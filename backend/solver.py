import calendar
from ortools.sat.python import cp_model
from models import GenerateRequest


SHIFT_CODES = ["D", "E", "N", "A", "L", "O", "Y"]
SHIFT_D = "D"   # 日勤
SHIFT_E = "E"   # 早番
SHIFT_N = "N"   # 夜勤（入り）
SHIFT_A = "A"   # 夜勤（明け）
SHIFT_L = "L"   # 遅番
SHIFT_O = "O"   # 休日
SHIFT_Y = "Y"   # 有給

# 「出勤扱い」のシフトコード（O / Y 以外）
WORK_SHIFT_CODES = [SHIFT_D, SHIFT_E, SHIFT_N, SHIFT_A, SHIFT_L]
# 「日勤系」（連勤カウント対象）
DAY_WORK_SHIFTS = [SHIFT_D, SHIFT_E, SHIFT_L]

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


def check_feasibility(request: GenerateRequest) -> list[str]:
    """Return list of infeasibility reasons before running solver."""
    year = request.year
    month = request.month
    num_days = calendar.monthrange(year, month)[1]
    days = list(range(1, num_days + 1))

    night_capable = [s for s in request.staff if s.night_available]
    total_night_capacity = sum(s.max_night for s in night_capable)

    # Build day conditions map
    dc_map = {}
    for dc in request.day_conditions:
        try:
            day = int(dc.date.split("-")[2])
            dc_map[day] = dc
        except Exception:
            pass

    total_night_required = sum(_get_required_n(dc_map.get(d)) for d in days)
    total_day_required = sum(_get_required_d(dc_map.get(d)) for d in days)

    errors = []

    # Check total night capacity
    if total_night_capacity < total_night_required:
        errors.append(
            f"夜勤の供給不足: 必要={total_night_required}回, 上限合計={total_night_capacity}回 "
            f"(夜勤可能スタッフ{len(night_capable)}人のmax_nightを合計 {total_night_required} 以上にしてください)"
        )

    # Check per-day night availability
    for d in days:
        dc = dc_map.get(d)
        n_req = _get_required_n(dc)
        if n_req > len(night_capable):
            errors.append(
                f"{month}月{d}日: 夜勤必要人数 {n_req}人 > 夜勤可能スタッフ {len(night_capable)}人"
            )
        d_req = _get_required_d(dc)
        if d_req > len(request.staff):
            errors.append(
                f"{month}月{d}日: 日勤必要人数 {d_req}人 > 総スタッフ {len(request.staff)}人"
            )

    # Check staff count is at least 1
    if len(request.staff) == 0:
        errors.append("スタッフが登録されていません")

    # Check prev_last_shifts: N→A carryover conflicts with required_staff_ids on day 1
    staff_map_local = {s.id: s for s in request.staff}
    dc1 = dc_map.get(1)
    if dc1:
        for sid, prev_sc in request.prev_last_shifts.items():
            if prev_sc == "N" and sid in dc1.required_staff_ids:
                name = staff_map_local.get(sid, type("", (), {"name": sid})()).name
                errors.append(
                    f"{month}月1日: {name} は前月夜勤明け（A固定）のため"
                    "required_staff_idsに設定できません。イベント設定を確認してください。"
                )

    return errors


