import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

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
  base: './',
  publicDir: 'public',
  plugins: [asciiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        popup: 'popup.html',
        welcome: 'welcome.html',
      },
      output: {
        charset: 'ascii',
      },
    },
  },
  test: {
    passWithNoTests: true,
  },
});
