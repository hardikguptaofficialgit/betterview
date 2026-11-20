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

function chromeDynamicImportPlugin(): any {
  return {
    name: 'chrome-dynamic-import',
    renderDynamicImport() {
      return {
        left: `import(((u) => typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(u.replace(/^\\.\\/?/, '')) : u)(`,
        right: `))`,
      };
    },
  };
}

export default defineConfig({
  publicDir: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  esbuild: {
    charset: 'ascii',
  },
  plugins: [chromeDynamicImportPlugin(), asciiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/content/index.ts',
      output: {
        format: 'es',
        entryFileNames: 'content.js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
