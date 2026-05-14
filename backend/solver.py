import calendar
from datetime import date as date_cls
from ortools.sat.python import cp_model
from models import GenerateRequest


SHIFT_CODES = ["D", "E", "N", "A", "L", "O", "Y"]
SHIFT_D = "D"   # 日勤
SHIFT_E = "E"   # 早番
SHIFT_N = "N"   # 夜勤入り
SHIFT_A = "A"   # 夜勤明け
SHIFT_L = "L"   # 遅番
SHIFT_O = "O"   # 休日
SHIFT_Y = "Y"   # 有給

WORK_SHIFT_CODES = [SHIFT_D, SHIFT_E, SHIFT_N, SHIFT_A, SHIFT_L]   # O / Y 以外
DAY_WORK_SHIFTS = [SHIFT_D, SHIFT_E, SHIFT_L]                       # 日勤系（連勤カウント）
DAYTIME_SHIFTS = [SHIFT_D, SHIFT_E, SHIFT_L]                        # 日中の通常勤務

DEFAULT_N_PER_DAY = 2
DEFAULT_D_PER_DAY = 3


def _get_required_n(dc, default=DEFAULT_N_PER_DAY):
    if dc is None:
        return default
    return dc.required_per_shift.get("N", default)


def _get_required_d(dc, default=DEFAULT_D_PER_DAY):
    if dc is None:
        return default
    return dc.required_per_shift.get("D", default)


def _get_required(dc, code, default=0):
    if dc is None:
        return default
    return dc.required_per_shift.get(code, default)


def _weekday(year: int, month: int, day: int) -> int:
    """0=月 1=火 ... 5=土 6=日"""
    return date_cls(year, month, day).weekday()


def _is_weekend(year: int, month: int, day: int) -> bool:
    wd = _weekday(year, month, day)
    return wd >= 5  # 5=土, 6=日


WEEKDAY_NAMES_JP = ["月", "火", "水", "木", "金", "土", "日"]


