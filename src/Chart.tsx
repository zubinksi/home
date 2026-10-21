import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { dayMon } from './model';

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const PITCH = 4;
const INK = '#33332c';
const STIPPLE = '#57564b';

/** At most five evenly spaced dates for the axis (first and last always). */
function axisLabels<T>(points: T[]): T[] {
  if (points.length <= 5) return points;
  const n = 5;
  return Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / (n - 1))]);
}

type Point = { date: string; total: number };

/** Where each point sits on a canvas of the given size. */
function geometry(points: Point[], width: number, height: number) {
  const vals = points.map((p) => p.total);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    lo *= 0.9;
    hi *= 1.05;
  }
  const pad = 8;
  const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - pad * 2));
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height * 0.72 - pad);
  /** Nearest point to a horizontal position. */
  const indexAt = (px: number) =>
    points.length === 1 ? 0 : Math.max(0, Math.min(points.length - 1, Math.round(((px - pad) / (width - pad * 2)) * (points.length - 1))));
  return { vals, pad, x, y, indexAt };
}

/**
 * Ink line with a 4×4 Bayer ordered-dither stipple beneath it. Dragging a mouse
 * or finger across it marks a day and reports it through onScrub.
 */
export function Chart({ points, onScrub }: { points: Point[]; onScrub?: (p: Point | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [{ width, height: HEIGHT }, setSize] = useState({ width: 0, height: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  const g = useMemo(() => geometry(points, width, HEIGHT), [points, width, HEIGHT]);

  // Canvas size comes from CSS (.chart canvas), so it follows the page scale.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width || !HEIGHT || points.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = HEIGHT * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);

    const { vals, pad, x, y } = g;
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
  }, [width, HEIGHT, points, g]);

  // a new series (fresh prices) drops any stale mark
  useEffect(() => setScrub(null), [points]);

  const mark = (e: PointerEvent<HTMLDivElement>) => {
    if (!points.length || !width) return;
    const i = g.indexAt(e.clientX - e.currentTarget.getBoundingClientRect().left);
    if (i !== scrub) {
      setScrub(i);
      onScrub?.(points[i]);
    }
  };
  const clear = () => {
    setScrub(null);
    onScrub?.(null);
  };

  return (
    <div className="chart">
      <div
        className="chart-plot"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          mark(e);
        }}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons ? mark(e) : undefined)}
        onPointerUp={(e) => e.pointerType !== 'mouse' && clear()}
        onPointerCancel={clear}
        onPointerLeave={(e) => e.pointerType === 'mouse' && clear()}
        // keep a finger drag here from also swiping to the next sleeve
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <canvas ref={canvas} />
        {scrub !== null && scrub < points.length && (
          <>
            <span className="chart-guide" style={{ left: g.x(scrub) }} />
            <span className="chart-mark" style={{ left: g.x(scrub), top: g.y(points[scrub].total) }} />
          </>
        )}
      </div>
      <div className="chart-axis">
        {axisLabels(points).map((p, i) => (
          <span key={i}>{dayMon(p.date)}</span>
        ))}
      </div>
      {points.length < 3 && <div className="module-note">Append a review to src/data.ts each quarter to extend the line.</div>}
    </div>
  );
}
