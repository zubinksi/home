/** Top row of a phone detail page: back to the list, and next / previous. */
export function MobileNav({
  onBack,
  position,
  onStep,
}: {
  onBack: () => void;
  position: { index: number; count: number } | null;
  onStep: (d: 1 | -1) => void;
}) {
  return (
    <div className="mnav">
      <button className="mnav-back" onClick={onBack} aria-label="Back to the list">
        <span aria-hidden>←</span> ALL
      </button>
      {position && (
        <div className="mnav-step">
          <button onClick={() => onStep(-1)} aria-label="Previous">
            ‹
          </button>
          <span>
            {position.index} / {position.count}
          </span>
          <button onClick={() => onStep(1)} aria-label="Next">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
