import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    minify: true,
    lib: {
      entry: 'src/background.ts',
      formats: ['iife'],
      name: 'IUIBackground',
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
