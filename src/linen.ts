// THE LINEN. The charts' linen weave, painted once as a seamless tile and laid
// over the wall on every theme: fine crossing threads of uneven weight with
// slubs and breaks, as under the charts; dark threads for the light wall,
// light ones for the dark walls.

const TILE = 160; // CSS pixels

function paint(ink: string): string {
  const scale = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.8;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // a thread runs the tile's length in segments, wrapping round so the tile repeats seamlessly
  const thread = (horizontal: boolean, at: number) => {
    let p = -rnd() * 30;
    while (p < TILE) {
      const seg = 12 + rnd() * 50;
      ctx.globalAlpha = 0.18 + rnd() * 0.32;
      for (const shift of [0, -TILE, TILE]) {
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(p + shift, at);
          ctx.lineTo(p + seg + shift, at);
        } else {
          ctx.moveTo(at, p + shift);
          ctx.lineTo(at, p + seg + shift);
        }
        ctx.stroke();
      }
      p += seg + rnd() * 2.5;
    }
  };
  for (let y = 0.5; y < TILE; y += 2) thread(true, y);
  for (let x = 0.5; x < TILE; x += 2) thread(false, x);
  return canvas.toDataURL('image/png');
}

export function applyLinen() {
  const root = document.documentElement;
  root.style.setProperty('--linen-dark', `url(${paint('#3a2e24')})`);
  root.style.setProperty('--linen-light', `url(${paint('#f1e9d8')})`);
  root.dataset.linen = '';
}
