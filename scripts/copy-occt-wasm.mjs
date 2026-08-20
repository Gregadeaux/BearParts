// Postinstall: put the OpenCascade wasm where the browser can fetch it.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(
  new URL("../node_modules/occt-import-js/dist/occt-import-js.wasm", import.meta.url),
);
const destDir = fileURLToPath(new URL("../public", import.meta.url));
const dest = `${destDir}/occt-import-js.wasm`;

if (!existsSync(src)) {
  console.warn("occt-import-js wasm not found — run npm install first");
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("copied occt-import-js.wasm → public/");
