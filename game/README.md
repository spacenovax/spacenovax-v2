# NOVA-X1 Genesis Defense

This folder is the standalone game deployment for `game.spacenovax.com`.

## Deploy

Set the hosting service root directory to `game`, then use:

```text
npm install
npm run build
```

Attach `game.spacenovax.com` to that deployment. The SpaceNovaX Mini App adds
the short-lived `session` and `api` query parameters automatically. Do not
place either `GAME_LAUNCH_SECRET` or `GAME_REWARD_SECRET` in this game build.
Those secrets stay only in the main SpaceNovaX server environment.

For production, set `GAME_LAUNCH_SECRET` in the main Render service and set
`GAME_ORIGIN=https://game.spacenovax.com` there as well.
