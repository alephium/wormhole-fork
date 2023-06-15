/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/node-apis/
 */

const webpack = require("webpack");

exports.onCreateWebpackConfig = function addPathMapping({
  stage,
  actions,
  getConfig,
}) {
  actions.setWebpackConfig({
    experiments: {
      asyncWebAssembly: true,
    },
    plugins: [
      // Work around for Buffer is undefined:
      // https://github.com/webpack/changelog-v5/issues/10
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    resolve: {
      fallback: {
        buffer: require.resolve("buffer"),
        fs: false,
        path: false,
        stream: require.resolve("stream-browserify"),
        crypto: require.resolve("crypto-browserify"),
      },
    },
  });

  // Work around for `Cannot convert a BigInt value to a number`
  // https://github.com/gatsbyjs/gatsby/issues/25297
  const webpackConfig = getConfig()

  if (stage === "build-javascript") {
    const dependencyRulesIndex = webpackConfig.module.rules.findIndex(
      (rule) => {
        return (
          rule.test &&
          rule.test.toString() === "/\\.(js|mjs)$/" &&
          typeof rule.exclude === "function"
        )
      }
    )

    webpackConfig.module.rules.splice(dependencyRulesIndex, 1)
  }

  actions.replaceWebpackConfig(webpackConfig)
};

exports.createPages = ({ actions }) => {
  const { createRedirect } = actions;
  createRedirect({
    fromPath: "/en/",
    toPath: "/",
    isPermanent: true,
  });
  createRedirect({
    fromPath: "/en/about/",
    toPath: "/buidl/",
    isPermanent: true,
  });
  createRedirect({
    fromPath: "/en/network/",
    toPath: "/network/",
    isPermanent: true,
  });
  createRedirect({
    fromPath: "/en/explorer/",
    toPath: "/explorer/",
    isPermanent: true,
  });
};
