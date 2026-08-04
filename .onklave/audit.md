# Template audit

- **Last audited:** 2026-08-04
- **Audited by:** Onklave platform maintenance (automated, Claude Code)
- **Next review due:** 2026-11-04 (quarterly, or sooner on a dependency alert)

## Why this file exists
So we know when this template was last deliberately checked, and what was true at
the time. Apps are generated from this repo — stale or vulnerable dependencies
here propagate to every app created from it.

## Scope of this audit
- The npm dependency tree (`three`, `@types/three`, `typescript`, `vite`,
  `vitest`) — advisory status, how far behind latest, and whether an upgrade
  survives typecheck + build + tests.
- The Go static server in `server/` — toolchain currency, `go vet`, `gofmt`,
  `govulncheck`, and a review of its serving defaults.
- The `Dockerfile` and `.dockerignore` — base image currency, non-root
  execution, build-context hygiene, secret leakage into the shipped artifact.
- The committed tree, scanned for secrets.
- End-to-end reality check: `docker build`, then the container actually run
  under the platform's runtime constraints (read-only root filesystem,
  `no-new-privileges`, forced non-root uid) and probed over HTTP.

Not in scope: the rendered 3D output itself (no GPU/browser rendering check was
performed — WebGL correctness is not verified by these tests), and
`onklave.yaml`, which was written and verified in a previous pass and is
deliberately untouched.

## Verification run
No Go toolchain is installed on the audit host, so every Go command was run
inside `golang:1.26-alpine` (`go1.26.5`) against the `server/` directory —
the same toolchain the Dockerfile builds with.

| Check | Command | Result |
|---|---|---|
| Clean install from lockfile | `npm ci` | Pass — 64 packages, 0 vulnerabilities |
| Type check | `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) | Pass — 0 errors |
| Type check, library types included | `npx tsc --noEmit --skipLibCheck false` | Pass — 0 errors (diagnostic only; `skipLibCheck` stays on in `tsconfig.json`) |
| Type checker negative control | temporary `const x: number = "s"` in `src/scene.ts` | Correctly failed with TS2322 + TS6133, then reverted — confirms the typecheck is real, not a no-op |
| Production build | `npm run build` (vite 8.2.0) | Pass — `dist/index.html` 1.08 kB, CSS 0.44 kB, JS 518.86 kB (129.76 kB gzip) |
| Web unit tests | `npm test` (vitest 4.1.10) | Pass — 1 file, 3 tests |
| npm advisories | `npm audit` | Pass — 0 vulnerabilities |
| npm currency | `npm outdated` | Clean — nothing outdated (was 4 packages behind before this audit) |
| three.js runtime symbols | `node -e "import('three')"` — assert the 9 symbols `scene.ts` imports | Pass — `REVISION 185`, all present |
| Go formatting | `gofmt -l .` | Pass — clean |
| Go vet | `go vet ./...` | Pass — no findings |
| Go tests | `go test ./...` | Pass — 4 tests (added in this audit; the package previously had no test files) |
| Go vulnerabilities | `go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...` | Pass — "No vulnerabilities found." |
| Secret scan | `git grep -nEi '(api[_-]?key\|secret\|password\|token\|BEGIN .*PRIVATE KEY\|AKIA…\|ghp_…\|xox…)'` over all tracked files | Pass — no matches |
| Image build | `docker build -t template-3d-web-app:audit2 .` | Pass |
| Image runs non-root | `docker inspect --format '{{.Config.User}}'` | Pass — `65532` |
| Container smoke test | `docker run --read-only --security-opt no-new-privileges --user 10001 -p 39100:3000 …` + `curl` | Pass — starts and serves under a forced non-root uid on a read-only rootfs |
| Health probe | `curl /health` | Pass — 200 `ok` |
| Site root | `curl /` | Pass — 200, `text/html; charset=utf-8` |
| Hashed asset | `curl /assets/index-*.js` | Pass — 200 |
| Directory listing | `curl /assets/` | Pass — 404 (was a 200 index-of page before this audit) |
| Response headers | `curl -D -` | Pass — `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

## Dependency status

npm packages:

| Package | Before | After | Note |
|---|---|---|---|
| `three` | 0.185.1 ← 0.182.0 | **0.185.1** | Upgraded. Three releases behind (r182 → r185). |
| `@types/three` | 0.182.0 | **0.185.3** | Upgraded in lockstep with `three`. |
| `typescript` | 6.0.3 | **7.0.2** | Major upgrade, applied. |
| `vitest` | 3.2.7 | **4.1.10** | Major upgrade, applied. |
| `vite` | 8.2.0 | **8.2.0** | Already latest; only the declared floor moved (`^8.0.16` → `^8.2.0`). |

