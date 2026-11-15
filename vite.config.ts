import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // fixed port: the save lives in the browser storage of http://localhost:47321
  server: { port: 47321, strictPort: true },
});
