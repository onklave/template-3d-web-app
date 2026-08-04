/**
 * Loading a model from content, with the procedural scene as the fallback.
 *
 * The placeholder is built FIRST and stays on screen until a model has actually
 * arrived and parsed. A 3D page that renders nothing while it waits — and
 * nothing at all if the fetch fails — is worse than one that renders a cube: the
 * blank canvas is indistinguishable from a broken build, and content lives on a
 * different host to the code, so it fails independently.
 *
 * Content is addressed by object path (`kenney/3.6.0/car-kit/ambulance.glb`) and
 * resolved through `resolveAssetUrl`, so the same build points at `public/` in
 * development and a content host in production without a code change.
 */

import { Box3, Group, Mesh, Object3D, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveAssetUrl } from './asset-source';

/** Loads a glTF from a URL. Narrowed so a test can substitute a stub. */
export interface ModelLoader {
  loadAsync(url: string): Promise<{ scene: Group }>;
}

export interface LoadModelOptions {
  /** Longest side of the model after fitting, in scene units. */
  fitTo?: number;
  /** Injected in tests; defaults to a real GLTFLoader. */
  loader?: ModelLoader;
}

/**
 * Scale and centre a loaded model so an unknown asset lands in frame.
 *
 * Content authored elsewhere arrives at whatever scale its author used — a
 * Kenney car is ~2 units, a scanned prop can be hundreds. Without this a
 * correctly-loaded model reads as a failed load, because it renders far outside
 * the camera frustum or as a speck.
 */
export function fitToFrame(object: Object3D, fitTo = 2): void {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (longest > 0) {
    const scale = fitTo / longest;
    object.scale.setScalar(scale);
    box.setFromObject(object);
  }
  const centre = box.getCenter(new Vector3());
  object.position.sub(centre);
}

/** Dispose every geometry and material under an object (three does not cascade). */
export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

/**
 * Load `path` into `scene` and remove `placeholder` once it is on screen.
 *
 * Resolves to the loaded object, or `null` when there is nothing to load or the
 * load failed — in both cases the placeholder is left alone. Never rejects:
 * missing content is a content problem, and it must not take down a page whose
 * code is fine.
 */
export async function loadModel(
  scene: Scene,
  path: string,
  placeholder: Object3D,
  options: LoadModelOptions = {}
): Promise<Object3D | null> {
  if (!path) return null;
  const loader = options.loader ?? new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(resolveAssetUrl(path));
    fitToFrame(gltf.scene, options.fitTo);
    scene.add(gltf.scene);
    // Swap only after the model is in the scene, so there is never a frame with
    // neither on screen.
    scene.remove(placeholder);
    disposeObject(placeholder);
    return gltf.scene;
  } catch (err) {
    console.warn(
      `content: could not load "${path}" — keeping the placeholder`,
      err
    );
    return null;
  }
}
