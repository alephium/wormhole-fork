import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { defineConfig, ConfigEnv, BuildEnvironmentOptions } from 'vite';
import type { InputOption, PreRenderedAsset } from 'rollup';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';
import packageJson from './package.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { version } = packageJson;
const isAnalyze = process.env.ANALYZE === 'true';

let gitHash = 'unknown';

try {
  gitHash = execSync('git log -1 --format=%H').toString().replace('\n', '');
} catch (e) {
  console.error(`Failed to determine git hash! Will be missing from telemetry`);
  console.error(e);
}

console.info(
  `\nBuilding Alephium Bridge Widget version=${version} hash=${gitHash}\n`,
);

// TODO: consider using the "VITE_APP_" prefix which is the default for Vite
const envPrefix = 'REACT_APP_';

const define = {
  'import.meta.env.REACT_APP_WIDGET_VERSION':
    process.env.CONNECT_VERSION ?? JSON.stringify(version),
  'import.meta.env.REACT_APP_WIDGET_GIT_HASH': JSON.stringify(gitHash),
};

const resolve = {
  alias: {
    public: path.resolve(__dirname, './public'),
    exports: path.resolve(__dirname, './src/exports'),
    'process/': 'process',
    'buffer/': 'buffer',
    '@alephium/bridge-common': path.resolve(__dirname, '../bridge-common/src'),
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
  ],
  // Ensure node_modules resolution works correctly for aliased paths
  // This makes Vite look in bridge-widget's node_modules even when resolving
  // imports from bridge-common
  preserveSymlinks: false,
};

const plugins = [
  checker({ typescript: true }),
  dts({ insertTypesEntry: true }),
  react(),
  nodePolyfills({
    include: [
      'crypto',
      'http',
      'https',
      'stream',
      'buffer',
      'url',
      'os',
      'zlib',
    ],
    globals: {
      global: true,
      Buffer: true,
    },
  }),
  process.env.ANALYZE === 'true' &&
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // or 'sunburst'
    }),
].filter(Boolean);

function assetFileNames(assetInfo: PreRenderedAsset) {
  if (assetInfo.name === 'main.css') {
    return '[name][extname]';
  }

  return '[name]-[hash][extname]';
}

// Local dev server
const sampleAppBuild: BuildEnvironmentOptions = {
  outDir: './build',
  rollupOptions: {
    input: {
      main: 'src/SampleApp.tsx',
      index: 'index.html',
    } as Record<string, string>,
    output: {
      assetFileNames,
      inlineDynamicImports: false,
      exports: 'named' as const,
    },
  },
};

const libEntry: InputOption = [path.resolve(__dirname, 'src/exports/index.ts')];

const rollupInput: InputOption = {
  index: 'src/exports/index.ts',
};

// Function-based external to catch all peer dependency paths
// This is more robust than an array, especially with preserveModules
const peerDeps = ['react', 'react-dom'];

const external = (id: string) => {
  // Check if the module ID starts with any peer dependency
  return peerDeps.some((dep) => id === dep || id.startsWith(dep + '/'));
};

// Production build, for npm import
const libBuild: BuildEnvironmentOptions = {
  outDir: './lib',
  lib: {
    entry: libEntry,
    formats: isAnalyze ? ['es'] : ['es', 'cjs'],
    fileName: (format, entryname) => {
      const n = entryname.split('/').pop()!;
      return `${n.split('.')[0]}.${format === 'es' ? 'mjs' : 'js'}`;
    },
  },
  rollupOptions: {
    input: rollupInput,
    output: {
      assetFileNames,
      inlineDynamicImports: false,
      exports: 'named' as const,
    },
    external,
  },
};

export default defineConfig(({ command }: ConfigEnv) => {
  const isSampleApp = command === 'serve';

  let build: BuildEnvironmentOptions | undefined = undefined;

  if (isSampleApp) {
    build = sampleAppBuild;
  } else if (command === 'build') {
    build = libBuild;
  }

  return {
    build,
    define,
    envPrefix,
    resolve,
    plugins,
  };
});
