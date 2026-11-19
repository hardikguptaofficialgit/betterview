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
    cssCodeSplit: false,
    lib: {
      entry: 'src/content/index.ts',
      formats: ['iife'],
      name: 'IUIContent',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
