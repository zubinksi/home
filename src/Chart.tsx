import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTheme } from './theme';
import { dayMon, longDate } from './model';

/** At most five evenly spaced dates for the axis (first and last always). */
function axisLabels<T>(points: T[]): T[] {
  if (points.length <= 5) return points;
  const n = 5;
  return Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / (n - 1))]);
}

/** Round values (1, 2, 2.5 or 5 × a power of ten) for the y-axis lines: the widest step giving at least three. */
function yTicks(lo: number, hi: number): number[] {
  if (!(hi > lo)) return [];
  const at = (step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  };
  const mag = 10 ** Math.floor(Math.log10(hi - lo));
  for (const step of [5, 2.5, 2, 1, 0.5, 0.25, 0.2, 0.1].map((m) => m * mag)) {
    const ticks = at(step);
    if (ticks.length >= 3) return ticks;
  }
  return at(0.05 * mag);
}

type Point = { date: string; total: number };

/** Where each point sits on a canvas of the given size. */
export type Overlay = {
  values: (number | null)[];
  color: string;
  /** dashed, for a fixed level rather than a line through time */
  dashed?: boolean;
  /** a fixed price level (e.g. a sell rung): drawn edge to edge and labelled on the y axis */
  level?: boolean;
};

function geometry(points: Point[], width: number, height: number, overlays: Overlay[] = [], right = 0) {
  const vals = points.map((p) => p.total);
  const all = [...vals, ...overlays.flatMap((o) => o.values.filter((v): v is number => v != null))];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  // room above the top level for its axis label
  if (overlays.some((o) => o.level)) hi += (hi - lo) * 0.08;
  if (hi === lo) {
    lo *= 0.9;
    hi *= 1.05;
  }
  const pad = 8;
  // the line runs from pad to `span` past it; `right` is kept clear for the labels
  const span = width - pad * 2 - right;
  const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * span);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height * 0.72 - pad);
  /** The value at a height on the canvas (the inverse of y). */
  const valueAt = (py: number) => lo + (1 - (py - pad) / (height * 0.72 - pad)) * (hi - lo);
  /** Nearest point to a horizontal position. */
  const indexAt = (px: number) =>
    points.length === 1 ? 0 : Math.max(0, Math.min(points.length - 1, Math.round(((px - pad) / span) * (points.length - 1))));
  return { vals, hi, pad, span, x, y, valueAt, indexAt };
}

/** The mono face the chart draws its words in, at a size in rem. */
function chartFont(css: CSSStyleDeclaration, rem: number, weight = 400) {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return `${weight} ${Math.round(rem * root * 10) / 10}px ${css.getPropertyValue('--mono')}`;
}

let measurer: CanvasRenderingContext2D | null = null;
/** Width of a piece of chart text, for the room kept to the right of the line. */
function textWidth(text: string, rem: number, weight = 400) {
  measurer ??= document.createElement('canvas').getContext('2d');
  if (!measurer) return text.length * rem * 10;
  measurer.font = chartFont(getComputedStyle(document.documentElement), rem, weight);
  return measurer.measureText(text).width;
}
const AXIS_REM = 0.5938;
const TAG_PAD = 5; // px either side of the price inside its tag
const GUTTER_GAP = 8; // px between the line's end and the right-hand labels
const END_LABEL_REM = 0.6875;

/**
 * Ink line with a linen-weave shading beneath it. Dragging a mouse
 * or finger across it marks a day and reports it through onScrub.
 */
