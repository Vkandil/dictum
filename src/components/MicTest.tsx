import { useEffect, useRef, useState } from "react";
import { Check, Mic, Square } from "lucide-react";
import { listenDictation, startMicTest, stopMicTest } from "../lib/bridge";
import { Button } from "./Ui";

/** Level below which we treat the signal as "nothing is really reaching the microphone". */
const SIGNAL_THRESHOLD = 0.02;
/** Safety stop, so a forgotten test can't hold the microphone open indefinitely. */
const MAX_TEST_MS = 15000;

/**
 * Live signal meter for a microphone. Nothing is transcribed or inserted - this only answers
 * "is this device actually picking me up?", which otherwise can only be discovered by losing a
 * real dictation. Takes the device id directly so an unsaved selection can be tried out.
 */
export default function MicTest({ deviceId, label = "Test microphone", onError }: { deviceId: string | null; label?: string; onError?: (error: unknown) => void }) {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [error, setError] = useState("");
  const testingRef = useRef(false);

  useEffect(() => {
    let off: (() => void) | undefined;
    void listenDictation((state) => {
      if (!testingRef.current || state.phase !== "listening" || typeof state.level !== "number") return;
      setLevel(state.level);
      setPeak((current) => Math.max(current, state.level ?? 0));
    }).then((fn) => { off = fn; });
    return () => off?.();
  }, []);

  // Stop the capture if this component goes away mid-test (navigating to another page).
  useEffect(() => () => { if (testingRef.current) void stopMicTest(); }, []);

  const stop = async () => {
    testingRef.current = false;
    setTesting(false);
    setLevel(0);
    await stopMicTest();
  };

  const start = async () => {
    setError("");
    setPeak(0);
    setLevel(0);
    try {
      await startMicTest(deviceId);
      testingRef.current = true;
      setTesting(true);
      window.setTimeout(() => { if (testingRef.current) void stop(); }, MAX_TEST_MS);
    } catch (caught) {
      setError(String(caught).replace(/^Error:\s*/i, ""));
      onError?.(caught);
    }
  };

  const heard = peak > SIGNAL_THRESHOLD;
  return <div className="mic-test">
    <div className="mic-test-row">
      <Button variant="secondary" onClick={() => void (testing ? stop() : start())}>{testing ? <><Square size={14} fill="currentColor" />Stop</> : <><Mic size={15} />{label}</>}</Button>
      <div className="mic-meter" role="meter" aria-label="Microphone signal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
        {Array.from({ length: 12 }, (_, index) => <i key={index} className={(index + 1) / 12 <= level ? "active" : ""} />)}
      </div>
    </div>
    {error ? <p className="field-error">{error}</p> : null}
    {!error && testing ? <p className="field-help">{heard ? "Picking you up — speak to watch the meter move." : "Say something. If the meter stays flat, try another microphone."}</p> : null}
    {!error && !testing && heard ? <p className="field-help mic-test-ok"><Check size={13} />This microphone is working.</p> : null}
    {!error && !testing && peak > 0 && !heard ? <p className="field-help">No sound was detected. Check that this is the right device and that Windows allows apps to use it.</p> : null}
  </div>;
}
