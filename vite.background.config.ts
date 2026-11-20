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
  publicDir: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [asciiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    lib: {
      entry: 'src/background.ts',
      formats: ['iife'],
      name: 'IUIBackground',
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        charset: 'ascii',
      },
    },
  },
});