def check_feasibility(request: GenerateRequest) -> list[str]:
    """Return list of infeasibility reasons before running solver."""
    year = request.year
    month = request.month
    num_days = calendar.monthrange(year, month)[1]
    days = list(range(1, num_days + 1))

    if len(request.staff) == 0:
        return ["スタッフが登録されていません"]

    staff_map_local = {s.id: s for s in request.staff}
    night_capable = [s for s in request.staff if s.night_available]
    total_night_capacity = sum(s.max_night for s in night_capable)

    dc_map = {}
    for dc in request.day_conditions:
        try:
            day = int(dc.date.split("-")[2])
            dc_map[day] = dc
        except Exception:
            pass

    # 希望休/有給/出勤の集計
    kyuku_wishes: dict[str, set] = {}    # staff_id -> set of days
    yuki_wishes: dict[str, set] = {}
    shukin_wishes: dict[str, set] = {}
    for w in request.wishes:
        try:
            d = int(w.date.split("-")[2])
        except Exception:
            continue
        if w.type == "希望休":
            kyuku_wishes.setdefault(w.staff_id, set()).add(d)
        elif w.type == "有給":
            yuki_wishes.setdefault(w.staff_id, set()).add(d)
        elif w.type == "出勤":
            shukin_wishes.setdefault(w.staff_id, set()).add(d)

    total_night_required = sum(_get_required_n(dc_map.get(d)) for d in days)
    total_day_required = sum(_get_required_d(dc_map.get(d)) for d in days)

    errors = []

    # ─── 全体的な需給バランス ───
    if total_night_capacity < total_night_required:
        deficit = total_night_required - total_night_capacity
        errors.append(
            f"【夜勤の総量不足】 必要 {total_night_required}回 / 上限合計 {total_night_capacity}回 → {deficit}回足りません。"
            f" 夜勤可能スタッフ（{len(night_capable)}名）の max_night を平均 {-(-deficit // max(len(night_capable), 1))}回ずつ増やすか、夜勤必要人数を減らしてください"
        )

    # 日別必要人数のキャパチェック
    night_shortage_days = []
    day_shortage_days = []
    for d in days:
        dc = dc_map.get(d)
        n_req = _get_required_n(dc)
        if n_req > len(night_capable):
            night_shortage_days.append(d)
        d_req = _get_required_d(dc)
        if d_req > len(request.staff):
            day_shortage_days.append(d)

    if night_shortage_days:
        days_str = (
            f"{len(night_shortage_days)}日間"
            if len(night_shortage_days) > 5
            else "・".join(f"{d}日" for d in night_shortage_days)
        )
        errors.append(
            f"【夜勤可能者の人数不足】 {month}月の {days_str} で夜勤必要人数が夜勤可能スタッフ {len(night_capable)}名を超えています"
        )
    if day_shortage_days:
        days_str = (
            f"{len(day_shortage_days)}日間"
            if len(day_shortage_days) > 5
            else "・".join(f"{d}日" for d in day_shortage_days)
        )
        errors.append(
            f"【総スタッフ数不足】 {month}月の {days_str} で必要人数が総スタッフ {len(request.staff)}名を超えています"
        )

    # ─── 前月引き継ぎ ───
    dc1 = dc_map.get(1)
    if dc1:
        for sid, prev_sc in request.prev_last_shifts.items():
            if prev_sc == "N" and sid in dc1.required_staff_ids:
                name = staff_map_local.get(sid, type("", (), {"name": sid})()).name
                errors.append(
                    f"【前月引き継ぎ vs イベント】 {month}月1日: {name} は前月夜勤明けでA固定のためイベント必須出勤に設定できません"
                )

    # ─── 個別スタッフの容量チェック ───
    for s in request.staff:
        # この月のスタッフ別制約
        fixed_off_days = {
            d for d in days
            if (s.fixed_off_weekdays or []) and date_cls(year, month, d).weekday() in s.fixed_off_weekdays
        }
        kyuku = kyuku_wishes.get(s.id, set())
        yuki = yuki_wishes.get(s.id, set())
        shukin = shukin_wishes.get(s.id, set())

        # 1) 有給 vs 固定休 (Y は出勤扱いではないので両立可だが警告)
        # 2) 有給 vs 出勤希望 → 矛盾
        if yuki & shukin:
            ds = sorted(yuki & shukin)
            errors.append(
                f"【希望矛盾】 {s.name}: {'・'.join(f'{d}日' for d in ds[:3])} に有給希望と出勤希望が両方あります"
            )
        # 3) 希望休 vs 出勤希望 → 矛盾
        if kyuku & shukin:
            ds = sorted(kyuku & shukin)
            errors.append(
                f"【希望矛盾】 {s.name}: {'・'.join(f'{d}日' for d in ds[:3])} に希望休と出勤希望が両方あります"
            )

        # 4) 固定休曜日 vs 出勤希望 → 矛盾
        if fixed_off_days & shukin:
            ds = sorted(fixed_off_days & shukin)
            wd_set = [WEEKDAY_NAMES_JP[i] for i in (s.fixed_off_weekdays or [])]
            errors.append(
                f"【固定休 vs 出勤希望】 {s.name}: 固定休曜日（{'・'.join(wd_set)}）に出勤希望が入っています ({'・'.join(f'{d}日' for d in ds[:3])})"
            )

        # 5) ロックの整合性チェック
        locks_for_staff = (request.locked_shifts or {}).get(s.id, {})
        for date_str, code in locks_for_staff.items():
            try:
                d = int(date_str.split("-")[2])
            except Exception:
                continue
            if not (1 <= d <= num_days):
                continue
            wd = date_cls(year, month, d).weekday()

            # N/A は夜勤可のみ
            if code in ("N", "A") and not s.night_available:
                errors.append(
                    f"【ロック矛盾】 {s.name} {month}月{d}日 のロック「{_shift_label(code)}」: 夜勤不可スタッフは夜勤系不可"
                )
            # 固定休曜日 vs ロックが勤務
            if (s.fixed_off_weekdays or []) and wd in s.fixed_off_weekdays and code in WORK_SHIFT_CODES:
                errors.append(
                    f"【ロック矛盾】 {s.name} {month}月{d}日 のロック「{_shift_label(code)}」: {WEEKDAY_NAMES_JP[wd]}曜は固定休に設定されています"
                )
            # Y ロックは有給希望が必要
            if code == "Y" and d not in yuki:
                errors.append(
                    f"【ロック矛盾】 {s.name} {month}月{d}日 のロック「有給」: その日に有給希望が登録されていません"
                )
            # required_staff_ids との衝突
            dc = dc_map.get(d)
            if dc and s.id in dc.required_staff_ids and code in ("O", "Y"):
                errors.append(
                    f"【ロック vs イベント】 {s.name} {month}月{d}日 のロック「{_shift_label(code)}」: イベント必須出勤の日に休みを固定できません"
                )
            if dc and s.id in dc.forbidden_staff_ids and code != "O":
                errors.append(
                    f"【ロック vs イベント】 {s.name} {month}月{d}日 のロック「{_shift_label(code)}」: イベント出勤禁止の日には休み(O)以外を固定できません"
                )

        # 6) N ロックの月内合計 > max_night
        n_locks = sum(1 for c in locks_for_staff.values() if c == "N")
        if s.night_available and n_locks > s.max_night:
            errors.append(
                f"【ロック vs 夜勤上限】 {s.name}: 夜勤ロックが {n_locks}回ですが max_night は {s.max_night}回です"
            )

        # 7) N→A 連鎖と矛盾するロック
        for date_str, code in locks_for_staff.items():
            try:
                d = int(date_str.split("-")[2])
            except Exception:
                continue
            next_d = d + 1
            next_str = f"{year:04d}-{month:02d}-{next_d:02d}"
            next_locked = locks_for_staff.get(next_str)
            if code == "N" and next_locked is not None and next_locked != "A" and next_d <= num_days:
                errors.append(
                    f"【N→A 連鎖違反】 {s.name}: {month}月{d}日「夜勤」の翌日 {next_d}日 を「{_shift_label(next_locked)}」でロックしていますが、夜勤の翌日は必ず明けです"
                )
            if code == "A" and next_str not in locks_for_staff and date_str:
                # 前日が N でロックされていることを確認
                prev_str = f"{year:04d}-{month:02d}-{d-1:02d}"
                prev_locked = locks_for_staff.get(prev_str)
                if d > 1 and prev_locked is not None and prev_locked != "N":
                    errors.append(
                        f"【N→A 連鎖違反】 {s.name}: {month}月{d}日「明け」をロックしていますが前日 {d-1}日 のロックは「{_shift_label(prev_locked)}」です（明けの前日は必ず夜勤）"
                    )

        # 8) required_staff_ids が固定休曜日と衝突
        for d in days:
            dc = dc_map.get(d)
            if not dc or s.id not in dc.required_staff_ids:
                continue
            wd = date_cls(year, month, d).weekday()
            if (s.fixed_off_weekdays or []) and wd in s.fixed_off_weekdays:
                errors.append(
                    f"【イベント vs 固定休】 {s.name}: {month}月{d}日({WEEKDAY_NAMES_JP[wd]}曜) はイベント必須出勤ですが {WEEKDAY_NAMES_JP[wd]}曜は固定休に設定されています"
                )

        # 9) 個人の休み総量 vs 必要勤務
        # min_off (絶対休まなければならない日) = 固定休 + Y希望 + forbidden_staff
        forbidden_for_s = {
            d for d in days
            if dc_map.get(d) is not None and s.id in dc_map[d].forbidden_staff_ids
        }
        must_off_days = fixed_off_days | yuki | forbidden_for_s
        # 必須出勤日 = required + 出勤希望
        required_for_s = {
            d for d in days
            if dc_map.get(d) is not None and s.id in dc_map[d].required_staff_ids
        }
        must_work_days = required_for_s | shukin
        # 重なりがあれば既に他のエラーで報告済
        max_work_days = num_days - len(must_off_days)
        if len(must_work_days) > max_work_days:
            errors.append(
                f"【個別キャパ超過】 {s.name}: 強制出勤日 {len(must_work_days)}日 > 出勤可能日 {max_work_days}日 (固定休+有給+強制休 = {len(must_off_days)}日)"
            )

        # 10) 希望休が多すぎて法定公休8日を確保できない場合の警告
        # (ハードではないが、最低公休8日 を満たせない可能性を pre-check で示唆)
        # ↑これはソフトなのでエラー化しない

    # ─── ペア制約 ───
    for pair in request.pairs:
        a = staff_map_local.get(pair.staff_a_id)
        b = staff_map_local.get(pair.staff_b_id)
        if not a or not b:
            continue
        if pair.type == "require":
            is_mentor = a.is_rookie != b.is_rookie
            mentor = b if a.is_rookie else a
            rookie = a if a.is_rookie else b

            # 夜勤不可スタッフが片方の場合（指導ペアと同格ペアで意味が違う）
            if not is_mentor:
                # 同格ペア: 両者とも夜勤しない → 夜勤総数チェック
                if a.night_available != b.night_available:
                    lost_max_night = (
                        a.max_night if a.night_available else b.max_night
                    )
                    remaining_cap = total_night_capacity - lost_max_night
                    if remaining_cap < total_night_required:
                        name_no = a.name if not a.night_available else b.name
                        name_yes = b.name if not a.night_available else a.name
                        errors.append(
                            f"【ペア require】 {name_yes} と {name_no} の「同シフト」ペア: 片方が夜勤不可のため {name_yes} の夜勤も奪われ、夜勤総数 {total_night_required}回 を残り {remaining_cap}回 で賄えません"
                        )
            else:
                # 指導ペア: 指導者の状態が新人に伝播
                # 指導者の有給日に新人が出勤希望 → 矛盾
                mentor_yuki_days = yuki_wishes.get(mentor.id, set())
                rookie_shukin_days = shukin_wishes.get(rookie.id, set())
                conflict = mentor_yuki_days & rookie_shukin_days
                if conflict:
                    ds = "・".join(f"{d}日" for d in sorted(conflict)[:3])
                    errors.append(
                        f"【指導ペア矛盾】 {ds}: 指導者「{mentor.name}」の有給日に新人「{rookie.name}」の出勤希望が設定されています"
                    )
                # 指導者の固定休曜日 と 新人の出勤希望の曜日
                if mentor.fixed_off_weekdays:
                    bad = []
                    for d in rookie_shukin_days:
                        wd = date_cls(year, month, d).weekday()
                        if wd in mentor.fixed_off_weekdays:
                            bad.append(d)
                    if bad:
                        ds = "・".join(f"{d}日" for d in bad[:3])
                        wd_names = "・".join(WEEKDAY_NAMES_JP[w] for w in mentor.fixed_off_weekdays)
                        errors.append(
                            f"【指導ペア矛盾】 指導者「{mentor.name}」の固定休曜日({wd_names})に新人「{rookie.name}」の出勤希望があります: {ds}"
                        )
                # 指導者の必須出勤日に新人の有給希望
                rookie_yuki_days = yuki_wishes.get(rookie.id, set())
                mentor_required_days = {
                    int(dc.date.split("-")[2]) for dc in request.day_conditions
                    if mentor.id in dc.required_staff_ids
                }
                conflict2 = mentor_required_days & rookie_yuki_days
                if conflict2:
                    ds = "・".join(f"{d}日" for d in sorted(conflict2)[:3])
                    errors.append(
                        f"【指導ペア矛盾】 {ds}: 指導者「{mentor.name}」がイベント必須出勤の日に新人「{rookie.name}」の有給希望があります"
                    )

    # ─── 日別の固定休衝突（その日に多すぎる人が固定休/forbidden で必要人数取れない）───
    for d in days:
        dc = dc_map.get(d)
        wd = date_cls(year, month, d).weekday()
        if dc:
            # その日の forbidden + fixed_off_weekday に該当 のスタッフ数
            unavailable = set(dc.forbidden_staff_ids)
            for s in request.staff:
                if (s.fixed_off_weekdays or []) and wd in s.fixed_off_weekdays:
                    unavailable.add(s.id)
            available = len(request.staff) - len(unavailable)
            total_req = sum(dc.required_per_shift.values()) if dc.required_per_shift else 5
            if available < total_req:
                errors.append(
                    f"【日別キャパ不足】 {month}月{d}日({WEEKDAY_NAMES_JP[wd]}曜): 必要人数合計 {total_req}名 > 出勤可能 {available}名（固定休+強制休除外後）"
                )

    return errors


