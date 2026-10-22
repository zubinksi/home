import { setLight, useLamplight } from './lamplight';

/** A little brass toggle plate: up for day, down for evening. */
export function LightSwitch() {
  const light = useLamplight();
  const day = light === 'day';
  return (
    <button
      className={`switch ${day ? 'is-up' : 'is-down'}`}
      role="switch"
      aria-checked={!day}
      aria-label="Evening light"
      title={day ? 'Switch to evening' : 'Switch to day'}
      onClick={() => setLight(day ? 'evening' : 'day')}
    >
      <span className="switch-screw" />
      <span className="switch-slot">
        <span className="switch-lever" />
      </span>
      <span className="switch-screw" />
    </button>
  );
}
