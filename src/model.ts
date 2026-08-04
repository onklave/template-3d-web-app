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

import {
  Box3,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Scene,
  SkinnedMesh,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveAssetUrl } from './asset-source';

/** Loads a glTF from a URL. Narrowed so a test can substitute a stub. */
export interface ModelLoader {
  loadAsync(url: string): Promise<{ scene: Group }>;
}

/** Loads a texture from a URL. Narrowed so a test can substitute a stub. */
export interface SkinLoader {
  loadAsync(url: string): Promise<Texture>;
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

/** World-space size and centre of a model, in scene units (metres). */
export interface Bounds {
  width: number;
  height: number;
  depth: number;
  center: Vector3;
}

/**
 * Measure a model's world-space bounding box, in scene units.
 *
 * Use it to scale content of unknown provenance to a size your scene defines —
 * "this character must stand 1.8 units tall" — rather than trusting the author's
 * units. Content from different kits is routinely authored at different scales:
 * the asset library's modular blocks are exactly 1 unit, its rigged characters
 * are 3.08, and its barrels 0.24. Nothing warns you; the scene just looks wrong.
 *
 * Two things worth knowing about the number this returns:
 *
 *   1. It is the BIND POSE. A clip that flings an arm overhead is not accounted
 *      for, and a T-posed character measures nearly as wide as it is tall.
 *      Right for scaling to a known height; wrong as a collider. Where a server
 *      is authoritative the collider is the contract and the model is scaled to
 *      fit it, never the reverse (`.onklave/rules.md`).
 *   2. A skinned mesh's own node transform is skipped, per glTF — the skeleton
 *      places the geometry. Transforms ABOVE it still count, so a `fitToFrame`
 *      scale on the root is honoured. For the library's characters this happens
 *      to change nothing (their mesh nodes are identity), so it is a
 *      spec-correctness guard rather than a fix for any model shipped today.
 */
export function measureBounds(object: Object3D): Bounds {
  object.updateWorldMatrix(true, true);
  const box = new Box3();
  const part = new Box3();
  const above = new Matrix4();

  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox;
    if (!local) return;
    part.copy(local);
    if ((mesh as SkinnedMesh).isSkinnedMesh) {
      // Skip the mesh's own transform, keep everything above it.
      above.copy(mesh.parent ? mesh.parent.matrixWorld : new Matrix4());
      part.applyMatrix4(above);
    } else {
      part.applyMatrix4(mesh.matrixWorld);
    }
    box.union(part);
  });

  if (box.isEmpty()) {
    return { width: 0, height: 0, depth: 0, center: new Vector3() };
  }
  const size = box.getSize(new Vector3());
  return {
    width: size.x,
    height: size.y,
    depth: size.z,
    center: box.getCenter(new Vector3()),
  };
}

/**
 * Apply a texture to every mesh under `object` — the runtime "skin swap".
 *
 * Some content ships geometry and textures separately on purpose: one rigged
 * character against seventy skins is seventy textures, not seventy copies of the
 * mesh. Such a model arrives with a plain colour material and NO texture slot,
 * and gets its look assigned at runtime.
 *
 * Three corrections are applied here, because each one produces a wrong-looking
 * result rather than an error, and all three are easy to miss:
 *
 *   1. `colorSpace = SRGBColorSpace`. Colour textures are authored in sRGB and
 *      three assumes linear. Without it everything renders washed out and pale.
 *   2. `flipY = false`. glTF's UV origin is the opposite of three's default for
 *      loose textures, so the skin applies upside-down.
 *   3. `color` reset to white. A material with `baseColorFactor` below 1 (0.8
 *      grey is common) MULTIPLIES the texture, so a correct skin still renders
 *      dim. The factor exists to tint an untextured mesh; once a texture is
 *      assigned it is no longer wanted.
 *
 * The previous map is disposed — swapping skins is the common interaction here,
 * and leaking a texture per swap is how a gallery reaches a gigabyte of GPU
 * memory.
 *
 * `isCurrent` guards the race that this interaction invites: a texture fetch is
 * slow enough that a visitor can pick a different model, or a different skin,
 * before it lands. Without the guard the late response paints itself onto
 * whatever is on screen now. Pass a predicate that captures what was current at
 * call time — a generation counter is the usual shape:
 *
 *     const gen = ++this.generation;
 *     await applySkin(model, path, { isCurrent: () => gen === this.generation });
 *
 * A superseded skin is disposed rather than applied, and the call resolves null.
 */
export async function applySkin(
  object: Object3D,
  path: string,
  options: { loader?: SkinLoader; isCurrent?: () => boolean } = {}
): Promise<Texture | null> {
  if (!path) return null;
  const loader = options.loader ?? new TextureLoader();
  let texture: Texture;
  try {
    texture = await loader.loadAsync(resolveAssetUrl(path));
  } catch (err) {
    console.warn(`content: could not load skin "${path}"`, err);
    return null;
  }

  // Superseded while in flight: drop it rather than paint it onto whatever the
  // visitor moved on to. Disposed, because it was fully decoded before we got here.
  if (options.isCurrent && !options.isCurrent()) {
    texture.dispose();
    return null;
  }

  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;

  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      const standard = material as MeshStandardMaterial;
      if (!standard) continue;
      standard.map?.dispose();
      standard.map = texture;
      standard.color = new Color(0xffffff);
      standard.needsUpdate = true;
    }
  });

  return texture;
}

/** Dispose every geometry and material under an object (three does not cascade). */
export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      // Disposing a material does NOT dispose its textures, so a swapped-in
      // skin outlives the model it was applied to unless dropped here.
      (material as MeshStandardMaterial)?.map?.dispose();
      material?.dispose();
    }
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
