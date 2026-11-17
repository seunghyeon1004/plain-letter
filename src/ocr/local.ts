/**
 * Local text recognition for photos when there is no on-device model.
 * Tesseract (WebAssembly) runs in a worker in this browser. Its engine and
 * English data are served by this app (about 6 MB, downloaded once), so the
 * photo never leaves the device. No AI model is involved.
 */
export async function recognizeLocally(image: Blob, onProgress?: (f: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const base = new URL("ocr/", document.baseURI).href;
  const worker = await createWorker("eng", 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
