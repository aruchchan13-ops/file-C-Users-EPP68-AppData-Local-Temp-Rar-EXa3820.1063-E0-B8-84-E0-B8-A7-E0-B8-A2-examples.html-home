# EyeReady

**Astronaut eye-health monitoring & preparedness — NASA Space Apps Challenge 2026**
*Create Health Monitoring Software for Astronauts on Space Missions*

EyeReady is an offline-first Progressive Web App that helps astronauts monitor visual
changes against their own baseline, practise appropriate responses, track
countermeasures and prepare a summary for the flight surgeon, in the context of
Spaceflight Associated Neuro-ocular Syndrome (SANS). The interface is in Thai with
English scientific terms.

> **Medical disclaimer.** EyeReady does **not** prevent, diagnose or treat SANS. It is an
> early-warning, self-monitoring and preparedness tool. Alerts indicate trends that need
> attention, not a diagnosis. Alert thresholds are starter values, to be tuned with
> clinicians. All demonstration data are synthetic (ข้อมูลจำลอง).

## Quick start

```bash
npm install
npm run dev          # development server
npm run build        # type-check + production build (dist/, includes service worker)
npm run preview      # serve the production build
npm test             # unit tests (scoring, baseline, alerts, demo calibration, adaptive plan)
npm run e2e          # end-to-end acceptance checks (needs `npm run preview` running)
```

No backend, no external database, no authentication and no cloud calls. All data lives
in the browser's IndexedDB.

## Features

| Area | What works |
| --- | --- |
| **Home Status** | Mission day, today's score, 7-day average, alert card with exact numbers, 7-day symptoms, countermeasures today, training progress |
| **Training** | 4 measurement modules, 6 scenarios, adaptive daily plan, 3 micro-lessons |
| **Symptom Log** | Create / edit / delete, severity 0–10, time, duration, notes, 7-day overview, history |
| **Mission Trend** | 180-day score vs baseline with thresholds and exam days, alert history, per-test comparison, weekly symptoms and adherence; every chart has a text summary and a data table |
| **Flight Surgeon Summary** | Alert, baseline, latest results, comparison table, symptoms, adherence, 30-day trend, exam context, training, **PDF export** (summary only) |
| Countermeasures | LBNP, thigh cuffs, resistance exercise (minutes), nutrition (yes/no); weekly %, 7-day grid, monthly history, "associated with" insights with sample sizes |
| Demo mode | Deterministic 180-day synthetic mission, global mission-day selector (Day 60/110/135 + slider), ~2-minute guided tour |
| About & Limitations, Settings | Method, limitations, privacy; data mode, text size, high contrast, screen calibration, install, data reset |

## Measurement modules

| Test | Procedure | Raw value (lower = better) |
| --- | --- | --- |
| Near-vision chart | 12 rows, logMAR 1.0 → −0.1 in 0.1 steps, 3 Sloan letters per row; starts at a level-dependent row (rows above credited), steps up if the start row fails, stops at ≥ 2 errors in a row; letter sizes computed for 40 cm from the screen calibration | letter-by-letter logMAR; smallest fully-read row is also stored |
| Amsler grid | 20 × 20 drawn grid with fixation dot, 10 × 10 tappable regions, eye selection | number of distorted regions |
| Contrast sensitivity | Sinusoidal grating in a soft-edged circle, 3 orientations (vertical, left/right diagonal), 1-up/2-down staircase in 0.1 log steps, 15 trials | mean contrast (%) of the final 6 trials (logCS also shown) |
| Near–far focus | 10 alternating rounds; far→near verified by picking the matching code, near→far self-reported; < 150 ms responses discarded; ≥ 5 valid rounds required | mean switching time (ms) |

## Scoring and baseline

* **Baseline** per test = mean of the daily raw values on the **first three mission days
  with a valid measurement**. Until then the test shows "building baseline (n/3)".
* **Score** = % of personal baseline, always oriented so **higher = better**:
  near `10^-(raw − baseline) × 100` (decimal-acuity ratio), contrast and focus
  `baseline / raw × 100` (inverted ratio), Amsler `100 − 5 × (raw − baseline)` (baseline is
  usually 0, so a ratio would divide by zero). Scores are clamped to 0–150 %.
* Several tests on one day are averaged. The **daily composite** is the mean of the tests
  done that day. **Missing data is null, never zero.** Raw values and scores are shown
  separately everywhere.

Code: `src/services/scoringService.ts`.

## Alert logic (starter values)

Evaluated for every mission day *d* from the stored data only (`src/services/alertService.ts`):

* **Symptom counting.** An *occurrence* is one entry with severity ≥ 1. A *symptom day*
  has ≥ 2 occurrences (this covers "≥ 2 categories or ≥ 2 occurrences"). *Relevant
  symptoms* for RED are the visual categories plus headache (not fatigue).
* **YELLOW** if the 7-day average score is < 90 % of baseline on days *d−2…d*, **or**
  there are ≥ 3 symptom days within *d−6…d*.
