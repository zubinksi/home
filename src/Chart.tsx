import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useLamplight } from './lamplight';
import { dayMon } from './model';

/** At most five evenly spaced dates for the axis (first and last always). */
function axisLabels<T>(points: T[]): T[] {
  if (points.length <= 5) return points;
  const n = 5;
  return Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / (n - 1))]);
}

type Point = { date: string; total: number };

/** Where each point sits on a canvas of the given size. */
export type Overlay = {
  values: (number | null)[];
  color: string;
  /** dashed, for a fixed level rather than a line through time */
  dashed?: boolean;
  /** written at the right-hand end of the line */
  label?: string;
};

function geometry(points: Point[], width: number, height: number, overlays: Overlay[] = []) {
  const vals = points.map((p) => p.total);
  const all = [...vals, ...overlays.flatMap((o) => o.values.filter((v): v is number => v != null))];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  // room above the top line for its label
  if (overlays.some((o) => o.label)) hi += (hi - lo) * 0.1;
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
 * Ink line with a linen-weave shading beneath it. Dragging a mouse
 * or finger across it marks a day and reports it through onScrub.
 */
export function Chart({
  points,
  overlays,
  onScrub,
}: {
  points: Point[];
  /** more lines on the same scale, one value per point (e.g. moving averages); colour is a CSS variable */
  overlays?: Overlay[];
  onScrub?: (p: Point | null, i: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [{ width, height: HEIGHT }, setSize] = useState({ width: 0, height: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  const light = useLamplight();
  const g = useMemo(() => geometry(points, width, HEIGHT, overlays), [points, width, HEIGHT, overlays]);

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
    // colours follow the page's palette (day or evening)
    const css = getComputedStyle(c);
    const INK = css.getPropertyValue('--ink').trim();
    const STIPPLE = css.getPropertyValue('--stipple').trim();

    const { vals, pad, x, y } = g;
    const lineAt = (px: number) => {
      if (points.length === 1) return y(vals[0]);
      const t = ((px - pad) / (width - pad * 2)) * (points.length - 1);
      const i = Math.max(0, Math.min(points.length - 2, Math.floor(t)));
      const f = Math.max(0, Math.min(1, t - i));
      return y(vals[i] + (vals[i + 1] - vals[i]) * f);
    };
    // linen: fine crossing threads of uneven weight, with slubs and breaks,
    // clipped just under the line and fading toward the bottom
    const x0 = x(0);
    const x1 = x(points.length - 1);
    let seed = 11; // fixed, so the weave doesn't shimmer as prices update
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, HEIGHT);
    for (let px = x0; px <= x1; px += 1) ctx.lineTo(px, lineAt(px) + 3);
    ctx.lineTo(x1, HEIGHT);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = STIPPLE;
    ctx.lineWidth = 0.8;
    const thread = (horizontal: boolean, at: number, len: number) => {
      let p = -rnd() * 30;
      while (p < len) {
        const seg = 12 + rnd() * 50;
        ctx.globalAlpha = 0.18 + rnd() * 0.32;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(p, at);
          ctx.lineTo(p + seg, at);
        } else {
          ctx.moveTo(at, p);
          ctx.lineTo(at, p + seg);
        }
        ctx.stroke();
        p += seg + rnd() * 2.5;
      }
    };
    for (let y = 0.5; y < HEIGHT; y += 2) thread(true, y + (rnd() - 0.5) * 0.4, width);
    for (let xx = Math.floor(x0) + 0.5; xx < x1; xx += 2) thread(false, xx, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    fade.addColorStop(0, 'rgba(0,0,0,0.05)');
    fade.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, HEIGHT);
    ctx.restore();

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

    // overlay lines (e.g. moving averages)
    for (const o of overlays ?? []) {
      const color = css.getPropertyValue(o.color).trim();
      ctx.strokeStyle = color;
      ctx.lineWidth = o.dashed ? 1 : 1.25;
      ctx.setLineDash(o.dashed ? [4, 3] : []);
      ctx.beginPath();
      let started = false;
      o.values.forEach((v, i) => {
        if (v == null) return;
        if (started) ctx.lineTo(x(i), y(v));
        else ctx.moveTo(x(i), y(v));
        started = true;
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const last = o.values[o.values.length - 1];
      if (o.label && last != null) {
        ctx.font = `400 ${Math.round(10 * (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16) + 1)}px ${css.getPropertyValue('--mono')}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = color;
        ctx.fillText(o.label, width - pad, y(last) - 3);
      }
    }
  }, [width, HEIGHT, points, overlays, g, light]);

  // a new series (fresh prices) drops any stale mark
  useEffect(() => setScrub(null), [points]);

  const mark = (e: PointerEvent<HTMLDivElement>) => {
    if (!points.length || !width) return;
    const i = g.indexAt(e.clientX - e.currentTarget.getBoundingClientRect().left);
    if (i !== scrub) {
      setScrub(i);
      onScrub?.(points[i], i);
    }
  };
  const clear = () => {
    setScrub(null);
    onScrub?.(null, -1);
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
