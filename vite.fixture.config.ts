import { defineConfig, Plugin } from 'vite';

function asciiPlugin(): Plugin {
  return {
    name: 'ascii-escape',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const file = bundle[fileName];
        if (file.type === 'chunk' && file.code) {
          file.code = file.code.replace(/[^\x00-\x7F]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
        }
      }
    },
  };
}

export default defineConfig({
  publicDir: 'test/public',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  esbuild: {
    charset: 'ascii',
  },
  plugins: [asciiPlugin()],
  build: {
    outDir: 'fixture-dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
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
