import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Asset, MotionSettings } from "../types";

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const LOOP_SECONDS = 5;

function easeOut(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return 1 - (1 - clamped) ** 3;
}

export function drawMotionFrame(
  canvas: HTMLCanvasElement,
  asset: Asset,
  settings: MotionSettings,
  seconds: number,
  imageSource?: ImageBitmap,
) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");

  const width = canvas.width;
  const height = canvas.height;
  const time = ((seconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const progress = time / LOOP_SECONDS;
  const intro = easeOut(Math.min(1, time / 0.8));
  const outro = easeOut(Math.min(1, (LOOP_SECONDS - time) / 0.7));

  context.save();
  context.fillStyle = "#141a19";
  context.fillRect(0, 0, width, height);

  const wash = context.createRadialGradient(width * 0.76, height * 0.22, 10, width * 0.76, height * 0.22, width * 0.8);
  wash.addColorStop(0, `${asset.accent}59`);
  wash.addColorStop(1, "#141a19");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  if (imageSource) {
    const sourceWidth = imageSource.width;
    const sourceHeight = imageSource.height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const imageWidth = sourceWidth * scale;
    const imageHeight = sourceHeight * scale;
    context.globalAlpha = 0.26;
    context.drawImage(imageSource, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    context.globalAlpha = 1;
    context.fillStyle = "rgba(15, 20, 18, 0.46)";
    context.fillRect(0, 0, width, height);
  }

  context.globalAlpha = 0.14;
  context.strokeStyle = asset.accent;
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  const orbX = width * (0.76 + Math.sin(progress * Math.PI * 2) * 0.035);
  const orbY = height * (0.48 + Math.cos(progress * Math.PI * 2) * 0.045);
  const orbRadius = height * 0.34;
  const orb = context.createRadialGradient(orbX - orbRadius * 0.3, orbY - orbRadius * 0.35, 1, orbX, orbY, orbRadius);
  orb.addColorStop(0, `${asset.accent}bb`);
  orb.addColorStop(0.55, `${asset.accent}55`);
  orb.addColorStop(1, `${asset.accent}00`);
  context.fillStyle = orb;
  context.beginPath();
  context.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
  context.fill();

  const markerStart = Math.min(settings.markerStart, settings.markerEnd);
  const markerEnd = Math.max(settings.markerStart, settings.markerEnd);
  const markerActive = progress >= markerStart && progress <= markerEnd;
  const inMotion = markerActive ? 1 : 0.36;
  const slide = (1 - intro) * 46 + Math.sin(progress * Math.PI * 2) * 6;

  context.globalAlpha = Math.max(0.18, intro * outro);
  context.filter = settings.blur > 0 ? `blur(${settings.blur * inMotion}px)` : "none";
  context.translate(-slide, 0);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = "500 18px 'Cascadia Mono', Consolas, monospace";
  context.fillStyle = asset.accent;
  context.fillText(`${asset.category.toUpperCase()}  /  ${asset.name.toUpperCase()}`, 116, height * 0.37);
  context.font = "500 72px 'Segoe UI', Arial, sans-serif";
  context.fillStyle = "#f3f0e8";
  context.strokeStyle = settings.strokeColor;
  context.lineWidth = 1.4;
  context.lineJoin = "round";
  if (settings.strokeColor !== "#141a19") context.strokeText(settings.title || "A quieter kind of motion", 112, height * 0.51, width * 0.75);
  context.fillText(settings.title || "A quieter kind of motion", 112, height * 0.51, width * 0.75);
  context.font = "400 24px 'Segoe UI', Arial, sans-serif";
  context.fillStyle = "#bbc2b9";
  context.fillText(settings.subtitle || "Curated details for the in-between.", 116, height * 0.59, width * 0.72);
  context.filter = "none";
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;

  context.fillStyle = "rgba(10, 14, 13, 0.72)";
  context.fillRect(0, height - 90, width, 90);
  context.fillStyle = "#a0aaa1";
  context.font = "14px 'Cascadia Mono', Consolas, monospace";
  context.fillText("FRAMEVAULT  /  MOTION STUDY 01", 64, height - 52);
  context.textAlign = "right";
  context.fillText(`${time.toFixed(2)}s  /  05.00s`, width - 64, height - 52);

  const trackLeft = 64;
  const trackWidth = width - 128;
  const trackY = height - 27;
  context.strokeStyle = "#59645c";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(trackLeft, trackY);
  context.lineTo(trackLeft + trackWidth, trackY);
  context.stroke();
  context.strokeStyle = asset.accent;
  context.beginPath();
  context.moveTo(trackLeft + markerStart * trackWidth, trackY - 7);
  context.lineTo(trackLeft + markerEnd * trackWidth, trackY - 7);
  context.stroke();
  context.fillStyle = "#f3f0e8";
  context.beginPath();
  context.arc(trackLeft + progress * trackWidth, trackY, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function useMotionCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  asset: Asset,
  settings: MotionSettings,
  playing: boolean,
  time: number,
  onTime: (time: number) => void,
  onError: (message: string) => void,
  ready: boolean,
) {
  const settingsRef = useRef(settings);
  const assetRef = useRef(asset);
  const timeRef = useRef(time);
  const onTimeRef = useRef(onTime);
  const onErrorRef = useRef(onError);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  settingsRef.current = settings;
  assetRef.current = asset;
  timeRef.current = time;
  onTimeRef.current = onTime;
  onErrorRef.current = onError;

  const renderAt = useCallback((seconds: number) => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Preview canvas is not ready.");
    drawMotionFrame(canvas, assetRef.current, settingsRef.current, seconds, bitmapRef.current ?? undefined);
  }, [canvasRef]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const start = performance.now() - timeRef.current * 1000;
    const draw = (now: number) => {
      try {
        const currentTime = playing ? ((now - start) / 1000) % LOOP_SECONDS : timeRef.current;
        renderAt(currentTime);
        if (playing) {
          timeRef.current = currentTime;
          onTimeRef.current(currentTime);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The canvas preview could not be rendered.";
        console.error("Canvas preview failed.", cause);
        onErrorRef.current(message);
      }
      if (playing) frame = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [canvasRef, playing, renderAt, asset, settings, ready]);

  useEffect(() => {
    if (!ready) return;
    bitmapRef.current?.close();
    bitmapRef.current = null;
    if (!asset.file) {
      try {
        renderAt(timeRef.current);
      } catch (cause) {
        onErrorRef.current(cause instanceof Error ? cause.message : "The canvas preview could not be rendered.");
      }
      return;
    }

    let active = true;
    void createImageBitmap(asset.file).then((bitmap) => {
      if (!active) {
        bitmap.close();
        return;
      }
      bitmapRef.current = bitmap;
      renderAt(timeRef.current);
    }).catch((cause: unknown) => {
      if (!active) return;
      const message = cause instanceof Error ? cause.message : "The imported image could not be decoded.";
      console.error("Imported asset preview failed.", cause);
      onErrorRef.current(message);
    });

    return () => {
      active = false;
      bitmapRef.current?.close();
      bitmapRef.current = null;
    };
  }, [asset, renderAt, ready]);

  return renderAt;
}
