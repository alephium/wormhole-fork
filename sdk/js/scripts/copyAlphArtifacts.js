const fs = require("fs");
["lib/esm", "lib/cjs"].forEach((buildPath) => {
  const targetDir = `${buildPath}/alephium/artifacts`
  if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir)
  }

  fs.readdirSync("src/alephium/artifacts").forEach((file) => {
    if (file.endsWith(".ral.json")) {
      fs.copyFileSync(
        `src/alephium/artifacts/${file}`,
        `${targetDir}/${file}`
      );
    }
  });
});
