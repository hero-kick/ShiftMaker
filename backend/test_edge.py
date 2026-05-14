"""Edge case tests: conflicting constraints, empty inputs, extreme patterns."""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from sample_data import get_sample_data
from models import GenerateRequest, Wish, StaffPair
from solver import solve, check_feasibility
import time


def case(name, fn):
    print(f"\n--- {name} ---")
    t0 = time.time()
    try:
        fn()
        print(f"  PASS ({time.time() - t0:.2f}s)")
    except AssertionError as e:
        print(f"  FAIL: {e}")
    except Exception as e:
        print(f"  ERROR: {type(e).__name__}: {e}")


def t_no_leaders():
    """全員リーダー不可 → H12 が発火しない（resilient）"""
    data = deepcopy(get_sample_data())
    for s in data["staff"]:
        s["can_lead"] = False
    req = GenerateRequest(**data)
    assert not check_feasibility(req), "expected feasible"
    result = solve(req)
    assert result["schedule"], "no schedule"


def t_all_rookie():
    """全員新人 → S10 が発火しない（非新人なしのため）"""
    data = deepcopy(get_sample_data())
    for s in data["staff"]:
        s["is_rookie"] = True
    req = GenerateRequest(**data)
    result = solve(req)
    assert result["schedule"], "no schedule"


def t_fixed_off_conflicts_with_event():
    """固定休曜日 vs イベント必須出勤 → イベント側を優先？無理なら INFEASIBLE"""
    data = deepcopy(get_sample_data())
    # s01 を月曜固定休に
    data["staff"][0]["fixed_off_weekdays"] = [0]
    # 2026-03-02 は月曜。s01 を required に
    for dc in data["day_conditions"]:
        if dc["date"] == "2026-03-02":
            dc["required_staff_ids"] = ["s01"]
            dc["event_flag"] = True
            dc["event_name"] = "テスト会議"
    req = GenerateRequest(**data)
    # 競合: 固定休 vs required → INFEASIBLE か、required が勝つか
    # 現実装では両方ハードなので INFEASIBLE が正しい
    try:
        solve(req)
        # もし解けた場合は required 側が反映されていることを確認
        # （実装では H15 fixed_off が WORK_SHIFT_CODES==0 を設定、H9 required が O==0 / Y==0 を設定
        #  → どちらも矛盾なし: shift は O or Y で、required は O/Y を禁止）
        # → 実際には INFEASIBLE になるはず
        raise AssertionError("expected INFEASIBLE but got solution")
    except ValueError as e:
        msg = str(e)
        assert ("充足不能" in msg or "見つかりません" in msg or "作れませんでした" in msg), f"unexpected error: {e}"


def t_lock_conflict_with_required():
    """ロックと required_staff_ids が矛盾 → INFEASIBLE"""
    data = deepcopy(get_sample_data())
    for dc in data["day_conditions"]:
        if dc["date"] == "2026-03-05":
            dc["required_staff_ids"] = ["s01"]
    data["locked_shifts"] = {"s01": {"2026-03-05": "O"}}  # O は出勤じゃない
    req = GenerateRequest(**data)
    try:
        solve(req)
        raise AssertionError("expected INFEASIBLE")
    except ValueError as e:
        msg = str(e)
        assert ("充足不能" in msg or "作れませんでした" in msg), f"got: {e}"


def t_lock_for_night_unavailable_staff():
    """夜勤不可スタッフに N をロック → INFEASIBLE"""
    data = deepcopy(get_sample_data())
    # s05 は night_available=False
    data["locked_shifts"] = {"s05": {"2026-03-10": "N"}}
    req = GenerateRequest(**data)
    try:
        solve(req)
        raise AssertionError("expected INFEASIBLE")
    except ValueError as e:
        pass


def t_too_many_wishes():
    """過剰な希望休 → ソフト制約なので解は出る、いくつかは無視される"""
    data = deepcopy(get_sample_data())
    # s01 に 20 日の希望休
    wishes = []
    for d in range(1, 21):
        wishes.append({
            "staff_id": "s01",
            "date": f"2026-03-{d:02d}",
            "type": "希望休",
        })
    data["wishes"] = wishes
    req = GenerateRequest(**data)
    result = solve(req)
    # s01 の off + ake は当然 31 日には収まらない
    o_count = sum(1 for d, c in result["schedule"]["s01"].items() if c == "O")
    print(f"    s01 received {o_count} off days out of 20 wishes")


