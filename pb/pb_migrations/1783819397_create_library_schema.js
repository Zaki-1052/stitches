/// <reference path="../pb_data/types.d.ts" />

// pb/pb_migrations/1783819397_create_library_schema.js
// Session 1.1 — the full SPEC §7 library data model: tags, patterns, pattern_attachments,
// projects, journal_entries, counters. One migration set because the six collections form one
// dependency graph (relation fields need the referenced collection's id, so order matters):
// tags → patterns → pattern_attachments → projects → journal_entries → counters.
//
// Deviations from SPEC §7's literal text, agreed with Zara (docs/DECISIONS.md 2026-07-11):
//   - Visibility-aware read rules are auth-gated: the literal `owner = @request.auth.id ||
//     visibility = "friends"` would match shared records for anonymous requests too.
//   - Parent relations (attachment→pattern, entry→project, counter→project) are locked on
//     update (`:changed = false`): otherwise an owner could re-point their record into a
//     friend's shared parent, injecting content into that friend's feed.
//   - patterns.deleteRule carries a back-relation guard: v0.39.6 blocks deletes only for
//     *required* references and silently auto-unlinks optional ones, so SPEC's "deleting a
//     pattern with linked projects is blocked" needs a rule to be true. scripts/rules-check.mjs
//     proves the empty-back-relation semantics empirically.
//   - owner relations cascade-delete: deleting an account wipes that person's content.
//   - PocketBase has no schema-level field defaults, so SPEC's "default" selects ship optional.
//     An empty visibility never matches "friends" — records are private until explicitly shared;
//     the Session 1.2 forms supply the display defaults (crochet / saved / planned / private).

const AUTHED = '@request.auth.id != ""'
const OWNER = 'owner = @request.auth.id'
// The update guard blocks owner transfer (SPEC §7) — same shape on every owned collection.
const OWNER_LOCK = '(@request.body.owner:isset = false || @request.body.owner = @request.auth.id)'

// SPEC §8: image fields accept only what every browser can decode (HEIC is converted client-side).
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// `?thumb=` serves only pre-declared sizes: square crop for chips/avatars, 400/800 wide for
// grids and detail views (SPEC §8 "lists never load originals").
const IMAGE_THUMBS = ['100x100', '400x0', '800x0']

const MB = 1048576

