import { defineConfig, Plugin, build as viteBuild } from 'vite';

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

function buildLoaderPlugin(): Plugin {
  return {
    name: 'build-loader',
    async closeBundle() {
      await viteBuild({
        configFile: false,
        publicDir: false,
        plugins: [asciiPlugin()],
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          target: 'es2020',
          minify: 'esbuild',
          rollupOptions: {
            input: 'src/content/loader.ts',
            output: {
              format: 'iife',
              entryFileNames: 'content.js',
              charset: 'ascii',
            },
          },
        },
      });
    },
  };
}

export default defineConfig({
  publicDir: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [asciiPlugin(), buildLoaderPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/content/main.ts',
      output: {
        format: 'es',
        entryFileNames: 'content-main.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        charset: 'ascii',
      },
    },
  },
});
