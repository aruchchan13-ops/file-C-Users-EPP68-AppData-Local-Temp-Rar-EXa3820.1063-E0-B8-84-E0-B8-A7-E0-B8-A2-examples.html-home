import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LESSONS } from '../../data/lessons';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { completeLesson, resetLesson } from '../../services/trainingService';
import { Card, EmptyState, PageHeader, ProgressBar } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';

export function LessonsPage() {
  const { completedLessons } = useMission();
  const done = LESSONS.filter((l) => completedLessons.includes(l.id)).length;
  return (
    <div>
      <PageHeader title="บทเรียนสั้น" en="Micro-learning" description="3 บทเรียน บทละประมาณ 1 นาที เพื่อเข้าใจ SANS สัญญาณเตือน และการรับมือระหว่างภารกิจ" />
      <Card className="mb-5">
        <p className="num mb-2 text-ink">
          เรียนแล้ว {done}/{LESSONS.length} บท
        </p>
        <ProgressBar value={(done / LESSONS.length) * 100} label="ความคืบหน้าบทเรียน" />
      </Card>
      <ol className="grid gap-4 md:grid-cols-3">
        {LESSONS.map((l, i) => {
          const isDone = completedLessons.includes(l.id);
          return (
            <li key={l.id}>
              <Link to={`/training/lessons/${l.id}`} className="card flex h-full flex-col p-5 hover:border-brand">
                <span className="text-sm font-semibold text-link">บทที่ {i + 1} · ~{l.minutes} นาที</span>
                <span className="mt-1 text-lg font-semibold text-ink">{l.title}</span>
                <span className="text-sm text-ink-muted">{l.en}</span>
                <span className="mt-auto pt-4">
                  {isDone ? (
                    <span className="tag bg-safe-bg text-safe">
                      <Icon name="check" size={14} /> เรียนแล้ว
                    </span>
                  ) : (
                    <span className="tag bg-alt text-ink-muted">ยังไม่เรียน</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LessonPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromPlan = params.get('from') === 'plan';
  const navigate = useNavigate();
  const { completedLessons } = useMission();
  const { toast } = useUi();
  const lesson = LESSONS.find((l) => l.id === id);
  const [card, setCard] = useState(0);
  if (!lesson) return <EmptyState title="ไม่พบบทเรียน" action={<Link to="/training/lessons" className="btn-primary">กลับไปบทเรียน</Link>} />;
  const isDone = completedLessons.includes(lesson.id);
  const c = lesson.cards[card];
  const last = card === lesson.cards.length - 1;

  const finish = async () => {
    const res = await completeLesson(lesson.id);
    if (res.ok) {
      toast('เรียนจบบทเรียนแล้ว');
      if (fromPlan) navigate('/training/plan');
    } else toast(res.error, 'error');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="breadcrumb" className="mb-2 text-sm">
        <Link className="link" to={fromPlan ? '/training/plan' : '/training/lessons'}>
          ← {fromPlan ? 'แผนฝึกประจำวัน' : 'บทเรียนทั้งหมด'}
        </Link>
      </nav>
      <PageHeader title={lesson.title} en={lesson.en} description={`~${lesson.minutes} นาที · ${isDone ? 'เรียนแล้ว ✓' : 'ยังไม่เรียน'}`} />
      <Card>
        <p className="num text-sm text-ink-muted" aria-live="polite">
          การ์ด {card + 1}/{lesson.cards.length}
        </p>
        <div className="mt-2">
          <ProgressBar value={((card + 1) / lesson.cards.length) * 100} label="ความคืบหน้าในบทเรียน" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-ink">{c.heading}</h2>
        <div className="mt-2 space-y-2 text-[1.02rem] text-ink">
          {c.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button type="button" className="btn-secondary" disabled={card === 0} onClick={() => setCard((x) => x - 1)}>
            ก่อนหน้า
          </button>
          {!last ? (
            <button type="button" className="btn-primary" onClick={() => setCard((x) => x + 1)}>
              ถัดไป
            </button>
          ) : isDone ? (
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => resetLesson(lesson.id)}>
                ทำเครื่องหมายว่ายังไม่เรียน
              </button>
              <Link to="/training/lessons" className="btn-primary">
                กลับไปบทเรียน
              </Link>
            </div>
          ) : (
            <button type="button" className="btn-primary" onClick={finish}>
              <Icon name="check" size={18} /> เรียนจบแล้ว
            </button>
          )}
        </div>
      </Card>
      <p className="hint mt-3">เนื้อหาเพื่อการเรียนรู้เท่านั้น ไม่ใช่คำแนะนำทางการแพทย์ ปฏิบัติตามคำแนะนำของแพทย์ประจำเที่ยวบินเสมอ</p>
    </div>
  );
}
