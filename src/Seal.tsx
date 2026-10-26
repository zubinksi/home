/**
 * The open-items count as a burgundy wax seal: an uneven blob of glossy wax,
 * a stamped recess inside a ring, and the number raised in the same red.
 * Drawn in SVG so the edge can be irregular and the wax can catch the light.
 */
export function Seal({ count }: { count: number }) {
  const label = count ? String(count) : '✓';
  return (
    <svg className="seal-svg" viewBox="0 0 100 100" aria-hidden>
      <defs>
        {/* wobble a circle into a poured, uneven blob */}
        <filter id="seal-blob" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" result="blob" />
          {/* glossy wax: light the blob's soft edges like a raised surface */}
          <feGaussianBlur in="blob" stdDeviation="2.2" result="soft" />
          <feSpecularLighting in="soft" surfaceScale="5" specularConstant="0.85" specularExponent="22" lightingColor="#ffe7e0" result="spec">
            <fePointLight x="22" y="8" z="55" />
          </feSpecularLighting>
          <feComposite in="spec" in2="blob" operator="in" result="specIn" />
          <feComposite in="blob" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.75" k4="0" />
        </filter>
        <radialGradient id="seal-wax" cx="42%" cy="38%" r="65%">
          <stop offset="0" stopColor="#a1363b" />
          <stop offset="0.6" stopColor="#7e2429" />
          <stop offset="1" stopColor="#5c171b" />
        </radialGradient>
        <radialGradient id="seal-well" cx="50%" cy="50%" r="55%">
          <stop offset="0" stopColor="#8a2d32" />
          <stop offset="1" stopColor="#722125" />
        </radialGradient>
      </defs>

      {/* the poured wax */}
      <circle cx="50" cy="50" r="41" fill="url(#seal-wax)" filter="url(#seal-blob)" />

      {/* the stamp's recess: shadowed at the top-left lip, lit at the bottom-right */}
      <circle cx="50" cy="50" r="30" fill="url(#seal-well)" />
      <circle cx="50.7" cy="50.7" r="30" fill="none" stroke="rgba(255,190,180,0.35)" strokeWidth="1.4" />
      <circle cx="49.3" cy="49.3" r="30" fill="none" stroke="rgba(45,5,8,0.55)" strokeWidth="1.6" />

      {/* a raised ring inside the recess */}
      <circle cx="49.6" cy="49.6" r="24.5" fill="none" stroke="rgba(255,200,190,0.35)" strokeWidth="1.1" />
      <circle cx="50.4" cy="50.4" r="24.5" fill="none" stroke="rgba(45,5,8,0.5)" strokeWidth="1.1" />
      <circle cx="50" cy="50" r="24.5" fill="none" stroke="#93333a" strokeWidth="1" />

      {/* the count, raised in the same red */}
      <g className="seal-num" textAnchor="middle" dominantBaseline="central">
        <text x="51" y="52" fill="rgba(35,3,6,0.75)">{label}</text>
        <text x="49.2" y="49.3" fill="rgba(255,210,200,0.7)">{label}</text>
        <text x="50" y="50.5" fill="#b2454b">{label}</text>
      </g>

      {/* a soft glint on the wax */}
      <ellipse cx="34" cy="24" rx="12" ry="5" fill="rgba(255,240,235,0.28)" transform="rotate(-28 34 24)" />
    </svg>
  );
}
