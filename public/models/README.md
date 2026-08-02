# Development content

Put models, textures and scene data here **for local development only**.

Anything in `public/` is copied into `dist/` and ships with the code bundle —
which is exactly what you do *not* want for production content:

- it makes every content change a code deploy;
- it makes rollback a rebuild;
- and large binaries in git punish every clone forever.

For production, set `VITE_CONTENT_BASE_URL` to an Onklave content release
channel and load through `resolveAssetUrl()` (`src/asset-source.ts`). Content
releases are immutable, signed, and resolved per channel — so promoting or
rolling back a model set is a pointer move.

Keep what lives here small: a placeholder or a low-poly stand-in, enough to run
the app offline.
