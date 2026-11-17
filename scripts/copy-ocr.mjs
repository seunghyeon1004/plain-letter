// Copies the local OCR engine and English data into public/ocr so the app serves
// them itself: a photo is read in the browser, and nothing about it goes to a CDN.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const out = join(root, "public", "ocr");
mkdirSync(out, { recursive: true });
const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];
for (const [from, to] of files) {
  const src = join(nm, from);
  if (!existsSync(src)) throw new Error(`missing ${src}; run npm install`);
  copyFileSync(src, join(out, to));
}
console.log(`copied ${files.length} OCR files to public/ocr`);
