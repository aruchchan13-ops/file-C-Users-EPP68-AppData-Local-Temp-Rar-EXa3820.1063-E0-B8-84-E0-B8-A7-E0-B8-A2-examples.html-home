import { useRef, useState, type KeyboardEvent } from 'react';
import type { AmslerDetails } from '../../types';
import { AMSLER_SIZE } from '../../services/measurementService';

const EYES: { id: AmslerDetails['eye']; label: string }[] = [
  { id: 'left', label: 'ตาซ้าย' },
  { id: 'right', label: 'ตาขวา' },
  { id: 'both', label: 'สองตา' },
];

/**
 * Amsler grid: 20 × 20 drawn squares with a central fixation dot. The tappable
 * regions are 10 × 10 (each covers 2 × 2 squares) so they stay large enough to
 * tap. Selected regions get a red hatch pattern AND an ✕, never colour alone.
 * Arrow keys move between regions (roving tabindex); Space/Enter toggles.
 */
export function AmslerTest({ onComplete }: { onComplete: (raw: number, details: AmslerDetails) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [eye, setEye] = useState<AmslerDetails['eye']>('both');
  const [focusIdx, setFocusIdx] = useState(Math.floor((AMSLER_SIZE * AMSLER_SIZE) / 2) - AMSLER_SIZE / 2);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const onKey = (e: KeyboardEvent, i: number) => {
    const r = Math.floor(i / AMSLER_SIZE);
    const c = i % AMSLER_SIZE;
    let next = i;
    if (e.key === 'ArrowRight') next = r * AMSLER_SIZE + Math.min(AMSLER_SIZE - 1, c + 1);
    else if (e.key === 'ArrowLeft') next = r * AMSLER_SIZE + Math.max(0, c - 1);
    else if (e.key === 'ArrowDown') next = Math.min(AMSLER_SIZE - 1, r + 1) * AMSLER_SIZE + c;
    else if (e.key === 'ArrowUp') next = Math.max(0, r - 1) * AMSLER_SIZE + c;
    else return;
    e.preventDefault();
    setFocusIdx(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label">ตาที่ทดสอบ (ปิดตาอีกข้าง)</legend>
        <div className="flex flex-wrap gap-2">
          {EYES.map((e) => (
            <label key={e.id} className={`btn ${eye === e.id ? 'bg-brand text-white' : 'border border-line text-ink'} cursor-pointer`}>
              <input type="radio" name="eye" value={e.id} checked={eye === e.id} onChange={() => setEye(e.id)} className="sr-only" />
              {e.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mx-auto w-full max-w-[460px]">
        <div
          role="grid"
          aria-label="Amsler grid 10 × 10 ช่อง แตะช่องที่เส้นดูคด บิด หรือหายไป"
          className="relative aspect-square w-full border-2 border-black bg-white"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '5% 5%',
          }}
        >
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="rgba(179,38,30,0.22)" />
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(179,38,30,0.75)" strokeWidth="3" />
              </pattern>
            </defs>
          </svg>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${AMSLER_SIZE}, 1fr)`, gridTemplateRows: `repeat(${AMSLER_SIZE}, 1fr)` }}>
            {Array.from({ length: AMSLER_SIZE }, (_, r) => (
              <div role="row" key={r} className="contents">
                {Array.from({ length: AMSLER_SIZE }, (_, c) => {
                  const i = r * AMSLER_SIZE + c;
                  const on = selected.has(i);
                  return (
                    <button
                      key={i}
                      ref={(el) => (refs.current[i] = el)}
                      role="gridcell"
                      type="button"
                      tabIndex={i === focusIdx ? 0 : -1}
                      aria-pressed={on}
                      aria-label={`แถว ${r + 1} คอลัมน์ ${c + 1}${on ? ' ผิดปกติ' : ''}`}
                      onClick={() => {
                        setFocusIdx(i);
                        toggle(i);
                      }}
                      onKeyDown={(e) => onKey(e, i)}
                      className="relative focus-visible:z-10"
                    >
                      {on && (
                        <svg aria-hidden className="absolute inset-0 h-full w-full">
                          <rect width="100%" height="100%" fill="url(#hatch)" />
                        </svg>
                      )}
                      {on && (
                        <svg aria-hidden viewBox="0 0 10 10" className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 text-[#B3261E]">
                          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num font-semibold text-ink" aria-live="polite">
          ช่องที่ผิดปกติ: {selected.size} ช่อง
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            ล้างที่เลือก
          </button>
          <button type="button" className="btn-primary" onClick={() => onComplete(selected.size, { cells: [...selected].sort((a, b) => a - b), eye })}>
            {selected.size === 0 ? 'เส้นตรงปกติทั้งหมด — บันทึก' : `บันทึก ${selected.size} ช่อง`}
          </button>
        </div>
      </div>
    </div>
  );
}
