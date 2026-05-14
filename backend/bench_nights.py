"""夜勤の偏り：回数と時間集中の両方を計測"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve
import statistics


def analyze(req: GenerateRequest, result: dict, label: str):
    schedule = result["schedule"]
    year, month = req.year, req.month
    num_days = max(int(d.split("-")[2]) for d in next(iter(schedule.values())).keys())
    days = list(range(1, num_days + 1))

    print(f"\n=== {label} ===")
    print(f"  {'名前':<14} {'夜勤可':>5} | {'夜勤回数':>4} | 夜勤日: 集中度（最大2週連続夜勤数 / 同月最大近接距離）")
    print(f"  {'-'*14} {'-'*5}-+-{'-'*8}-+-{'-'*60}")

    spread_nights = []
    cluster_max_in14 = []
    closest_gap = []

    for s in req.staff:
        if not s.night_available:
            continue
        sched = schedule[s.id]
        night_days = [d for d in days if sched[f"{year:04d}-{month:02d}-{d:02d}"] == "N"]
        spread_nights.append(len(night_days))

        # 14日窓内の最大夜勤数
        max_in14 = 0
        for start in range(1, num_days - 12):
            cnt = sum(1 for nd in night_days if start <= nd < start + 14)
            max_in14 = max(max_in14, cnt)
        cluster_max_in14.append(max_in14)

        # 隣接夜勤の最短距離（連夜勤は1）
        if len(night_days) >= 2:
            gaps = [night_days[i + 1] - night_days[i] for i in range(len(night_days) - 1)]
            min_gap = min(gaps)
            closest_gap.append(min_gap)
        else:
            min_gap = "-"

        nights_str = ",".join(str(d) for d in night_days)
        print(f"  {s.name:<14} {'是' if s.night_available else '非':>5} | {len(night_days):>4} | "
              f"14日内max={max_in14} 最短間隔={min_gap} | {nights_str}")

    if spread_nights:
        print(f"\n  夜勤回数: min={min(spread_nights)} max={max(spread_nights)} "
              f"diff={max(spread_nights)-min(spread_nights)} stdev={statistics.stdev(spread_nights):.2f}")
        print(f"  14日窓内最大集中: min={min(cluster_max_in14)} max={max(cluster_max_in14)} "
              f"avg={statistics.mean(cluster_max_in14):.1f}")


def run(year, month, label):
    data = deepcopy(get_sample_data(year=year, month=month))
    req = GenerateRequest(**data)
    result = solve(req)
    analyze(req, result, f"{label} ({year}/{month})")


if __name__ == "__main__":
    run(2026, 3, "現状")
    run(2026, 4, "現状")
    run(2026, 5, "現状")
