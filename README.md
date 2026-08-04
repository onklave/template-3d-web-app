# 3D web app

An interactive browser 3D application, built with Vite + TypeScript and
[three.js](https://threejs.org), served as static assets by Onklave.

Generated from `onklave/template-3d-web-app`.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # -> dist/
npm test           # unit tests
npm run typecheck
```

## How this is deployed

Onklave builds the repo with the shipped `Dockerfile`: Vite emits `dist/`, and a
small dependency-free Go server serves it on **:3000** with a **`/health`**
route. The image runs non-root on a read-only root filesystem — no writable
paths, no privileged ports.

The contract is declared in `onklave.yaml` at the repo root — build context,
port, health path and exposed route. The platform reads that file; GitHub
Actions is not used, and a workflow cannot declare a service. To add a second
deployable, add another entry under `services` with its own build context and
`expose.path`.

Keep the Dockerfile, port and health route in step with `onklave.yaml`. If they
drift, the readiness probe fails and the pod CrashLoops.

## Code vs content — the thing to get right

A 3D app has two asset lifecycles, and conflating them is the usual mistake:

| | Code | Content |
|---|---|---|
| What | this bundle | models, textures, scene data |
| Ships on | deploy | its own cadence |
| Changes | with the repo | far more often, and much larger |
| Rollback | redeploy | a pointer move |

Everything that loads content goes through `resolveAssetUrl()` in
`src/asset-source.ts`. Unset, it resolves against the app's own origin —
`public/`. Set `VITE_CONTENT_BASE_URL` and it resolves against a content host
instead.

Because every asset URL is behind that one function, switching is a config
change, not a refactor. Keep it that way.

### The Onklave asset library

A content host that exists today, CC0-1.0, no credentials needed:

```
https://assets.onklave.app/catalog/index.json              totals + every pack
https://assets.onklave.app/catalog/packs/<slug>.json       object paths, bytes, sha256, previews
https://assets.onklave.app/catalog/characters/<slug>.json  clips, skins, accessories
```

**5,044 models across 50 packs** (median 11 KB, largest 0.9 MB) and **7 rigged
characters** carrying named animation clips and swappable skins. The catalog is
plain JSON served with CORS, so an app — or an agent deciding what to build —
reads it directly without cloning anything.

Point the app at it from `onklave.yaml`:

```yaml
    build:
      args:
        VITE_CONTENT_BASE_URL: https://assets.onklave.app
        VITE_MODEL_PATH: kenney/3.6.0/car-kit/ambulance.glb
```

Build args, not runtime env: Vite bakes `VITE_*` when `npm run build` runs in
the build pod, so setting them on the running container does nothing. They are
public by construction — never put a secret in one.

A future platform primitive — immutable, signed, channel-resolved content
releases, so promoting or rolling back a model set is a pointer move — is **not
built**. When it lands, adopting it changes this one config value, which is why
the seam exists ahead of it.

## Choosing a renderer

three.js is the template's **default**, not a commitment — it is the most widely
known and has the shallowest learning curve. PlayCanvas and Babylon.js are
equally valid: PlayCanvas for general interactive apps and configurators,
Babylon for simulation-, physics- or game-heavy products where its integrated
features cut implementation cost.

**Decide by measuring, not by feature checklist.** Benchmark your real workload
— actual asset sizes, draw counts and interaction model — against your frame
budget on representative hardware, including a mid-range laptop with integrated
graphics.

Engine-specific code is confined to `src/main.ts` and `src/scene.ts`.
`src/asset-source.ts` and the build/deploy contract are engine-neutral, so a
swap is bounded.

## Performance, before it bites

- Compress geometry (Draco/meshopt) and textures (KTX2). Raw glTF gets large
  fast.
- Ship a small first payload and stream the rest — time-to-first-render is what
  users judge.
- Cap `devicePixelRatio` (this template caps at 2); phones report 3–4 and the
  pixel cost climbs faster than the visible gain.
- Dispose geometries, materials and the renderer on teardown. Long-lived 3D
  pages leak fast, and a leak only surfaces after a long session.

## Accessibility

A canvas is invisible to assistive technology. `index.html` carries a text
equivalent in `#a11y-content`; keep it in step with the scene. Institutional
buyers — universities in particular — commonly require WCAG conformance in
procurement, so treat it as a requirement rather than a nicety.

## Layout

```
index.html          page shell + accessible text equivalent
src/main.ts         entry point, error handling, teardown
src/scene.ts        scene construction (engine-specific)
src/asset-source.ts content URL resolution (engine-neutral)
public/             dev-time content; production content comes from a release
server/             tiny Go static server used by the image
Dockerfile          Vite build -> distroless, non-root, :3000, /health
onklave.yaml        deploy manifest the platform reads (build, port, route)
```
