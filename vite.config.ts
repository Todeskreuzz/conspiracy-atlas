import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// All dependencies are bundled locally. No CDN, no external runtime services.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During `npm run dev`, API calls are proxied to `wrangler pages dev` (port 8788).
    // If it is not running, the UI shows "Currently unavailable!" instead of loading forever.
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/cytoscape')) return 'cytoscape';
          if (id.includes('node_modules/leaflet') || id.includes('world-atlas') || id.includes('topojson')) return 'map';
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) return 'editor';
          return undefined;
        },
      },
    },
  },
});
