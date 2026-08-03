import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        diagnostic: resolve(__dirname, 'diagnostic/index.html'),
        agencyScorecard: resolve(__dirname, 'agency-scorecard/index.html'),
        independenceIndex: resolve(__dirname, 'independence-index/index.html'),
        agencyStrengthIndex: resolve(__dirname, 'agency-strength-index/index.html'),
      },
    },
  },
});
