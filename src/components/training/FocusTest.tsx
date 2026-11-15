import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusDetails } from '../../types';
import { FOCUS_MIN_VALID_MS, FOCUS_ROUNDS, letterHeightMm } from '../../services/measurementService';
import { mean } from '../../utils/stats';

type Direction = FocusDetails['rounds'][number]['direction'];
type Phase = 'ready' | 'wait' | 'respond';

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
    navigator.vibrate?.(60);
  } catch {
    /* sound is optional */
  }
}

function randomCode(digits: number): string {
  let s = '';
  while (s.length < digits) s += String(Math.floor(Math.random() * 10));
  return s;
}

/**
 * Near–far focus switching, 10 alternating rounds.
 *  far→near: look at a far object (≥ 3 m). At the cue a small code appears;
 *            time = cue → correct choice (verified by the answer).
 *  near→far: read the small code on screen. At the cue look at the far
 *            object and tap when it is sharp (self-reported).
 * Responses under 150 ms are anticipations and are discarded.
 */
export function FocusTest({ pxPerMm, digits, choices, onComplete }: { pxPerMm: number; digits: number; choices: number; onComplete: (raw: number, details: FocusDetails) => void }) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [code, setCode] = useState(() => randomCode(digits));
  const [options, setOptions] = useState<string[]>([]);
  const [rounds, setRounds] = useState<FocusDetails['rounds']>([]);
  const [message, setMessage] = useState('');
  const cueAt = useRef(0);
  const timer = useRef<number>();

  const direction: Direction = round % 2 === 0 ? 'far-to-near' : 'near-to-far';
  const nearPx = (letterHeightMm(0.4) * pxPerMm) / 0.716; // N8-size target at 40 cm

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const record = useCallback(
    (ms: number | null, correct: boolean) => {
      const next = [...rounds, { direction, ms, correct }];
      setRounds(next);
      if (next.length >= FOCUS_ROUNDS) {
        const valid = (d?: Direction) => next.filter((r) => r.ms !== null && r.correct && (!d || r.direction === d)).map((r) => r.ms as number);
        const all = valid();
        if (all.length < 5) {
          setMessage('รอบที่ใช้ได้น้อยกว่า 5 รอบ ผลนี้ไม่ถูกบันทึก กรุณาเริ่มใหม่');
          setRounds([]);
          setRound(0);
          setPhase('ready');
          return;
        }
        onComplete(Math.round(mean(all)!), {
          rounds: next,
          farToNearMs: mean(valid('far-to-near')) && Math.round(mean(valid('far-to-near'))!),
          nearToFarMs: mean(valid('near-to-far')) && Math.round(mean(valid('near-to-far'))!),
        });
        return;
      }
      setRound((r) => r + 1);
      setCode(randomCode(digits));
      setPhase('ready');
    },
    [rounds, direction, digits, onComplete],
  );

  const begin = () => {
    setMessage('');
    setPhase('wait');
    const delay = 2000 + Math.random() * 2000;
    timer.current = window.setTimeout(() => {
      if (direction === 'far-to-near') {
        const pool = new Set([code]);
        while (pool.size < choices) pool.add(randomCode(digits));
        setOptions([...pool].sort(() => Math.random() - 0.5));
      }
      cueAt.current = performance.now();
      setPhase('respond');
      beep();
    }, delay);
  };

  const respond = (correct: boolean) => {
    const ms = performance.now() - cueAt.current;
    if (ms < FOCUS_MIN_VALID_MS) {
      setMessage('ตอบเร็วเกินไป (ก่อนจะปรับโฟกัสได้) รอบนี้ไม่นับเวลา');
      record(null, correct);
      return;
    }
    if (!correct) setMessage('รหัสไม่ตรง รอบนี้ไม่นับเวลา');
    else setMessage(`รอบ ${round + 1}: ${(ms / 1000).toFixed(2)} วินาที`);
    record(correct ? Math.round(ms) : null, correct);
  };

  const tooEarly = () => {
    window.clearTimeout(timer.current);
    setMessage('กดก่อนสัญญาณ รอบนี้เริ่มใหม่');
    setPhase('ready');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span className="num">
          รอบ {round + 1}/{FOCUS_ROUNDS}
        </span>
        <span>{direction === 'far-to-near' ? 'ไกล → ใกล้' : 'ใกล้ → ไกล'}</span>
      </div>

      <div className="flex min-h-[14rem] flex-col items-center justify-center gap-4 rounded-xl border border-line bg-white p-6 text-center" aria-live="assertive">
        {phase === 'ready' && (
          <>
            <p className="text-lg font-semibold text-ink">
              {direction === 'far-to-near' ? 'เตรียมมองวัตถุที่อยู่ไกล (≥ 3 เมตร)' : 'เตรียมอ่านรหัสบนหน้าจอในระยะ 40 ซม.'}
            </p>
            <button type="button" className="btn-primary min-w-[10rem]" onClick={begin}>
              เริ่มรอบที่ {round + 1}
            </button>
          </>
        )}
        {phase === 'wait' &&
          (direction === 'far-to-near' ? (
            <>
              <p className="text-2xl font-bold text-ink">มองไกล…</p>
              <p className="hint">มองวัตถุที่อยู่ไกล รอเสียง/สัญญาณ แล้วกลับมามองหน้าจอ</p>
              <button type="button" className="btn-ghost" onClick={tooEarly}>
                ยกเลิกรอบนี้
              </button>
            </>
          ) : (
            <>
              <p className="hint">อ่านรหัสนี้ในระยะใกล้ (ไม่ต้องกด)</p>
              <p className="num font-semibold tracking-[0.3em] text-black" style={{ fontSize: `${nearPx}px`, fontFamily: 'Arial, sans-serif' }}>
                {code}
              </p>
              <p className="hint">รอสัญญาณ “มองไกล”</p>
              <button type="button" className="btn-ghost" onClick={tooEarly}>
                ยกเลิกรอบนี้
              </button>
            </>
          ))}
        {phase === 'respond' &&
          (direction === 'far-to-near' ? (
            <>
              <p className="hint">กลับมามองใกล้ แล้วเลือกรหัสที่ตรงกับรหัสเล็กนี้</p>
              <p className="num font-semibold tracking-[0.3em] text-black" style={{ fontSize: `${nearPx}px`, fontFamily: 'Arial, sans-serif' }}>
                {code}
              </p>
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="ตัวเลือกรหัส">
                {options.map((o) => (
                  <button key={o} type="button" className="btn-secondary num min-w-[5.5rem] text-lg" onClick={() => respond(o === code)}>
                    {o}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-ink">มองไกล!</p>
              <p className="hint">มองวัตถุที่อยู่ไกล แตะปุ่มเมื่อวัตถุนั้นชัด</p>
              <button type="button" className="btn-primary min-h-[64px] min-w-[12rem] text-lg" onClick={() => respond(true)}>
                ชัดแล้ว
              </button>
            </>
          ))}
      </div>
      {message && (
        <p className="text-sm font-medium text-ink" role="status">
          {message}
        </p>
      )}
      {rounds.length > 0 && (
        <ol className="num flex flex-wrap gap-1.5 text-xs" aria-label="ผลแต่ละรอบ">
          {rounds.map((r, i) => (
            <li key={i} className={`rounded px-2 py-1 ${r.ms !== null ? 'bg-alt text-ink' : 'bg-caution-bg text-caution'}`}>
              {i + 1}: {r.ms !== null ? `${(r.ms / 1000).toFixed(2)}s` : 'ไม่นับ'}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
