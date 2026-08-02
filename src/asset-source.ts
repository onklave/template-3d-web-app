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
 * In development, content is served from `public/` and `resolveAssetUrl` is the
 * identity function. In production, point `VITE_CONTENT_BASE_URL` at an Onklave
 * content release channel: the platform stores content releases immutably,
 * signs them, and resolves a channel (`stable`, `canary`) to one release, so
 * promoting or rolling back content is a pointer move rather than a rebuild.
 *
 * Keeping every asset URL behind this one function is what makes that switch a
 * config change instead of a refactor.
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
