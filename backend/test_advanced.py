"""Test advanced constraints: locks, fixed_off_weekdays, max_consecutive_nights, weekend balance."""
import sys
sys.path.insert(0, ".")
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve
import time


def main():
    data = get_sample_data()
    req = GenerateRequest(**data)

    # 1) 固定休曜日: 最初のスタッフを月曜固定休に
    if req.staff:
        req.staff[0].fixed_off_weekdays = [0]  # 月曜

    # 2) max_consecutive_nights: 一人だけ厳しめに 1
    if len(req.staff) > 1:
        req.staff[1].max_consecutive_nights = 1

    # 3) locks: 1日目の最初の人を D に固定
    if req.staff:
        sid = req.staff[0].id
        first_date = f"{req.year:04d}-{req.month:02d}-01"
        req.locked_shifts = {sid: {first_date: "D"}}

    print("Running solver with advanced constraints...")
    t0 = time.time()
    result = solve(req)
    print(f"Solved in {time.time() - t0:.2f}s")

    schedule = result["schedule"]

    # 検証 1: 固定休曜日
    s0 = req.staff[0]
    s0_sched = schedule[s0.id]
    failed = []
    from datetime import date
    for d_str, code in s0_sched.items():
        y, m, d = map(int, d_str.split("-"))
        wd = date(y, m, d).weekday()
        if 0 in (s0.fixed_off_weekdays or []) and wd == 0:
            if code not in ("O", "Y"):
                failed.append(f"FIXED-OFF VIOLATION: {s0.name} {d_str} (mon) = {code}")
    print(f"Fixed weekday off: {'OK' if not failed else 'FAIL'}")
    for f in failed:
        print(f"  {f}")

    # 検証 2: max_consecutive_nights
    if len(req.staff) > 1:
        s1 = req.staff[1]
        dates = sorted(schedule[s1.id].keys())
        streak = 0
        max_seen = 0
        for d in dates:
            if schedule[s1.id][d] == "N":
                streak += 1
                max_seen = max(max_seen, streak)
            else:
                streak = 0
        print(f"max consecutive nights for {s1.name}: {max_seen} (limit {s1.max_consecutive_nights}): "
              f"{'OK' if max_seen <= s1.max_consecutive_nights else 'FAIL'}")

    # 検証 3: locked shift
    s0_first_date = f"{req.year:04d}-{req.month:02d}-01"
    lock_result = schedule[s0.id][s0_first_date]
    print(f"Locked shift {s0.name} day1=D: actual={lock_result} {'OK' if lock_result == 'D' else 'FAIL'}")

    # 検証 4: 土日休み公平性
    import calendar
    weekend_days = []
    cal = calendar.Calendar()
    for d in range(1, calendar.monthrange(req.year, req.month)[1] + 1):
        from datetime import date
        wd = date(req.year, req.month, d).weekday()
        if wd >= 5:
            weekend_days.append(f"{req.year:04d}-{req.month:02d}-{d:02d}")
    weekend_offs = []
    for sid, sched in schedule.items():
        n = sum(1 for d in weekend_days if sched.get(d) in ("O", "Y"))
        name = next(s.name for s in req.staff if s.id == sid)
        weekend_offs.append((name, n))
    weekend_offs.sort(key=lambda x: -x[1])
    print(f"Weekend offs: min={min(n for _, n in weekend_offs)}, max={max(n for _, n in weekend_offs)}")
    for name, n in weekend_offs:
        print(f"  {n}: {name}")

    # 検証 5: 連休（2連続O）
    print("\n2連休保有スタッフ:")
    no_two_off = []
    for sid, sched in schedule.items():
        dates = sorted(sched.keys())
        has = False
        for i in range(len(dates) - 1):
            if sched[dates[i]] == "O" and sched[dates[i + 1]] == "O":
                has = True
                break
        name = next(s.name for s in req.staff if s.id == sid)
        if not has:
            no_two_off.append(name)
    if no_two_off:
        print(f"  WARN: 2連休なし: {no_two_off}")
    else:
        print("  OK: 全員2連休あり")

    print("\nDone.")


if __name__ == "__main__":
    main()
