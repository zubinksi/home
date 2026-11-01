/** Top row of a phone detail page: back to the list. (Swipe for next / previous.) */
export function MobileNav({ onBack }: { onBack: () => void }) {
  return (
    <div className="mnav">
      <button className="mnav-back" onClick={onBack} aria-label="Back to the list">
        {/* a return arrow: back along the line, then round to where you came from */}
        <svg className="mnav-arrow" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 10 4 15l5 5" />
          <path d="M4 15h10.5a5.5 5.5 0 0 0 0-11H11" />
        </svg>
      </button>
    </div>
  );
}