def _shift_label(code: str) -> str:
    return {
        "D": "日勤", "E": "早番", "N": "夜勤", "A": "明け",
        "L": "遅番", "O": "休日", "Y": "有給",
    }.get(code, code)


def solve(request: GenerateRequest) -> dict:
    year = request.year
    month = request.month
    num_days = calendar.monthrange(year, month)[1]
    days = list(range(1, num_days + 1))

    staff_list = request.staff
    staff_ids = [s.id for s in staff_list]
    staff_map = {s.id: s for s in staff_list}

    # day -> DayCondition
    day_conditions_map: dict[int, object] = {}
    for dc in request.day_conditions:
        try:
            day = int(dc.date.split("-")[2])
            if 1 <= day <= num_days:
                day_conditions_map[day] = dc
        except Exception:
            pass

    # (staff_id, day) -> wish type
    wish_map: dict[tuple, str] = {}
    for w in request.wishes:
        try:
            day = int(w.date.split("-")[2])
            wish_map[(w.staff_id, day)] = w.type
        except Exception:
            pass

    # locked: (staff_id, day) -> shift_code
    lock_map: dict[tuple, str] = {}
    for sid, by_date in (request.locked_shifts or {}).items():
        if sid not in staff_ids:
            continue
        for ds, code in by_date.items():
            try:
                day = int(ds.split("-")[2])
                if code in SHIFT_CODES and 1 <= day <= num_days:
                    lock_map[(sid, day)] = code
            except Exception:
                pass

    weekend_days = [d for d in days if _is_weekend(year, month, d)]
    num_weekend = len(weekend_days)

    model = cp_model.CpModel()

    # x[staff_id][day][shift_code] = BoolVar
    x: dict[str, dict[int, dict[str, cp_model.IntVar]]] = {}
    for sid in staff_ids:
        x[sid] = {}
        for d in days:
            x[sid][d] = {}
            for sc in SHIFT_CODES:
                x[sid][d][sc] = model.new_bool_var(f"x_{sid}_{d}_{sc}")

    # H0: 前月末 N → 当月1日 A
    for sid in staff_ids:
        prev_shift = request.prev_last_shifts.get(sid)
        if prev_shift == "N":
            model.add(x[sid][1][SHIFT_A] == 1)

    # H1: 各人各日 1 シフト
    for sid in staff_ids:
        for d in days:
            model.add_exactly_one([x[sid][d][sc] for sc in SHIFT_CODES])

    # H2: N の翌日は A
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                model.add(x[sid][d + 1][SHIFT_A] == 1).only_enforce_if(x[sid][d][SHIFT_N])

    # H3: A の翌日は N にしない
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                model.add(x[sid][d + 1][SHIFT_N] == 0).only_enforce_if(x[sid][d][SHIFT_A])

    # H4: A は前日 N と同時のみ
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                model.add(x[sid][d][SHIFT_N] == 1).only_enforce_if(x[sid][d + 1][SHIFT_A])

    # H5: 月の夜勤上限
    for sid in staff_ids:
        s = staff_map[sid]
        model.add(sum(x[sid][d][SHIFT_N] for d in days) <= s.max_night)

    # H6: 夜勤不可スタッフは N/A 禁止
    for sid in staff_ids:
        s = staff_map[sid]
        if not s.night_available:
            for d in days:
                model.add(x[sid][d][SHIFT_N] == 0)
                model.add(x[sid][d][SHIFT_A] == 0)

    # H7: 日別必要人数
    for d in days:
        dc = day_conditions_map.get(d)
        if dc is not None:
            for sc, req_count in dc.required_per_shift.items():
                if sc in SHIFT_CODES and req_count > 0:
                    model.add(sum(x[sid][d][sc] for sid in staff_ids) >= req_count)

    # H8: 有給は希望日のみ、希望日は必ず Y
    yuki_set = {(sid, d) for (sid, d), wtype in wish_map.items() if wtype == "有給"}
    for sid in staff_ids:
        for d in days:
            if (sid, d) not in yuki_set:
                model.add(x[sid][d][SHIFT_Y] == 0)
            else:
                model.add(x[sid][d][SHIFT_Y] == 1)

    # H9: イベントの required_staff_ids → 必ず出勤（O/Y 禁止）
    for d in days:
        dc = day_conditions_map.get(d)
        if dc is not None:
            for sid in dc.required_staff_ids:
                if sid in staff_ids:
                    model.add(x[sid][d][SHIFT_O] == 0)
                    model.add(x[sid][d][SHIFT_Y] == 0)

    # H9b: 「出勤」希望 → 必ず出勤
    for (sid, d), wtype in wish_map.items():
        if wtype == "出勤" and sid in staff_ids:
            model.add(x[sid][d][SHIFT_O] == 0)
            model.add(x[sid][d][SHIFT_Y] == 0)

    # H10: イベントの forbidden_staff_ids → 必ず O
    for d in days:
        dc = day_conditions_map.get(d)
        if dc is not None:
            for sid in dc.forbidden_staff_ids:
                if sid in staff_ids:
                    model.add(x[sid][d][SHIFT_O] == 1)

    # H11: ペア制約
    # forbid = 夜勤同日NG
    # require =
    #   ① 指導ペア（is_rookie が片方だけ True） → 指導者の状態が新人に一方向伝播。
    #      指導者が有給/固定休/絶対休み → 新人も休み(O)
    #      指導者が必須出勤・通常勤務 → 新人も同じシフト
    #   ② 同格ペア（両者の rookie フラグが同じ） → 双方向で同シフト、片方だけ強制的な日は除外
    for pair in request.pairs:
        a_id = pair.staff_a_id
        b_id = pair.staff_b_id
        if a_id not in staff_ids or b_id not in staff_ids:
            continue
        a_obj = staff_map[a_id]
        b_obj = staff_map[b_id]
        a_off_wd = set(a_obj.fixed_off_weekdays or [])
        b_off_wd = set(b_obj.fixed_off_weekdays or [])

        if pair.type == "forbid":
            for d in days:
                model.add(x[a_id][d][SHIFT_N] + x[b_id][d][SHIFT_N] <= 1)
            continue

        # require
        is_mentor_pair = a_obj.is_rookie != b_obj.is_rookie
        if is_mentor_pair:
            # 指導者 / 新人 を特定
            if a_obj.is_rookie:
                rookie_id, mentor_id = a_id, b_id
                mentor_off_wd = b_off_wd
            else:
                rookie_id, mentor_id = b_id, a_id
                mentor_off_wd = a_off_wd

            for d in days:
                wd = date_cls(year, month, d).weekday()
                dc = day_conditions_map.get(d)
                mentor_yuki = wish_map.get((mentor_id, d)) == "有給"
                mentor_fixed_off = wd in mentor_off_wd
                mentor_forbidden = bool(dc and mentor_id in dc.forbidden_staff_ids)
                rookie_yuki = wish_map.get((rookie_id, d)) == "有給"

                if mentor_yuki or mentor_fixed_off or mentor_forbidden:
                    # 指導者が不在の日 → 新人も休み（Y希望があればYに、そうでなければO）
                    if rookie_yuki:
                        # H8 で Y 強制済みなので追加制約不要
                        pass
                    else:
                        # 新人は O 確定（指導者なしで働かせない）
                        model.add(x[rookie_id][d][SHIFT_O] == 1)
                    continue

                if rookie_yuki:
                    # 新人だけ有給 → 指導者は自由
                    continue

                # それ以外は同シフトに揃える（指導同行）
                for sc in SHIFT_CODES:
                    model.add(x[mentor_id][d][sc] == x[rookie_id][d][sc])
        else:
            # 同格ペア: 双方向、個別事情の日は除外
            for d in days:
                wd = date_cls(year, month, d).weekday()
                dc = day_conditions_map.get(d)
                a_is_yuki = wish_map.get((a_id, d)) == "有給"
                b_is_yuki = wish_map.get((b_id, d)) == "有給"
                a_fixed = wd in a_off_wd
                b_fixed = wd in b_off_wd
                a_required = bool(dc and a_id in dc.required_staff_ids)
                b_required = bool(dc and b_id in dc.required_staff_ids)
                a_forbidden = bool(dc and a_id in dc.forbidden_staff_ids)
                b_forbidden = bool(dc and b_id in dc.forbidden_staff_ids)
                if (a_is_yuki != b_is_yuki) or (a_fixed != b_fixed) or \
                   (a_required != b_required) or (a_forbidden != b_forbidden):
                    continue
                for sc in SHIFT_CODES:
                    model.add(x[a_id][d][sc] == x[b_id][d][sc])

    # H12: リーダー必須（資格者が居る場合のみ強制）
    leader_ids = [sid for sid in staff_ids if staff_map[sid].can_lead]
    if leader_ids:
        for d in days:
            leader_working = sum(
                x[lid][d][sc] for lid in leader_ids for sc in WORK_SHIFT_CODES
            )
            model.add(leader_working >= 1)

    # H13: 連続夜勤上限（多くても max_consecutive_nights 回まで）
    for sid in staff_ids:
        s = staff_map[sid]
        max_cn = max(1, s.max_consecutive_nights)
        # 連続 max_cn+1 日の窓に N は最大 max_cn 回まで
        for d in days:
            window_end = d + max_cn
            if window_end <= num_days:
                window = list(range(d, window_end + 1))
                model.add(sum(x[sid][dd][SHIFT_N] for dd in window) <= max_cn)

    # H14: 固定シフト（ロック）
    for (sid, d), code in lock_map.items():
        model.add(x[sid][d][code] == 1)

    # H15: 固定休曜日（曜日リストの曜日は必ず O か Y）
    for sid in staff_ids:
        s = staff_map[sid]
        if not s.fixed_off_weekdays:
            continue
        for d in days:
            if _weekday(year, month, d) in s.fixed_off_weekdays:
                # その曜日は出勤シフト全部禁止（O or Y のみ許可）
                for sc in WORK_SHIFT_CODES:
                    model.add(x[sid][d][sc] == 0)

    # ─── ソフト制約（ペナルティ最小化）───
    penalty_terms = []

    # S1: 希望休 → O が望ましい
    for (sid, d), wtype in wish_map.items():
        if wtype == "希望休" and sid in staff_ids:
            not_off = model.new_bool_var(f"not_off_{sid}_{d}")
            model.add(x[sid][d][SHIFT_O] == 0).only_enforce_if(not_off)
            model.add(x[sid][d][SHIFT_O] == 1).only_enforce_if(not_off.negated())
            penalty_terms.append(not_off * 150)

    # S1b: 前月末 A → 当月1日は O 推奨
    for sid in staff_ids:
        prev_shift = request.prev_last_shifts.get(sid)
        if prev_shift == "A":
            not_off_d1 = model.new_bool_var(f"not_off_d1_{sid}")
            model.add(x[sid][1][SHIFT_O] == 0).only_enforce_if(not_off_d1)
            model.add(x[sid][1][SHIFT_O] == 1).only_enforce_if(not_off_d1.negated())
            penalty_terms.append(not_off_d1 * 20)

    # S2: A の翌日は O が望ましい（線形化）
    # A[d] == 1 かつ O[d+1] == 0 が望ましくない
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                ake_not_off = model.new_bool_var(f"ake_not_off_{sid}_{d}")
                # ake_not_off >= A[d] + (1 - O[d+1]) - 1 = A[d] - O[d+1]
                model.add(ake_not_off >= x[sid][d][SHIFT_A] - x[sid][d + 1][SHIFT_O])
                penalty_terms.append(ake_not_off * 25)

    # S3: 長すぎる連勤を抑制
    work_shifts = [SHIFT_D, SHIFT_E, SHIFT_L, SHIFT_N]
    for sid in staff_ids:
        s = staff_map[sid]
        max_consec = s.max_consecutive_days
        for d in days:
            window_end = d + max_consec
            if window_end <= num_days:
                window_days = list(range(d, window_end + 1))
                consec_work = sum(x[sid][dd][sc] for dd in window_days for sc in work_shifts)
                over_limit = model.new_bool_var(f"over_{sid}_{d}")
                model.add(consec_work >= max_consec + 1).only_enforce_if(over_limit)
                model.add(consec_work <= max_consec).only_enforce_if(over_limit.negated())
                penalty_terms.append(over_limit * 200)

    # S3b: 月またぎ連勤の抑制
    # 前月末に prev_streak 連勤していたスタッフは、月初に長く働かせると
    # 月をまたいで 8〜10 連勤になりうる。先頭日数の連勤を抑える。
    for sid in staff_ids:
        s = staff_map[sid]
        prev_streak = request.prev_consecutive_work.get(sid, 0)
        if prev_streak <= 0:
            continue
        max_consec = s.max_consecutive_days
        # 前月末 prev_streak 連勤 → 今月頭は (max_consec - prev_streak) 日まで連続勤務可
        allowed = max(0, max_consec - prev_streak)
        window_len = allowed + 1  # この日数が全部勤務だと連勤オーバー
        if window_len <= num_days:
            window = list(range(1, window_len + 1))
            consec = sum(x[sid][dd][sc] for dd in window for sc in work_shifts)
            over = model.new_bool_var(f"prev_streak_over_{sid}")
            # consec が allowed を超えたら over を 1 に強制
            model.add(over >= consec - allowed)
            penalty_terms.append(over * 200)

    # S4: 夜勤回数を均等化
    # 月の総夜勤数を「夜勤可能スタッフ数」で割って 1人あたりの目標を作る
    night_capable_ids = [sid for sid in staff_ids if staff_map[sid].night_available]
    if night_capable_ids:
        total_required_nights = sum(_get_required_n(day_conditions_map.get(d)) for d in days)
        n_night_staff = len(night_capable_ids)
        target_floor = total_required_nights // max(n_night_staff, 1)
        target_ceil = (total_required_nights + n_night_staff - 1) // max(n_night_staff, 1)
        # ハードキャップ: 上限 = ceil + 1（max_night 以下）
        # 下限は強いソフトペナルティで対応（無理に詰めて INFEASIBLE にしない）
        for sid in night_capable_ids:
            s = staff_map[sid]
            nc = sum(x[sid][d][SHIFT_N] for d in days)
            hard_cap = min(s.max_night, target_ceil + 1)
            model.add(nc <= hard_cap)

            # ソフト: target_floor からの上下偏差を罰する
            dev_pos = model.new_int_var(0, num_days, f"dev_pos_{sid}")
            dev_neg = model.new_int_var(0, num_days, f"dev_neg_{sid}")
            model.add(nc - target_floor == dev_pos - dev_neg)
            penalty_terms.append(dev_pos * 60)
            penalty_terms.append(dev_neg * 120)  # 不足側を強く罰する

            # 追加: target_ceil を超える分（= floor+2 以上）は特に強く罰する
            # → 理想は全員 floor か ceil（差 1）に収める
            over_ceil = model.new_int_var(0, num_days, f"over_ceil_{sid}")
            model.add(over_ceil >= nc - target_ceil)
            model.add(over_ceil >= 0)
            penalty_terms.append(over_ceil * 250)

    # S4b: 7日窓内の夜勤集中を避ける（時間的にまんべんなく散らす）
    # 月に 7-9 夜勤の人は、平均すると週 1.6-2 回。7日窓に 3回以上はペナルティ。
    if night_capable_ids:
        for sid in night_capable_ids:
            for d in days:
                if d + 6 <= num_days:
                    window = list(range(d, d + 7))
                    nights_in_window = sum(x[sid][dd][SHIFT_N] for dd in window)
                    over = model.new_int_var(0, 7, f"n_over7_{sid}_{d}")
                    model.add(over >= nights_in_window - 2)
                    model.add(over >= 0)
                    penalty_terms.append(over * 80)

    # S4c: 14日窓内の夜勤集中を避ける（更にまんべんなく散らす）
    # 月 8 夜勤なら 14日に約 3-4 回が理想。5回以上はペナルティ。
    if night_capable_ids:
        for sid in night_capable_ids:
            for d in days:
                if d + 13 <= num_days:
                    window = list(range(d, d + 14))
                    nights_in_window = sum(x[sid][dd][SHIFT_N] for dd in window)
                    over14 = model.new_int_var(0, 14, f"n_over14_{sid}_{d}")
                    # 14 日に 4 回までは OK、それ超でペナルティ
                    model.add(over14 >= nights_in_window - 4)
                    model.add(over14 >= 0)
                    penalty_terms.append(over14 * 60)

    # S5: （削除）S3 と冗長だったので削除。max_consecutive_days で十分制御される

    # S6: 公休数 O を全スタッフで均等化
    # 各スタッフの「強制的に決まる O」分を差し引いた可変分でターゲット計算する
    total_d_req = sum(_get_required_d(day_conditions_map.get(d)) for d in days)
    total_n_req = sum(_get_required_n(day_conditions_map.get(d)) for d in days)
    total_e_req = sum(_get_required(day_conditions_map.get(d), "E", 0) for d in days)
    total_l_req = sum(_get_required(day_conditions_map.get(d), "L", 0) for d in days)
    total_work_slots = total_d_req + total_e_req + total_l_req + total_n_req + total_n_req  # +A
    total_y = sum(1 for (sid, _), wt in wish_map.items() if wt == "有給" and sid in staff_ids)

    if len(staff_ids) > 0:
        # 各スタッフの「必ず O になる日数」（fixed_off_weekdays / forbidden_staff_ids）
        # Y は別途 H8 でカウントしているので含めない（O とは別）
        forced_off_count_by = {}
        for sid in staff_ids:
            s_obj = staff_map[sid]
            forced_off = sum(
                1 for d in days
                if day_conditions_map.get(d) is not None
                and sid in day_conditions_map[d].forbidden_staff_ids
            )
            fixed_off_days = 0
            if s_obj.fixed_off_weekdays:
                fixed_off_days = sum(
                    1 for d in days
                    if _weekday(year, month, d) in s_obj.fixed_off_weekdays
                )
            # 固定休曜日に有給希望があった日は Y になるので O 集計には入らない
            yuki_on_fixed = 0
            if s_obj.fixed_off_weekdays:
                yuki_on_fixed = sum(
                    1 for (s, d), wt in wish_map.items()
                    if s == sid and wt == "有給"
                    and _weekday(year, month, d) in s_obj.fixed_off_weekdays
                )
            forced_off_count_by[sid] = forced_off + fixed_off_days - yuki_on_fixed

        total_off_slots = max(0, len(staff_ids) * num_days - total_work_slots - total_y)
        target_o = total_off_slots // len(staff_ids)

        # 個別ターゲット = 全体目標と「強制的に O になる量」の大きい方
        # （固定休が多いスタッフが target_o を超えていても、追加ペナルティは課さない）
        for sid in staff_ids:
            forced = forced_off_count_by[sid]
            per_target = max(target_o, forced)
            # ハードキャップ: 個別目標 +1（厳しめ）
            max_o_allowed = per_target + 1
            o_count = sum(x[sid][d][SHIFT_O] for d in days)
            model.add(o_count <= max_o_allowed)

            dev_pos = model.new_int_var(0, num_days, f"o_dev_pos_{sid}")
            dev_neg = model.new_int_var(0, num_days, f"o_dev_neg_{sid}")
            model.add(o_count - per_target == dev_pos - dev_neg)
            penalty_terms.append(dev_neg * 100)
            penalty_terms.append(dev_pos * 100)

    # S7: 最低月公休数の保証（30日以上は 8、29日以下は 7）
    min_off_target = 8 if num_days >= 30 else 7
    for sid in staff_ids:
        o_count = sum(x[sid][d][SHIFT_O] for d in days)
        under_min = model.new_int_var(0, num_days, f"o_under_{sid}")
        model.add(min_off_target - o_count <= under_min)
        model.add(under_min >= 0)
        penalty_terms.append(under_min * 100)

    # S8: 土日休みの公平性（固定休曜日に土日を含むスタッフは除外して均等化）
    if num_weekend > 0 and len(staff_ids) > 0:
        # 固定休に土日を持つスタッフは S8 対象外（彼らは必然的に高い土日休数）
        we_balance_ids = []
        for sid in staff_ids:
            s = staff_map[sid]
            if s.fixed_off_weekdays and (5 in s.fixed_off_weekdays or 6 in s.fixed_off_weekdays):
                continue
            we_balance_ids.append(sid)

        if we_balance_ids:
            # 必要勤務枠（土日分）
            weekend_work_slots = sum(
                _get_required_d(day_conditions_map.get(d)) +
                _get_required_n(day_conditions_map.get(d)) +
                _get_required(day_conditions_map.get(d), "E", 0) +
                _get_required(day_conditions_map.get(d), "L", 0) +
                _get_required_n(day_conditions_map.get(d))  # +A
                for d in weekend_days
            )
            # 固定休スタッフは weekend 全部 O なので、彼らの分を勤務枠から引かない
            # 残りスタッフで weekend 出勤を分担
            total_we_slots = num_weekend * len(we_balance_ids)
            avg_we_off = max(0, total_we_slots - weekend_work_slots) // max(len(we_balance_ids), 1)
            weekend_target = max(1, min(avg_we_off, num_weekend - 1))

            for sid in we_balance_ids:
                s = staff_map[sid]
                target = s.weekend_off_target if s.weekend_off_target is not None else weekend_target
                we_off = sum(x[sid][d][SHIFT_O] + x[sid][d][SHIFT_Y] for d in weekend_days)
                dev_pos = model.new_int_var(0, num_weekend + 1, f"we_dev_pos_{sid}")
                dev_neg = model.new_int_var(0, num_weekend + 1, f"we_dev_neg_{sid}")
                model.add(we_off - target == dev_pos - dev_neg)
                # 双方向にしっかり罰する（働きすぎも、休みすぎも）
                penalty_terms.append(dev_neg * 80)
                penalty_terms.append(dev_pos * 40)

    # S9: 月に最低1回の「2連休（連続O）」が望ましい
    # 軽量実装: 各 (d, d+1) で v = O[d] AND O[d+1] を作り、staff ごとに合計が 0 ならペナルティ
    # has_two_off に reify するが、整数和との比較なので 1 つだけ。
    for sid in staff_ids:
        two_off_vars = []
        for d in days:
            if d + 1 in days:
                v = model.new_bool_var(f"two_off_{sid}_{d}")
                # v -> O[d] かつ O[d+1]
                model.add(v <= x[sid][d][SHIFT_O])
                model.add(v <= x[sid][d + 1][SHIFT_O])
                # 逆向きは不要（only_enforce_if の重さ回避）
                two_off_vars.append(v)
        if two_off_vars:
            # 合計を IntVar に集約し、0 のとき has_two_off=0 になるよう片側だけ縛る
            total_two_off = model.new_int_var(0, len(two_off_vars), f"total_two_off_{sid}")
            model.add(total_two_off == sum(two_off_vars))
            # 「総数が小さいほどペナルティ」を線形で代用（dev_neg 1個 = 軽量）
            target_two = 1
            shortage = model.new_int_var(0, target_two, f"two_off_short_{sid}")
            model.add(shortage >= target_two - total_two_off)
            penalty_terms.append(shortage * 60)

    # S10: 新人だけの日中シフトを避ける（新人 ≥ 1 のときのみ）
    # 「新人が日中に居る かつ 非新人が日中に1人も居ない」日を罰する。
    # ポイント: danger を 0 のまま逃げられないよう、危険状況なら danger=1 に強制する向きで定式化。
    rookie_ids = [sid for sid in staff_ids if staff_map[sid].is_rookie]
    non_rookie_ids = [sid for sid in staff_ids if not staff_map[sid].is_rookie]
    if rookie_ids and non_rookie_ids:
        max_rookie_day = len(rookie_ids) * len(DAYTIME_SHIFTS)
        max_senior_day = len(non_rookie_ids) * len(DAYTIME_SHIFTS)
        for d in days:
            rookie_day = sum(x[rid][d][sc] for rid in rookie_ids for sc in DAYTIME_SHIFTS)
            non_rookie_day = sum(x[nid][d][sc] for nid in non_rookie_ids for sc in DAYTIME_SHIFTS)

            # rookie_present: 新人が日中に1人以上 → 1（rookie_day>=1 のとき強制的に 1）
            rookie_present = model.new_bool_var(f"rookie_present_{d}")
            model.add(rookie_day <= max_rookie_day * rookie_present)  # rookie_day>=1 → present=1
            model.add(rookie_day >= rookie_present)                  # present=1 → rookie_day>=1

            # no_senior: 非新人が日中に0人 → 1（non_rookie_day==0 のとき強制的に 1）
            no_senior = model.new_bool_var(f"no_senior_{d}")
            model.add(non_rookie_day >= 1 - no_senior)               # no_senior=0 → non_rookie_day>=1
            model.add(non_rookie_day <= max_senior_day * (1 - no_senior))  # no_senior=1 → non_rookie_day==0

            # danger = rookie_present AND no_senior（両方1なら danger>=1 に強制）
            danger = model.new_bool_var(f"rookie_only_{d}")
            model.add(danger >= rookie_present + no_senior - 1)
            penalty_terms.append(danger * 250)

    # S11a: 遅番→翌日早番 (L→E) を避ける（同一スタッフ）
    # シンプル線形化
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                # L[d]==1 かつ E[d+1]==1 が違反
                # bool var で表現、線形：l_then_e >= L[d] + E[d+1] - 1
                l_then_e = model.new_bool_var(f"l_then_e_{sid}_{d}")
                model.add(l_then_e >= x[sid][d][SHIFT_L] + x[sid][d + 1][SHIFT_E] - 1)
                penalty_terms.append(l_then_e * 150)

    # S11b: 連続夜勤2回を超えるパターン
    # max_consecutive_nights=1 のスタッフに対し N-N の出現を強く減点
    for sid in staff_ids:
        s = staff_map[sid]
        if s.max_consecutive_nights >= 2:
            continue
        for d in days:
            if d + 1 in days:
                nn = model.new_bool_var(f"nn_{sid}_{d}")
                model.add(nn >= x[sid][d][SHIFT_N] + x[sid][d + 1][SHIFT_N] - 1)
                penalty_terms.append(nn * 300)

    # 目的関数
    if penalty_terms:
        model.minimize(sum(penalty_terms))

    solver = cp_model.CpSolver()
    # 25 秒で打ち切り → FEASIBLE でも返す（許容できる解を素早く返す）
    # 並列度を上げて短時間で良い解を探す
    solver.parameters.max_time_in_seconds = 25
    solver.parameters.num_search_workers = 8
    # 相対 gap 1% で OK とみなして早期終了
    solver.parameters.relative_gap_limit = 0.01

    status = solver.solve(model)

    schedule: dict[str, dict[str, str]] = {}
    summary: dict[str, dict] = {}

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for sid in staff_ids:
            schedule[sid] = {}
            counts = {sc: 0 for sc in SHIFT_CODES}
            weekend_off = 0
            two_off_streaks = 0

            for d in days:
                date_str = f"{year:04d}-{month:02d}-{d:02d}"
                assigned = SHIFT_O
                for sc in SHIFT_CODES:
                    if solver.value(x[sid][d][sc]) == 1:
                        assigned = sc
                        break
                schedule[sid][date_str] = assigned
                counts[assigned] += 1
                if _is_weekend(year, month, d) and assigned in (SHIFT_O, SHIFT_Y):
                    weekend_off += 1

            # 2連休のカウント（重ならないように）
            prev_o = False
            for d in days:
                date_str = f"{year:04d}-{month:02d}-{d:02d}"
                is_o = schedule[sid][date_str] == SHIFT_O
                if is_o and prev_o:
                    two_off_streaks += 1
                    prev_o = False
                else:
                    prev_o = is_o

            summary[sid] = {
                "name": staff_map[sid].name,
                "night_count": counts[SHIFT_N],
                "off_count": counts[SHIFT_O],
                "paid_leave_count": counts[SHIFT_Y],
                "work_count": counts[SHIFT_D] + counts[SHIFT_E] + counts[SHIFT_L] + counts[SHIFT_A],
                "day_count": counts[SHIFT_D],
                "early_count": counts[SHIFT_E],
                "late_count": counts[SHIFT_L],
                "ake_count": counts[SHIFT_A],
                "weekend_off": weekend_off,
                "two_off_blocks": two_off_streaks,
                "total_days": num_days,
            }

    elif status == cp_model.INFEASIBLE:
        # 診断モード: 制約を段階的に外して原因の候補を特定
        causes = _diagnose_infeasibility(request)
        if causes:
            msg = "シフトが作れませんでした。次のいずれかが原因と考えられます:\n" + "\n".join(f"・{c}" for c in causes)
        else:
            msg = (
                "制約を満たすシフトが見つかりませんでした。\n"
                "・希望休が特定の日に集中していないか\n"
                "・固定シフト/固定休曜日が他の条件と矛盾していないか\n"
                "・夜勤上限が低すぎないか\n"
                "を見直してください"
            )
        raise ValueError(msg)
    elif status == cp_model.UNKNOWN:
        raise ValueError(
            f"制限時間（{int(solver.parameters.max_time_in_seconds)}秒）内に解が見つかりませんでした。"
            "スタッフ数を減らすか、制約を緩和してください。"
        )
    else:
        raise ValueError(
            f"ソルバーエラーが発生しました（状態: {solver.status_name(status)}）。"
        )

    return {"schedule": schedule, "summary": summary}