`npm outdated` is now empty and `npm audit` reports 0 vulnerabilities.

On the three.js bump specifically: because three uses `0.x` versioning, every
release is a semver-major to npm, so the previous `^0.182.0` range could never
have picked up r183–r185 on its own — the template would have drifted silently.
It was applied rather than deferred because the template's engine surface is
nine core symbols (`WebGLRenderer`, `Scene`, `PerspectiveCamera`, `BoxGeometry`,
`MeshStandardMaterial`, `Mesh`, `AmbientLight`, `DirectionalLight`, `Clock`),
all long-stable; the upgrade was verified by a typecheck *with library types
included* against `@types/three` 0.185.3, a runtime import asserting all nine
symbols exist at `REVISION 185`, plus a clean build and test run. Bundle cost:
497.85 kB → 518.86 kB minified (125.66 → 129.76 kB gzip).

TypeScript 7 and vitest 4 were applied on the same basis — every check above
passes, including a full library typecheck and a negative control proving the
compiler still rejects bad code. See Open items for the residual risk on TS 7.

Deliberately **not** changed:

- **`server/go.mod` `go 1.23` directive.** It is a compatibility floor, not a
  pin, and the image builds with go1.26.5. Raising it would only narrow which
  toolchains can build a generated app, for no gain — this code uses nothing
  newer.
- **Digest pinning of base images.** See finding 6; it needs an automated bump
  story before it is an improvement.

Toolchain / base images:

| Image | Before | After | Note |
|---|---|---|---|
| Build (web) | `node:22-alpine` | **`node:24-alpine`** | Node 22 (Jod) is in maintenance LTS; 24 (Krypton) is active LTS. Build stage only — it does not ship into the runtime image. |
| Build (server) | `golang:1.26-alpine` | unchanged | go1.26.5 is the current stable release. |
| Runtime | `gcr.io/distroless/static-debian12:nonroot` | **`gcr.io/distroless/static-debian13:nonroot`** | Current distroless base; still `nonroot` (uid 65532). |

## Findings

1. **(medium) Directory listing was enabled on the static server.** `GET
   /assets/` returned Go's built-in index-of page listing every file. This
   matters more in this template than most: it is a 3D app whose entire content
   model is "drop files in `public/` and they ship verbatim", so a listing turns
   every unreferenced work-in-progress model or texture from unlinked into
   discoverable. **Fixed** — `server/main.go` now serves a directory only when
   it contains an `index.html`, and 404s otherwise. Covered by a test.

2. **(medium) `.dockerignore` did not exclude local env files.** The web stage
   does `COPY . .`, and Vite loads `.env*` at build time and inlines every
   `VITE_`-prefixed value into the shipped bundle. `.gitignore` covers `*.local`
   but `.dockerignore` did not, so a developer's uncommitted `.env.local` would
   have entered the build context and any `VITE_`-prefixed secret in it would
   have been baked into a public artifact. **Fixed** — `*.local`, `.env.local`,
   `.env.*.local`, `.gitignore` and `.DS_Store` are now excluded, with a comment
   explaining why so it is not silently dropped later.

3. **(low) No connection timeouts on the HTTP server.** `http.ListenAndServe`
   applies no read/idle deadline, so a stalled client can hold a connection open
   indefinitely (Slowloris; `gosec` G112). **Fixed** — an explicit
   `http.Server` with `ReadHeaderTimeout` 10s, `ReadTimeout` 30s, `IdleTimeout`
   120s. `WriteTimeout` is deliberately left unset: 3D payloads are large and a
   phone on a slow link is a legitimate long write that a timeout would truncate
   mid-download.

4. **(low) No baseline security response headers.** **Partially fixed** —
   `X-Content-Type-Options: nosniff` and `Referrer-Policy:
   strict-origin-when-cross-origin` are now set for every response.
   `X-Frame-Options`/`frame-ancestors` and `Content-Security-Policy` were
   deliberately **not** set: embedding a 3D viewer in another page is a
   legitimate use of this template, and a useful CSP depends on where a given
   app loads content from. The hook point and a comment explaining the decision
   are in `securityHeaders` in `server/main.go`.

