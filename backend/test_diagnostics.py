"""INFEASIBLE 時の診断メッセージをテスト"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve, check_feasibility


def show(name, req):
    print(f"\n=== {name} ===")
    # check_feasibility 結果
    pre = check_feasibility(req)
    if pre:
        print("pre-check で検知:")
        for e in pre:
            print(f"  - {e}")
        return
    # solve()
    try:
        solve(req)
        print("  解けた（期待は INFEASIBLE）")
    except ValueError as e:
        print("solve() 後の診断:")
        print(f"  {e}")


def main():
    # Case 1: 固定休 vs イベント必須出勤
    data = deepcopy(get_sample_data())
    data["staff"][0]["fixed_off_weekdays"] = [0]  # 月曜固定休
    for dc in data["day_conditions"]:
        if dc["date"] == "2026-03-02":  # 月曜
            dc["required_staff_ids"] = ["s01"]
            dc["event_flag"] = True
            dc["event_name"] = "テスト会議"
    show("固定休曜日 vs イベント必須出勤", GenerateRequest(**data))

    # Case 2: ロック vs required
    data = deepcopy(get_sample_data())
    for dc in data["day_conditions"]:
        if dc["date"] == "2026-03-05":
            dc["required_staff_ids"] = ["s01"]
    data["locked_shifts"] = {"s01": {"2026-03-05": "O"}}
    show("ロックを O にしたが required", GenerateRequest(**data))

    # Case 3: 夜勤不可者を N にロック
    data = deepcopy(get_sample_data())
    data["locked_shifts"] = {"s05": {"2026-03-10": "N"}}  # s05 is night_available=False
    show("夜勤不可者に N をロック", GenerateRequest(**data))

    # Case 4: max_night が低すぎ
    data = deepcopy(get_sample_data())
    for s in data["staff"]:
        s["max_night"] = 2  # 全員max2回 → 8人 * 2 = 16 < 62
    show("max_night が低すぎ", GenerateRequest(**data))

    # Case 5: ペア require + 夜勤不可
    data = deepcopy(get_sample_data())
    data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s05", "type": "require"}]
    show("ペア require + 夜勤不可", GenerateRequest(**data))

    # Case 6: 希望矛盾（同日に有給+出勤希望）
    data = deepcopy(get_sample_data())
    data["wishes"] = [
        {"staff_id": "s01", "date": "2026-03-05", "type": "有給"},
        {"staff_id": "s01", "date": "2026-03-05", "type": "出勤"},
    ]
    show("有給と出勤希望の矛盾", GenerateRequest(**data))

    # Case 7: N→A 連鎖違反のロック
    data = deepcopy(get_sample_data())
    data["locked_shifts"] = {
        "s01": {
            "2026-03-05": "N",
            "2026-03-06": "D",   # 翌日 D だが N の翌日は A 必須
        }
    }
    show("N→A 連鎖違反のロック", GenerateRequest(**data))

    # Case 8: その日全員固定休
    data = deepcopy(get_sample_data())
    for s in data["staff"]:
        s["fixed_off_weekdays"] = [6]  # 全員日曜固定休
    show("全員日曜固定休（日曜の必要人数を満たせない）", GenerateRequest(**data))


if __name__ == "__main__":
    main()
