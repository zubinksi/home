/**
 * The household mark: one iris from the wallpaper in our house.
 * Left-hand petals are drawn once and mirrored. `--iris-gap` should match
 * whatever the icon sits on, so overlapping petals read as separate shapes.
 */
const MIRROR = 'matrix(-1 0 0 1 48 0)';

export const IRIS = {
  viewBox: '6 1.5 36 36',
  // tall upright petal hugging the center, ruffled at the top
  standard:
    'M21.3 19C17.6 18.4 14.4 15.4 13.9 11.2 13.7 9.6 14.2 8 15.2 7.2 15.7 8 16.4 8.4 17.2 8.3 17.3 7 18 6 19 5.6 19.4 6.6 20.1 7.2 21 7.3 21.9 10.4 22 14.8 21.3 19Z',
  // rounded center petal narrowing into the stem
  dome:
    'M24 9.6C20.4 9.6 18.5 12.6 18.6 16 18.7 19.6 21 22.6 24 24.6 27 22.6 29.3 19.6 29.4 16 29.5 12.6 27.6 9.6 24 9.6Z',
  // broad fall drooping down and out, scalloped along its outer edge
  fall:
    'M22.6 21.6C20 19.4 14.8 18.8 10.8 20.2 8.9 20.9 7.6 22.6 7.9 24.4 7 25.8 7.4 27.8 9 28.3 8.9 30.1 10.3 31.5 12.1 31.2 12.8 32.9 14.8 33.5 16.3 32.5 17.9 33 19.4 31.8 19.4 30.1 21.3 28.2 22.4 25 22.6 21.6Z',
  stem: 'M22.5 23.5 22.8 31.5C23.6 32.1 24.4 32.1 25.2 31.5L25.5 23.5C24.5 24.3 23.5 24.3 22.5 23.5Z',
};

export function Iris({ size = 24, className = '', title }: { size?: number | string; className?: string; title?: string }) {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      className={`iris ${className}`}
      viewBox={IRIS.viewBox}
      width={s}
      height={s}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g className="iris-petal">
        <path d={IRIS.standard} />
        <path d={IRIS.standard} transform={MIRROR} />
        <path d={IRIS.dome} />
        <path d={IRIS.fall} />
        <path d={IRIS.fall} transform={MIRROR} />
      </g>
      <path className="iris-stem" d={IRIS.stem} />
    </svg>
  );
}
