/**
 * Dynamically imports face-api.js and loads the required neural network models.
 *
 * IMPORTANT: face-api.js accesses browser-only APIs (document, HTMLCanvasElement, etc.)
 * at import time, so it MUST be dynamically imported — never statically imported at
 * module scope — to avoid SSR crashes in Next.js.
 *
 * @returns The face-api.js module, ready for detection calls.
 */
export const loadModels = async () => {
  const faceapi = await import("face-api.js");

  const MODEL_URL = "/models";

  console.log("[EmotionMirror] Loading face-api.js models from", MODEL_URL);

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
  ]);

  console.log("[EmotionMirror] Models loaded successfully");

  return faceapi;
};