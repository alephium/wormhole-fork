import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, ConfigEnv, BuildEnvironmentOptions } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import dts from 'vite-plugin-dts';
import packageJson from './package.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const peerDeps = Object.keys(packageJson.peerDependencies || {});

// Production build, for npm import
const libBuild: BuildEnvironmentOptions = {
  outDir: './lib',
  lib: {
    entry: path.resolve(__dirname, 'src/exports/index.ts'),
    formats: ['es', 'cjs'],
    fileName: (format, entryname) => {
      const n = entryname.split('/').pop()!;
      return `${n.split('.')[0]}.${format === 'es' ? 'mjs' : 'js'}`;
    },
  },
  rollupOptions: {
    input: {
      index: 'src/exports/index.ts',
    },
    output: {
      assetFileNames: '[name]-[hash][extname]',
      inlineDynamicImports: false,
      exports: 'named' as const,
    },
    external: (id: string) => {
      // Check if the module ID starts with any peer dependency
      return peerDeps.some((dep) => id === dep || id.startsWith(dep + '/'));
    },
  },
};

// Local dev server
const sampleAppBuild: BuildEnvironmentOptions = {
  outDir: './build',
};

export default defineConfig(({ command }: ConfigEnv) => {
  return {
    build: command === 'serve' ? sampleAppBuild : libBuild,
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2020',
        // Node.js global to browser globalThis
        define: {
          global: 'globalThis',
        },
      },
    },
    resolve: {
      alias: {
        public: path.resolve(__dirname, './public'),
        exports: path.resolve(__dirname, './src/exports'),
        'process/': 'process',
        'buffer/': 'buffer',
      },
      dedupe: [
        '@emotion/react',
        '@emotion/styled',
        '@mui/styled-engine',
        '@mui/system',
        '@solana/web3.js',
        '@solana/spl-token',
        '@solana/spl-token-registry',
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-wallets',
      ]
    },
    plugins: [
      checker({ typescript: true }),
      dts({ insertTypesEntry: true }),
      react(),
      nodePolyfills({
        include: ['process', 'buffer'],
        globals: {
          global: false,
          Buffer: true
        },
      }),
    ],
  };
});
