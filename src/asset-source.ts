/**
 * Where 3D assets come from.
 *
 * A browser 3D app has two asset lifecycles and they should not be confused:
 *
 *   - **Code** — this bundle. Ships on deploy, versioned with the repo, gated by
 *     the usual build and review path.
 *   - **Content** — models, textures, scene data. Large, changes on a different
 *     cadence, and should version and roll back WITHOUT a code deploy.
 *
 * Today both lifecycles are one: content is served from `public/`, ships inside
 * the bundle, and `resolveAssetUrl` is the identity function. Setting
 * `VITE_CONTENT_BASE_URL` resolves paths against an external base instead — a
 * static host or CDN you control.
 *
 * The platform primitive this is built for — immutable, signed content releases
 * resolved per channel (`stable`, `canary`), so promoting or rolling back
 * content is a pointer move — is NOT built yet. There is nothing to point
 * `VITE_CONTENT_BASE_URL` at on the platform side.
 *
 * The seam exists ahead of it deliberately: keeping every asset URL behind this
 * one function is what makes that switch a config change instead of a refactor.
 */

const CONTENT_BASE = (
  import.meta.env['VITE_CONTENT_BASE_URL'] ?? ''
).replace(/\/+$/, '');

/**
 * Resolve a content-relative path (e.g. `models/scene.glb`) to a URL.
 *
 * Absolute URLs pass through untouched, so a caller that already holds a signed
 * URL is not mangled.
 */
export function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.replace(/^\/+/, '');
  return CONTENT_BASE ? `${CONTENT_BASE}/${clean}` : `/${clean}`;
}
