"""Quick validation test for the solver."""
import sys
sys.path.insert(0, ".")

from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve
from collections import Counter
import time

data = get_sample_data()
req = GenerateRequest(**data)

night_cap = sum(s.max_night for s in req.staff if s.night_available)
night_req = sum(
    dc.required_per_shift.get("N", 0) for dc in req.day_conditions
)
print(f"Night capacity: {night_cap} / required: {night_req}")
assert night_cap >= night_req, "INFEASIBLE: not enough night capacity"

print("Running solver...")
t0 = time.time()
result = solve(req)
elapsed = time.time() - t0
print(f"Solved in {elapsed:.2f}s")

schedule = result["schedule"]
summary = result["summary"]
staff_ids = list(schedule.keys())

# Constraint checks
errors = []
for sid, days in schedule.items():
    dates = sorted(days.keys())
    name = summary[sid]["name"]
    for i, date in enumerate(dates[:-1]):
        if days[date] == "N" and days[dates[i + 1]] != "A":
            errors.append(f"{name}: {date} N->not A ({days[dates[i+1]]})")
        if days[dates[i + 1]] == "A" and days[date] != "N":
            errors.append(f"{name}: {dates[i+1]} A prev not N ({days[date]})")

dc_map = {dc.date: dc for dc in req.day_conditions}
count_errors = []
for date in sorted(schedule[staff_ids[0]].keys()):
    d_count = sum(1 for sid in staff_ids if schedule[sid][date] == "D")
    n_count = sum(1 for sid in staff_ids if schedule[sid][date] == "N")
    req_d = dc_map[date].required_per_shift.get("D", 0) if date in dc_map else 3
    req_n = dc_map[date].required_per_shift.get("N", 0) if date in dc_map else 2
    if d_count < req_d:
        count_errors.append(f"{date}: D {d_count}<{req_d}")
    if n_count < req_n:
        count_errors.append(f"{date}: N {n_count}<{req_n}")

all_shifts = []
for sid, days in schedule.items():
    all_shifts.extend(days.values())
dist = Counter(all_shifts)

print(f"\n=== Results ===")
print(f"Shift dist: D={dist['D']} N={dist['N']} A={dist['A']} O={dist['O']} Y={dist['Y']}")
print(f"N->A chain violations: {len(errors)}", "OK" if not errors else "FAIL")
for e in errors:
    print(f"  {e}")
print(f"Required count shortfalls: {len(count_errors)}", "OK" if not count_errors else "FAIL")
for e in count_errors[:5]:
    print(f"  {e}")

print(f"\nStaff summary:")
for sid, s in summary.items():
    print(f"  {s['name']}: nights={s['night_count']} off={s['off_count']} work={s['work_count']}")

all_ok = len(errors) == 0 and len(count_errors) == 0 and dist["O"] < 310
print(f"\n{'PASS' if all_ok else 'FAIL'}")
