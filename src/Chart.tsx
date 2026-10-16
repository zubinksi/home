import { useEffect, useRef, useState } from 'react';
import { monYY } from './model';

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const HEIGHT = 230;
const PITCH = 4;
const INK = '#33332c';
const STIPPLE = '#57564b';

/** Ink line with a 4×4 Bayer ordered-dither stipple beneath it. */
export function Chart({ points }: { points: { date: string; total: number }[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width || points.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = HEIGHT * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);

    const vals = points.map((p) => p.total);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi === lo) {
      lo *= 0.9;
      hi *= 1.05;
    }
    const pad = 8;
    const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - pad * 2));
    const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (HEIGHT * 0.72 - pad);
    const lineAt = (px: number) => {
      if (points.length === 1) return y(vals[0]);
      const t = ((px - pad) / (width - pad * 2)) * (points.length - 1);
      const i = Math.max(0, Math.min(points.length - 2, Math.floor(t)));
      const f = Math.max(0, Math.min(1, t - i));
      return y(vals[i] + (vals[i + 1] - vals[i]) * f);
    };

    // stipple
    ctx.fillStyle = STIPPLE;
    for (let gx = 0; gx * PITCH < width; gx++) {
      const px = gx * PITCH + PITCH / 2;
      if (px < x(0) || px > x(points.length - 1)) continue;
      const top = lineAt(px) + 3;
      for (let gy = 0; gy * PITCH < HEIGHT; gy++) {
        const py = gy * PITCH + PITCH / 2;
        if (py < top) continue;
        const depth = (py - top) / (HEIGHT - top);
        const density = Math.sqrt(1 - depth) * 0.8;
        if ((BAYER[gy % 4][gx % 4] + 0.5) / 16 < density) {
          ctx.beginPath();
          ctx.arc(px, py, 1.7 / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // line + end dot
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.total)) : ctx.moveTo(x(i), y(p.total))));
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x(points.length - 1), y(vals[vals.length - 1]), 3, 0, Math.PI * 2);
    ctx.fill();
  }, [width, points]);

  return (
    <div className="chart" ref={wrap}>
      <canvas ref={canvas} style={{ width: '100%', height: HEIGHT, display: 'block' }} />
      <div className="chart-axis">
        {points.map((p, i) => (
          <span key={i}>{p.date === 'now' ? 'NOW' : monYY(p.date)}</span>
        ))}
      </div>
      {points.length <= 2 && <div className="module-note">One snapshot so far. Append one to src/data.ts at each quarterly review.</div>}
    </div>
  );
}
