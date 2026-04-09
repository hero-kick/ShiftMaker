# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Python 3.13 on Windows — use `py -3` instead of `python` or `pip`
cd backend
py -3 -m pip install -r requirements.txt
py -3 -m uvicorn main:app --port 8000   # no --reload to avoid stale cache issues
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

- `main.py` — CORS allows ports 5173–5175. Endpoints: `GET /api/health`, `GET /api/sample`, `POST /api/generate`
- `models.py` — Pydantic models: `Staff`, `ShiftType`, `DayCondition`, `Wish`, `GenerateRequest`, `ShiftResult`
- `solver.py` — CP-SAT solver. Entry: `solve(request)` + `check_feasibility(request)` pre-check
- `sample_data.py` — 10 nurses, 31 days (March 2026). All night-capable staff have `max_night=8`
- `test_solver.py` — Quick constraint validation script. Run: `py -3 test_solver.py`

**Frontend** (`frontend/src/`): React 18 + Vite. Proxies `/api` to port 8000.

- `store/useStore.js` — Zustand store: staff, wishes, dayConditions, shiftTypes, schedule, summary, year, month
- `api/client.js` — Axios with 90s timeout (solver can take up to 55s)
- `App.jsx` — **6-tab** layout: スタッフ管理 | 希望入力 | **イベント** | 日別条件 | シフト表 | 集計
- `components/EventCalendar.jsx` — Event management (calendar + side panel / mobile bottom sheet)

## Mobile Architecture

All components render dual layouts controlled by `useIsMobile(768)` hook (defined per-component, uses `matchMedia`).

**Patterns:**
- `App.jsx`: separate mobile header (month select + generate btn + "..." overflow) + bottom tab bar
- `StaffManager.jsx`: collapsible add form + card list (tap to edit)
- `WishInput.jsx`: horizontal scrollable staff pills + compact wish type buttons
- `DayConditionInput.jsx`: card layout with `-/+` stepper buttons
- `EventCalendar.jsx`: `ReactDOM.createPortal` bottom sheet modal for event editing
- `ShiftTable.jsx`: personal view with prev/next staff navigation (default on mobile)
- `ShiftSummary.jsx`: per-staff stat cards with 5-column grid

**LAN testing:** `vite.config.js` has `host: true`. Backend CORS includes LAN IP. Run backend with `--host 0.0.0.0`.

## Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| スタッフ管理 | StaffManager.jsx | Add/edit/delete staff |
| 希望入力 | WishInput.jsx | Calendar-based wish entry (希望休/有給) |
| イベント | EventCalendar.jsx | Special events with required attendees |
| 日別条件 | DayConditionInput.jsx | Per-day shift count requirements |
| シフト表 | ShiftTable.jsx | Color-coded generated schedule grid |
| 集計 | ShiftSummary.jsx | Per-staff statistics |

## Data Model: DayCondition

```
date: str              # YYYY-MM-DD
required_per_shift: dict[str, int]   # e.g. {"D": 3, "N": 2}
event_flag: bool       # true if a special event exists
event_name: str | None # event title (e.g. "病棟会議")
required_staff_ids: list[str]   # must attend (not O or Y)
forbidden_staff_ids: list[str]  # must be O
```

## Shift Codes

| Code | Name | Rule |
|------|------|------|
| D | 日勤 | Normal day shift |
| N | 夜勤 | Night — **must** be followed by A next day |
| A | 明け | Post-night — always preceded by N; soft preference for O next day |
| O | 休み | Day off |
| Y | 有給 | Paid leave — **only assignable when explicitly wished** |

## Solver Constraints

**Hard:**
- Exactly 1 shift per staff per day
- N→A chain (and reverse: A must be preceded by N)
- `night_available=False` → cannot be N or A
- Monthly night count ≤ `max_night`
- Required shift counts per day satisfied
- Y only on days with an explicit 有給 wish
- `required_staff_ids` → not O, not Y
- `forbidden_staff_ids` → must be O

**Soft (penalty minimization):**
- 希望休 → prefer O (penalty 100)
- After A, prefer O next day (penalty 20)
- Consecutive D/N days > `max_consecutive_days` (penalty 200)
- Night shift count variance across staff (penalty 10/deviation)

**Feasibility pre-check** (`check_feasibility`):
- Total `max_night` across night-capable staff must ≥ total required N shifts
- Returns HTTP 422 with explanation if infeasible

## Known Issues / TODO

- Night-unavailable staff (e.g. s05, s07) can end up with very few days off (~7/31) because only D shifts count toward the consecutive-work penalty. Consider adding a soft constraint for minimum monthly off-days.
- The soft constraint for consecutive days only counts D and N (not A). A-chains give implicit rest but aren't counted.
