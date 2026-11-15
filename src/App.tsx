import { useEffect, useState } from 'react';
import { HashRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { UiProvider } from './hooks/useUi';
import { MissionProvider, useMission } from './hooks/useMission';
import { AppShell } from './components/layout/AppShell';
import { GuidedDemoProvider } from './components/layout/GuidedDemo';
import { PRIMARY_NAV, SECONDARY_NAV } from './components/layout/nav';
import { EmptyState, Notice } from './components/ui';
import { isStorageAvailable } from './services/database';
import { HomePage } from './pages/Home/HomePage';
import { TrainingPage } from './pages/Training/TrainingPage';
import { MeasurementPage } from './pages/Training/MeasurementPage';
import { ScenarioListPage } from './pages/Scenarios/ScenarioListPage';
import { ScenarioPage } from './pages/Scenarios/ScenarioPage';
import { DailyPlanPage } from './pages/DailyPlan/DailyPlanPage';
import { LessonPage, LessonsPage } from './pages/Lessons/LessonsPage';
import { SymptomLogPage } from './pages/SymptomLog/SymptomLogPage';
import { MissionTrendPage } from './pages/MissionTrend/MissionTrendPage';
import { FlightSurgeonPage } from './pages/FlightSurgeon/FlightSurgeonPage';
import { CountermeasuresPage } from './pages/Countermeasures/CountermeasuresPage';
import { MeasurementHistoryPage } from './pages/Measurements/MeasurementHistoryPage';
import { AboutPage } from './pages/About/AboutPage';
import { SettingsPage } from './pages/Settings/SettingsPage';

function ScenarioRoute() {
  const { id } = useParams();
  return <ScenarioPage key={id} />;
}
function LessonRoute() {
  const { id } = useParams();
  return <LessonPage key={id} />;
}

const TITLES: Record<string, string> = Object.fromEntries([...PRIMARY_NAV.map((n) => [n.to, n.full]), ...SECONDARY_NAV.map((n) => [n.to, n.label])]);

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES[pathname];
    document.title = t ? `${t} · EyeReady` : 'EyeReady';
  }, [pathname]);
  return null;
}

function StorageWarning() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    isStorageAvailable().then(setOk);
  }, []);
  if (ok) return null;
  return (
    <div className="mb-4">
      <Notice tone="danger" title="บันทึกข้อมูลในเครื่องไม่ได้">
        เบราว์เซอร์นี้ปิด IndexedDB (เช่น โหมดส่วนตัวบางแบบ) ดูโหมดสาธิตได้ แต่ผลที่บันทึกจะไม่ถูกเก็บ ลองเปิดในหน้าต่างปกติ
      </Notice>
    </div>
  );
}

function Shell() {
  const { ready } = useMission();
  if (!ready) return <p className="p-8 text-center text-ink-muted">กำลังโหลด EyeReady…</p>;
  return (
    <GuidedDemoProvider>
      <DocumentTitle />
      <AppShell>
        <StorageWarning />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/training/plan" element={<DailyPlanPage />} />
          <Route path="/training/near" element={<MeasurementPage key="near" type="near" />} />
          <Route path="/training/amsler" element={<MeasurementPage key="amsler" type="amsler" />} />
          <Route path="/training/contrast" element={<MeasurementPage key="contrast" type="contrast" />} />
          <Route path="/training/focus" element={<MeasurementPage key="focus" type="focus" />} />
          <Route path="/training/scenarios" element={<ScenarioListPage />} />
          <Route path="/training/scenarios/:id" element={<ScenarioRoute />} />
          <Route path="/training/lessons" element={<LessonsPage />} />
          <Route path="/training/lessons/:id" element={<LessonRoute />} />
          <Route path="/symptoms" element={<SymptomLogPage />} />
          <Route path="/trend" element={<MissionTrendPage />} />
          <Route path="/surgeon" element={<FlightSurgeonPage />} />
          <Route path="/countermeasures" element={<CountermeasuresPage />} />
          <Route path="/measurements" element={<MeasurementHistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <EmptyState
                title="ไม่พบหน้านี้"
                action={
                  <Link to="/" className="btn-primary">
                    กลับหน้าสถานะ
                  </Link>
                }
              />
            }
          />
        </Routes>
      </AppShell>
    </GuidedDemoProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <UiProvider>
        <MissionProvider>
          <Shell />
        </MissionProvider>
      </UiProvider>
    </HashRouter>
  );
}
