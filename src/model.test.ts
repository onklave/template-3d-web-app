import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Scene,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { applySkin, fitToFrame, loadModel } from './model';

const placeholder = () =>
  new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());

/** A loaded glTF: one 10-unit cube offset from the origin. */
function loadedModel(): Group {
  const group = new Group();
  const mesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial());
  mesh.position.set(50, 0, 0);
  group.add(mesh);
  return group;
}

describe('loadModel', () => {
  it('does not fetch when there is no model path', async () => {
    const scene = new Scene();
    const box = placeholder();
    scene.add(box);
    const loader = { loadAsync: vi.fn() };

    expect(await loadModel(scene, '', box, { loader })).toBeNull();
    expect(loader.loadAsync).not.toHaveBeenCalled();
    expect(scene.children).toContain(box);
  });

  it('swaps the placeholder for the model once it has loaded', async () => {
    const scene = new Scene();
    const box = placeholder();
    scene.add(box);
    const model = loadedModel();
    const loader = { loadAsync: vi.fn().mockResolvedValue({ scene: model }) };

    const result = await loadModel(scene, 'kenney/car.glb', box, { loader });

    expect(result).toBe(model);
    expect(scene.children).toContain(model);
    expect(scene.children).not.toContain(box);
  });

  it('resolves the path through the content seam', async () => {
    const scene = new Scene();
    const loader = {
      loadAsync: vi.fn().mockResolvedValue({ scene: loadedModel() }),
    };

    await loadModel(scene, 'kenney/car.glb', placeholder(), { loader });

    // No VITE_CONTENT_BASE_URL in tests, so the seam is the identity function
    // plus a leading slash.
    expect(loader.loadAsync).toHaveBeenCalledWith('/kenney/car.glb');
  });

  it('keeps the placeholder when the content fails to load', async () => {
    const scene = new Scene();
    const box = placeholder();
    scene.add(box);
    const loader = { loadAsync: vi.fn().mockRejectedValue(new Error('404')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Never rejects: content lives on another host and fails independently of
    // the code, so a missing asset must not take the page down.
    expect(await loadModel(scene, 'missing.glb', box, { loader })).toBeNull();
    expect(scene.children).toContain(box);
    warn.mockRestore();
  });
});

describe('fitToFrame', () => {
  it('scales an oversized model down and centres it on the origin', () => {
    const model = loadedModel(); // 10 units, offset 50 on x

    fitToFrame(model, 2);

    expect(model.scale.x).toBeCloseTo(0.2);
    // Centred, so the offset the author baked in no longer puts it off-camera.
    expect(model.position.x).toBeCloseTo(-10);
  });

  it('leaves an empty object alone rather than dividing by zero', () => {
    const empty = new Group();
    expect(() => fitToFrame(empty, 2)).not.toThrow();
    expect(empty.scale.x).toBe(1);
  });
});

describe('applySkin', () => {
  /** A model shaped like the rigged characters: one mesh, one tinted material. */
  function skinnable(): { model: Group; material: MeshStandardMaterial } {
    const material = new MeshStandardMaterial();
    // What a character ships with: a grey baseColorFactor and no texture.
    material.color = new Color(0.8, 0.8, 0.8);
    const model = new Group();
    model.add(new Mesh(new BoxGeometry(1, 1, 1), material));
    return { model, material };
  }

  const skinLoader = () => {
    const texture = new Texture();
    return { texture, loader: { loadAsync: vi.fn().mockResolvedValue(texture) } };
  };

  it('does not fetch when there is no skin path', async () => {
    const { model } = skinnable();
    const loader = { loadAsync: vi.fn() };

    expect(await applySkin(model, '', { loader })).toBeNull();
    expect(loader.loadAsync).not.toHaveBeenCalled();
  });

  it('assigns the texture to every mesh material', async () => {
    const { model, material } = skinnable();
    const { texture, loader } = skinLoader();
    // `needsUpdate` is a write-only setter in three; the observable effect is
    // the version bump that forces the shader program to be rebuilt — needed
    // here because the material had no map slot before the skin arrived.
    const before = material.version;

    const result = await applySkin(model, 'kenney/skins/a.png', { loader });

    expect(result).toBe(texture);
    expect(material.map).toBe(texture);
    expect(material.version).toBeGreaterThan(before);
  });

  // Colour textures are authored in sRGB; three assumes linear. Without this
  // the skin renders washed out — a wrong picture, not an error.
  it('marks the texture as sRGB', async () => {
    const { model } = skinnable();
    const { texture, loader } = skinLoader();

    await applySkin(model, 'kenney/skins/a.png', { loader });

    expect(texture.colorSpace).toBe(SRGBColorSpace);
  });

  // glTF's UV origin is the opposite of three's default for loose textures.
  it('does not flip the texture vertically', async () => {
    const { model } = skinnable();
    const { texture, loader } = skinLoader();

    await applySkin(model, 'kenney/skins/a.png', { loader });

    expect(texture.flipY).toBe(false);
  });

  // A baseColorFactor below 1 MULTIPLIES the texture, so a correct skin still
  // renders dim. This is the subtlest of the three and the easiest to ship.
  it('resets the material tint to white so the skin is not darkened', async () => {
    const { model, material } = skinnable();
    const { loader } = skinLoader();
    expect(material.color.r).toBeCloseTo(0.8);

    await applySkin(model, 'kenney/skins/a.png', { loader });

    expect(material.color.r).toBe(1);
    expect(material.color.g).toBe(1);
    expect(material.color.b).toBe(1);
  });

  it('disposes the previous skin so swapping does not leak', async () => {
    const { model, material } = skinnable();
    const first = new Texture();
    const disposed = vi.spyOn(first, 'dispose');
    material.map = first;

    await applySkin(model, 'kenney/skins/b.png', {
      loader: { loadAsync: vi.fn().mockResolvedValue(new Texture()) },
    });

    expect(disposed).toHaveBeenCalled();
  });

  it('keeps the model on screen when the skin fails to load', async () => {
    const { model, material } = skinnable();
    const loader = { loadAsync: vi.fn().mockRejectedValue(new Error('404')) };

    expect(await applySkin(model, 'kenney/skins/gone.png', { loader })).toBeNull();
    expect(material.map).toBeNull();
  });
});
