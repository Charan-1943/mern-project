import JSZip from "jszip";
import { CANVAS_HEIGHT, CANVAS_WIDTH, drawMotionFrame, LOOP_SECONDS } from "../hooks/useMotionCanvas";
import type { Asset, MotionSettings } from "../types";

const FRAME_RATE = 24;
const SEQUENCE_FRAME_RATE = 12;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function supportedWebMType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export async function exportWebM(
  canvas: HTMLCanvasElement,
  asset: Asset,
  settings: MotionSettings,
  onProgress: (progress: number) => void,
) {
  if (!canvas.captureStream || !("MediaRecorder" in window)) {
    throw new Error("This browser does not support canvas video recording. Export a PNG sequence instead.");
  }
  const mimeType = supportedWebMType();
  if (!mimeType) throw new Error("No supported WebM codec was found. Export a PNG sequence instead.");

  const stream = canvas.captureStream(FRAME_RATE);
  let recorder: MediaRecorder | undefined;
  const chunks: BlobPart[] = [];
  let imageSource: ImageBitmap | undefined;

  try {
    const activeRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    recorder = activeRecorder;
    imageSource = asset.file ? await createImageBitmap(asset.file) : undefined;
    const recording = new Promise<Blob>((resolve, reject) => {
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      activeRecorder.onerror = () => reject(new Error("The browser could not record this canvas."));
      activeRecorder.onstop = () => {
        if (chunks.length === 0) {
          reject(new Error("The browser produced an empty recording."));
          return;
        }
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    activeRecorder.start(250);
    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      const tick = (now: number) => {
        try {
          const elapsed = now - start;
          const progress = Math.min(1, elapsed / (LOOP_SECONDS * 1000));
          drawMotionFrame(canvas, asset, settings, progress * LOOP_SECONDS, imageSource);
          onProgress(progress);
          if (progress >= 1) resolve();
          else requestAnimationFrame(tick);
        } catch (cause) {
          reject(cause);
        }
      };
      requestAnimationFrame(tick);
    });
    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    if (activeRecorder.state !== "inactive") activeRecorder.stop();
    const blob = await recording;
    downloadBlob(blob, `${asset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-framevault.webm`);
  } finally {
    if (recorder?.state !== "inactive") recorder?.stop();
    stream.getTracks().forEach((track) => track.stop());
    imageSource?.close();
  }
}

export async function exportPngSequence(
  canvas: HTMLCanvasElement,
  asset: Asset,
  settings: MotionSettings,
  onProgress: (progress: number) => void,
) {
  const frames = LOOP_SECONDS * SEQUENCE_FRAME_RATE;
  if (canvas.width * canvas.height * frames > 60_000_000) {
    throw new Error("This PNG sequence exceeds the safe browser memory limit. Use WebM or a shorter sequence.");
  }

  const sequence = new JSZip();
  const folder = sequence.folder("frames");
  if (!folder) throw new Error("Could not create the PNG sequence archive.");
  const imageSource = asset.file ? await createImageBitmap(asset.file) : undefined;
  try {
    for (let index = 0; index < frames; index += 1) {
      drawMotionFrame(canvas, asset, settings, index / SEQUENCE_FRAME_RATE, imageSource);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error(`Could not render PNG frame ${index + 1}.`));
        }, "image/png");
      });
      folder.file(`frame-${String(index + 1).padStart(3, "0")}.png`, blob);
      onProgress((index + 1) / frames * 0.8);
    }
    const archive = await sequence.generateAsync(
      { type: "blob", compression: "STORE" },
      (metadata) => onProgress(0.8 + metadata.percent / 100 * 0.2),
    );
    downloadBlob(archive, `${asset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-png-sequence.zip`);
  } finally {
    imageSource?.close();
  }
}

export const exportSpecs = {
  frameRate: FRAME_RATE,
  sequenceFrameRate: SEQUENCE_FRAME_RATE,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
