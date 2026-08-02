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
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export interface SceneHandle {
  dispose(): void;
}

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

  const clock = new Clock();
  renderer.setAnimationLoop(() => {
    mesh.rotation.y += clock.getDelta() * 0.6;
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
      renderer.dispose();
    },
  };
}
