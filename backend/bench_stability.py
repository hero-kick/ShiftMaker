"""同じ入力で複数回実行し、結果のブレ（安定性）を測る"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve
from bench_fairness import metrics_of
import time
import statistics


def stability(month_year, n=5):
    y, m = month_year
    print(f"\n=== {y}/{m} × {n}回試行 ===")
    night_diffs = []
    off_diffs = []
    we_diffs = []
    two_diffs = []
    times = []
    print(f"  {'試行':>4s} {'時間':>6s} | {'夜勤(差)':>10s} {'公休(差)':>10s} {'土日休(通常)':>12s} {'2連休(通常)':>12s}")
    for trial in range(1, n + 1):
        data = deepcopy(get_sample_data(year=y, month=m))
        req = GenerateRequest(**data)
        t0 = time.time()
        result = solve(req)
        elapsed = time.time() - t0
        m_dat = metrics_of(req, result)
        we_reg = m_dat["weekend_off_regular"]
        two_reg = m_dat["two_off_regular"]
        night_diffs.append(m_dat["nights"]["diff"])
        off_diffs.append(m_dat["offs"]["diff"])
        we_diffs.append(we_reg["diff"] if we_reg else 0)
        two_diffs.append(two_reg["diff"] if two_reg else 0)
        times.append(elapsed)
        print(f"  {trial:>4d} {elapsed:>5.2f}s |  "
              f"diff{m_dat['nights']['diff']}     "
              f"diff{m_dat['offs']['diff']}      "
              f"diff{we_reg['diff'] if we_reg else 0}        "
              f"diff{two_reg['diff'] if two_reg else 0}")
    print(f"  平均: 夜勤差 {statistics.mean(night_diffs):.1f} 公休差 {statistics.mean(off_diffs):.1f} "
          f"土日休差 {statistics.mean(we_diffs):.1f} 2連休差 {statistics.mean(two_diffs):.1f} 時間 {statistics.mean(times):.2f}s")


if __name__ == "__main__":
    stability((2026, 3), n=5)
    stability((2026, 4), n=5)
    stability((2026, 5), n=5)
    stability((2025, 12), n=5)
