"""シフトを複数回生成して公平性メトリクスを計測する"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from datetime import date as date_cls
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve
import time
import statistics


def metrics_of(req: GenerateRequest, result: dict) -> dict:
    """1 つのシフト結果から公平性メトリクスを抽出"""
    schedule = result["schedule"]
    year, month = req.year, req.month
    num_days = max(int(d.split("-")[2]) for d in next(iter(schedule.values())).keys())
    days = list(range(1, num_days + 1))

    rows = []
    for s in req.staff:
        sched = schedule[s.id]
        nights = sum(1 for c in sched.values() if c == "N")
        offs = sum(1 for c in sched.values() if c == "O")
        yukis = sum(1 for c in sched.values() if c == "Y")
        works = sum(1 for c in sched.values() if c in ("D", "E", "L", "N", "A"))
        weekend_off = 0
        weekend_work = 0
        for d in days:
            wd = date_cls(year, month, d).weekday()
            if wd >= 5:
                code = sched[f"{year:04d}-{month:02d}-{d:02d}"]
                if code in ("O", "Y"):
                    weekend_off += 1
                else:
                    weekend_work += 1
        # 2連休
        two_off = 0
        prev_o = False
        for d in days:
            is_o = sched[f"{year:04d}-{month:02d}-{d:02d}"] == "O"
            if is_o and prev_o:
                two_off += 1
                prev_o = False
            else:
                prev_o = is_o
        rows.append({
            "name": s.name,
            "night_available": s.night_available,
            "is_rookie": s.is_rookie,
            "nights": nights,
            "offs": offs,
            "yukis": yukis,
            "works": works,
            "weekend_off": weekend_off,
            "weekend_work": weekend_work,
            "two_off_blocks": two_off,
        })

    def spread(vals):
        if not vals:
            return None
        return {
            "min": min(vals),
            "max": max(vals),
            "diff": max(vals) - min(vals),
            "stdev": round(statistics.stdev(vals), 2) if len(vals) > 1 else 0,
            "values": vals,
        }

    night_rows = [r for r in rows if r["night_available"]]
    # 固定休曜日に土日を含むスタッフを「特殊」とみなして除外した行
    special_ids = set()
    for s in req.staff:
        if s.fixed_off_weekdays and (5 in s.fixed_off_weekdays or 6 in s.fixed_off_weekdays):
            special_ids.add(s.id)
    regular_rows = [r for r, s in zip(rows, req.staff) if s.id not in special_ids]

    return {
        "nights":       spread([r["nights"] for r in night_rows]),
        "offs":         spread([r["offs"] for r in rows]),
        "weekend_off":  spread([r["weekend_off"] for r in rows]),
        "weekend_off_regular":  spread([r["weekend_off"] for r in regular_rows]),
        "weekend_work": spread([r["weekend_work"] for r in rows]),
        "two_off":      spread([r["two_off_blocks"] for r in rows]),
        "two_off_regular": spread([r["two_off_blocks"] for r in regular_rows]),
        "rows": rows,
    }


def fmt(m, key):
    s = m[key]
    if s is None:
        return "-"
    return f"min={s['min']} max={s['max']} diff={s['diff']} std={s['stdev']}"


def bench_one(year, month):
    data = deepcopy(get_sample_data(year=year, month=month))
    req = GenerateRequest(**data)
    t0 = time.time()
    result = solve(req)
    elapsed = time.time() - t0
    m = metrics_of(req, result)
    return elapsed, m


def detailed_print(req, metrics):
    """1試行の詳細を出力"""
    rows = metrics["rows"]
    print(f"  {'名前':<15s} {'夜勤可':>5s} {'新人':>4s} | {'夜勤':>3s} {'公休':>3s} {'有給':>3s} {'土日休':>5s} {'土日勤':>5s} {'2連休':>5s}")
    for r in rows:
        print(
            f"  {r['name']:<15s} {'是' if r['night_available'] else '非':>5s} "
            f"{'新' if r['is_rookie'] else '  ':>4s} | "
            f"{r['nights']:>3d} {r['offs']:>3d} {r['yukis']:>3d} {r['weekend_off']:>5d} {r['weekend_work']:>5d} {r['two_off_blocks']:>5d}"
        )


def main(months=None, n_trials=3, detail_month=None):
    """複数月×複数試行のベンチ"""
    if months is None:
        months = [(2026, 3), (2026, 4), (2026, 5), (2025, 12)]

    all_results = []
    print(f"{'月':>10s} {'試行':>4s} {'解時間':>7s}  | {'夜勤(差)':>14s} | {'公休(差)':>14s} | {'土日休(差)':>14s} | {'2連休':>10s}")
    print("-" * 110)

    for (y, m) in months:
        for trial in range(1, n_trials + 1):
            try:
                elapsed, metrics = bench_one(y, m)
            except Exception as e:
                print(f"{y}/{m:<2d}     {trial}    FAIL: {e}")
                continue
            all_results.append((y, m, trial, elapsed, metrics))
            n = metrics["nights"]
            o = metrics["offs"]
            w = metrics["weekend_off"]
            t = metrics["two_off"]
            print(
                f"{y}/{m:<2d}     {trial:>4d}  {elapsed:>6.2f}s | "
                f"min{n['min']:>2d}-max{n['max']:>2d}(d{n['diff']:>2d}) | "
                f"min{o['min']:>2d}-max{o['max']:>2d}(d{o['diff']:>2d}) | "
                f"min{w['min']:>2d}-max{w['max']:>2d}(d{w['diff']:>2d}) | "
                f"min{t['min']:>2d}-max{t['max']:>2d}(d{t['diff']:>2d})"
            )

    print("-" * 110)
    # 集計
    night_diffs = [r[4]["nights"]["diff"] for r in all_results]
    off_diffs = [r[4]["offs"]["diff"] for r in all_results]
    we_diffs = [r[4]["weekend_off"]["diff"] for r in all_results]
    two_diffs = [r[4]["two_off"]["diff"] for r in all_results]
    times = [r[3] for r in all_results]
    if night_diffs:
        we_reg_diffs = [r[4]["weekend_off_regular"]["diff"] if r[4]["weekend_off_regular"] else 0 for r in all_results]
        two_reg_diffs = [r[4]["two_off_regular"]["diff"] if r[4]["two_off_regular"] else 0 for r in all_results]
        print(f"夜勤差          avg={statistics.mean(night_diffs):.2f} max={max(night_diffs)}")
        print(f"公休差          avg={statistics.mean(off_diffs):.2f} max={max(off_diffs)}")
        print(f"土日休差(全員)  avg={statistics.mean(we_diffs):.2f} max={max(we_diffs)}")
        print(f"土日休差(通常)  avg={statistics.mean(we_reg_diffs):.2f} max={max(we_reg_diffs)}")
        print(f"2連休差(全員)   avg={statistics.mean(two_diffs):.2f} max={max(two_diffs)}")
        print(f"2連休差(通常)   avg={statistics.mean(two_reg_diffs):.2f} max={max(two_reg_diffs)}")
        print(f"解時間          avg={statistics.mean(times):.2f}s max={max(times):.2f}s")

    # 詳細表示
    if detail_month and all_results:
        y_d, m_d = detail_month
        for r in all_results:
            if r[0] == y_d and r[1] == m_d and r[2] == 1:
                data = deepcopy(get_sample_data(year=y_d, month=m_d))
                req = GenerateRequest(**data)
                print(f"\n--- 詳細: {y_d}/{m_d} 試行1 ---")
                detailed_print(req, r[4])
                break

    return all_results


if __name__ == "__main__":
    main(detail_month=(2026, 5))
