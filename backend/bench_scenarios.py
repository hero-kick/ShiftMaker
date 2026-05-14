"""様々な構成での公平性ベンチマーク"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from datetime import date as date_cls
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve
from bench_fairness import metrics_of
import time
import statistics


def run(name, mutate_fn, n=3, year=2026, month=3):
    times = []
    metrics_list = []
    for trial in range(n):
        data = deepcopy(get_sample_data(year=year, month=month))
        mutate_fn(data)
        req = GenerateRequest(**data)
        t0 = time.time()
        try:
            result = solve(req)
        except Exception as e:
            print(f"{name:40s} [試行{trial+1}] FAIL: {str(e)[:80]}")
            return
        times.append(time.time() - t0)
        metrics_list.append(metrics_of(req, result))

    avg_time = statistics.mean(times)
    night_diffs = [m["nights"]["diff"] for m in metrics_list]
    off_diffs = [m["offs"]["diff"] for m in metrics_list]
    we_reg_diffs = [m["weekend_off_regular"]["diff"] if m["weekend_off_regular"] else 0 for m in metrics_list]
    two_reg_diffs = [m["two_off_regular"]["diff"] if m["two_off_regular"] else 0 for m in metrics_list]

    print(
        f"{name:40s} "
        f"夜勤 max={max(night_diffs)} 公休 max={max(off_diffs)} "
        f"土日休(通常) max={max(we_reg_diffs)} 2連休(通常) max={max(two_reg_diffs)} "
        f"時間 avg={avg_time:.2f}s"
    )


def mut_baseline(data):
    pass


def mut_no_rookie(data):
    for s in data["staff"]:
        s["is_rookie"] = False


def mut_no_fixed_off(data):
    for s in data["staff"]:
        s["fixed_off_weekdays"] = []


def mut_all_night_capable(data):
    for s in data["staff"]:
        s["night_available"] = True
        s["max_night"] = 8


def mut_heavy_wishes(data):
    # 各スタッフに2-3個の希望休
    data["wishes"] = []
    targets = [
        ("s01", [5, 12, 20]),
        ("s02", [3, 18]),
        ("s03", [10, 25]),
        ("s04", [7, 14, 28]),
        ("s06", [6, 19]),
        ("s08", [11, 22]),
        ("s09", [9, 16]),
        ("s10", [13, 24]),
    ]
    for sid, dates in targets:
        for d in dates:
            data["wishes"].append({"staff_id": sid, "date": f"2026-03-{d:02d}", "type": "希望休"})


def mut_with_pairs(data):
    data["pairs"] = [
        {"staff_a_id": "s01", "staff_b_id": "s09", "type": "require"},  # 指導ペア
        {"staff_a_id": "s02", "staff_b_id": "s03", "type": "forbid"},
    ]


def mut_heavy_events(data):
    # 数日にイベント
    events_at = [3, 10, 17, 24]
    for dc in data["day_conditions"]:
        d = int(dc["date"].split("-")[2])
        if d in events_at:
            dc["event_flag"] = True
            dc["event_name"] = "会議"
            dc["required_staff_ids"] = ["s01", "s02"]


def mut_higher_demand(data):
    # 日勤を 5 人必要に
    for dc in data["day_conditions"]:
        dc["required_per_shift"]["D"] = 4
        dc["required_per_shift"]["N"] = 2


def mut_15_staff(data):
    # スタッフ15名（増員）
    extra = [
        {"id": f"s{i:02d}", "name": f"看護師{i}", "role": "看護師",
         "night_available": True, "max_night": 6, "max_consecutive_days": 5,
         "max_consecutive_nights": 2, "can_lead": False, "is_rookie": False,
         "fixed_off_weekdays": []}
        for i in range(11, 16)
    ]
    data["staff"].extend(extra)


def mut_yuki(data):
    # 数人に有給希望
    data["wishes"] = [
        {"staff_id": "s01", "date": "2026-03-15", "type": "有給"},
        {"staff_id": "s02", "date": "2026-03-20", "type": "有給"},
        {"staff_id": "s04", "date": "2026-03-08", "type": "有給"},
    ]


if __name__ == "__main__":
    print(f"{'シナリオ':40s} 結果")
    print("-" * 130)
    run("ベースライン（サンプル通り）", mut_baseline)
    run("全員非新人", mut_no_rookie)
    run("固定休スタッフ無し", mut_no_fixed_off)
    run("全員夜勤可", mut_all_night_capable)
    run("希望休多数（20件）", mut_heavy_wishes)
    run("ペア制約あり（指導+禁止）", mut_with_pairs)
    run("イベント4日 必須出勤2名", mut_heavy_events)
    run("日勤要件4名/日", mut_higher_demand)
    run("スタッフ15名", mut_15_staff)
    run("有給希望3件", mut_yuki)
