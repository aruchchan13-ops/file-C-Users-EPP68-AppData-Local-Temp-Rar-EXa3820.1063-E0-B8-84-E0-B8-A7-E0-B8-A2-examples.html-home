import { Link } from 'react-router-dom';
import { useMission } from '../../hooks/useMission';
import { scenarioStats } from '../../services/trainingService';
import { Card, PageHeader, ProgressBar, Stat } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';

export function ScenarioList({ compact = false }: { compact?: boolean }) {
  const { scenarioResults } = useMission();
  const stats = scenarioStats(scenarioResults);
  return (
    <ol className="space-y-2">
      {stats.perScenario.map(({ scenario, best, attempts }, i) => (
        <li key={scenario.id}>
          <Link
            to={`/training/scenarios/${scenario.id}`}
            className="flex min-h-[56px] items-center gap-3 rounded-lg border border-line bg-page p-3 hover:border-brand hover:bg-alt"
          >
            <span aria-hidden className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-alt font-bold text-brand">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{scenario.title}</span>
              {!compact && <span className="block text-sm text-ink-muted">{scenario.context}</span>}
              <span className="block text-sm text-ink-muted">
                ความยาก {scenario.difficulty}/6 · {attempts ? `ฝึกแล้ว ${attempts} ครั้ง · ดีที่สุด ${best}` : 'ยังไม่ได้ฝึก'}
              </span>
            </span>
            {attempts > 0 ? (
              <span className="tag bg-safe-bg text-safe">
                <Icon name="check" size={14} /> เสร็จแล้ว
              </span>
            ) : (
              <span className="tag bg-alt text-ink-muted">ใหม่</span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function ScenarioListPage() {
  const { scenarioResults } = useMission();
  const stats = scenarioStats(scenarioResults);
  return (
    <div>
      <nav aria-label="breadcrumb" className="mb-2 text-sm">
        <Link className="link" to="/training">
          ← การฝึกและการวัด
        </Link>
      </nav>
      <PageHeader title="สถานการณ์ฝึก" en="Scenario-based training" description="6 สถานการณ์เรียงจากง่ายไปยาก ฝึกตัดสินใจและขั้นตอนรับมือเมื่อการมองเห็นเปลี่ยนแปลงระหว่างภารกิจ" />
      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="ฝึกครบแล้ว" value={`${stats.completed}/6`} />
          <Stat label="อัตราการฝึกครบ" value={`${stats.completionRate}%`} />
          <Stat label="คะแนนเฉลี่ย (ดีที่สุดของแต่ละเรื่อง)" value={stats.averageScore === null ? '—' : stats.averageScore.toFixed(0)} />
        </div>
        <div className="mt-4">
          <ProgressBar value={stats.completionRate} label="อัตราการฝึกครบ" />
        </div>
      </Card>
      <ScenarioList />
    </div>
  );
}
