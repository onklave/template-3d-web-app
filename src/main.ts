/**
 * Minimal interactive 3D scene.
 *
 * Deliberately small: a renderer, a lit scene, an orbiting camera, a resize
 * handler and a disposal path. It is a starting point for an Onklave 3D
 * project, not a framework.
 *
 * ## Choosing a renderer
 *
 * This template ships **three.js** because it is the most widely known and has
 * the shallowest learning curve. It is a default, not a commitment —
 * PlayCanvas and Babylon.js are equally valid, and the right choice is decided
 * by measuring YOUR workload (asset sizes, draw calls, interaction model)
 * against your performance budget on representative hardware. A feature matrix
 * will not tell you which one holds frame rate on your scene.
 *
 * Everything engine-specific lives in this file and `scene.ts`; `asset-source`
 * and the build/deploy contract are engine-neutral, so swapping is bounded.
 */

import { createScene } from './scene';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const status = document.querySelector<HTMLElement>('#status');

if (!canvas) {
  throw new Error('#scene canvas is missing from index.html');
}

try {
  const scene = createScene(canvas);
  status?.replaceChildren('Ready');

  // Free GPU resources on teardown. Long-lived 3D pages leak fast without it,
  // and a leak only shows up after the kind of long session real users have.
  window.addEventListener('pagehide', () => scene.dispose(), { once: true });
} catch (err) {
  // WebGL is unavailable often enough (old drivers, blocklists, headless) that
  // failing visibly beats a blank canvas.
  status?.replaceChildren(
    err instanceof Error ? err.message : 'Could not start the 3D scene'
  );
  throw err;
}
