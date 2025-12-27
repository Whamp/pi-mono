import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/client',
  build: {
    outDir: '../../dist/public',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/client'),
      'crypto': resolve(__dirname, 'src/client/mocks/crypto.ts'),
      'http': resolve(__dirname, 'src/client/mocks/http.ts'),
    },
  },
  define: {
      'global': 'window',
      'process.env': {},
      'process.platform': '"browser"',
      'process.versions': {},
      'process.version': '""'
  }
});
