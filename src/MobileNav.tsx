/** Top row of a phone detail page: back to the list. (Swipe for next / previous.) */
export function MobileNav({ onBack }: { onBack: () => void }) {
  return (
    <div className="mnav">
      <button className="mnav-back" onClick={onBack} aria-label="Back to the list">
        <span aria-hidden>←</span>
      </button>
    </div>
  );
}
