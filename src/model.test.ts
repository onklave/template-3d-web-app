import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fitToFrame, loadModel } from './model';

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
