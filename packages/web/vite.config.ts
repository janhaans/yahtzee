import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the game server runs on port 3000; Vite forwards the socket to it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
    },
  },
});
