import { useEffect, useRef } from "react";
import type { Sky } from "./weather";

// THE LIGHT AT THE DOOR. Behind the PIN pad, sun comes through the leaves of a
// tree onto the wall: soft golden flecks, each a little image of the sun through
// a gap in the leaves, gathered where the canopy is thin and shimmering as the
// branches move. Nearer the tree (the top left) the flecks are bigger and
// denser. It's a small WebGL shader drawn at half resolution, which also gives
// the light its softness; without WebGL the wall simply stays plain. It follows
// DC's weather: full and golden in sun, clouds drifting over it when it's partly
// cloudy, faint and grey when overcast or raining, cool and dim at night. Going
// in, the Gate fades it straight to the wall inside.

const FRAG = `#version 300 es
precision highp float;
uniform vec2 res;
uniform float t;
uniform vec3 wall;
uniform float strength; // how much sun gets through: 1 in full sun
uniform float clouds;   // clouds drifting across it, 0 to 1
uniform vec3 tint;      // the light's colour: golden sun, cool moon
out vec4 colour;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1 + 3.7) + 0.15 * noise(p * 4.3 + 9.1); }

// sun flecks: a soft disc in each cell, each a fixed gap in the leaves. They
// don't wander; they only flicker as single leaves flip in front of them
float flecks(vec2 p, float size, float flutter) {
  vec2 i = floor(p), f = fract(p);
  float light = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(x, y), id = i + n, h = hash2(id);
      vec2 o = 0.15 + 0.7 * h;
      float r = size * (0.55 + 0.6 * h.x);
      float flicker = 1.0 - flutter * (0.5 + 0.5 * sin(t * (1.6 + 2.4 * h.x) + 6.2831 * h.y));
      float d = length(n + o - f);
      light = max(light, smoothstep(r, r * 0.35, d) * (0.6 + 0.4 * h.y) * flicker);
    }
  return light;
}

// the branch swaying: back and forth together, in gusts that come and go, and
// now and then a bigger one that swings it further for a few seconds
vec2 swayAt(float k) {
  float gust = 0.55 + 0.45 * sin(t * 0.19) * sin(t * 0.07 + 1.3);
  gust += 0.9 * pow(max(0.0, sin(t * 0.083 + 0.7)), 12.0) + 0.6 * pow(max(0.0, sin(t * 0.131 + 2.9)), 14.0);
  vec2 s = vec2(0.034 * sin(t * 1.05) + 0.015 * sin(t * 2.3 + 1.1), 0.012 * sin(t * 0.85 + 2.0) + 0.005 * sin(t * 1.9));
  return s * gust * k;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res.y;           // square units, 1 = the screen's height
  vec2 p = vec2(uv.x, 1.0 - uv.y);             // from the top left
  // nearness to the tree: strongest at the top left, but some sun everywhere
  float near = clamp(1.05 - p.y * 0.95 - p.x * 0.12, 0.12, 1.0);
  // the canopy's layers sway together but not quite in step: the outer twigs
  // and leaves (smaller flecks, the leaves' shadows) move a little further
  vec2 q = p + swayAt(1.0), q2 = p + swayAt(1.35), q3 = p + swayAt(1.7);
  // where the canopy is thin enough for sun to come through
  float gaps = smoothstep(0.42 - 0.22 * near, 0.72 - 0.12 * near, fbm(q * 1.8));
  // a fixed warp makes the round flecks lumpy, like light through real leaves
  vec2 w = q + 0.09 * (vec2(fbm(q * 3.0), fbm(q * 3.0 + 5.2)) - 0.5);
  vec2 w2 = q2 + 0.09 * (vec2(fbm(q2 * 3.0), fbm(q2 * 3.0 + 5.2)) - 0.5);
  float big = flecks(w * 3.4, 0.85, 0.06);
  float small = flecks(w2 * 7.5 + 7.0, 0.7, 0.2);
  float pools = 1.0 - (1.0 - big * (0.4 + 0.6 * near)) * (1.0 - small * 0.75);
  // the nearest leaves: dark shapes cutting into the light
  float leaves = smoothstep(0.5, 0.7, fbm(q3 * 5.0));
  float light = clamp(pools * (0.3 + 0.7 * gaps) * (0.2 + 1.0 * near) * (1.0 - 0.75 * leaves) * 1.25, 0.0, 1.0);
  vec3 shade = wall * 0.97;                      // the wall in the shade: nearly the gray inside, so going in is seamless
  vec3 sun = tint;
  light = smoothstep(0.05, 0.85, light);
  // clouds: broad soft shadows drifting slowly across the whole wall
  float drift = smoothstep(0.35, 0.75, fbm(vec2(p.x * 0.9 - t * 0.035, p.y * 0.6 + t * 0.008)));
  light *= strength * (1.0 - clouds * drift);
  // a touch of grain stops smooth gradients banding
  float grain = (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 128.0;
  colour = vec4(mix(shade, sun * 0.95, light) + grain, 1.0);
}`;