# ============================================================
# INFEASIBLE 時の自動診断
# ============================================================

def _diagnose_infeasibility(request: GenerateRequest) -> list[str]:
    """
    INFEASIBLE になったときに、どの制約が原因かを試行錯誤で特定する。
    まずカテゴリを絞り込み、次に具体的なアイテムまで掘り下げる。
    """
    from copy import deepcopy

    causes: list[str] = []

    # カテゴリ毎の: (key, generic_message, drill_down_fn)
    tests = [
        ("locks", "固定シフト（ロック）が他の制約と衝突しています", _drill_locks),
        ("fixed_off", "スタッフの固定休曜日が必要人数・イベントと衝突しています", _drill_fixed_off),
        ("pairs", "出勤ペア制約が衝突しています", _drill_pairs),
        ("wishes_yuki", "有給希望が他の制約と衝突しています", _drill_yuki),
        ("wishes_shukin", "出勤希望が他の制約と衝突しています", _drill_shukin),
        ("required", "イベントの「必ず出勤」設定が衝突しています", _drill_required),
        ("forbidden", "イベントの「絶対休み」設定が衝突しています", _drill_forbidden),
        ("max_consec_night", "連続夜勤上限が低すぎて夜勤総数を捌けません", None),
        ("max_night", "スタッフの max_night（夜勤上限）が低すぎます", _drill_max_night),
        ("prev_carryover", "前月引き継ぎ（前月末夜勤→A強制）が衝突しています", _drill_prev),
    ]

    for key, message, drill in tests:
        relaxed = deepcopy(request)
        _relax(relaxed, key)
        if _can_solve_quickly(relaxed):
            # カテゴリ確定 → 具体的なアイテムまで掘り下げ
            specific = drill(request) if drill else []
            if specific:
                causes.extend(specific)
            else:
                causes.append(message)
            if len(causes) >= 4:
                break

    if not causes:
        relaxed = deepcopy(request)
        for key, _, _ in tests:
            _relax(relaxed, key)
        if _can_solve_quickly(relaxed, time_limit=3.0):
            causes.append(
                "複数の制約が複合的に衝突しています。"
                "まず固定シフト/固定休曜日/ペア設定をすべて外して再生成 → 1つずつ戻してください"
            )
        else:
            causes.append(
                "夜勤必要人数または日勤必要人数がスタッフ数を上回っている可能性があります。"
                "「人数」タブで日別必要人数を見直してください"
            )

    return causes[:4]


