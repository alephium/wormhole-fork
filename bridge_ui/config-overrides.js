const { ProvidePlugin } = require("webpack");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const path = require("path");

module.exports = function override(config, env) {
  config.resolve.plugins.forEach(plugin => {
    if (plugin instanceof ModuleScopePlugin) {
      const cwd = process.cwd()
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'alephium', 'devnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'alephium', 'testnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'alephium', 'mainnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'ethereum', 'devnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'ethereum', 'testnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'ethereum', 'mainnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'guardian', 'devnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'guardian', 'testnet.json'))
      plugin.allowedFiles.add(path.join(cwd, '..', 'configs', 'guardian', 'mainnet.json'))
    }
  })
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...config.module.rules,
        {
          test: /\.js$/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
        {
          test: /\.wasm$/,
          type: "webassembly/async",
        },
      ],
    },
    plugins: [
      ...config.plugins,
      new ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
        process: "process/browser",
      }),
    ],
    resolve: {
      ...config.resolve,
      fallback: {
        assert: "assert",
        buffer: "buffer",
        console: "console-browserify",
        constants: "constants-browserify",
        crypto: "crypto-browserify",
        domain: "domain-browser",
        events: "events",
        fs: false,
        http: "stream-http",
        https: "https-browserify",
        os: "os-browserify/browser",
        path: "path-browserify",
        punycode: "punycode",
        process: "process/browser",
        querystring: "querystring-es3",
        stream: "stream-browserify",
        _stream_duplex: "readable-stream/duplex",
        _stream_passthrough: "readable-stream/passthrough",
        _stream_readable: "readable-stream/readable",
        _stream_transform: "readable-stream/transform",
        _stream_writable: "readable-stream/writable",
        string_decoder: "string_decoder",
        sys: "util",
        timers: "timers-browserify",
        tty: "tty-browserify",
        url: "url",
        util: "util",
        vm: "vm-browserify",
        zlib: "browserify-zlib",
      },
    },
    experiments: {
      asyncWebAssembly: true,
    },
    ignoreWarnings: [/Failed to parse source map/],
  };
};
