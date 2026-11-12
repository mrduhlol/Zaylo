import { useEffect, useRef, useState } from 'react';
import { useWorkspacePreferences } from '../../../stores/useWorkspacePreferences';
import { nextBackground } from '../hooks/chatSession';

const selections = new Map<string, number>();
let previous = -1;
function selection(id: string) {
  if (!selections.has(id)) {
    previous = nextBackground(10, previous);
    selections.set(id, previous);
    if (selections.size > 100) selections.delete(selections.keys().next().value!);
  }
  return selections.get(id)!;
}

/** Original procedural clouds and user supplied media. No source-site code or runtime fetches. */
export function ChatBackground({ conversationId, active }: { conversationId: string; active: boolean }) {
  const [mounted, setMounted] = useState(active);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enabled = useWorkspacePreferences(s => s.animationsEnabled);
  const intensity = useWorkspacePreferences(s => s.animationIntensity);
  const variant = selection(conversationId);
  useEffect(() => {
    if (active) { setMounted(true); return; }
    const timer = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!mounted || !canvas || intensity <= 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;
    let disposed = false;
    let time = 0;
    let video: HTMLVideoElement | undefined;
    let image: HTMLImageElement | undefined;
    const isStatic = () => !enabled || reduced.matches || !active;
    const keyMatte = (white: boolean) => {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = frame;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const value = white ? 255 - Math.min(data[i], data[i + 1], data[i + 2]) : Math.max(data[i], data[i + 1], data[i + 2]);
        const alpha = Math.min(1, Math.max(0, (value - 45) / 85));
        const edge = Math.min(1, x / (width * .14), (width - 1 - x) / (width * .14), y / (height * .14), (height - 1 - y) / (height * .14));
        data[i + 3] = Math.round(data[i + 3] * alpha * edge * edge * (3 - 2 * edge));
      }
      ctx.putImageData(frame, 0, 0);
    };
    const hash = (x: number, y: number) => {
      const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const noise = (x: number, y: number) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const top = hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u;
      const bottom = hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u;
      return top * (1 - v) + bottom * v;
    };
    const draw = () => {
      if (disposed || document.hidden) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (variant === 9) {
        // Original layered value-noise cloud density; no reference-site renderer code.
        ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--theme-accent').trim() || '#8270a8';
        ctx.font = '12px monospace';
        const ramp = ' .,:;i+=xX#';
        for (let y = 0; y < 30; y++) for (let x = 0; x < 80; x++) {
          const nx = x * .055 + time * .035, ny = y * .11;
          const density = noise(nx, ny) * .6 + noise(nx * 2 + 7, ny * 2 + time * .02) * .27 + noise(nx * 4, ny * 4) * .13;
          const shade = Math.max(0, Math.min(9, Math.floor((density - .28) * 23)));
          const envelope = Math.sin(Math.PI * x / 80) * Math.sin(Math.PI * y / 30);
          ctx.globalAlpha = envelope * .65 * Math.min(1, shade / 3);
          ctx.fillText(ramp[shade], x * 8, y * 12);
        }
        ctx.globalAlpha = 1;
      } else if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        keyMatte(variant === 4);
      } else if (image?.complete && image.naturalWidth) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        keyMatte(false);
      }
      time += .1;
      if (!isStatic()) timer = window.setTimeout(draw, 100);
    };
    const sync = () => {
      window.clearTimeout(timer);
      if (document.hidden || isStatic()) video?.pause();
      else void video?.play().catch(() => {});
      draw();
    };
    const base = `${import.meta.env.BASE_URL}chat-backgrounds/`;
    if (variant < 8) {
      video = document.createElement('video');
      video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
      video.src = `${base}study-${variant}.mp4`;
      video.onloadeddata = () => {
        canvas.width = video!.videoWidth; canvas.height = video!.videoHeight;
        sync();
      };
      video.load();
    } else if (variant === 8) {
      image = new Image(); image.onload = () => { canvas.width = image!.naturalWidth; canvas.height = image!.naturalHeight; sync(); };
      image.src = `${base}blue-arc.png`;
    } else { canvas.width = 640; canvas.height = 360; sync(); }
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    return () => {
      disposed = true; window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync);
      if (video) { video.pause(); video.onloadeddata = null; video.removeAttribute('src'); video.load(); }
      if (image) image.onload = null;
    };
  }, [variant, mounted, enabled, active, intensity]);

  if (!mounted) return null;
  return <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center motion-safe:transition-opacity motion-safe:duration-300" style={{ opacity: active ? intensity * .6 : 0 }}>
    <canvas ref={canvasRef} className="max-w-full object-contain" style={variant === 8 ? { width: 'min(32%, 296px)', height: 'auto', transform: 'rotate(90deg)' } : { width: 'min(90%, 900px)', maxHeight: '85%' }} />
  </div>;
}