def _staff_name(request: GenerateRequest, sid: str) -> str:
    for s in request.staff:
        if s.id == sid:
            return s.name
    return sid


def _drill_pairs(request: GenerateRequest) -> list[str]:
    """どのペアが問題かを特定"""
    from copy import deepcopy
    found = []
    for i, pair in enumerate(request.pairs):
        if i >= 8:
            break
        test = deepcopy(request)
        test.pairs = [p for j, p in enumerate(request.pairs) if j != i]
        if _can_solve_quickly(test, time_limit=1.2):
            a = _staff_name(request, pair.staff_a_id)
            b = _staff_name(request, pair.staff_b_id)
            kind = "夜勤NG" if pair.type == "forbid" else "同シフトマスト"
            found.append(f"ペア「{a} × {b}」({kind}) が原因。スタッフ管理タブで該当ペアを削除すると解けます")
            if len(found) >= 2:
                break
    return found


def _drill_yuki(request: GenerateRequest) -> list[str]:
    """どの有給希望が問題か"""
    from copy import deepcopy
    from collections import defaultdict

    by_staff = defaultdict(list)
    for w in request.wishes:
        if w.type == "有給":
            by_staff[w.staff_id].append(w)

    found = []
    # 1) スタッフ単位で外せるか
    for sid, ws in by_staff.items():
        if len(found) >= 2:
            break
        test = deepcopy(request)
        test.wishes = [w for w in request.wishes if not (w.type == "有給" and w.staff_id == sid)]
        if _can_solve_quickly(test, time_limit=1.2):
            name = _staff_name(request, sid)
            dates = sorted(int(w.date.split("-")[2]) for w in ws)
            ds = "・".join(f"{d}日" for d in dates[:5])
            tail = "..." if len(dates) > 5 else ""
            # スタッフの個別1件まで絞れるか試す
            for w in ws:
                test2 = deepcopy(request)
                test2.wishes = [ww for ww in request.wishes if ww != w]
                if _can_solve_quickly(test2, time_limit=1.0):
                    d = int(w.date.split("-")[2])
                    found.append(f"有給希望「{name} の {d}日」が原因。希望入力タブで該当の有給を外すと解けます")
                    break
            else:
                found.append(f"有給希望「{name}」の {ds}{tail} のうちどれかが原因。希望入力タブで見直してください")
    return found