def t_pair_require_with_max_night_mismatch():
    """ペア require だが片方は night_available=False → forbid的に夜勤回避すれば解ける"""
    data = deepcopy(get_sample_data())
    # s01 (夜勤可) と s05 (夜勤不可) を require ペアに
    data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s05", "type": "require"}]
    req = GenerateRequest(**data)
    try:
        result = solve(req)
        # s01 が N の日が無いはず（s05 は N に出来ないため）
        s01 = result["schedule"]["s01"]
        n_count = sum(1 for _, c in s01.items() if c == "N")
        print(f"    s01 nights with require pair to dayonly s05: {n_count}")
    except ValueError as e:
        print(f"    INFEASIBLE: {e}")


def t_empty_wishes_and_events():
    """空入力での基本動作"""
    data = deepcopy(get_sample_data())
    data["wishes"] = []
    req = GenerateRequest(**data)
    result = solve(req)
    assert result["schedule"], "no schedule"
    # 全スタッフが summary を持つ
    for s in data["staff"]:
        assert s["id"] in result["summary"], f"missing {s['id']}"


def t_max_consecutive_nights_3():
    """max_consecutive_nights=3 → 3連続夜勤までは可"""
    data = deepcopy(get_sample_data())
    for s in data["staff"]:
        s["max_consecutive_nights"] = 3
    req = GenerateRequest(**data)
    result = solve(req)
    # 各人の最大連続夜勤を測る
    max_streak_all = 0
    for sid, sched in result["schedule"].items():
        dates = sorted(sched.keys())
        streak = 0
        max_s = 0
        for d in dates:
            if sched[d] == "N":
                streak += 1
                max_s = max(max_s, streak)
            else:
                streak = 0
        max_streak_all = max(max_streak_all, max_s)
    assert max_streak_all <= 3, f"got streak {max_streak_all}"
    print(f"    max night streak across all staff: {max_streak_all}")


def t_pair_forbid_night():
    """ペア forbid（夜勤同日NG）が守られている"""
    data = deepcopy(get_sample_data())
    data["pairs"] = [{"staff_a_id": "s01", "staff_b_id": "s02", "type": "forbid"}]
    req = GenerateRequest(**data)
    result = solve(req)
    for d_str in result["schedule"]["s01"]:
        if result["schedule"]["s01"][d_str] == "N" and result["schedule"]["s02"][d_str] == "N":
            raise AssertionError(f"both s01 and s02 are N on {d_str}")


def t_two_locks_same_day():
    """同一日の複数スタッフロック"""
    data = deepcopy(get_sample_data())
    data["locked_shifts"] = {
        "s01": {"2026-03-05": "D"},
        "s02": {"2026-03-05": "D"},
        "s03": {"2026-03-05": "D"},
    }
    req = GenerateRequest(**data)
    result = solve(req)
    assert result["schedule"]["s01"]["2026-03-05"] == "D"
    assert result["schedule"]["s02"]["2026-03-05"] == "D"
    assert result["schedule"]["s03"]["2026-03-05"] == "D"


def main():
    case("リーダー資格者ゼロ (H12非起動)", t_no_leaders)
    case("全員新人 (S10非起動)", t_all_rookie)
    case("固定休曜日 vs イベント必須出勤 (INFEASIBLE 期待)", t_fixed_off_conflicts_with_event)
    case("ロック vs required (INFEASIBLE 期待)", t_lock_conflict_with_required)
    case("夜勤不可者に N をロック (INFEASIBLE 期待)", t_lock_for_night_unavailable_staff)
    case("過剰な希望休（ソフト制約として動く）", t_too_many_wishes)
    case("ペア require + 夜勤不可スタッフ", t_pair_require_with_max_night_mismatch)
    case("空 wishes/events", t_empty_wishes_and_events)
    case("max_consecutive_nights=3", t_max_consecutive_nights_3)
    case("ペア forbid（夜勤同日NG）", t_pair_forbid_night)
    case("同一日に複数スタッフロック", t_two_locks_same_day)


if __name__ == "__main__":
    main()
