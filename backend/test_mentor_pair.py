"""指導ペアの挙動テスト"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve


def desc_pair(name):
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")


def show_schedule(req, sids_to_show, dates_to_show=None):
    try:
        result = solve(req)
    except ValueError as e:
        print(f"  INFEASIBLE: {str(e).split(chr(10))[0]}")
        return None
    schedule = result["schedule"]
    print("  → 解けた")
    if dates_to_show is None:
        dates_to_show = sorted(schedule[sids_to_show[0]].keys())[:7]
    for sid in sids_to_show:
        name = next(s.name for s in req.staff if s.id == sid)
        rookie = next(s.is_rookie for s in req.staff if s.id == sid)
        flag = "🌱" if rookie else "👤"
        codes = " ".join(schedule[sid][d] for d in dates_to_show)
        print(f"  {flag} {name:12s} {codes}")
    return result


# ─── ケース 1: 指導ペアで指導者に有給 → 新人も自動的に休み ───
desc_pair("指導ペア: 指導者に有給 → 新人も自動的に休み")
data = deepcopy(get_sample_data())
# s01 主任 (rookie=False), s09 新人 (rookie=True) をペアに
data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s09", "type": "require"}]
# 指導者 s01 に5日有給
data["wishes"] = [
    {"staff_id": "s01", "date": f"2026-03-{d:02d}", "type": "有給"}
    for d in [3, 4, 10, 17, 24]
]
result = show_schedule(GenerateRequest(**data), ["s01", "s09"],
                       [f"2026-03-{d:02d}" for d in [3, 4, 10, 17, 24]])
if result:
    # 新人 s09 がこれらの日にすべて O か Y か確認
    s09 = result["schedule"]["s09"]
    bad = [d for d in [3, 4, 10, 17, 24] if s09[f"2026-03-{d:02d}"] not in ("O", "Y")]
    if not bad:
        print("  [OK] 指導者有給日に新人もすべて休みになっている")
    else:
        print(f"  [NG] 新人が働いている日: {bad}")


# ─── ケース 2: 指導ペアで新人に有給 → 指導者は通常勤務OK ───
desc_pair("指導ペア: 新人に有給 → 指導者は通常勤務してOK")
data = deepcopy(get_sample_data())
data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s09", "type": "require"}]
data["wishes"] = [
    {"staff_id": "s09", "date": f"2026-03-{d:02d}", "type": "有給"}
    for d in [5, 12]
]
result = show_schedule(GenerateRequest(**data), ["s01", "s09"],
                       [f"2026-03-{d:02d}" for d in [5, 12]])
if result:
    s01 = result["schedule"]["s01"]
    s09 = result["schedule"]["s09"]
    print(f"  s09: {s09['2026-03-05']} {s09['2026-03-12']}   (Y であるべき)")
    print(f"  s01: {s01['2026-03-05']} {s01['2026-03-12']}   (何でもOK)")


# ─── ケース 3: 同格ペア（両者非新人）で 1人有給 → 既存の対称ロジックで OK ───
desc_pair("同格ペア（両者ベテラン）: 片方有給 → もう片方は自由")
data = deepcopy(get_sample_data())
data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s02", "type": "require"}]
data["wishes"] = [
    {"staff_id": "s01", "date": "2026-03-05", "type": "有給"}
]
show_schedule(GenerateRequest(**data), ["s01", "s02"],
              [f"2026-03-{d:02d}" for d in [4, 5, 6]])


# ─── ケース 4: 指導ペアで通常日 → 同じシフト ───
desc_pair("指導ペア: 通常日 → 同じシフトに揃う")
data = deepcopy(get_sample_data())
data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s09", "type": "require"}]
data["wishes"] = []
result = show_schedule(GenerateRequest(**data), ["s01", "s09"],
                       [f"2026-03-{d:02d}" for d in [1, 2, 3, 4, 5, 6, 7]])
if result:
    s01 = result["schedule"]["s01"]
    s09 = result["schedule"]["s09"]
    # 通常日は同じシフト（個別事情がない日）
    diff = []
    for d in [1, 2, 3, 4, 5, 6, 7]:
        date = f"2026-03-{d:02d}"
        if s01[date] != s09[date]:
            diff.append((d, s01[date], s09[date]))
    if not diff:
        print("  [OK] 7日間すべて同じシフト")
    else:
        print(f"  [INFO] シフトが違う日: {diff}")


# ─── ケース 5: pre-check が新規矛盾を検知 ───
desc_pair("pre-check: 指導者有給日に新人の出勤希望")
data = deepcopy(get_sample_data())
data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s09", "type": "require"}]
data["wishes"] = [
    {"staff_id": "s01", "date": "2026-03-10", "type": "有給"},
    {"staff_id": "s09", "date": "2026-03-10", "type": "出勤"},
]
from solver import check_feasibility
req = GenerateRequest(**data)
errs = check_feasibility(req)
if errs:
    print("  pre-check で検知:")
    for e in errs:
        print(f"    - {e}")
else:
    print("  pre-check では検知されず（solve 結果に依存）")
    try:
        solve(req)
        print("    → solve は成功")
    except ValueError as e:
        print(f"    → solve INFEASIBLE: {str(e).split(chr(10))[0]}")
