import { useState } from 'react';
import type { NearDetails } from '../../types';
import { LETTERS_PER_ROW, NEAR_ROWS, SLOAN_LETTERS, letterByLetterLogMAR, letterHeightMm, nPointLabel, randomLetters } from '../../services/measurementService';

interface RowResult {
  index: number;
  letters: string[];
  answers: (string | null)[];
}

/**
 * Near-vision chart. Rows shrink by 0.1 logMAR; each row shows 3 Sloan letters.
 * The test starts at a level-dependent row (rows above are credited), goes up
 * if the start row fails, and stops when a row has 2 or more errors.
 */
export function NearVisionTest({ pxPerMm, startLogMAR, onComplete }: { pxPerMm: number; startLogMAR: number; onComplete: (raw: number, details: NearDetails) => void }) {
  const startIndex = Math.max(0, NEAR_ROWS.findIndex((r) => Math.abs(r - startLogMAR) < 1e-6));
  const [rowIndex, setRowIndex] = useState(startIndex);
  const [letters, setLetters] = useState(() => randomLetters(LETTERS_PER_ROW));
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [done, setDone] = useState<RowResult[]>([]);
  const [direction, setDirection] = useState<'down' | 'up'>('down');

  const logMAR = NEAR_ROWS[rowIndex];
  const heightPx = letterHeightMm(logMAR) * pxPerMm;
  const fontPx = heightPx / 0.716; // cap-height of the chart typeface ≈ 0.716 em

  const finish = (rows: RowResult[]) => {
    const tested = rows.map((r) => ({ index: r.index, correct: r.answers.filter((a, i) => a === r.letters[i]).length }));
    // Rows above the largest tested row are credited as read (3 letters each).
    const credited = Math.min(...tested.map((t) => t.index));
    const total = credited * LETTERS_PER_ROW + tested.reduce((a, t) => a + t.correct, 0);
    // Smallest row read completely; falls back to the last credited row.
    const perfect = tested.filter((t) => t.correct === LETTERS_PER_ROW).map((t) => t.index);
    const smallestRow = perfect.length ? NEAR_ROWS[Math.max(...perfect)] : credited > 0 ? NEAR_ROWS[credited - 1] : null;
    onComplete(letterByLetterLogMAR(total), {
      smallestRowLogMAR: smallestRow,
      lettersCorrect: total,
      startLogMAR,
      rows: tested.sort((a, b) => a.index - b.index).map((t) => ({ logMAR: NEAR_ROWS[t.index], correct: t.correct })),
    });
  };

  const answer = (value: string | null) => {
    const next = [...answers, value];
    if (next.length < LETTERS_PER_ROW) {
      setAnswers(next);
      return;
    }
    const row: RowResult = { index: rowIndex, letters, answers: next };
    const rows = [...done, row];
    const correct = next.filter((a, i) => a === letters[i]).length;
    const isStart = rows.length === 1;
    let nextIndex: number | null = null;
    let nextDir = direction;
    if (direction === 'down') {
      if (isStart && correct < 2 && rowIndex > 0) {
        nextIndex = rowIndex - 1;
        nextDir = 'up';
      } else if (correct >= 2 && rowIndex < NEAR_ROWS.length - 1) nextIndex = rowIndex + 1;
    } else if (correct < 2 && rowIndex > 0) nextIndex = rowIndex - 1;

    if (nextIndex === null) {
      finish(rows);
      return;
    }
    setDone(rows);
    setDirection(nextDir);
    setRowIndex(nextIndex);
    setLetters(randomLetters(LETTERS_PER_ROW));
    setAnswers([]);
  };

  const pos = answers.length;
  const tooSmall = heightPx < 2;
  const progressRows = done.length + 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
        <span className="num">
          แถว {rowIndex + 1}/{NEAR_ROWS.length} · logMAR {logMAR.toFixed(1)} · {nPointLabel(logMAR)} · ทดสอบแล้ว {progressRows} แถว
        </span>
        <span className="num">ตัวอักษรที่ {pos + 1}/3</span>
      </div>

      <div className="flex min-h-[9rem] items-center justify-center rounded-xl border border-line bg-white p-6" aria-live="polite">
        <p className="sr-only">ตัวอักษรแสดงอยู่บนหน้าจอ เลือกตัวที่ {pos + 1} จากปุ่มด้านล่าง</p>
        <div aria-hidden className="flex items-end" style={{ gap: `${Math.max(fontPx * 0.8, 4)}px` }}>
          {letters.map((l, i) => (
            <div key={i} className="flex flex-col items-center">
              <span style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: `${fontPx}px`, lineHeight: 1, fontWeight: 600, color: '#000' }}>{l}</span>
              <span className={`mt-2 h-1 w-6 rounded ${i === pos ? 'bg-brand' : i < pos ? 'bg-line' : 'bg-transparent'}`} />
            </div>
          ))}
        </div>
      </div>
      {tooSmall && <p className="hint">แถวนี้เล็กกว่าที่หน้าจอนี้แสดงได้ชัดเจน หากอ่านไม่ออกให้กด "มองไม่ชัด"</p>}

      <fieldset>
        <legend className="label">ตัวที่ {pos + 1} คือตัวอักษรใด?</legend>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {SLOAN_LETTERS.map((l) => (
            <button key={l} type="button" onClick={() => answer(l)} className="btn-secondary min-h-[52px] text-xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {l}
            </button>
          ))}
          <button type="button" onClick={() => answer(null)} className="btn-secondary col-span-5 min-h-[52px] sm:col-span-2">
            มองไม่ชัด
          </button>
        </div>
      </fieldset>
    </div>
  );
}
