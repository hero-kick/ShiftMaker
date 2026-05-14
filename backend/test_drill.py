"""具体名まで掘り下げる診断のテスト"""
import sys
sys.path.insert(0, ".")
from copy import deepcopy
from sample_data import get_sample_data
from models import GenerateRequest
from solver import solve, check_feasibility


def case(name, build_data):
    print(f"\n=== {name} ===")
    data = build_data()
    req = GenerateRequest(**data)
    pre = check_feasibility(req)
    if pre:
        print("pre-checkで検知（drill不要）:")
        for e in pre[:5]:
            print(f"  - {e}")
        return
    try:
        solve(req)
        print("  解けた（drillテストには使えない）")
    except ValueError as e:
        msg = str(e)
        # 改行ごとに表示
        for line in msg.split("\n"):
            print(f"  {line}")


def c_pair_solver_only():
    """pre-checkを通り抜けるが、solver で INFEASIBLE になるペア
    s06 と s08 が require: 毎日同じシフト → 必要人数を満たすのが困難でも
    pre-check の単純チェックでは通る場合がある"""
    data = deepcopy(get_sample_data())
    # 全員夜勤可能のうち2人を require ペアに
    # これだけだとほぼ毎日解ける。dial up the difficulty:
    # → 多数のペア require を入れて衝突を作る
    data["pairs"] = [
        {"staff_a_id": "s01", "staff_b_id": "s02", "type": "require"},
        {"staff_a_id": "s03", "staff_b_id": "s04", "type": "require"},
        {"staff_a_id": "s01", "staff_b_id": "s03", "type": "forbid"},  # s01-s03 夜勤NG
        # s01==s02 同シフト かつ s03==s04 同シフト かつ s01-s03 夜勤NG
        # → s01がNなら s02もN（OK）、s03は N不可（s04も N不可）
        # → 同日に s01,s02 がN、s03,s04 はNではない
        # 残り s06,s08,s09,s10 で夜勤を回す必要が出てくる
    ]
    return data


def c_yuki_conflict():
    """有給希望がイベント必須出勤と衝突（pre-checkでも検知できるが drill 動作を見たいので
    あえてイベントを使わない構造で作る）"""
    data = deepcopy(get_sample_data())
    # s05は夜勤不可。s05に大量の有給を入れて出勤可能日を削り、
    # かつ s05に required も付けて矛盾を作る (pre-checkで捕捉される)
    # → 代わりに、有給を入れたうえでN→A 連鎖の都合で日勤シフトが破綻するシナリオに
    # 簡単な例: 月の全日に s01 を有給 → s01は全月Y → 必要人数足りないかも
    data["wishes"] = [
        {"staff_id": "s01", "date": f"2026-03-{d:02d}", "type": "有給"}
        for d in range(1, 22)  # 21日分の有給
    ]
    return data


def c_pair_yuki_combined():
    """ユーザー報告のケースを再現:
    ペアと有給の両方が原因と判定される複合シナリオ"""
    data = deepcopy(get_sample_data())
    data["pairs"] = [
        {"staff_a_id": "s01", "staff_b_id": "s02", "type": "require"},
    ]
    # 大量有給
    data["wishes"] = [
        {"staff_id": "s01", "date": f"2026-03-{d:02d}", "type": "有給"}
        for d in [5, 6, 7, 8, 12, 13, 14, 19, 20]
    ]
    return data


def c_locked_conflict():
    """ロック多数で詰む状況（pre-check通り抜けで solver INFEASIBLE）"""
    data = deepcopy(get_sample_data())
    # 全員の3月1日を D にロック → D が10名（必要は2-3）→これだけならOK
    # 1日に夜勤者を0にする → 必要人数2に届かず INFEASIBLE
    data["locked_shifts"] = {
        sid: {"2026-03-01": "D"} for sid in ["s01", "s02", "s03", "s04", "s06", "s08", "s09", "s10"]
    }
    return data


if __name__ == "__main__":
    case("ペア複数 require/forbid 入り組み", c_pair_solver_only)
    case("有給 21日分 (s01)", c_yuki_conflict)
    case("ペア + 有給の複合", c_pair_yuki_combined)
    case("ロック多数（夜勤者0）", c_locked_conflict)
