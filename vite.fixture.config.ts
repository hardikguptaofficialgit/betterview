import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'test/public',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir: 'fixture-dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/fixture/main.ts',
      formats: ['iife'],
      name: 'IUIFixture',
      fileName: () => 'fixture.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
