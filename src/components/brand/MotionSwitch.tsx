import { setMotion, useMotionOff } from "@/bloq";

/** The Motion switch, bottom left of the landing (Maria's design in docs/design/landing-v2; prompt 27).
 *  Dark = motion on. The choice applies to the landing and the game and stays on this device. */
export function MotionSwitch() {
  const on = !useMotionOff();
  return (
    <div className="lv-motion">
      <button type="button" aria-pressed={on} onClick={() => setMotion(!on)} title={on ? "Turn motion off" : "Turn motion on"}>
        Motion
      </button>
    </div>
  );
}
