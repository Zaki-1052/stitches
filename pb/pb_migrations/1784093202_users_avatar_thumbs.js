/// <reference path="../pb_data/types.d.ts" />

// pb/pb_migrations/1784093202_users_avatar_thumbs.js
// Session 4.1 — declare a 100x100 thumb on users.avatar so the friends feed, shared-by chips,
// and the header load avatar thumbnails instead of originals (SPEC §8 "lists never load
// originals"; DECISIONS 2026-07-11 thumbs precedent). PB serves `?thumb=` only for pre-declared
// sizes and generates them lazily on first request, so existing avatars need no backfill.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.getByName('avatar').thumbs = ['100x100']
    app.save(users)
  },
  (app) => {
    // Revert to the fresh-install default (no declared thumb sizes).
    const users = app.findCollectionByNameOrId('users')
    users.fields.getByName('avatar').thumbs = []
    app.save(users)
  },
)
