const fs = require("fs");
const path = require("path");
const Module = require("module");

const root = process.cwd();
const ignore = new Set(["node_modules", ".next", ".git", "dist", "build"]);
const files = [];
const builtins = new Set(Module.builtinModules);

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(item.name)) continue;

    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(item.name)) {
      files.push(full);
    }
  }
}

walk(root);

const imports = new Set();

const importRegex =
  /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|require\(["']([^"']+)["']\)/g;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let match;

  while ((match = importRegex.exec(text))) {
    const source = match[1] || match[2];

    if (!source) continue;
    if (source.startsWith(".") || source.startsWith("@/")) continue;
    if (source.startsWith("node:")) continue;
    if (builtins.has(source)) continue;

    let packageName;

    if (source.startsWith("@")) {
      const parts = source.split("/");
      packageName = `${parts[0]}/${parts[1]}`;
    } else {
      packageName = source.split("/")[0];
    }

    imports.add(packageName);
  }
}

const missing = [...imports]
  .filter((packageName) => {
    try {
      require.resolve(packageName, { paths: [root] });
      return false;
    } catch {
      return true;
    }
  })
  .sort();

console.log(missing.join(" "));
