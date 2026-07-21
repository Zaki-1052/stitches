/// <reference path="../pb_data/types.d.ts" />

// pb/pb_migrations/1784613470_yarn_stash.js
// Session 6.1 — the yarn stash (ADDONS §2): the `yarns` collection plus `projects.yarns`, one
// migration because the relation field needs the new collection's id. Mirrors the Session 1.1
// idioms; helpers are redeclared module-locally (migrations share no modules).
//
// Decisions carried in (docs/ADDONS.md §2, DECISIONS 2026-07-19/-20):
//   - Deletion is a quiet unlink, deliberately unlike patterns' blocked-while-linked guard:
//     yarn is consumable stash ("used the last skein, tidying up" is the normal delete), and
//     v0.39.6 auto-unlinks optional relations, so a deleted yarn silently leaves every
//     project's `yarns` array while projects and journals survive.
//   - The projects link guard ships OWN-YARNS-ONLY — the ADDONS §2.2 fallback, taken at a
//     proven wall (2026-07-20 gate): v0.39.6 evaluates an OR of two multi-relation dot-path
//     conditions per-aggregate (each arm ALL-quantified over the whole set), not per-row, so
//     a legitimate own+friend-shared mix fails both arms and the friends-linkable form can't
//     be expressed. Friend-shared yarns stay viewable and chip-renderable; they are not
//     linkable. DECISIONS 2026-07-20.
//   - No unique index: re-buying the same colorway is a legitimate duplicate.
//   - No schema-level defaults exist in v0.39.6 — an empty visibility never matches "friends",
//     so yarns are private until explicitly shared; the form supplies the display default.

const AUTHED = '@request.auth.id != ""'
const OWNER = 'owner = @request.auth.id'
// The update guard blocks owner transfer (SPEC §7) — same shape on every owned collection.
const OWNER_LOCK = '(@request.body.owner:isset = false || @request.body.owner = @request.auth.id)'

// SPEC §8: image fields accept only what every browser can decode (HEIC is converted client-side).
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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

// Own yarns only (see header); yarnless projects pass through the empty arm. Both arms carry
// 2026-07-20 gate findings: the empty check is the DOT-PATH form because bare `yarns = ""`
// does NOT match an empty multi-relation (an empty multi resolves like an empty array, while
// a dot-path over the empty set resolves to "" — the Session 1.1 back-relation semantics),
// and the owner check ALL-quantifies over the linked set, which is exactly what own-only needs.
const YARN_LINKABLE = '(yarns.id = "" || yarns.owner = @request.auth.id)'
const YARN_LINKABLE_UPDATE =
  '(@request.body.yarns:changed = false || @request.body.yarns.id = "" ||' +
  ' @request.body.yarns.owner = @request.auth.id)'

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id

    // ---- yarns — the stash: patterns-shaped sharing, quiet-unlink deletes. ----
    const yarns = new Collection({
      type: 'base',
      name: 'yarns',
      listRule: AUTHED + ' && (' + OWNER + ' || visibility = "friends")',
      viewRule: AUTHED + ' && (' + OWNER + ' || visibility = "friends")',
      createRule: OWNER,
      updateRule: OWNER + ' && ' + OWNER_LOCK,
      deleteRule: OWNER, // quiet unlink — see header
      fields: ownedFields(usersId, [
        { name: 'name', type: 'text', required: true },
        { name: 'brand', type: 'text' },
        { name: 'colorway', type: 'text' }, // freeform; real yarn colors are not patch tokens
        {
          // byte-identical to patterns.yarn_weight — labels come from web/src/lib/cyc.ts
          name: 'weight',
          type: 'select',
          maxSelect: 1,
          values: ['cyc_0', 'cyc_1', 'cyc_2', 'cyc_3', 'cyc_4', 'cyc_5', 'cyc_6', 'cyc_7', 'cyc_8'],
        },
        { name: 'fiber', type: 'text' },
        { name: 'yardage_per_skein', type: 'number' },
        { name: 'skein_count', type: 'number', min: 0 }, // linked, not tracked: no decrement math
        {
          // no separate thumbnail field — no import door feeds yarns; cards use photos[0]
          name: 'photos',
          type: 'file',
          maxSelect: 6,
          maxSize: 8 * MB,
          mimeTypes: IMAGE_MIMES,
          thumbs: IMAGE_THUMBS,
        },
        { name: 'notes', type: 'editor' },
        {
          name: 'visibility',
          type: 'select',
          maxSelect: 1,
          values: ['private', 'friends'],
        },
      ]),
      indexes: ['CREATE INDEX idx_yarns_owner ON yarns (owner)'],
    })
    app.save(yarns)

    // ---- projects gains the multi-link plus the guard, appended to the stored rules. ----
    const projects = app.findCollectionByNameOrId('projects')
    projects.fields.add(
      new RelationField({
        name: 'yarns',
        collectionId: yarns.id,
        maxSelect: 99,
        cascadeDelete: false, // yarn deletion quietly unlinks instead
      }),
    )
    projects.createRule = projects.createRule + ' && ' + YARN_LINKABLE
    projects.updateRule = projects.updateRule + ' && ' + YARN_LINKABLE_UPDATE
    app.save(projects)
  },
  (app) => {
    // PB stores resolved rule strings, not the JS that composed them, so the appended guard
    // can't be "subtracted" — restore the Session 1.1 (1783819397) compositions verbatim.
    const PATTERN_LINKABLE =
      '(pattern = "" || pattern.owner = @request.auth.id || pattern.visibility = "friends")'
    const projects = app.findCollectionByNameOrId('projects')
    projects.fields.removeByName('yarns')
    projects.createRule = OWNER + ' && ' + PATTERN_LINKABLE
    projects.updateRule =
      OWNER +
      ' && ' +
      OWNER_LOCK +
      ' && (@request.body.pattern:changed = false || @request.body.pattern = "" ||' +
      ' @request.body.pattern.owner = @request.auth.id ||' +
      ' @request.body.pattern.visibility = "friends")'
    app.save(projects)
    app.delete(app.findCollectionByNameOrId('yarns'))
  },
)
