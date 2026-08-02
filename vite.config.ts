import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Emit to dist/ — the artifact the Onklave static deploy preset serves.
    outDir: 'dist',
    // 3D assets are large; a hashed filename per asset is what makes a
    // long-lived cache header safe at the edge.
    assetsInlineLimit: 0,
  },
});
