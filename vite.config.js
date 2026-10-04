import { defineConfig } from 'vite';

export default defineConfig({
  // A *relative* base path means the built game works from any URL:
  // https://<you>.github.io/<any-repo-name>/, a custom domain, or a local folder.
  // (If you ever need an absolute base instead, set it like: base: '/our-memories/')
  base: './',

  server: {
    // Listen on your local network too, so you can open the dev server on your
    // phone: run `npm run dev` and open the "Network:" URL it prints.
    host: true,
  },

  preview: {
    host: true,
  },

  build: {
    outDir: 'dist',
    // Keep Vite's bundled JS separate from the game's own public/assets folder.
    assetsDir: 'bundle',
    // Phaser itself is ~1.3 MB minified; that's expected, so don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
});
