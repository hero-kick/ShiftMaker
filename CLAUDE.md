# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Python 3.13 on Windows — use `py -3` instead of `python` or `pip`
cd backend
py -3 -m pip install -r requirements.txt
py -3 -m uvicorn main:app --port 8000   # no --reload to avoid stale cache issues
py -3 test_solver.py        # basic solver test
py -3 test_advanced.py      # locks / fixed_off_weekdays / max_consecutive_nights
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5174 (5173 may be taken by another project)
npm run build      # production build check
```

### Server restart notes
- Multiple uvicorn processes can silently pile up on port 8000. Always kill all first:
  `taskkill //F //IM python.exe` (Windows), then restart.
- Clear `backend/__pycache__` if stale module data is served after edits.
- Frontend port: configured as 5174 in `vite.config.js`. If taken, Vite auto-increments to 5175.

## Architecture

**Backend** (`backend/`): FastAPI + OR-Tools CP-SAT solver.

- `main.py` — Logging, request middleware, CORS (env `SHIFTMAKER_CORS_ORIGINS` + LAN regex). Endpoints: `GET /api/health` (returns version + solver status), `GET /api/sample`, `POST /api/generate`. Serves static SPA in prod with cache headers + path-traversal guard. 500 errors are sanitized; details only in logs.
- `models.py` — Pydantic models with validators: bounds on `max_night`/`max_consecutive_*` (≤31), `MAX_STAFF=80`, weekday/wish-type validation, ID-uniqueness check.
- `solver.py` — CP-SAT solver. Entry: `solve(request)` + `check_feasibility(request)` + `_diagnose_infeasibility()` (drill-down to specific pair/wish/lock causing INFEASIBLE).
- `sample_data.py` — 10 nurses, includes leaders, rookie, fixed-off-weekday case.
- `test_solver.py` / `test_advanced.py` / `test_edge.py` / `test_mentor_pair.py` / `test_drill.py` / `test_diagnostics.py` — Validation scripts.
- `bench_fairness.py` / `bench_scenarios.py` / `bench_stability.py` / `bench_nights.py` — Fairness benchmarks.

**Frontend** (`frontend/src/`): React 18 + Vite. Proxies `/api` to port 8000.

- `store/useStore.js` — Zustand store with `persist` + `safeStorage` (quota-safe). Active workspace-scoped key.
  Holds `staff, wishes, dayConditions, pairs, shiftTypes, year, month, schedules` (per-month: `{schedule, summary, locks, notes}`).
- `api/client.js` — Axios with 90s timeout. `checkHealth()` for boot-time connectivity check.
- `ErrorBoundary.jsx` — Top-level error boundary with reload + data-backup-export recovery UI.
- `safeStorage.js` — localStorage wrapper: catches QuotaExceededError, dispatches `shiftmaker-storage-error`, memory fallback for private mode.
- `hooks/useIsMobile.js` — Shared mobile-breakpoint hook (was duplicated in 6 components).
- `hooks/useModalA11y.js` — Modal a11y: Escape-to-close, focus trap, focus restore.
- `App.jsx` — **7-tab** layout. First tab is Dashboard. Shows offline banner + storage-warning banner.
- `components/Dashboard.jsx` — Health overview, prep checks, quick links.
- `components/Icons.jsx` — Unified SVG icon set (currentColor, 24×24).
- `workspace.js` / `WorkspaceGate.jsx` — Per-workspace localStorage isolation with optional PIN.

## Mobile Architecture

All components render dual layouts controlled by `useIsMobile(768)` hook.

## Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| ホーム | Dashboard.jsx | Health overview + prep status + quick jumps |
| スタッフ | StaffManager.jsx | Add/edit/delete staff + pair constraints |
| 希望 | WishInput.jsx | Calendar-based wish entry (希望休/有給/出勤) |
| イベント | EventCalendar.jsx | Special events with required/forbidden attendees |
| 人数 | DayConditionInput.jsx | Per-day shift count requirements |
| シフト表 | ShiftTable.jsx | Generated grid + lock + edit warnings + notes |
| 集計 | ShiftSummary.jsx | Per-staff stats + fairness heatmap + score |

