import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AlertLevel, Source } from '../types';

export function PageHeader({ title, en, description, actions }: { title: string; en?: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-ink sm:text-[1.75rem]">
          {title}
          {en && <span className="ml-2 inline-block whitespace-nowrap align-middle text-base font-medium text-ink-muted">{en}</span>}
        </h1>
        {description && <p className="mt-1 max-w-3xl text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, className = '', actions, id }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; id?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          {title && (
            <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold text-ink">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function SimulatedTag({ label = 'ข้อมูลจำลอง' }: { label?: string }) {
  return (
    <span className="tag bg-caution-bg text-caution" title="ข้อมูลสังเคราะห์ ไม่ใช่การวัดจริงของนักบินอวกาศ">
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
        <path d="M5 0.5 9.5 9H0.5z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}

export function SourceBadge({ source }: { source: Source }) {
  return source === 'synthetic' ? (
    <SimulatedTag />
  ) : (
    <span className="tag bg-alt text-brand-ink border border-brand-ink/30">
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4" fill="currentColor" />
      </svg>
      บันทึกโดยผู้ใช้
    </span>
  );
}

export function ProTag() {
  return <span className="tag bg-brand text-white">Pro</span>;
}

/** Shape + colour + text: never colour alone. */
export function AlertShape({ level, size = 18 }: { level: AlertLevel; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 20 20', 'aria-hidden': true } as const;
  if (level === 'green')
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" fill="rgb(var(--c-safe))" />
        <path d="M6 10.5l2.6 2.6L14 7.6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (level === 'yellow')
    return (
      <svg {...common}>
        <path d="M10 1.5 19 18H1z" fill="rgb(var(--c-caution))" />
        <path d="M10 7v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="10" cy="15" r="1.2" fill="#fff" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" fill="rgb(var(--c-danger))" />
      <path d="M6.5 10h7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export const LEVEL_STYLE: Record<AlertLevel, { text: string; bg: string; border: string }> = {
  green: { text: 'text-safe', bg: 'bg-safe-bg', border: 'border-safe' },
  yellow: { text: 'text-caution', bg: 'bg-caution-bg', border: 'border-caution' },
  red: { text: 'text-danger', bg: 'bg-danger-bg', border: 'border-danger' },
};

export function AlertPill({ level, label }: { level: AlertLevel; label: string }) {
  const s = LEVEL_STYLE[level];
  return (
    <span className={`tag ${s.bg} ${s.text} border ${s.border} text-sm`}>
      <AlertShape level={level} size={14} />
      {label}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-alt/60 p-6 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'muted' }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`num text-2xl font-bold leading-tight ${tone === 'muted' ? 'text-ink-muted' : 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'caution' | 'danger' | 'safe'; children: ReactNode; title?: string }) {
  const cls = {
    info: 'bg-alt border-line text-ink',
    caution: 'bg-caution-bg border-caution/40 text-caution',
    danger: 'bg-danger-bg border-danger/40 text-danger',
    safe: 'bg-safe-bg border-safe/40 text-safe',
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={tone === 'info' ? 'text-ink-muted' : ''}>{children}</div>
    </div>
  );
}

export function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <Notice tone="info" title={compact ? undefined : 'ข้อจำกัดทางการแพทย์'}>
      EyeReady <strong className="text-ink">ไม่ได้ป้องกัน วินิจฉัย หรือรักษา SANS</strong> เป็นเครื่องมือเฝ้าระวังและเตรียมความพร้อมเท่านั้น
      การแจ้งเตือนบอกแนวโน้มที่ควรใส่ใจ ไม่ใช่ผลวินิจฉัย ค่าเกณฑ์เป็นค่าเริ่มต้น (starter values) ที่ต้องปรับร่วมกับแพทย์
    </Notice>
  );
}

export function ThresholdNotice() {
  return (
    <p className="flex items-start gap-2 text-sm text-ink-muted">
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="mt-1 shrink-0">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7v4.5M8 4.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>ค่าเกณฑ์การแจ้งเตือนเป็นค่าเริ่มต้น (starter values) ที่ต้องปรับร่วมกับแพทย์ ไม่ใช่มาตรฐานทางการแพทย์ที่ผ่านการรับรอง</span>
    </p>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-alt">
      <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${v}%` }} />
    </div>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="link">
      {children}
    </Link>
  );
}
