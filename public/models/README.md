# Development content

Put models, textures and scene data here.

Anything in `public/` is copied into `dist/` and ships with the code bundle. That
has real costs, and today you pay them:

- every content change is a code deploy;
- rollback is a rebuild;
- and large binaries in git punish every clone forever.

So keep what lives here small — a placeholder or a low-poly stand-in — and prefer
procedural geometry while the app is still finding its shape.

## Use the asset library instead

For most 3D apps you do not need to source content at all. The **Onklave asset
library** is live and CC0-1.0 (commercial use permitted, no attribution
required):

```
https://assets.onklave.app/catalog/index.json
```

5,044 models across 50 packs, plus 7 rigged characters with named animation
clips and swappable skins. Set `VITE_CONTENT_BASE_URL` to
`https://assets.onklave.app` — via `onklave.yaml` `build.args`, since Vite bakes
`VITE_*` at build time — and load by object path. Nothing is downloaded at build
time and no content enters the bundle.

To pull assets into a repo anyway — offline work, a test fixture, a build step
that processes them — use `tools/pull.mjs` in the `onklave/asset-library` repo.
Every download is verified against the catalog's sha256.

The platform primitive for content that versions independently — an immutable,
signed, channel-resolved content release — **does not exist yet**. The seam
does: every asset URL goes through `resolveAssetUrl()` (`src/asset-source.ts`),
so adopting releases later is a config change rather than a refactor.

Treat a growing `public/` as a signal to revisit, not as the plan.

## Formats

Runtime assets should be **GLB** (glTF 2.0 binary) — meshopt-compressed geometry,
KTX2 textures, metres, Y-up, −Z forward, right-handed. FBX and USD are
interchange formats: convert them, don't ship them.

CC0 sources that already fit that profile: Kenney, Quaternius, Poly Haven.
