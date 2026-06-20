# LogGate — Automotive Datalog Validation

> **Portfolio project.** A browser-based tool for validating automotive CSV datalogs against tuner-defined rules. No server, no account, no data sent anywhere.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Problem Statement

Remote automotive tuning requires customers to capture wide-open-throttle (WOT) datalogs on a closed course or dyno and submit them to a tuner. In practice, logs come in with:

- **Missing critical channels** (no AFR/lambda, no knock data)
- **Wrong procedure** (wrong gear, wrong starting RPM, throttle lifted early)
- **File format variations** (COBB Accessport, MHD Flasher, generic ECU loggers)
- **Data quality issues** (corrupted timestamps, low sample rates)

Reviewing bad logs wastes hours of tuner time. LogGate validates log structure and procedure compliance instantly, generates a clear redo message for the customer, and produces a technical summary for the tuner — all before the tuner opens the file.

---

## Features

| Feature | Description |
|---|---|
| **CSV ingestion** | Accepts generic CSV, COBB Accessport-like, and MHD/BMW-like column naming |
| **Format detection** | Automatically identifies the ECU logging source |
| **Column mapping** | Maps diverse raw column names to a unified telemetry schema |
| **Unit normalization** | km/h → mph, °C → °F, lambda → estimated AFR |
| **Pull window detection** | Locates the WOT segment using throttle continuity + RPM sweep heuristics |
| **Rule validation** | Checks start speed, start RPM, gear, throttle continuity, end RPM, sample rate, and more |
| **Failure events** | Discrete markers for early lift, wrong gear, no redline — rendered on charts |
| **Validation score** | 0–100 score with weighted deductions per failed check |
| **Telemetry charts** | Recharts visualizations: RPM/throttle, speed/RPM, AFR/boost, timing/knock |
| **Gauge cluster replay** | SVG arc gauges that animate through the log with play/pause/scrub controls |
| **Dyno animation** | Decorative loading animation while validation runs |
| **Customer message** | Plain-English redo instructions tailored to the dominant failure |
| **Tuner summary** | Structured technical report with pull metrics, check results, and channel status |
| **File upload** | Drag-and-drop or file-picker, 100% in-browser, no server upload |
| **Metrics page** | Live evaluation of all 10 demo logs with accuracy stats and IoU analysis |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) — App Router, static export |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org) |
| Animation | [Motion / Framer Motion](https://motion.dev) |
| CSV parsing | [PapaParse](https://www.papaparse.com) |
| Icons | [Lucide React](https://lucide.dev) |
| Testing | [Vitest](https://vitest.dev) — 153 tests across 4 suites |
| Deployment | [Vercel](https://vercel.com) (zero configuration required) |

---

## Architecture

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page
│   ├── demo/page.tsx           # Interactive demo (10 synthetic logs)
│   ├── metrics/page.tsx        # Live evaluation dashboard (server component)
│   └── upload/
│       ├── page.tsx            # Server wrapper (metadata)
│       └── UploadClient.tsx    # Client-side upload + validation UI
│
├── components/
│   ├── layout/                 # Navbar, Footer, PageShell
│   ├── charts/                 # Recharts telemetry visualizations
│   ├── mapping/                # Column mapping + raw preview tables
│   ├── replay/                 # Gauge cluster + playback controls
│   ├── upload/                 # CsvUploader drag-drop component
│   ├── validation/             # Dashboard, summary cards, report cards
│   └── DynoLoadingAnimation.tsx
│
└── lib/
    ├── demo-data/              # Synthetic log generators + 10 demo logs
    ├── metrics/                # evaluateDemoSet, calculatePullWindowIoU
    ├── parser/                 # parseCsv → detectFormat → mapColumns → normalize
    ├── reports/                # generateCustomerMessage, generateTunerSummary
    ├── schema/                 # TypeScript types: NormalizedLogRow, ValidationResult
    └── validation/             # requiredChannels, sampleRate, detectPullWindow, …
```

### Data flow

```
CSV text
  └─▶ parseCsvText()          PapaParse → headers + raw rows
  └─▶ stripMetadataRows()     Remove ECU metadata rows above the header
  └─▶ detectFormat()          Identify COBB / MHD / generic / unknown
  └─▶ mapColumns()            Fuzzy-match raw headers → NormalizedLogRow fields
  └─▶ normalizeUnits()        Convert km/h, °C, kPa, lambda as needed
  └─▶ crossDeriveLambdaAfr()  Derive AFR from lambda (or vice versa)
  └─▶ ParsedLog               { rows: NormalizedLogRow[], columnMappings, … }
        │
        └─▶ validateLog()
              ├─▶ checkRequiredChannels()
              ├─▶ checkSampleRate()
              ├─▶ detectPullWindow()        WOT heuristic on throttle + RPM
              ├─▶ validateStartConditions() Speed + RPM entry check
              ├─▶ validateThrottle()        Continuity + early-lift detection
              ├─▶ validateGear()            Direct or speed/RPM ratio estimate
              ├─▶ validateEndConditions()   Target RPM reached?
              ├─▶ validateMissingValues()   Null channel gaps in pull window
              └─▶ scoreValidation()         Weighted 0–100 score + outcome
                    │
                    └─▶ ValidationResult   { outcome, score, pullWindow,
                                             failureEvents, checks, … }
```

---

## Unified Schema

Every CSV format is normalized into `NormalizedLogRow`:

```typescript
interface NormalizedLogRow {
  timeSec:                  number;        // required — seconds from log start
  rpm?:                     number;        // engine speed (RPM)
  speedMph?:                number;        // vehicle speed (always mph after normalization)
  gear?:                    number;        // transmission gear (integer)
  throttlePct?:             number;        // throttle position 0–100%
  acceleratorPct?:          number;        // pedal position (MHD alias for throttle)
  afr?:                     number;        // air-fuel ratio (gasoline: ~14.7 stoich)
  lambda?:                  number;        // lambda (1.0 = stoich)
  boostPsi?:                number;        // boost pressure (always psi after normalization)
  mapKpa?:                  number;        // manifold absolute pressure (kPa)
  ignitionTimingDeg?:       number;        // spark advance (degrees BTDC)
  knockRetardDeg?:          number;        // knock retard (degrees)
  timingCorrectionCylinders?: {           // per-cylinder corrections (MHD style)
    cyl1?: number; cyl2?: number; cyl3?: number; cyl4?: number;
    cyl5?: number; cyl6?: number; cyl7?: number; cyl8?: number;
  };
  iatF?:                    number;        // intake air temperature (always °F)
  coolantTempF?:            number;        // coolant temperature (always °F)
  fuelPressurePsi?:         number;        // fuel pressure (always psi)
  sourceRowIndex:           number;        // original CSV row number (0-based)
}
```

### Column aliases

The mapper recognises dozens of common column name variants per field. Examples:

| Normalized field | Accepted raw names |
|---|---|
| `rpm` | `RPM`, `Engine Speed`, `Engine Speed (RPM)` |
| `speedMph` | `Speed`, `Vehicle Speed`, `Vehicle Speed (mph)`, `VSS` |
| `throttlePct` | `Throttle`, `Throttle Position`, `Throttle Pos (%)`, `TPS` |
| `acceleratorPct` | `Accelerator Pedal`, `Pedal Position`, `APP`, `Pedal` |
| `afr` | `AFR`, `Air Fuel Ratio`, `Wideband AFR` |
| `lambda` | `Lambda`, `Actual Lambda`, `Lambda Bank 1`, `Lambda B1` |
| `knockRetardDeg` | `Knock Retard`, `KR`, `Feedback Knock`, `Knock Correction` |

---

## Demo Logs

Ten synthetic CSV logs are generated from a deterministic base dataset:

| # | ID | Expected | Failure Type | Format |
|---|---|---|---|---|
| 1 | `good-pull` | ✅ PASS | — | Generic |
| 2 | `missing-afr` | ❌ FAIL | `missing_channels` | Generic |
| 3 | `wrong-gear` | ❌ FAIL | `wrong_gear` | Generic |
| 4 | `early-lift` | ❌ FAIL | `early_lift` | Generic |
| 5 | `high-rpm-start` | ❌ FAIL | `high_rpm_start` | Generic |
| 6 | `no-redline` | ❌ FAIL | `no_redline` | Generic |
| 7 | `low-sample-rate` | ⚠️ WARN | `low_sample_rate` | Generic |
| 8 | `corrupted-timestamps` | ❌ FAIL | `corrupted_timestamps` | Generic |
| 9 | `cobb-good` | ✅ PASS | — | COBB Accessport-like |
| 10 | `mhd-good` | ✅ PASS | — | MHD / BMW-like |

---

## Validation Rules

The built-in template validates a **40 Roll — 4th Gear — 2k RPM to Redline** pull:

| Rule | Threshold |
|---|---|
| Required channels | time, RPM, speed, throttle or pedal, AFR or lambda, ignition timing, knock retard |
| Start speed | 40 mph ± 7 mph |
| Start RPM | 2,000 ± 400 RPM |
| Required gear | 4th (estimated from speed/RPM ratio if no gear column) |
| Minimum throttle | ≥ 90% throughout the pull |
| Target end RPM | 6,500 RPM |
| Minimum pull duration | 5.0 seconds |
| Minimum sample rate | 5 Hz |

### Score weights

Failed checks deduct points from 100:

| Check | Deduction |
|---|---|
| No pull detected | −40 |
| Timestamp corruption | −30 |
| Missing RPM channel | −30 |
| Missing throttle channel | −25 |
| Wrong gear | −25 |
| Throttle lift / continuity | −20 |
| Target RPM not reached | −20 |
| Pull too short | −20 |
| Missing AFR/lambda | −20 |
| Start speed out of range | −15 |
| Sample rate below minimum | −10 (fail) / −8 (warn) |
| Start RPM out of range | −10 |

---

## Metrics Page

The `/metrics` page runs `evaluateDemoSet()` at server-render time — all 10 demo logs are parsed and validated live. No numbers are hard-coded.

Reported metrics:

- **Bad-log detection rate** — correctly flagged non-passing logs / total non-passing expected
- **False rejection rate** — incorrectly rejected passing logs / total expected passing
- **Average pull-window IoU** — Intersection-over-Union between detected pull window and WOT reference (throttle ≥ 88%) derived from the raw rows
- **Average irrelevant data trimmed** — mean fraction of rows outside the detected pull window

---

## Screenshots

> _Add screenshots here after first deployment._

```
/           Landing page with hero, how-it-works, and CTA
/demo       Interactive demo: log selector → dyno animation → tabbed results
/metrics    Live evaluation dashboard with per-log table and accuracy stats
/upload     Drag-and-drop CSV upload with the same validation pipeline
```

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/loggate.git
cd loggate
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Production build (static export) |
| `npm start` | Serve the production build locally |
| `npm test` | Run all 153 Vitest tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | ESLint check |

---

## Deployment to Vercel

LogGate is a static Next.js app with no server-side dependencies or environment variables. Deployment is zero-configuration.

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Vercel auto-detects Next.js.

### Option B — GitHub integration

1. Push to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Click **Deploy** — no configuration needed

### Build settings (auto-detected)

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build command | `npm run build` |
| Output directory | `.next` |
| Install command | `npm install` |
| Node.js version | 18.x or 20.x |

### Environment variables

None required. All processing is client-side.

---

## Testing

```
npm test

Test Files  4 passed (4)
     Tests  153 passed (153)
  Duration  ~1s
```

| File | Coverage |
|---|---|
| `parser.test.ts` | CSV parsing, format detection, column mapping, unit conversion, edge cases |
| `validator.test.ts` | All 10 validation scenarios, score ordering, failure event assertions |
| `pull-window.test.ts` | `detectPullWindow`, `calculatePullWindowIoU`, `deriveWotReference` |
| `simulation.test.ts` | Full `evaluateDemoSet` harness, score stability, determinism |

---

## Safety Disclaimer

> **For closed-course, dyno, and educational use only.**
>
> LogGate validates datalog *structure* and *procedure compliance*. It does not provide engine calibration advice, tuning recommendations, or driving instructions. Never modify engine calibration or perform performance driving on public roads. All activities must comply with applicable laws and be performed by qualified professionals.
>
> No real customer data is processed or stored. All computation occurs in the user's browser.

---

## License

MIT — see [LICENSE](LICENSE).

---

*LogGate is a portfolio project demonstrating browser-based data processing, domain-specific validation logic, and modern React/Next.js UI patterns applied to the automotive tuning domain.*
