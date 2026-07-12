/// <reference path="../pb_data/types.d.ts" />

// pb/pb_migrations/1783806920_configure_users.js
// Session 0.2 — configure the built-in `users` auth collection (SPEC §7/§9).
// The locked createRule IS the invite gate: only superusers can create accounts, there is no
// public signup. A fresh PocketBase v0.39.6 install already ships a `users` auth collection, so
// this edits it in place (idempotent: absolute assignments only, no field add/remove).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // Access rules — any authenticated user may read; self may update; create/delete locked.
    users.listRule = '@request.auth.id != ""'
    users.viewRule = '@request.auth.id != ""'
    users.createRule = null // locked — invite gate (superusers only)
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = null // locked

    // Password auth only — no OAuth, OTP, or MFA.
    users.passwordAuth.enabled = true
    users.oauth2.enabled = false
    users.otp.enabled = false
    users.mfa.enabled = false

    // 90-day auth token so nobody re-logs-in on their phone every two weeks.
    users.authToken.duration = 7776000

    // Profile fields: name required, avatar capped at 5 MB.
    users.fields.getByName('name').required = true
    users.fields.getByName('avatar').maxSize = 5242880

    app.save(users)
  },
  (app) => {
    // Revert to the PocketBase v0.39.6 fresh-install defaults.
    const users = app.findCollectionByNameOrId('users')

    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'

    users.authToken.duration = 432000

    users.fields.getByName('name').required = false
    users.fields.getByName('avatar').maxSize = 0

    app.save(users)
  },
)
