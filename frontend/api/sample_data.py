import calendar
from datetime import date


DEFAULT_SHIFT_TYPES = [
    {"code": "D", "name": "日勤", "color": "#4CAF50"},
    {"code": "N", "name": "夜勤", "color": "#9C27B0"},
    {"code": "A", "name": "明け", "color": "#FF9800"},
    {"code": "O", "name": "休み", "color": "#9E9E9E"},
    {"code": "Y", "name": "有給", "color": "#2196F3"},
]

# 夜勤可能8人 × max_night=8 = 64 >= 必要夜勤数(2×31=62)
SAMPLE_STAFF = [
    {
        "id": "s01",
        "name": "田中 花子",
        "role": "主任",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s02",
        "name": "鈴木 一郎",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s03",
        "name": "佐藤 美咲",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s04",
        "name": "高橋 健太",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s05",
        "name": "伊藤 由美",
        "role": "看護師",
        "night_available": False,
        "max_night": 0,
        "max_consecutive_days": 5,
    },
    {
        "id": "s06",
        "name": "渡辺 翔",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s07",
        "name": "山本 さくら",
        "role": "看護師",
        "night_available": False,
        "max_night": 0,
        "max_consecutive_days": 5,
    },
    {
        "id": "s08",
        "name": "中村 大輔",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s09",
        "name": "小林 奈々",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
    {
        "id": "s10",
        "name": "加藤 浩二",
        "role": "看護師",
        "night_available": True,
        "max_night": 8,
        "max_consecutive_days": 5,
    },
]


def get_sample_data(year: int = 2026, month: int = 3) -> dict:
    num_days = calendar.monthrange(year, month)[1]
    day_conditions = []
    for d in range(1, num_days + 1):
        date_str = f"{year:04d}-{month:02d}-{d:02d}"
        weekday = date(year, month, d).weekday()
        is_weekend = weekday >= 5  # Saturday=5, Sunday=6

        day_conditions.append(
            {
                "date": date_str,
                "required_per_shift": {
                    "D": 2 if is_weekend else 3,
                    "N": 2,
                },
                "event_flag": False,
                "required_staff_ids": [],
                "forbidden_staff_ids": [],
            }
        )

    return {
        "staff": SAMPLE_STAFF,
        "shift_types": DEFAULT_SHIFT_TYPES,
        "day_conditions": day_conditions,
        "wishes": [],
        "year": year,
        "month": month,
    }