def _drill_shukin(request: GenerateRequest) -> list[str]:
    """どの出勤希望が問題か"""
    from copy import deepcopy
    from collections import defaultdict

    by_staff = defaultdict(list)
    for w in request.wishes:
        if w.type == "出勤":
            by_staff[w.staff_id].append(w)

    found = []
    for sid, ws in by_staff.items():
        if len(found) >= 2:
            break
        for w in ws:
            test = deepcopy(request)
            test.wishes = [ww for ww in request.wishes if ww != w]
            if _can_solve_quickly(test, time_limit=1.0):
                name = _staff_name(request, sid)
                d = int(w.date.split("-")[2])
                found.append(f"出勤希望「{name} の {d}日」が原因。希望入力タブで該当の出勤指定を外すと解けます")
                break
    return found


def _drill_required(request: GenerateRequest) -> list[str]:
    """どのイベント必須出勤が問題か"""
    from copy import deepcopy

    all_required = []
    for dc in request.day_conditions:
        for sid in dc.required_staff_ids:
            all_required.append((dc.date, sid))

    found = []
    for date_str, sid in all_required:
        if len(found) >= 2:
            break
        test = deepcopy(request)
        for dc in test.day_conditions:
            if dc.date == date_str:
                dc.required_staff_ids = [s for s in dc.required_staff_ids if s != sid]
        if _can_solve_quickly(test, time_limit=1.0):
            name = _staff_name(request, sid)
            d = int(date_str.split("-")[2])
            found.append(f"イベント必須出勤「{name} の {d}日」が原因。イベントタブで該当を外すと解けます")
    return found


