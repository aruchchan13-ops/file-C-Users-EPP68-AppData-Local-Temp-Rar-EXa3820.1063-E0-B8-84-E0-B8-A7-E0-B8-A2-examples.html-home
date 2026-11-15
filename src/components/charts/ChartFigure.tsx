import { useId, useState, type ReactNode } from 'react';

/**
 * Accessible chart wrapper: a text summary (figcaption) for screen readers and
 * everyone, plus a working "view as table" toggle with the underlying values.
 */
export function ChartFigure({
  title,
  summary,
  children,
  table,
}: {
  title: string;
  summary: ReactNode;
  children: ReactNode;
  table?: { headers: string[]; rows: (string | number)[][] };
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <figure className="card p-4 sm:p-5" aria-labelledby={`${id}-t`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h2 id={`${id}-t`} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {table && (
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" aria-expanded={showTable} aria-controls={`${id}-table`} onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'ซ่อนตาราง' : 'ดูเป็นตาราง'}
          </button>
        )}
      </div>
      <figcaption className="mb-3 text-sm text-ink-muted">{summary}</figcaption>
      <div aria-hidden={showTable ? undefined : true}>{children}</div>
      {table && showTable && (
        <div id={`${id}-table`} className="mt-4 max-h-80 overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={`ตารางข้อมูล: ${title}`}>
          <table className="num w-full text-left text-sm">
            <thead className="sticky top-0 bg-alt">
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 text-ink">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
