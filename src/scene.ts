/**
 * Scene construction, isolated from page wiring so it can be swapped or tested.
 */

import {
  AmbientLight,
  BoxGeometry,
  Clock,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { disposeObject, loadModel } from './model';

export interface SceneHandle {
  dispose(): void;
}

/**
 * Content path of the model to display, e.g.
 * `kenney/3.6.0/car-kit/ambulance.glb`. Empty (the default) keeps the
 * procedural placeholder and issues no request — a template that 404s on every
 * dev run teaches you to ignore its errors. See `.env.example`.
 */
const MODEL_PATH = import.meta.env['VITE_MODEL_PATH'] ?? '';

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  // Cap at 2: beyond that the pixel cost climbs faster than the visible gain,
  // and phones report 3–4.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(3, 2, 4);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 0.4));
  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(5, 8, 3);
  scene.add(key);

  const geometry = new BoxGeometry(1.5, 1.5, 1.5);
  const material = new MeshStandardMaterial({
    color: 0x4f9cf9,
    roughness: 0.35,
  });
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);

  // What the animation loop spins: the placeholder now, the model once it lands.
  let subject: Object3D = mesh;
  let loaded: Object3D | null = null;
  void loadModel(scene, MODEL_PATH, mesh).then((model) => {
    if (model) {
      loaded = model;
      subject = model;
    }
  });

  const clock = new Clock();
  renderer.setAnimationLoop(() => {
    subject.rotation.y += clock.getDelta() * 0.6;
    renderer.render(scene, camera);
  });

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', onResize);

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      // The loaded model owns geometries and materials the placeholder does
      // not; `loadModel` already disposed the placeholder if it swapped.
      if (loaded) disposeObject(loaded);
      renderer.dispose();
    },
  };
}