export function Chart({
  points,
  overlays,
  onScrub,
  yFormat,
  format,
  endLabel = false,
  corner,
}: {
  /** a small note at the top left, in the readout's row (it gives way while scrubbing) */
  corner?: ReactNode;
  points: Point[];
  /** how the y-axis values read, e.g. "$1.2M" */
  yFormat: (v: number) => string;
  /** a value in full, for the scrub readout (and the end label), e.g. "$81.31" */
  format: (v: number) => string;
  /** show the latest value in a tag at the right, level with the line's end */
  endLabel?: boolean;
  /** more lines on the same scale, one value per point (e.g. moving averages); colour is a CSS variable */
  overlays?: Overlay[];
  onScrub?: (p: Point | null, i: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [{ width, height: HEIGHT }, setSize] = useState({ width: 0, height: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  const theme = useTheme(); // the colours come from CSS; redraw when they change
  const last = points[points.length - 1];
  const endText = endLabel && last ? format(last.total) : '';
  // the y labels and the price tag share a gutter on the right, as wide as the widest of them
  const right = useMemo(() => {
    const all = [...points.map((p) => p.total), ...(overlays ?? []).flatMap((o) => o.values.filter((v): v is number => v != null))];
    if (!all.length) return 0;
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const labels = yTicks(lo - (hi - lo), hi + (hi - lo) * 0.2).map((v) => textWidth(yFormat(v), AXIS_REM));
    const tag = endText ? textWidth(endText, END_LABEL_REM, 500) + TAG_PAD * 2 : 0;
    return Math.ceil(Math.max(tag, ...labels)) + GUTTER_GAP;
  }, [points, overlays, yFormat, endText]);
  const g = useMemo(() => geometry(points, width, HEIGHT, overlays, right), [points, width, HEIGHT, overlays, right]);

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

    const { vals, pad, span, x, y } = g;
    const lineAt = (px: number) => {
      if (points.length === 1) return y(vals[0]);
      const t = ((px - pad) / span) * (points.length - 1);
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

    // a minimal y axis: faint dotted rules at a few round values, labelled in the
    // right-hand gutter beside the price tag
    const MUTED = css.getPropertyValue('--muted').trim();
    const ruleEnd = width - right + GUTTER_GAP / 2;
    const tagY = endText ? y(vals[vals.length - 1]) : null;
    const clearOfTag = (ty: number) => tagY == null || Math.abs(ty - tagY) >= 20;
    ctx.font = chartFont(css, AXIS_REM);
    if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = '0.06em';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = MUTED;
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 0.75;
    ctx.setLineDash([1, 3]);
    // every price level gets its value on the axis, in its line's colour; the
    // round values fill in wherever they don't crowd one
    const levels = (overlays ?? [])
      .filter((o) => o.level && o.values[0] != null)
      .map((o) => ({ v: o.values[0]!, color: css.getPropertyValue(o.color).trim() }));
    // down to just above the axis, since the shading runs below the lowest point
    for (const v of yTicks(g.valueAt(HEIGHT - 10), g.hi)) {
      const ty = Math.round(y(v)) + 0.5;
      if (ty < 8) continue; // no room for its label at the very top
      if (levels.some((l) => Math.abs(y(l.v) - ty) < 14)) continue;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(ruleEnd, ty);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (clearOfTag(ty)) ctx.fillText(yFormat(v), width, ty);
    }
    ctx.setLineDash([]);
    for (const l of levels) {
      const ly = Math.round(y(l.v));
      if (!clearOfTag(ly)) continue;
      ctx.fillStyle = l.color;
      ctx.fillText(yFormat(l.v), width, ly);
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

    // overlay lines (e.g. moving averages)
    for (const o of overlays ?? []) {
      const color = css.getPropertyValue(o.color).trim();
      ctx.strokeStyle = color;
      ctx.lineWidth = o.dashed ? 1 : 1.25;
      ctx.setLineDash(o.dashed ? [4, 3] : []);
      ctx.beginPath();
      if (o.level && o.values[0] != null) {
        // a price level runs from the left edge to its label in the gutter
        ctx.moveTo(0, y(o.values[0]));
        ctx.lineTo(ruleEnd, y(o.values[0]));
      } else {
        let started = false;
        o.values.forEach((v, i) => {
          if (v == null) return;
          if (started) ctx.lineTo(x(i), y(v));
          else ctx.moveTo(x(i), y(v));
          started = true;
        });
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // the latest value in a small ink tag, level with the end dot, flush with the right edge
    if (endText && tagY != null) {
      ctx.font = chartFont(css, END_LABEL_REM, 500);
      if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = '0px';
      const w = textWidth(endText, END_LABEL_REM, 500) + TAG_PAD * 2;
      const h = 16;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(width - w, tagY - h / 2, w, h, 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = css.getPropertyValue('--slab').trim();
      ctx.fillText(endText, width - w / 2, tagY + 0.5);
    }
  }, [width, HEIGHT, points, overlays, g, theme, yFormat, endText, right]);

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

  const at = scrub !== null && scrub < points.length ? points[scrub] : null;
  return (
    <div className="chart">
      {/* while scrubbing, the day and its value, together and centred above the plot */}
      <div className={`chart-tip ${corner && !at ? 'has-corner' : ''}`} aria-live="polite">
        {at ? (
          <>
            {longDate(new Date(at.date + 'T00:00:00'))} · <b>{format(at.total)}</b>
          </>
        ) : (
          corner
        )}
      </div>
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
        {at && (
          <>
            <span className="chart-guide" style={{ left: g.x(scrub!) }} />
            <span className="chart-mark" style={{ left: g.x(scrub!), top: g.y(at.total) }} />
          </>
        )}
      </div>
      {/* dates span exactly the line, not the gutter */}
      <div className="chart-axis" style={{ paddingLeft: g.pad, paddingRight: g.pad + right }}>
        {axisLabels(points).map((p, i) => (
          <span key={i}>{dayMon(p.date)}</span>
        ))}
      </div>
      {points.length < 3 && <div className="module-note">Append a review to src/data.ts each quarter to extend the line.</div>}
    </div>
  );
}
