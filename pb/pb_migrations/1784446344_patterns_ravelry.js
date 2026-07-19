/// <reference path="../pb_data/types.d.ts" />

// pb/pb_migrations/1784446344_patterns_ravelry.js
// Ravelry R1 — provenance fields (RAVELRY.md §6). `ravelry_id` is the R3 import script's
// idempotency key and the §3 #3 destroy-on-request marker; `ravelry_fetched_at` records when
// the metadata was pulled so any future staleness or deletion obligation stays honorable.
// Both optional, set by the save form only when a pattern originates from Ravelry; nothing
// renders them in v1. API rules unchanged — owner-writes already covers them.
migrate(
  (app) => {
    const patterns = app.findCollectionByNameOrId('patterns')
    patterns.fields.add(new NumberField({ name: 'ravelry_id', onlyInt: true }))
    patterns.fields.add(new DateField({ name: 'ravelry_fetched_at' }))
    app.save(patterns)
  },
  (app) => {
    const patterns = app.findCollectionByNameOrId('patterns')
    patterns.fields.removeByName('ravelry_fetched_at')
    patterns.fields.removeByName('ravelry_id')
    app.save(patterns)
  },
)