5. **(low) Base images were behind.** Node build image on maintenance LTS,
   distroless runtime on Debian 12. **Fixed** — `node:24-alpine` and
   `gcr.io/distroless/static-debian13:nonroot`. Image rebuilt and re-smoke-tested.

6. **(low) Base images are referenced by mutable tag, not digest.** `node:24-alpine`
   and friends can move under the template. **Not fixed — recommended.** Digest
   pins only help if something bumps them; pinned digests in a template with no
   automated bump go stale and end up *worse* than a floating tag. Recommended
   action: adopt digest pins together with Renovate/Dependabot on this repo, as
   one change.

7. **(low, informational) `server/go.mod` declares `go 1.23`** while the image
   builds with go1.26.5. Harmless — it is a floor and the module compiles and
   vets clean — but it means the compiler applies 1.23 language semantics.
   **Not changed** (see Dependency status). Revisit if the server ever needs a
   newer language feature.

8. **(low, informational) The bundle now trips Vite's 500 kB chunk warning.**
   three r185 pushed the single chunk to 518.86 kB minified (129.76 kB gzip), so
   every generated app's build output now carries a chunk-size warning. Nothing
   is broken and gzip transfer size is fine. **Not changed** — raising
   `chunkSizeWarningLimit` would suppress a signal worth keeping, and code
   splitting is an app-level decision. See Open items.

9. **No secrets committed.** The tracked tree is 18 files; a pattern scan for
   keys, tokens, passwords and private-key headers found nothing. The runtime
   image contains only the built `dist/` and a static Go binary — no source, no
   `node_modules`, no git history, no shell, no package manager.

10. **Non-root execution confirmed, not just declared.** The image ships
    `USER 65532` and was additionally verified running under a *forced*
    `--user 10001` (the uid the platform uses) with `--read-only` and
    `--security-opt no-new-privileges` — it starts and serves correctly, so the
    Dockerfile's claim about the platform's runtime constraints holds.

## Changes made in this audit
- Upgraded `three` 0.182.0 → 0.185.1 and `@types/three` 0.182.0 → 0.185.3.
- Upgraded `typescript` 6.0.3 → 7.0.2 and `vitest` 3.2.7 → 4.1.10.
- Raised the declared `vite` floor `^8.0.16` → `^8.2.0` (already-installed version).
- `server/main.go`: suppressed directory listings; added `ReadHeaderTimeout` /
  `ReadTimeout` / `IdleTimeout`; added `nosniff` and `Referrer-Policy` headers;
  extracted `newHandler(http.FileSystem)` so the above is testable.
- `server/main_test.go` (new): 4 tests covering the health probe, asset serving,
  directory-listing suppression and the security headers. The package had no
  tests before.
- `Dockerfile`: `node:22-alpine` → `node:24-alpine`;
  `distroless/static-debian12` → `static-debian13`; server stage copies
  `server/*.go` rather than only `main.go`, so a generated app that splits the
  server across files still builds.
- `.dockerignore`: excluded local env files, `.gitignore` and `.DS_Store`, with
  a comment explaining the Vite build-time inlining risk.
- Added this file.

`onklave.yaml` was not modified.

## Open items
1. **Decide whether to hold `typescript` at 6.x.** TS 7 is the native port and
   is npm `latest`; everything in this repo passes under it, including a
   library-inclusive typecheck and a negative control. But this template's
   surface is small and a generated app's will not be, and 7.0.2 is early in
   its line. If the team wants a conservative floor for customer-generated
   apps, pin `typescript@^6.0.3` — nothing else here depends on 7.
2. **Adopt Renovate or Dependabot on this repo, and pin base images by digest
   in the same change** (finding 6). `three` had drifted three releases behind
   with no signal, and its `0.x` versioning means a caret range will *never*
   surface the drift — this template needs an automated nudge, not a quarterly
   human one, to stay current between audits.
3. **Decide the chunking story** (finding 8): code-split three.js out of the
   entry chunk via dynamic `import()`, or accept the warning. Worth deciding
   deliberately since every generated app inherits it.
4. **Consider whether generated apps should ship a CSP** (finding 4). The
   decision belongs to the app, but the platform could offer a default for the
   common case; `securityHeaders` in `server/main.go` is the hook point.
5. **No rendering verification exists.** Every check here is static or
   HTTP-level; nothing confirms the scene actually draws. If three.js upgrades
   are going to be applied automatically, a headless WebGL smoke test is the
   missing safety net.