def solve(request: GenerateRequest) -> dict:
    year = request.year
    month = request.month
    num_days = calendar.monthrange(year, month)[1]
    days = list(range(1, num_days + 1))

    staff_list = request.staff
    staff_ids = [s.id for s in staff_list]
    staff_map = {s.id: s for s in staff_list}

    # Build date string -> day number mapping
    day_conditions_map: dict[int, object] = {}
    for dc in request.day_conditions:
        try:
            parts = dc.date.split("-")
            day = int(parts[2])
            if 1 <= day <= num_days:
                day_conditions_map[day] = dc
        except Exception:
            pass

    # Build wish lookup: (staff_id, day) -> wish type
    wish_map: dict[tuple, str] = {}
    for w in request.wishes:
        try:
            parts = w.date.split("-")
            day = int(parts[2])
            wish_map[(w.staff_id, day)] = w.type
        except Exception:
            pass

    model = cp_model.CpModel()

    # x[staff_id][day][shift_code] = BoolVar
    x: dict[str, dict[int, dict[str, cp_model.IntVar]]] = {}
    for sid in staff_ids:
        x[sid] = {}
        for d in days:
            x[sid][d] = {}
            for sc in SHIFT_CODES:
                x[sid][d][sc] = model.new_bool_var(f"x_{sid}_{d}_{sc}")

    # Hard constraint 0: prev_last_shifts — if previous month ended with N, day 1 must be A
    for sid in staff_ids:
        prev_shift = request.prev_last_shifts.get(sid)
        if prev_shift == "N":
            model.add(x[sid][1][SHIFT_A] == 1)

    # Hard constraint 1: Each staff has exactly 1 shift per day
    for sid in staff_ids:
        for d in days:
            model.add_exactly_one([x[sid][d][sc] for sc in SHIFT_CODES])

    # Hard constraint 2: Night shift (N) must be followed by A (明け) next day
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                model.add(x[sid][d + 1][SHIFT_A] == 1).only_enforce_if(x[sid][d][SHIFT_N])

    # Hard constraint 3: After A (明け), must not be N next day
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                model.add(x[sid][d + 1][SHIFT_N] == 0).only_enforce_if(x[sid][d][SHIFT_A])

    # Hard constraint 4: If tomorrow is A, today must be N
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                model.add(x[sid][d][SHIFT_N] == 1).only_enforce_if(x[sid][d + 1][SHIFT_A])

    # Hard constraint 5: Monthly night shifts <= max_night
    for sid in staff_ids:
        s = staff_map[sid]
        model.add(sum(x[sid][d][SHIFT_N] for d in days) <= s.max_night)

    # Hard constraint 6: Staff with night_available=False cannot be N or A
    for sid in staff_ids:
        s = staff_map[sid]
        if not s.night_available:
            for d in days:
                model.add(x[sid][d][SHIFT_N] == 0)
                model.add(x[sid][d][SHIFT_A] == 0)

    # Hard constraint 7: Required staff counts per shift per day
    for d in days:
        dc = day_conditions_map.get(d)
        if dc is not None:
            for sc, req_count in dc.required_per_shift.items():
                if sc in SHIFT_CODES and req_count > 0:
                    model.add(
                        sum(x[sid][d][sc] for sid in staff_ids) >= req_count
                    )

    # Hard constraint 8: Y (有給) can ONLY be assigned on days with an explicit 有給 wish
    # (and must be assigned if the wish exists)
    yuki_set = {(sid, d) for (sid, d), wtype in wish_map.items() if wtype == "有給"}
    for sid in staff_ids:
        for d in days:
            if (sid, d) not in yuki_set:
                model.add(x[sid][d][SHIFT_Y] == 0)
            else:
                model.add(x[sid][d][SHIFT_Y] == 1)

    # Hard constraint 9: required_staff_ids must work (not O, not Y) on that day
    for d in days:
        dc = day_conditions_map.get(d)
        if dc is not None:
            for sid in dc.required_staff_ids:
                if sid in staff_ids:
                    model.add(x[sid][d][SHIFT_O] == 0)
                    model.add(x[sid][d][SHIFT_Y] == 0)

    # Hard constraint 9b: per-staff "出勤" wish → must work (not O, not Y) on that day
    for (sid, d), wtype in wish_map.items():
        if wtype == "出勤" and sid in staff_ids:
            model.add(x[sid][d][SHIFT_O] == 0)
            model.add(x[sid][d][SHIFT_Y] == 0)

    # Hard constraint 10: forbidden_staff_ids must be O on that day
    for d in days:
        dc = day_conditions_map.get(d)
        if dc is not None:
            for sid in dc.forbidden_staff_ids:
                if sid in staff_ids:
                    model.add(x[sid][d][SHIFT_O] == 1)

    # Hard constraint 11: ペア制約
    #   forbid  = 同じ日に両者が「夜勤(N)」になるのを禁止。
    #              日勤や明け・早番・遅番の被りはOK、夜勤の丸被りのみNG。
    #   require = 同日出勤マスト（両方とも O/Y でない、または両方とも O/Y）
    for pair in request.pairs:
        a_id = pair.staff_a_id
        b_id = pair.staff_b_id
        if a_id not in staff_ids or b_id not in staff_ids:
            continue
        for d in days:
            if pair.type == "forbid":
                # 夜勤同時アサインを禁止
                model.add(x[a_id][d][SHIFT_N] + x[b_id][d][SHIFT_N] <= 1)
            elif pair.type == "require":
                a_works = sum(x[a_id][d][sc] for sc in WORK_SHIFT_CODES)
                b_works = sum(x[b_id][d][sc] for sc in WORK_SHIFT_CODES)
                model.add(a_works == b_works)

    # Hard constraint 12: リーダー必須（can_lead=True なスタッフが1人以上いる日のみ強制）
    # 病棟は毎日 1 人リーダーが必要 → リーダー資格者が最低1名出勤
    leader_ids = [sid for sid in staff_ids if staff_map[sid].can_lead]
    if leader_ids:
        for d in days:
            # 少なくとも 1 人のリーダーが出勤（O でも Y でもない）
            leader_working = sum(
                x[lid][d][sc] for lid in leader_ids for sc in WORK_SHIFT_CODES
            )
            model.add(leader_working >= 1)

    # Collect penalty terms for soft constraints
    penalty_terms = []

    # Soft constraint 1: Respect 希望休 -> prefer O
    for (sid, d), wtype in wish_map.items():
        if wtype == "希望休" and sid in staff_ids:
            not_off = model.new_bool_var(f"not_off_{sid}_{d}")
            model.add(x[sid][d][SHIFT_O] == 0).only_enforce_if(not_off)
            model.add(x[sid][d][SHIFT_O] == 1).only_enforce_if(not_off.negated())
            penalty_terms.append(not_off * 150)  # raised from 100

    # Soft constraint 1b: prev_last_shifts — if previous month ended with A, day 1 prefers O
    for sid in staff_ids:
        prev_shift = request.prev_last_shifts.get(sid)
        if prev_shift == "A":
            not_off_d1 = model.new_bool_var(f"not_off_d1_{sid}")
            model.add(x[sid][1][SHIFT_O] == 0).only_enforce_if(not_off_d1)
            model.add(x[sid][1][SHIFT_O] == 1).only_enforce_if(not_off_d1.negated())
            penalty_terms.append(not_off_d1 * 20)

    # Soft constraint 2: After A (明け), prefer O next day
    for sid in staff_ids:
        for d in days:
            if d + 1 in days:
                not_off_after_a = model.new_bool_var(f"not_off_after_a_{sid}_{d}")
                both = model.new_bool_var(f"a_and_not_off_{sid}_{d}")
                model.add_bool_and([x[sid][d][SHIFT_A], not_off_after_a]).only_enforce_if(both)
                model.add_bool_or([x[sid][d][SHIFT_A].negated(), not_off_after_a.negated()]).only_enforce_if(both.negated())
                model.add(x[sid][d + 1][SHIFT_O] == 0).only_enforce_if(not_off_after_a)
                model.add(x[sid][d + 1][SHIFT_O] == 1).only_enforce_if(not_off_after_a.negated())
                penalty_terms.append(both * 20)

    # Soft constraint 3: Avoid long consecutive working days
    # D / E / L / N をすべて「勤務日」として連勤カウント
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

    # Soft constraint 4: Minimize variance in night shift counts across night-capable staff
    # Use actual total required nights for a realistic target
    night_capable_ids = [sid for sid in staff_ids if staff_map[sid].night_available]
    night_counts = []
    if night_capable_ids:
        total_required_nights = sum(_get_required_n(day_conditions_map.get(d)) for d in days)
        n_night_staff = len(night_capable_ids)
        target_nights = total_required_nights // max(n_night_staff, 1)

        for sid in night_capable_ids:
            nc = sum(x[sid][d][SHIFT_N] for d in days)
            night_counts.append((sid, nc))
            dev_pos = model.new_int_var(0, num_days, f"dev_pos_{sid}")
            dev_neg = model.new_int_var(0, num_days, f"dev_neg_{sid}")
            model.add(nc - target_nights == dev_pos - dev_neg)
            penalty_terms.append(dev_pos * 15)
            penalty_terms.append(dev_neg * 15)

    # Soft constraint 5: Prefer off days for non-night staff to balance workload
    # Night-unavailable staff get penalized for too many consecutive day-work (D/E/L)
    for sid in staff_ids:
        s = staff_map[sid]
        if not s.night_available:
            for d in days:
                if d + 4 <= num_days:
                    window_days = list(range(d, d + 5))
                    all_day = sum(x[sid][dd][sc] for dd in window_days for sc in DAY_WORK_SHIFTS)
                    all_work = model.new_bool_var(f"all5d_{sid}_{d}")
                    model.add(all_day >= 5).only_enforce_if(all_work)
                    model.add(all_day <= 4).only_enforce_if(all_work.negated())
                    penalty_terms.append(all_work * 100)

    # Objective: minimize total penalty
    if penalty_terms:
        model.minimize(sum(penalty_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 55
    solver.parameters.num_workers = 4

    status = solver.solve(model)

    # Build schedule from solution
    schedule: dict[str, dict[str, str]] = {}
    summary: dict[str, dict] = {}

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for sid in staff_ids:
            schedule[sid] = {}
            counts = {sc: 0 for sc in SHIFT_CODES}

            for d in days:
                date_str = f"{year:04d}-{month:02d}-{d:02d}"
                assigned = SHIFT_O  # default
                for sc in SHIFT_CODES:
                    if solver.value(x[sid][d][sc]) == 1:
                        assigned = sc
                        break
                schedule[sid][date_str] = assigned
                counts[assigned] += 1

            # 既存フィールドを維持しつつ新シフトの内訳も返す
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
                "total_days": num_days,
            }

    elif status == cp_model.INFEASIBLE:
        raise ValueError(
            "制約を満たすシフトが見つかりませんでした（充足不能）。"
            "夜勤上限・必要人数・希望休の数を見直してください。"
        )
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
