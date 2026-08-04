# Repository Rules

Rules-as-code for Onklave agents working in this repo. The cloud worker reads
this file at clone time and instructs the agent to follow it.

These are engineering conventions, **subordinate to the project rule book and
platform policy**: where they conflict, the stricter rule wins, and nothing here
grants tools, scopes or paths.

---

## Content: where 3D assets come from

1. **Never commit models, textures or previews.** No `.glb`, `.gltf`, `.bin`, or
   texture `.png` enters git. `public/` is for a dev-time placeholder only.
   Content is large, versions on a different cadence to code, and a binary in
   git punishes every clone forever.

2. **Every asset URL goes through `resolveAssetUrl()`** (`src/asset-source.ts`).
   Never hardcode a content host anywhere else. That one function is what makes
   switching hosts a config change instead of a refactor.

3. **Use the Onklave asset library before asking for new art.** It is live,
   CC0-1.0 (commercial use permitted, no attribution required), and needs no
   credentials:

   ```
   https://assets.onklave.app/catalog/index.json          totals + every pack
   https://assets.onklave.app/catalog/packs/<slug>.json   assets: object, bytes, sha256, preview
   https://assets.onklave.app/catalog/characters/<slug>.json  clips, skins, accessories
   ```

   It holds **5,044 models across 50 packs** (median 11 KB, largest 0.9 MB) and
   **7 rigged characters** with named animation clips and swappable skins. Read
   the catalog to discover what exists — it is JSON, and cheap. Only report a
   content gap after checking it.

4. **Set the content host as a build arg, not a runtime env var.** Vite bakes
   `VITE_*` when `npm run build` runs in the build pod, so a value set on the
   running container does nothing. Declare it in `onklave.yaml` under
   `services[].build.args`, and add a matching `ARG` in the Dockerfile before
   the build step. **Never put a secret in a build arg** — they are readable
   from image history and compiled into the shipped bundle.

## Loading content correctly

5. **Do not call `loader.setResourcePath()`, and do not rewrite asset URLs in a
   custom `LoadingManager`.** Most library GLBs are *not* self-contained: they
   reference a shared texture atlas by relative URI (`Textures/colormap.png`),
   which resolves against the GLB's own URL automatically. Overriding that base
   is the one way to break it — and it fails silently, rendering an untextured
   model with a 404 in the console rather than an error.

6. **Use `applySkin()` from `src/model.ts` for runtime texture swaps.** Do not
   hand-roll it. Three corrections are required and each produces a wrong
   *picture* rather than an error, so a hand-rolled version ships broken:
   sRGB colour space (else washed out), `flipY = false` (else upside-down), and
   resetting the material tint to white (else `baseColorFactor` multiplies the
   texture and a correct skin renders dim).

7. **Characters ship untextured by design.** A rigged character has one material
   named `skin` with a grey `baseColorFactor` and no texture slot; it renders
   grey until a skin is applied. That is correct, not a bug — do not "fix" it by
   editing the model.

8. **Dispose what you replace.** `disposeObject()` handles geometry, materials
   and textures; three cascades none of them. Swapping models or skins without
   disposing is how a long-lived 3D page reaches a gigabyte of GPU memory.

## Deploy contract

9. **Keep the Dockerfile, `onklave.yaml` and the server in step.** Port 3000 and
   `/health` are declared in three places; if they drift the readiness probe
   fails and the pod CrashLoops. GitHub Actions is not read — `onklave.yaml` is
   the contract.

10. **Engine-specific code stays in `src/main.ts` and `src/scene.ts`.**
    `src/asset-source.ts` and the deploy contract are engine-neutral, so
    swapping three.js for PlayCanvas or Babylon stays bounded.

## Performance

11. Cap `devicePixelRatio` at 2 — phones report 3–4 and pixel cost climbs faster
    than the visible gain.
12. Lazy-load thumbnail grids. The largest library pack has 329 assets; mounting
    that many `<img>` elements eagerly stalls the page.