// owner + created/updated on every collection: PB auto-adds only `id` when creating in code.
function ownedFields(usersId, fields) {
  return [
    {
      name: 'owner',
      type: 'relation',
      collectionId: usersId,
      required: true,
      maxSelect: 1,
      cascadeDelete: true,
    },
  ].concat(fields, [
    { name: 'created', type: 'autodate', onCreate: true },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ])
}

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id

    // ---- tags — reads open to any signed-in user: shared patterns must render their tags. ----
    const tags = new Collection({
      type: 'base',
      name: 'tags',
      listRule: AUTHED,
      viewRule: AUTHED,
      createRule: OWNER,
      updateRule: OWNER + ' && ' + OWNER_LOCK,
      deleteRule: OWNER,
      fields: ownedFields(usersId, [
        { name: 'name', type: 'text', required: true },
        {
          name: 'color',
          type: 'select',
          maxSelect: 1,
          values: ['blue', 'coral', 'lilac', 'mint', 'butter'],
        },
      ]),
      indexes: ['CREATE UNIQUE INDEX idx_tags_owner_name ON tags (owner, name)'],
    })
    app.save(tags)

    // ---- patterns — the library. ----
    const patterns = new Collection({
      type: 'base',
      name: 'patterns',
      listRule: AUTHED + ' && (' + OWNER + ' || visibility = "friends")',
      viewRule: AUTHED + ' && (' + OWNER + ' || visibility = "friends")',
      createRule: OWNER,
      updateRule: OWNER + ' && ' + OWNER_LOCK,
      // The blocked-while-linked delete guard is set after `projects` exists (below) — its
      // back-relation reference can't validate against a collection that isn't created yet.
      deleteRule: OWNER,
      fields: ownedFields(usersId, [
        { name: 'title', type: 'text', required: true },
        { name: 'designer', type: 'text' },
        { name: 'source_url', type: 'url' },
        { name: 'source_name', type: 'text' },
        {
          name: 'craft',
          type: 'select',
          maxSelect: 1,
          values: ['crochet', 'knitting', 'tunisian', 'other'],
        },
        {
          name: 'yarn_weight',
          type: 'select',
          maxSelect: 1,
          values: ['cyc_0', 'cyc_1', 'cyc_2', 'cyc_3', 'cyc_4', 'cyc_5', 'cyc_6', 'cyc_7', 'cyc_8'],
        },
        { name: 'hook_mm', type: 'number' },
        { name: 'gauge', type: 'text' },
        { name: 'yardage', type: 'number' },
        { name: 'yardage_max', type: 'number' },
        {
          name: 'difficulty',
          type: 'select',
          maxSelect: 1,
          values: ['beginner', 'easy', 'intermediate', 'experienced'],
        },
        {
          name: 'shelf',
          type: 'select',
          maxSelect: 1,
          values: ['saved', 'want_to_make', 'queued'],
        },
        {
          name: 'visibility',
          type: 'select',
          maxSelect: 1,
          values: ['private', 'friends'],
        },
        {
          name: 'tags',
          type: 'relation',
          collectionId: tags.id,
          maxSelect: 99,
          cascadeDelete: false, // deleting a tag just unsets it from patterns
        },
        {
          name: 'thumbnail',
          type: 'file',
          maxSelect: 1,
          maxSize: 5 * MB,
          mimeTypes: IMAGE_MIMES,
          thumbs: IMAGE_THUMBS,
        },
        {
          name: 'photos',
          type: 'file',
          maxSelect: 10,
          maxSize: 8 * MB,
          mimeTypes: IMAGE_MIMES,
          thumbs: IMAGE_THUMBS,
        },
        { name: 'notes', type: 'editor' },
      ]),
      indexes: ['CREATE INDEX idx_patterns_owner ON patterns (owner)'],
    })
    app.save(patterns)

    // ---- pattern_attachments — the copyright vault: owner-only everywhere, files Protected. ----
    const attachments = new Collection({
      type: 'base',
      name: 'pattern_attachments',
      listRule: OWNER,
      viewRule: OWNER,
      createRule: OWNER + ' && pattern.owner = @request.auth.id',
      updateRule: OWNER + ' && ' + OWNER_LOCK + ' && @request.body.pattern:changed = false',
      deleteRule: OWNER,
      fields: ownedFields(usersId, [
        {
          name: 'pattern',
          type: 'relation',
          collectionId: patterns.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true, // the vault dies with its pattern
        },
        { name: 'label', type: 'text' },
        {
          name: 'files',
          type: 'file',
          maxSelect: 10,
          maxSize: 30 * MB, // vintage scans get chunky (SPEC §13 sizes Nginx for this)
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          protected: true, // served only with a short-lived file token (SPEC §7)
        },
        { name: 'pattern_text', type: 'editor' },
      ]),
    })
    app.save(attachments)

    // ---- projects — the journal's spine. pattern link optional: improvised makes are
    // first-class. Linking requires the pattern to be yours or friends-visible. ----
    const PATTERN_LINKABLE =
      '(pattern = "" || pattern.owner = @request.auth.id || pattern.visibility = "friends")'
    const projects = new Collection({
      type: 'base',
      name: 'projects',
      listRule: AUTHED + ' && (' + OWNER + ' || visibility = "friends")',
      viewRule: AUTHED + ' && (' + OWNER + ' || visibility = "friends")',
      createRule: OWNER + ' && ' + PATTERN_LINKABLE,
      updateRule:
        OWNER +
        ' && ' +
        OWNER_LOCK +
        ' && (@request.body.pattern:changed = false || @request.body.pattern = "" ||' +
        ' @request.body.pattern.owner = @request.auth.id ||' +
        ' @request.body.pattern.visibility = "friends")',
      deleteRule: OWNER,
      fields: ownedFields(usersId, [
        {
          name: 'pattern',
          type: 'relation',
          collectionId: patterns.id,
          maxSelect: 1,
          cascadeDelete: false, // pattern deletion is instead blocked by patterns.deleteRule
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['planned', 'in_progress', 'finished', 'frogged', 'hibernating'],
        },
        { name: 'started_on', type: 'date' },
        { name: 'finished_on', type: 'date' },
        { name: 'hook_mm', type: 'number' },
        { name: 'yarn_used', type: 'text' },
        { name: 'summary', type: 'editor' }, // the pinned summary
        {
          name: 'cover',
          type: 'file',
          maxSelect: 1,
          maxSize: 8 * MB,
          mimeTypes: IMAGE_MIMES,
          thumbs: IMAGE_THUMBS,
        },
        {
          name: 'visibility',
          type: 'select',
          maxSelect: 1,
          values: ['private', 'friends'],
        },
      ]),
      indexes: ['CREATE INDEX idx_projects_owner ON projects (owner)'],
    })
    app.save(projects)

    // Now that `projects` exists, patterns get their blocked-while-linked delete guard:
    // match-all over the back-relation holds vacuously when zero linked projects exist and
    // fails as soon as one does (SPEC §7's "blocked"; PB auto-unlinks optional refs otherwise).
    patterns.deleteRule = OWNER + ' && projects_via_pattern.id = ""'
    app.save(patterns)

    // ---- journal_entries — visibility inherited from the project: sharing a project shares
    // its story. ----
    const entries = new Collection({
      type: 'base',
      name: 'journal_entries',
      listRule: AUTHED + ' && (' + OWNER + ' || project.visibility = "friends")',
      viewRule: AUTHED + ' && (' + OWNER + ' || project.visibility = "friends")',
      createRule: OWNER + ' && project.owner = @request.auth.id',
      updateRule: OWNER + ' && ' + OWNER_LOCK + ' && @request.body.project:changed = false',
      deleteRule: OWNER,
      fields: ownedFields(usersId, [
        {
          name: 'project',
          type: 'relation',
          collectionId: projects.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true, // a project's diary dies with it
        },
        { name: 'entry_date', type: 'date', required: true }, // editable → backdating works
        { name: 'body', type: 'editor' },
        {
          name: 'photos',
          type: 'file',
          maxSelect: 6,
          maxSize: 8 * MB,
          mimeTypes: IMAGE_MIMES,
          thumbs: IMAGE_THUMBS,
        },
      ]),
      indexes: ['CREATE INDEX idx_journal_entries_project ON journal_entries (project)'],
    })
    app.save(entries)

    // ---- counters — personal process: never visible to friends, even on shared projects. ----
    const counters = new Collection({
      type: 'base',
      name: 'counters',
      listRule: OWNER,
      viewRule: OWNER,
      createRule: OWNER + ' && project.owner = @request.auth.id',
      updateRule: OWNER + ' && ' + OWNER_LOCK + ' && @request.body.project:changed = false',
      deleteRule: OWNER,
      fields: ownedFields(usersId, [
        {
          name: 'project',
          type: 'relation',
          collectionId: projects.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'number', min: 0 },
        { name: 'target', type: 'number' },
      ]),
      indexes: ['CREATE INDEX idx_counters_project ON counters (project)'],
    })
    app.save(counters)

    // resets_with is a self-relation, so it can only be added once `counters` has an id.
    // Same-project linking and no-reset-loops stay client-enforced per SPEC §7.
    counters.fields.add(
      new RelationField({
        name: 'resets_with',
        collectionId: counters.id,
        maxSelect: 1,
        cascadeDelete: false, // deleting the linked counter just unsets the link
      }),
    )
    app.save(counters)
  },
  (app) => {
    // Reverse dependency order.
    const names = [
      'counters',
      'journal_entries',
      'projects',
      'pattern_attachments',
      'patterns',
      'tags',
    ]
    for (const name of names) {
      app.delete(app.findCollectionByNameOrId(name))
    }
  },
)