* **RED** if the daily score is < 80 % of baseline on days *d−2…d* **and** a relevant
  symptom was recorded on days *d−2…d*.
* **GREEN** otherwise. A day without a score breaks a consecutive run. The 7-day
  average needs ≥ 3 scored days in the window.

Every alert shows level, exact numbers, dates, baseline comparison and the recommended
action, using colour **and** shape (circle / triangle / octagon) **and** text.

## Demo data

`src/services/demoDataService.ts` builds a deterministic 180-day mission (seeded per
day, so a given day always gives the same values):

* Days 1–90 stable with noise and few symptoms; days 91–105 decline 0.45 points/day on
  a latent performance index (baseline = 100); days 106–180 continue declining
  (0.5/day) with increasing symptoms and changing countermeasure adherence.
* The seed and slopes were calibrated **together with the alert algorithm**. Result
  (computed, not hard-coded, and asserted in `demoCalibration.test.ts`): first
  **YELLOW on day 109**, first **RED on day 134**, scheduled eye exam on day 150.
  Across other seeds the same model gives yellow ≈ 108–110 and red ≈ 132–134.
* Records added by the user in demo mode are stored separately (source "user") and
  merged on top, labelled "บันทึกโดยผู้ใช้".

## Adaptive plan

`src/services/adaptivePlanService.ts`: level 1–5 (start 2), replayed from stored daily
scores — three consecutive strong days (≥ 95 %) raise it, one poor day (< 90 %) lowers
it. Fatigue ≥ 7/10 shortens the plan from ~6 to ≤ 3 minutes. Activities are ordered by
the weakest test of the week. During baseline building all four tests are planned.

## Architecture

* React 18 + TypeScript + Vite, Tailwind CSS (team palette as CSS variables),
  Dexie (IndexedDB), Recharts, jsPDF + html2canvas (lazy-loaded), vite-plugin-pwa
  (Workbox precache of all assets, including fonts).
* `src/hooks/useMission.tsx` is the single data layer: it merges synthetic and stored
  records, filters them to the selected mission day and derives baselines, scores and
  the alert timeline once, so every page shows the same numbers.
* Hash routing (works offline and from any static host).

```
src/
  components/  layout/ charts/ alerts/ training/ ui.tsx
  pages/       Home Training Scenarios DailyPlan Lessons SymptomLog MissionTrend
               FlightSurgeon Countermeasures Measurements About Settings
  services/    database measurementService scoringService alertService demoDataService
               countermeasureService adaptivePlanService trainingService pdfService
  data/        scenarios.ts lessons.ts
  hooks/ types/ utils/ styles/
```

## Accessibility

Light and dark themes (Settings → ธีม: system / light / dark; dark is for dim cabin
lighting and is applied before first paint). Both are token swaps of the same system: navy
chrome stays `#13294B`, and vision-test canvases stay white in every theme so results remain
comparable.

WCAG AA colour contrast (team palette), 44 px touch targets, IBM Plex Sans Thai bundled
for offline use with Thai-friendly line height, keyboard navigation (skip link, roving
focus on the Amsler grid, visible focus), semantic landmarks, accessible chart summaries
and data tables, alerts never rely on colour alone, text-size and high-contrast modes.
The axe-core WCAG 2 A/AA audit reports no violations on any page in either theme.

## Assumptions

1. **No existing EyeReady code was present in this repository** (only a README; another
   branch holds an unrelated project). The app was built from scratch, keeping the five
   specified primary areas (Home Status, Training, Symptom Log, Mission Trend, Flight
   Surgeon Summary) as the primary navigation.
2. **Theme.** The team-supplied palette (white page, navy `#13294B` brand, `#F2F4F8`
   alternating sections, red/yellow/green status pairs) was used instead of the dark
   navy theme in the brief; the navy sidebar, hero and footer keep the mission-control
   feel.
3. Screen-based tests depend on screen size, brightness and gamma; they track change
   against oneself on the same device and are not clinical measurements. A credit-card
   calibration sets letter sizes (default 96 dpi).
4. The Amsler grid uses 10 × 10 tappable regions (each 2 × 2 drawn squares) so targets
   stay tappable on phones.
5. Countermeasure daily targets (LBNP 30 min, cuffs 60 min, exercise 60 min, nutrition
   yes) and the eye-exam schedule (days 30, 90, 150) are illustrative defaults.
6. Adherence % is computed over days that were logged; unlogged days are reported but
   not counted as failures. Insights need ≥ 7 days in each group.
7. PDF pages are rendered by the browser and rasterised (so Thai shapes correctly); the
   PDF contains summaries only — no notes, raw logs or personal details.
8. In personal mode, the selected mission day defaults to today (from the mission start
   date set in Settings); entries are recorded for the selected day.

## Future work

Clinical review of thresholds and methods with ophthalmology / aerospace medicine,
volunteer testing (e.g. head-down-tilt analogues), automatic screen calibration,
integration with on-board exam results (OCT, fundoscopy) through approved channels,
and encrypted export for the ground medical team.
