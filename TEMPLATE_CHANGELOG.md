# Template changelog

Templates are **scaffold-once** — a generated repo forks from this history and
receives nothing afterwards. This file makes a retrofit mechanical: read from
your `.onklave/template.json` version up to the current one and apply what
applies.

Check for drift:

```bash
cat .onklave/template.json                                              # yours
gh api repos/onklave/template-3d-web-app/contents/.onklave/template.json \
  --jq '.content' | base64 -d                                           # current
```

---

## 1.2.0 — 2026-08-05

- **`.onklave/template.json`** — this marker. Repos generated before 1.2.0 have
  no marker at all; that absence means "1.0.0 or earlier".
- **`.onklave/rules.md`** — read by the cloud worker at clone time, so an agent
  working in the repo is actually told about the asset library and the traps
  that fail silently. Adds the three 3D constraints (skeleton cloning,
  server-authoritative collision, degrade-don't-fail).

**Retrofit:** copy both files.

## 1.1.0 — 2026-08-04

- **`src/model.ts` + `src/model.test.ts`** — `loadModel`, `fitToFrame`,
  `disposeObject`, `applySkin`. `applySkin` encodes three corrections that each
  produce a wrong *picture* rather than an error: sRGB colour space, `flipY =
  false`, and resetting the material tint to white so `baseColorFactor` does not
  multiply the skin dim. Plus an `isCurrent` guard so a slow texture fetch
  cannot paint itself onto a model the user already moved past.
- **`disposeObject`** now disposes `material.map`. Three does not cascade to
  textures, so a swapped-in skin outlived the model it was applied to.
- **`onklave.yaml` `build.args` + `Dockerfile` `ARG`** — Vite bakes `VITE_*` at
  build time, so the content host cannot be a runtime env var. This is the only
  path by which it can reach the app.
- **`src/asset-source.ts`, `README.md`, `public/models/README.md`** — stopped
  claiming Onklave content releases exist. They do not (platform gap P4);
  `https://assets.onklave.app` does.

**Retrofit:** copy `src/model.ts` and its test; add the `ARG`/`build.args` pair;
replace `src/asset-source.ts`; re-read the two READMEs.

## 1.0.0

Initial: Vite + TypeScript + three.js, distroless Go static server on :3000
with `/health`, `onklave.yaml` deploy contract.
