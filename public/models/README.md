# Development content

Put models, textures and scene data here.

Anything in `public/` is copied into `dist/` and ships with the code bundle. That
has real costs, and today you pay them:

- every content change is a code deploy;
- rollback is a rebuild;
- and large binaries in git punish every clone forever.

So keep what lives here small — a placeholder or a low-poly stand-in — and prefer
procedural geometry while the app is still finding its shape.

## Where this is going

Content should version and roll back independently of code, on its own cadence.
The platform primitive for that — an immutable, signed, channel-resolved content
release — **does not exist yet**. There is no Onklave content release channel to
point at today, so `public/` is the only supported source in both development and
production.

What does exist is the seam: every asset URL goes through `resolveAssetUrl()`
(`src/asset-source.ts`), and setting `VITE_CONTENT_BASE_URL` resolves paths
against an external base instead of `/`. That already works for any static host
or CDN you control. When content releases land, adopting them is a config change
rather than a refactor — which is the whole reason the seam exists before the
thing it points at.

Until then, treat a growing `public/` as a signal to revisit, not as the plan.

## Formats

Runtime assets should be **GLB** (glTF 2.0 binary) — meshopt-compressed geometry,
KTX2 textures, metres, Y-up, −Z forward, right-handed. FBX and USD are
interchange formats: convert them, don't ship them.

CC0 sources that already fit that profile: Kenney, Quaternius, Poly Haven.
