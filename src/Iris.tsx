/**
 * The household mark: one iris from the wallpaper in our house.
 * Drawn on a 76-unit grid traced from the wallpaper; left-hand parts are drawn
 * once and mirrored about x = 38. `--iris-gap` should match whatever the icon
 * sits on, so overlapping petals read as separate shapes.
 */
const MIRROR = 'matrix(-1 0 0 1 76 0)';

export const IRIS = {
  viewBox: '9.25 6.75 57.5 57.5',
  // upright petal behind the center, ruffled at its top
  standard:
    'M36.4 22C35.8 17.6 34.6 13.4 32.4 10.6 31.4 9.2 29.8 9.4 29.2 10.6 28 9.8 26.4 10.4 26.4 12 25 12.6 24.6 14.4 25.4 15.6 23.8 16.6 22.8 18.6 23.2 20.8 23.4 24.6 24.4 28.4 26.4 31.2 28.2 33.4 30.6 34.4 32.6 34.2 34.6 30.6 36.2 26.4 36.4 22Z',
  // shadowed fold where the standard turns in behind the center petal
  fold:
    'M32.6 13C29.6 15.8 26.8 19.4 25.2 23.2 24.6 26.8 25.4 30 27.4 32.6 28.6 33.6 30 34.1 31.2 34.2 29.4 29.2 29.4 21.6 32.6 13Z',
  // rounded center petal, ruffled along the bottom
  dome:
    'M38 14.4C33.6 14.4 30.2 17.4 29.4 21.8 28.6 26.4 29.8 30.6 31.6 33 32.8 34.4 34.2 33.8 35 34.8 36 35.6 37 35.4 38 36.2 39 35.4 40 35.6 41 34.8 41.8 33.8 43.2 34.4 44.4 33 46.2 30.6 47.4 26.4 46.6 21.8 45.8 17.4 42.4 14.4 38 14.4Z',
  domeVein:
    'M38 18C37.3 22.5 37.3 27.5 38 32',
  // broad fall hanging down and out, its tip turning in at the bottom
  fall:
    'M34.4 35.4C30.6 35.6 26.4 36.2 22.6 37.6 18.8 39 15.6 38.8 12.8 39.6 10.6 40.4 9.4 42.2 10 44.2 9.2 46 9.6 48.2 10.8 49.6 10.4 51.6 11.6 53.6 13.4 54.2 13.6 56.2 15.4 57.6 17.4 57.4 18.2 59.4 20.6 61 22.8 60.6 24.6 61.6 26.2 60.2 26.2 58.2 26.6 56 28.4 54.4 30.6 53.6 32.8 52.4 34 50 34 47.2L34 38.2 34.4 35.4Z',
  fallVeins: ['M32.4 39.2C26.4 40.4 19.6 43.4 14.8 47.8', 'M32.6 43.2C28.6 46.6 25.8 51.2 24.4 57.4'],
  // the beard showing at the top of the sheath
  beard: 'M38 34.6C36.6 36.6 36.4 40 37 43L38 45 39 43C39.6 40 39.4 36.6 38 34.6Z',
  // olive sheath, notched at the top, tapering to a point
  sheath:
    'M33.8 40C34.8 40.6 35.8 41.8 36.6 43.6L38 45.4 39.4 43.6C40.2 41.8 41.2 40.6 42.2 40 42.8 45 42.6 50.8 41.2 54.4 40.2 56.6 39 57.8 38 58.2 37 57.8 35.8 56.6 34.8 54.4 33.4 50.8 33.2 45 33.8 40Z',
  sheathInner: 'M38 46.5C37.2 49.5 37.2 53 38 56 38.8 53 38.8 49.5 38 46.5Z',
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
      </g>
      <path className="iris-fold" d={IRIS.fold} />
      <path className="iris-fold" d={IRIS.fold} transform={MIRROR} />
      <g className="iris-petal">
        <path d={IRIS.dome} />
        <path d={IRIS.fall} />
        <path d={IRIS.fall} transform={MIRROR} />
      </g>
      <g className="iris-vein">
        <path d={IRIS.domeVein} />
        {IRIS.fallVeins.map((d) => (
          <path key={d} d={d} />
        ))}
        {IRIS.fallVeins.map((d) => (
          <path key={`m${d}`} d={d} transform={MIRROR} />
        ))}
      </g>
      <path className="iris-petal" d={IRIS.beard} />
      <path className="iris-stem" d={IRIS.sheath} />
      <path className="iris-stem-light" d={IRIS.sheathInner} />
    </svg>
  );
}
