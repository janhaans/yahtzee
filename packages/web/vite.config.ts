import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the game server runs on port 3000; Vite forwards the socket and API to it.
export default defineConfig({
  plugins: [react()],
  // The 3D dice (three.js + physics) are one lazy chunk of about 620 kB, loaded only by the
  // laptop and served from the laptop itself, so that size is fine.
  build: { chunkSizeWarningLimit: 700 },
  server: {
    proxy: {
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
      '/api': { target: 'http://127.0.0.1:3000' },
    },
  },
});
