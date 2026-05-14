import calendar
from datetime import date


DEFAULT_SHIFT_TYPES = [
    {"code": "D", "name": "日勤", "color": "#4CAF50"},
    {"code": "E", "name": "早番", "color": "#26C6DA"},
    {"code": "N", "name": "夜勤", "color": "#9C27B0"},
    {"code": "A", "name": "明け", "color": "#FF9800"},
    {"code": "L", "name": "遅番", "color": "#5C6BC0"},
    {"code": "O", "name": "休日", "color": "#9E9E9E"},
    {"code": "Y", "name": "有給", "color": "#2196F3"},
]

# ── 基本構成 ──
#   看護師 16 名（夜勤可 14 名 / 夜勤不可 2 名）
#   平日 日勤 8 / 夜勤 2、土曜 日勤 5 / 夜勤 2、日曜 日勤 3 / 夜勤 2
#   夜勤供給: 14 名 × max_night 8 = 112 回 ≥ 必要 62 回（31日想定）

def _staff(sid, name, role, night=True, max_n=8, lead=False, rookie=False, fixed_off=None):
    return {
        "id": sid,
        "name": name,
        "role": role,
        "night_available": night,
        "max_night": max_n if night else 0,
        "max_consecutive_days": 5,
        "max_consecutive_nights": 2,
        "can_lead": lead,
        "is_rookie": rookie,
        "fixed_off_weekdays": fixed_off or [],
    }


SAMPLE_STAFF = [
    _staff("s01", "田中 花子", "師長", lead=True),
    _staff("s02", "鈴木 一郎", "主任", lead=True),
    _staff("s03", "佐藤 美咲", "看護師", lead=True),
    _staff("s04", "高橋 健太", "看護師", lead=True),
    _staff("s05", "伊藤 由美", "看護師(育児中)", night=False, fixed_off=[5, 6]),  # 土日固定休
    _staff("s06", "渡辺 翔", "看護師", lead=True),
    _staff("s07", "山本 さくら", "看護師(時短)", night=False),
    _staff("s08", "中村 大輔", "看護師", lead=True),
    _staff("s09", "小林 奈々", "看護師(新人)", rookie=True),
    _staff("s10", "加藤 浩二", "看護師"),
    _staff("s11", "吉田 ゆかり", "看護師", lead=True),
    _staff("s12", "山田 太郎", "看護師"),
    _staff("s13", "佐々木 恵", "看護師"),
    _staff("s14", "松本 健", "看護師"),
    _staff("s15", "井上 みき", "看護師(新人)", rookie=True),
    _staff("s16", "木村 大樹", "看護師"),
]


def _required_for(weekday: int) -> dict:
    """0=月..6=日。平日 D8/N2・土曜 D5/N2・日曜 D3/N2。"""
    if weekday == 6:        # 日曜
        return {"D": 3, "N": 2}
    if weekday == 5:        # 土曜
        return {"D": 5, "N": 2}
    return {"D": 8, "N": 2}  # 平日


def get_sample_data(year: int = 2026, month: int = 3) -> dict:
    num_days = calendar.monthrange(year, month)[1]
    day_conditions = []
    for d in range(1, num_days + 1):
        date_str = f"{year:04d}-{month:02d}-{d:02d}"
        weekday = date(year, month, d).weekday()
        day_conditions.append({
            "date": date_str,
            "required_per_shift": _required_for(weekday),
            "event_flag": False,
            "required_staff_ids": [],
            "forbidden_staff_ids": [],
        })

    return {
        "staff": SAMPLE_STAFF,
        "shift_types": DEFAULT_SHIFT_TYPES,
        "day_conditions": day_conditions,
        "wishes": [],
        "year": year,
        "month": month,
    }
