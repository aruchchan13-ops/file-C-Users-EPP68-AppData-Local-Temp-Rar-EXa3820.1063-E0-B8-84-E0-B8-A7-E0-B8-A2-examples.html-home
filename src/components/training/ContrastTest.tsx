import { useEffect, useRef, useState } from 'react';
import type { ContrastDetails, Orientation } from '../../types';
import { CONTRAST_TRIALS, ORIENTATIONS, contrastThreshold, staircaseNext, type StaircaseState } from '../../services/measurementService';

const ORIENT_META: Record<Orientation, { label: string; angle: number; icon: string }> = {
  vertical: { label: 'แนวตั้ง', angle: 0, icon: 'M6 3v18M10 3v18M14 3v18M18 3v18' },
  left: { label: 'เฉียงซ้าย ( \\ )', angle: -45, icon: 'M3 7l14 14M3 3l18 18M7 3l14 14' },
  right: { label: 'เฉียงขวา ( / )', angle: 45, icon: 'M21 7 7 21M21 3 3 21M17 3 3 17' },
};

/** Draws a sinusoidal grating in a soft-edged circle on mid-grey. contrast in %. */
function drawGrating(canvas: HTMLCanvasElement, contrastPct: number, orientation: Orientation) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(size, size);
  const c = contrastPct / 100;
  const cycles = 6;
  const theta = (ORIENT_META[orientation].angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) / r;
      // raised-cosine window: soft edge over the outer 25 % so the edge gives no orientation cue
      const w = d >= 1 ? 0 : d < 0.75 ? 1 : 0.5 * (1 + Math.cos(Math.PI * ((d - 0.75) / 0.25)));
      const u = dx * cos + dy * sin;
      const v = 128 + 127 * c * w * Math.sin((2 * Math.PI * cycles * u) / size);
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(v);
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Contrast sensitivity: 15 trials, 1-up/2-down staircase on contrast,
 * result = mean contrast of the final 6 trials. No feedback during the test.
 */
export function ContrastTest({ startContrast, onComplete }: { startContrast: number; onComplete: (raw: number, details: ContrastDetails) => void }) {
  const [state, setState] = useState<StaircaseState>({ contrast: startContrast, correctStreak: 0 });
  const [orientation, setOrientation] = useState<Orientation>(() => ORIENTATIONS[Math.floor(Math.random() * 3)]);
  const [trials, setTrials] = useState<ContrastDetails['trials']>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) drawGrating(canvasRef.current, state.contrast, orientation);
  }, [state.contrast, orientation, trials.length]);

  const answer = (a: Orientation | null) => {
    const correct = a === orientation;
    const nextTrials = [...trials, { contrast: Math.round(state.contrast * 100) / 100, orientation, answer: a, correct }];
    if (nextTrials.length >= CONTRAST_TRIALS) {
      const levels = nextTrials.map((t) => t.contrast);
      onComplete(contrastThreshold(levels), { trials: nextTrials, finalSix: levels.slice(-6) });
      return;
    }
    setTrials(nextTrials);
    setState(staircaseNext(state, correct));
    // new random orientation each trial
    setOrientation(ORIENTATIONS[Math.floor(Math.random() * 3)]);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span className="num">
          ข้อ {trials.length + 1}/{CONTRAST_TRIALS}
        </span>
        <span className="num">ความคมชัด (contrast) ปัจจุบัน {state.contrast.toFixed(2)}%</span>
      </div>
      <div className="flex justify-center rounded-xl p-4" style={{ background: 'rgb(128,128,128)' }}>
        <canvas ref={canvasRef} width={240} height={240} className="h-[240px] w-[240px]" role="img" aria-label="วงกลมลายเส้น เลือกทิศทางของลายเส้นจากปุ่มด้านล่าง" />
      </div>
      <fieldset>
        <legend className="label">ลายเส้นในวงกลมเป็นแนวใด?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          {ORIENTATIONS.map((o) => (
            <button key={o} type="button" className="btn-secondary min-h-[56px] justify-start sm:justify-center" onClick={() => answer(o)}>
              <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="11" strokeWidth="1.2" />
                <path d={ORIENT_META[o].icon} />
              </svg>
              {ORIENT_META[o].label}
            </button>
          ))}
          <button type="button" className="btn-secondary min-h-[56px]" onClick={() => answer(null)}>
            มองไม่เห็นลาย
          </button>
        </div>
      </fieldset>
    </div>
  );
}