def _drill_forbidden(request: GenerateRequest) -> list[str]:
    """どのイベント絶対休みが問題か"""
    from copy import deepcopy

    all_forbidden = []
    for dc in request.day_conditions:
        for sid in dc.forbidden_staff_ids:
            all_forbidden.append((dc.date, sid))

    found = []
    for date_str, sid in all_forbidden:
        if len(found) >= 2:
            break
        test = deepcopy(request)
        for dc in test.day_conditions:
            if dc.date == date_str:
                dc.forbidden_staff_ids = [s for s in dc.forbidden_staff_ids if s != sid]
        if _can_solve_quickly(test, time_limit=1.0):
            name = _staff_name(request, sid)
            d = int(date_str.split("-")[2])
            found.append(f"イベント絶対休み「{name} の {d}日」が原因。イベントタブで該当を外すと解けます")
    return found


def _drill_locks(request: GenerateRequest) -> list[str]:
    """どのロックが問題か"""
    from copy import deepcopy

    all_locks = []
    for sid, by_date in (request.locked_shifts or {}).items():
        for date_str, code in by_date.items():
            all_locks.append((sid, date_str, code))

    found = []
    for sid, date_str, code in all_locks:
        if len(found) >= 2:
            break
        test = deepcopy(request)
        new_locks = {}
        for s2, m in (test.locked_shifts or {}).items():
            new_locks[s2] = {d: c for d, c in m.items() if not (s2 == sid and d == date_str)}
        test.locked_shifts = new_locks
        if _can_solve_quickly(test, time_limit=1.0):
            name = _staff_name(request, sid)
            try:
                d = int(date_str.split("-")[2])
            except Exception:
                d = date_str
            found.append(f"ロック「{name} の {d}日 = {_shift_label(code)}」が原因。シフト表でロックを解除すると解けます")
    return found


def _drill_fixed_off(request: GenerateRequest) -> list[str]:
    """どのスタッフの固定休曜日が問題か"""
    from copy import deepcopy

    found = []
    for s in request.staff:
        if not s.fixed_off_weekdays:
            continue
        if len(found) >= 2:
            break
        test = deepcopy(request)
        for ts in test.staff:
            if ts.id == s.id:
                ts.fixed_off_weekdays = []
                break
        if _can_solve_quickly(test, time_limit=1.0):
            wd_names = "・".join(WEEKDAY_NAMES_JP[w] for w in s.fixed_off_weekdays)
            found.append(f"スタッフ「{s.name}」の固定休曜日（{wd_names}）が原因。スタッフ管理タブで見直すと解けます")
    return found


def _drill_max_night(request: GenerateRequest) -> list[str]:
    """どのスタッフの max_night が低すぎるか"""
    from copy import deepcopy

    found = []
    # max_night が小さい順に試す（影響度が高そうな順）
    sorted_staff = sorted(
        [s for s in request.staff if s.night_available],
        key=lambda s: s.max_night,
    )
    for s in sorted_staff[:5]:
        if len(found) >= 2:
            break
        test = deepcopy(request)
        for ts in test.staff:
            if ts.id == s.id:
                ts.max_night = max(ts.max_night, 31)
                break
        if _can_solve_quickly(test, time_limit=1.0):
            found.append(f"スタッフ「{s.name}」の夜勤上限 {s.max_night}回 が低すぎる可能性。スタッフ管理タブで増やすと解けます")
    return found


def _drill_prev(request: GenerateRequest) -> list[str]:
    """どの前月引き継ぎが問題か"""
    from copy import deepcopy

    found = []
    for sid, prev_sc in (request.prev_last_shifts or {}).items():
        if len(found) >= 2:
            break
        test = deepcopy(request)
        test.prev_last_shifts = {k: v for k, v in (test.prev_last_shifts or {}).items() if k != sid}
        if _can_solve_quickly(test, time_limit=1.0):
            name = _staff_name(request, sid)
            found.append(f"前月引き継ぎ「{name}: {_shift_label(prev_sc)}」が原因。前月のシフトを見直すと解けます")
    return found