## Shift Codes (7)

| Code | Name | Rule |
|------|------|------|
| D | 日勤 | Day shift |
| E | 早番 | Early |
| N | 夜勤 | Night — **must** be followed by A |
| A | 明け | Post-night |
| L | 遅番 | Late — soft constraint avoids L→E next day same staff |
| O | 休み | Day off |
| Y | 有給 | Paid leave — only on days with explicit 有給 wish |

## Data Model

### Staff (extended)
```
id, name, role
night_available: bool
max_night: int                       # monthly cap
max_consecutive_days: int            # connect-work cap
max_consecutive_nights: int          # default 2 (NN OK, NNN forbidden)
is_rookie: bool
can_lead: bool                       # leader-qualified
fixed_off_weekdays: list[int]        # 0=月 ... 6=日
weekend_off_target: int | None       # optional override
```

### GenerateRequest (extended)
```
staff, shift_types, day_conditions, wishes, year, month
prev_last_shifts: dict[str, str]            # staff_id -> shift_code on last day of prev month
pairs: list[StaffPair]                       # forbid (夜勤同時禁止) / require (同シフト強制)
locked_shifts: dict[str, dict[str, str]]    # staff_id -> date -> code (partial-regen)
```

### DayCondition (extended)
```
date, required_per_shift, event_flag, event_name
required_staff_ids: list[str]
forbidden_staff_ids: list[str]
note: str | None        # day-level note (printed in modal)
```

## Solver Constraints (v3.0)

**Hard:**
- Exactly 1 shift per staff per day
- N→A chain (bidirectional)
- `night_available=False` → no N/A
- `max_night` enforced
- Per-day required counts
- Y only when explicitly wished; required when wished
- 出勤 wish → not O/Y
- `required_staff_ids` → not O/Y; `forbidden_staff_ids` → O
- **Pairs**: forbid = no shared N; require = identical shift code
- **Leader**: ≥1 `can_lead` working per day (if any leaders exist)
- **max_consecutive_nights**: hard cap per staff (window-based)
- **locked_shifts**: forced equal to specified code
- **fixed_off_weekdays**: O/Y only on listed weekdays

**Soft (penalty minimization):**
- 希望休→O (×150), prev-month A→day1 O (×20), A→O next day (×25)
- Long consecutive days >max (×200)
- Night-count deviation from target (×20 each side)
- Off-day deviation from target (×80 each side) + hard cap
- Min 8 off-days/month (×100 per missing day)
- **Weekend off balance** (×40 below target, ×10 above)
- **2-day-off block per month** required (×120 if absent)
- **No rookie-only daytime** (×250 if violation)
- **L→E next day same staff** (×150)
- **N-N for max_consecutive_nights=1 staff** (×300)

**Feasibility pre-check** (`check_feasibility`):
- Total `max_night` ≥ total required N
- Per-day required ≤ available staff
- N-carryover vs required_staff_ids on day 1

## Frontend Features (v3.0)

- **Dashboard**: status badges per prep step, fairness wins/issues, quick jumps, recent months
- **Locks**: click cell → popover → "ロック"; locked cells survive regenerate. Visual orange shadow
- **Manual edit warnings**: real-time detection (N→A break, night-capable, consec, monthly cap, shortage). Red pulse + warn badge
- **Day notes**: per-date free text, ★ for events, accessible from column header
- **Heatmap**: color-graded grid of nights/off/weekend-off/2-off-blocks + fairness score 0-100 per staff
- **Print**: A4 landscape optimized via `@media print`
- **Fixed off weekdays**: per-staff weekday picker
- **Staff reorder**: ↑/↓ buttons on desktop table
