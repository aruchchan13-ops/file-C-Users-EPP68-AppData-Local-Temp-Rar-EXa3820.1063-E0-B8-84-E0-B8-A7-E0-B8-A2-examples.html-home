import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CHECKLIST, SCENARIOS, scoreScenario, type ChecklistId } from '../../data/scenarios';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { saveScenarioResult } from '../../services/trainingService';
import { Card, EmptyState, Notice, PageHeader } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';

export function ScenarioPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromPlan = params.get('from') === 'plan';
  const navigate = useNavigate();
  const { dataset, day, scenarioResults } = useMission();
  const { toast } = useUi();
  const scenario = SCENARIOS.find((s) => s.id === id);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [ticked, setTicked] = useState<ChecklistId[]>([]);
  const [finished, setFinished] = useState<ReturnType<typeof scoreScenario> | null>(null);

  if (!scenario)
    return (
      <EmptyState title="ไม่พบสถานการณ์นี้" action={<Link className="btn-primary" to="/training/scenarios">กลับไปรายการสถานการณ์</Link>} />
    );

  const index = SCENARIOS.indexOf(scenario);
  const choice = scenario.choices.find((c) => c.id === choiceId) ?? null;
  const best = scenario.choices.find((c) => c.score === 100)!;
  const previous = scenarioResults.filter((r) => r.scenarioId === scenario.id);

  const finish = async () => {
    if (!choice) return;
    const s = scoreScenario(choice, ticked, scenario);
    setFinished(s);
    const res = await saveScenarioResult({ dataset, day, scenarioId: scenario.id, choiceId: choice.id, ...s });
    if (res.ok) toast(`บันทึกผลสถานการณ์แล้ว: ${s.score} คะแนน`);
    else toast(res.error, 'error');
  };

  const restart = () => {
    setChoiceId(null);
    setSubmitted(false);
    setTicked([]);
    setFinished(null);
  };

  const next = SCENARIOS[index + 1];

  return (
    <div>
      <nav aria-label="breadcrumb" className="mb-2 text-sm">
        <Link className="link" to={fromPlan ? '/training/plan' : '/training/scenarios'}>
          ← {fromPlan ? 'แผนฝึกประจำวัน' : 'สถานการณ์ฝึกทั้งหมด'}
        </Link>
      </nav>
      <PageHeader
        title={scenario.title}
        en={`Scenario ${index + 1}/6`}
        description={
          <>
            ความยาก {scenario.difficulty}/6 · {scenario.context}
            {previous.length > 0 && ` · เคยฝึก ${previous.length} ครั้ง คะแนนดีที่สุด ${Math.max(...previous.map((p) => p.score))}`}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-link">เรื่องราวในภารกิจ</p>
            <p className="mt-2 text-[1.05rem] text-ink">{scenario.story}</p>
          </Card>

          <Card title={scenario.question} id="q">
            <fieldset disabled={submitted}>
              <legend className="sr-only">{scenario.question}</legend>
              <div className="space-y-2">
                {scenario.choices.map((c, i) => {
                  const picked = choiceId === c.id;
                  const reveal = submitted && (picked || c.score === 100);
                  const tone = !reveal ? '' : c.score === 100 ? 'border-safe bg-safe-bg' : c.unsafe ? 'border-danger bg-danger-bg' : 'border-caution bg-caution-bg';
                  return (
                    <label
                      key={c.id}
                      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3 ${picked && !submitted ? 'border-brand bg-alt' : 'border-line'} ${tone}`}
                    >
                      <input type="radio" name="choice" className="mt-1 h-5 w-5 accent-[rgb(var(--c-brand))]" checked={picked} onChange={() => setChoiceId(c.id)} />
                      <span className="flex-1">
                        <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {c.text}
                        {reveal && (
                          <span className="mt-1 block text-sm">
                            <strong>
                              {c.score === 100 ? '✓ แนวทางที่ดีที่สุด' : c.unsafe ? '✕ ไม่ปลอดภัย' : '△ ยังไม่ดีที่สุด'} ({c.unsafe ? 0 : c.score} คะแนน):
                            </strong>{' '}
                            {c.feedback}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {!submitted && (
              <button type="button" className="btn-primary mt-4" disabled={!choice} onClick={() => setSubmitted(true)}>
                ยืนยันคำตอบ
              </button>
            )}
          </Card>

          {submitted && choice && (
            <div aria-live="polite" className="space-y-5">
              <Notice tone={choice.score === 100 ? 'safe' : choice.unsafe ? 'danger' : 'caution'} title={choice.score === 100 ? 'ถูกต้อง' : choice.unsafe ? 'ตัวเลือกนี้ไม่ปลอดภัย (0 คะแนน)' : 'ยังมีทางที่ดีกว่า'}>
                {choice.feedback}
              </Notice>
              <Card title="แนวทางที่แนะนำ" id="best">
                <p className="font-semibold text-ink">{scenario.bestAction}</p>
                <p className="mt-2 text-ink-muted">
                  <strong className="text-ink">ทำไม:</strong> {scenario.why}
                </p>
                {choice.id !== best.id && <p className="mt-2 text-sm text-ink-muted">ตัวเลือกที่ดีที่สุด: {best.text}</p>}
              </Card>

              <Card title="ขั้นตอนรับมือ (coping workflow)" id="checklist">
                <p className="hint mb-3">เลือกขั้นตอนที่คุณจะทำในสถานการณ์นี้ ระบบจะเทียบกับขั้นตอนที่แนะนำ (20% ของคะแนน)</p>
                <fieldset disabled={!!finished} className="space-y-2">
                  <legend className="sr-only">ขั้นตอนรับมือ</legend>
                  {CHECKLIST.map((item) => {
                    const on = ticked.includes(item.id);
                    const recommended = scenario.recommendedChecklist.includes(item.id);
                    return (
                      <label key={item.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[rgb(var(--c-brand))]"
                          checked={on}
                          onChange={() => setTicked((t) => (on ? t.filter((x) => x !== item.id) : [...t, item.id]))}
                        />
                        <span className="flex-1">{item.label}</span>
                        {finished && (
                          <span className={`tag ${recommended ? 'bg-safe-bg text-safe' : 'bg-alt text-ink-muted'}`}>{recommended ? 'แนะนำ' : 'ไม่จำเป็นในกรณีนี้'}</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
                {!finished ? (
                  <button type="button" className="btn-primary mt-4" onClick={finish}>
                    ส่งและดูคะแนน
                  </button>
                ) : (
                  <div className="mt-5 rounded-lg bg-alt p-4" role="status">
                    <p className="num text-3xl font-bold text-ink">{finished.score}/100</p>
                    <p className="num text-sm text-ink-muted">
                      การตัดสินใจ {finished.choiceScore} × 80% + ขั้นตอนรับมือ {finished.checklistScore} × 20%
                      {finished.unsafe && ' · ตัวเลือกไม่ปลอดภัยได้ 0 คะแนนเสมอ'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {fromPlan && (
                        <button type="button" className="btn-primary" onClick={() => navigate('/training/plan')}>
                          กลับไปแผนวันนี้
                        </button>
                      )}
                      {next && !fromPlan && (
                        <Link className="btn-primary" to={`/training/scenarios/${next.id}`} onClick={restart}>
                          สถานการณ์ถัดไป <Icon name="chevron" size={18} />
                        </Link>
                      )}
                      <button type="button" className="btn-secondary" onClick={restart}>
                        ฝึกซ้ำ
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="หลักการให้คะแนน" id="rules">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>คะแนน = การตัดสินใจ 80% + ขั้นตอนรับมือ 20%</li>
              <li>ตัวเลือกที่เพิกเฉยต่ออาการหรือทำงานต่อแบบไม่ปลอดภัยได้ 0 คะแนนเสมอ</li>
              <li>ฝึกซ้ำได้ ระบบเก็บทุกครั้งและใช้คะแนนดีที่สุด</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
