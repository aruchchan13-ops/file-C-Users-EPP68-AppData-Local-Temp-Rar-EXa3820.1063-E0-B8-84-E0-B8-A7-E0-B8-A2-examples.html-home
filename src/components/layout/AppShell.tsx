import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav';
import { MissionDayControl } from './MissionDayControl';
import { useOnline } from '../../hooks/useOnline';
import { useUi } from '../../hooks/useUi';
import { useMission } from '../../hooks/useMission';
import { useGuidedDemo } from './GuidedDemo';

function isActive(path: string, to: string) {
  if (to === '/') return path === '/';
  if (to === '/training') return path === '/training' || /^\/training\/(near|amsler|contrast|focus|scenarios)/.test(path);
  return path === to || path.startsWith(`${to}/`);
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md text-white">
      <img src="./icons/icon.svg" alt="" width={32} height={32} className="rounded-lg ring-1 ring-white/30" />
      <span className="text-lg font-bold tracking-wide">EyeReady</span>
    </Link>
  );
}

function OfflineBadge() {
  const online = useOnline();
  return online ? (
    <span className="tag bg-white/10 text-white/90" title="เชื่อมต่ออินเทอร์เน็ต — แอปไม่ได้ส่งข้อมูลออก">
      <span aria-hidden className="h-2 w-2 rounded-full bg-[#7FD1A4] ring-2 ring-[#7FD1A4]/25" /> ออนไลน์
    </span>
  ) : (
    <span className="tag bg-caution-bg text-caution" role="status">
      <Icon name="wifiOff" size={14} /> ออฟไลน์ — ทำงานได้ตามปกติ
    </span>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { start } = useGuidedDemo();
  const linkCls = (active: boolean) =>
    `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[0.95rem] ${active ? 'bg-on-chrome text-on-chrome-fg font-semibold' : 'text-white/90 hover:bg-white/10'}`;
  return (
    <nav aria-label="เมนูหลัก" className="on-brand flex flex-col gap-1">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-white/60">หลัก</p>
      {PRIMARY_NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={onNavigate} className={() => linkCls(isActive(pathname, n.to))} aria-current={isActive(pathname, n.to) ? 'page' : undefined}>
          <Icon name={n.icon} size={20} />
          <span>{n.full}</span>
        </NavLink>
      ))}
      <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-white/60">เพิ่มเติม</p>
      {SECONDARY_NAV.map((n) => (
        <NavLink key={n.to} to={n.to} onClick={onNavigate} className={() => linkCls(isActive(pathname, n.to))} aria-current={isActive(pathname, n.to) ? 'page' : undefined}>
          <Icon name={n.icon} size={20} />
          <span>{n.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          start();
        }}
        className="mt-4 flex min-h-[44px] items-center gap-3 rounded-lg border border-white/30 px-3 text-[0.95rem] text-white hover:bg-white/10"
      >
        <Icon name="play" size={18} />
        เริ่มทัวร์สาธิต (2 นาที)
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { toasts, dismiss } = useUi();
  const { isDemo } = useMission();
  const mainRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus to the page on navigation (screen readers announce the new page).
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-link">
        ข้ามไปเนื้อหาหลัก
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto bg-chrome px-3 py-4 lg:flex">
        <div className="on-brand mb-4 px-2">
          <Brand />
          <p className="mt-1 text-xs text-white/70">Astronaut Eye Health · NASA Space Apps 2026</p>
        </div>
        <SideNav />
        <div className="on-brand mt-auto px-2 pt-6">
          <OfflineBadge />
        </div>
      </aside>

      {/* Top bar (mobile/tablet) */}
      <header className="on-brand sticky top-0 z-30 flex items-center justify-between gap-2 bg-chrome px-4 py-2 lg:hidden no-print">
        <Brand />
        <div className="flex items-center gap-2">
          <OfflineBadge />
          <button
            ref={menuBtnRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
            aria-label="เปิดเมนูทั้งหมด"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูทั้งหมด" id="mobile-menu">
          <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-ink/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(20rem,88vw)] overflow-y-auto bg-chrome px-3 py-4">
            <div className="on-brand mb-2 flex items-center justify-between px-2">
              <Brand />
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} autoFocus>
                <Icon name="close" />
              </button>
            </div>
            <SideNav onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <MissionDayControl />

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-content px-4 pb-28 pt-6 outline-none sm:px-6 lg:pb-12">
        {children}
      </main>

      <footer className="on-brand bg-chrome px-4 py-6 pb-28 text-sm text-white/85 sm:px-6 lg:pb-6 no-print">
        <div className="mx-auto max-w-content space-y-1">
          <p className="font-semibold text-white">EyeReady · NASA Space Apps Challenge 2026</p>
          <p>
            ไม่ใช่เครื่องมือวินิจฉัย ไม่ได้ป้องกันหรือรักษา SANS · ข้อมูลทั้งหมดเก็บในอุปกรณ์นี้เท่านั้น
            {isDemo && ' · ขณะนี้แสดงข้อมูลจำลอง'}
          </p>
          <p>
            <Link to="/about" className="underline underline-offset-2">
              เกี่ยวกับและข้อจำกัด
            </Link>
          </p>
        </div>
      </footer>

      {/* Bottom navigation (mobile) — the five primary areas */}
      <nav aria-label="เมนูหลัก (มือถือ)" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden no-print">
        <ul className="grid grid-cols-5">
          {PRIMARY_NAV.map((n) => {
            const active = isActive(pathname, n.to);
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[0.72rem] leading-tight ${active ? 'font-semibold text-brand-ink' : 'text-ink-muted'}`}
                >
                  <Icon name={n.icon} size={22} />
                  <span>{n.label}</span>
                  {active && <span aria-hidden className="mt-0.5 h-0.5 w-6 rounded bg-brand-ink" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.tone === 'error' ? 'border-danger/50 bg-danger-bg text-danger' : 'border-safe/40 bg-safe-bg text-safe'
            }`}
          >
            <Icon name={t.tone === 'error' ? 'info' : 'check'} size={18} />
            <span className="font-medium">{t.message}</span>
            <button type="button" className="-my-1 ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md opacity-80 hover:bg-black/5 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="ปิดข้อความ">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