def _relax(req: GenerateRequest, key: str) -> None:
    """指定カテゴリの制約を緩和する（in-place）"""
    if key == "locks":
        req.locked_shifts = {}
    elif key == "fixed_off":
        for s in req.staff:
            s.fixed_off_weekdays = []
    elif key == "pairs":
        req.pairs = []
    elif key == "wishes_yuki":
        req.wishes = [w for w in req.wishes if w.type != "有給"]
    elif key == "wishes_shukin":
        req.wishes = [w for w in req.wishes if w.type != "出勤"]
    elif key == "required":
        for dc in req.day_conditions:
            dc.required_staff_ids = []
    elif key == "forbidden":
        for dc in req.day_conditions:
            dc.forbidden_staff_ids = []
    elif key == "max_consec_night":
        for s in req.staff:
            s.max_consecutive_nights = 99
    elif key == "max_night":
        for s in req.staff:
            if s.night_available:
                s.max_night = max(s.max_night, 31)
    elif key == "prev_carryover":
        req.prev_last_shifts = {}


def _can_solve_quickly(request: GenerateRequest, time_limit: float = 1.5) -> bool:
    """軽量に解けるか試す（短いタイムリミット）"""
    try:
        year = request.year
        month = request.month
        num_days = calendar.monthrange(year, month)[1]
        days = list(range(1, num_days + 1))
        staff_list = request.staff
        staff_ids = [s.id for s in staff_list]
        staff_map = {s.id: s for s in staff_list}

        if not staff_ids:
            return False

        day_conditions_map = {}
        for dc in request.day_conditions:
            try:
                d = int(dc.date.split("-")[2])
                if 1 <= d <= num_days:
                    day_conditions_map[d] = dc
            except Exception:
                pass

        wish_map: dict = {}
        for w in request.wishes:
            try:
                d = int(w.date.split("-")[2])
                wish_map[(w.staff_id, d)] = w.type
            except Exception:
                pass

        lock_map: dict = {}
        for sid, by_date in (request.locked_shifts or {}).items():
            if sid not in staff_ids:
                continue
            for ds, code in by_date.items():
                try:
                    d = int(ds.split("-")[2])
                    if code in SHIFT_CODES and 1 <= d <= num_days:
                        lock_map[(sid, d)] = code
                except Exception:
                    pass

        model = cp_model.CpModel()
        x = {sid: {d: {sc: model.new_bool_var(f"x_{sid}_{d}_{sc}") for sc in SHIFT_CODES} for d in days} for sid in staff_ids}

        # ハード制約だけ（ソフトは入れない＝速度優先）
        for sid in staff_ids:
            prev_shift = request.prev_last_shifts.get(sid)
            if prev_shift == "N":
                model.add(x[sid][1][SHIFT_A] == 1)
            for d in days:
                model.add_exactly_one([x[sid][d][sc] for sc in SHIFT_CODES])
                if d + 1 in days:
                    model.add(x[sid][d + 1][SHIFT_A] == 1).only_enforce_if(x[sid][d][SHIFT_N])
                    model.add(x[sid][d + 1][SHIFT_N] == 0).only_enforce_if(x[sid][d][SHIFT_A])
                    model.add(x[sid][d][SHIFT_N] == 1).only_enforce_if(x[sid][d + 1][SHIFT_A])
            s = staff_map[sid]
            model.add(sum(x[sid][d][SHIFT_N] for d in days) <= s.max_night)
            if not s.night_available:
                for d in days:
                    model.add(x[sid][d][SHIFT_N] == 0)
                    model.add(x[sid][d][SHIFT_A] == 0)
            # max_consecutive_nights
            max_cn = max(1, s.max_consecutive_nights)
            for d in days:
                if d + max_cn <= num_days:
                    window = list(range(d, d + max_cn + 1))
                    model.add(sum(x[sid][dd][SHIFT_N] for dd in window) <= max_cn)
            # fixed_off_weekdays
            if s.fixed_off_weekdays:
                for d in days:
                    if date_cls(year, month, d).weekday() in s.fixed_off_weekdays:
                        for sc in WORK_SHIFT_CODES:
                            model.add(x[sid][d][sc] == 0)

        # 必要人数
        for d in days:
            dc = day_conditions_map.get(d)
            if dc is not None:
                for sc, req_count in dc.required_per_shift.items():
                    if sc in SHIFT_CODES and req_count > 0:
                        model.add(sum(x[sid][d][sc] for sid in staff_ids) >= req_count)

        # Y wish ↔ Y
        yuki_set = {(sid, d) for (sid, d), wt in wish_map.items() if wt == "有給"}
        for sid in staff_ids:
            for d in days:
                if (sid, d) not in yuki_set:
                    model.add(x[sid][d][SHIFT_Y] == 0)
                else:
                    model.add(x[sid][d][SHIFT_Y] == 1)

        # required / forbidden
        for d in days:
            dc = day_conditions_map.get(d)
            if dc is not None:
                for sid in dc.required_staff_ids:
                    if sid in staff_ids:
                        model.add(x[sid][d][SHIFT_O] == 0)
                        model.add(x[sid][d][SHIFT_Y] == 0)
                for sid in dc.forbidden_staff_ids:
                    if sid in staff_ids:
                        model.add(x[sid][d][SHIFT_O] == 1)

        # 出勤希望
        for (sid, d), wtype in wish_map.items():
            if wtype == "出勤" and sid in staff_ids:
                model.add(x[sid][d][SHIFT_O] == 0)
                model.add(x[sid][d][SHIFT_Y] == 0)

        # ペア（require は solve と同じ: 指導ペアと同格ペアで挙動分岐）
        for pair in request.pairs:
            a_id = pair.staff_a_id
            b_id = pair.staff_b_id
            if a_id not in staff_ids or b_id not in staff_ids:
                continue
            a_obj = staff_map[a_id]
            b_obj = staff_map[b_id]
            a_off_wd = set(a_obj.fixed_off_weekdays or [])
            b_off_wd = set(b_obj.fixed_off_weekdays or [])

            if pair.type == "forbid":
                for d in days:
                    model.add(x[a_id][d][SHIFT_N] + x[b_id][d][SHIFT_N] <= 1)
                continue

            is_mentor_pair = a_obj.is_rookie != b_obj.is_rookie
            if is_mentor_pair:
                if a_obj.is_rookie:
                    rookie_id, mentor_id = a_id, b_id
                    mentor_off_wd = b_off_wd
                else:
                    rookie_id, mentor_id = b_id, a_id
                    mentor_off_wd = a_off_wd
                for d in days:
                    wd = date_cls(year, month, d).weekday()
                    dc = day_conditions_map.get(d)
                    mentor_yuki = wish_map.get((mentor_id, d)) == "有給"
                    mentor_fixed_off = wd in mentor_off_wd
                    mentor_forbidden = bool(dc and mentor_id in dc.forbidden_staff_ids)
                    rookie_yuki = wish_map.get((rookie_id, d)) == "有給"
                    if mentor_yuki or mentor_fixed_off or mentor_forbidden:
                        if not rookie_yuki:
                            model.add(x[rookie_id][d][SHIFT_O] == 1)
                        continue
                    if rookie_yuki:
                        continue
                    for sc in SHIFT_CODES:
                        model.add(x[mentor_id][d][sc] == x[rookie_id][d][sc])
            else:
                for d in days:
                    wd = date_cls(year, month, d).weekday()
                    dc = day_conditions_map.get(d)
                    a_is_yuki = wish_map.get((a_id, d)) == "有給"
                    b_is_yuki = wish_map.get((b_id, d)) == "有給"
                    a_fixed = wd in a_off_wd
                    b_fixed = wd in b_off_wd
                    a_req = bool(dc and a_id in dc.required_staff_ids)
                    b_req = bool(dc and b_id in dc.required_staff_ids)
                    a_fb = bool(dc and a_id in dc.forbidden_staff_ids)
                    b_fb = bool(dc and b_id in dc.forbidden_staff_ids)
                    if (a_is_yuki != b_is_yuki) or (a_fixed != b_fixed) or \
                       (a_req != b_req) or (a_fb != b_fb):
                        continue
                    for sc in SHIFT_CODES:
                        model.add(x[a_id][d][sc] == x[b_id][d][sc])

        # ロック
        for (sid, d), code in lock_map.items():
            model.add(x[sid][d][code] == 1)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit
        solver.parameters.num_search_workers = 4
        status = solver.solve(model)
        return status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    except Exception:
        return False
