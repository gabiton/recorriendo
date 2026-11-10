import { copyFile, mkdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageRoot = new URL("node_modules/maplibre-gl/", root);
const { version } = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));
const target = new URL(`public/maplibre/${version}/`, root);
await mkdir(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(new URL(`dist/${file}`, packageRoot), new URL(file, target));
}
await copyFile(new URL("LICENSE.txt", packageRoot), new URL("LICENSE.txt", target));
console.log(`MapLibre ${version}: worker preparado.`);