const VERT = `#version 300 es
in vec2 at;
void main() { gl_Position = vec4(at, 0.0, 1.0); }`;

/** How each sky lights the wall: sun strength, drifting clouds, the light's colour. */
const SKIES: Record<Sky, { strength: number; clouds: number; tint: [number, number, number] }> = {
  clear: { strength: 1, clouds: 0, tint: [1.0, 0.8, 0.5] },
  partly: { strength: 0.95, clouds: 0.75, tint: [1.0, 0.82, 0.55] },
  overcast: { strength: 0.32, clouds: 0.3, tint: [0.92, 0.88, 0.8] },
  rain: { strength: 0.2, clouds: 0.4, tint: [0.82, 0.86, 0.9] },
  snow: { strength: 0.42, clouds: 0.25, tint: [0.95, 0.97, 1.0] },
  storm: { strength: 0.14, clouds: 0.6, tint: [0.78, 0.8, 0.86] },
  night: { strength: 0.38, clouds: 0.1, tint: [0.62, 0.7, 0.86] },
};

/** Draws the dappled light into the canvas; returns a cleanup. */
function dapple(canvas: HTMLCanvasElement, sky: { current: Sky }): (() => void) | undefined {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const at = gl.getAttribLocation(prog, "at");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "res");
  const uT = gl.getUniformLocation(prog, "t");
  const uStrength = gl.getUniformLocation(prog, "strength");
  const uClouds = gl.getUniformLocation(prog, "clouds");
  const uTint = gl.getUniformLocation(prog, "tint");

  // the wall's own colour, so the light falls on the page's ground
  const ground = getComputedStyle(document.documentElement)
    .getPropertyValue("--ground")
    .trim();
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ground);
  const rgb = m
    ? [1, 2, 3].map((k) => parseInt(m[k], 16) / 255)
    : [0.56, 0.57, 0.53];
  gl.uniform3f(gl.getUniformLocation(prog, "wall"), rgb[0], rgb[1], rgb[2]);

  // half resolution: cheaper, and the light is meant to be soft
  const size = () => {
    canvas.width = Math.max(1, Math.round(innerWidth * 0.5));
    canvas.height = Math.max(1, Math.round(innerHeight * 0.5));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  size();
  addEventListener("resize", size);

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now() - 20_000; // start mid-shimmer, not from a tidy t = 0
  let frame = 0;
  // the light eases toward the sky's settings, so a change in the weather
  // comes in over a few seconds rather than at once
  const cur = { ...SKIES[sky.current], tint: [...SKIES[sky.current].tint] as [number, number, number] };
  let last = performance.now();
  const draw = (now: number) => {
    const goal = SKIES[sky.current];
    const k = Math.min(1, (now - last) / 2500);
    last = now;
    cur.strength += (goal.strength - cur.strength) * k;
    cur.clouds += (goal.clouds - cur.clouds) * k;
    cur.tint = cur.tint.map((v, i) => v + (goal.tint[i] - v) * k) as [number, number, number];
    gl.uniform1f(uStrength, cur.strength);
    gl.uniform1f(uClouds, cur.clouds);
    gl.uniform3f(uTint, cur.tint[0], cur.tint[1], cur.tint[2]);
    gl.uniform1f(uT, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!still) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("resize", size);
  };
}

export function DoorLight({ sky }: { sky: Sky }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef(sky);
  skyRef.current = sky;
  useEffect(() => (ref.current ? dapple(ref.current, skyRef) : undefined), []);
  return (
    <div className="door-light" aria-hidden>
      <canvas ref={ref} className="door-dapple" />
    </div>
  );
}
