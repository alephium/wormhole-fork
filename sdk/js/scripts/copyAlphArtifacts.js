const fs = require("fs-extra");
["lib/esm", "lib/cjs"].forEach((buildPath) => {
  const targetDir = `${buildPath}/alephium/artifacts`;
  fs.copySync("src/alephium/artifacts", targetDir);
});
