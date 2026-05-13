from pydantic import BaseModel, Field
from typing import Optional


class Staff(BaseModel):
    id: str
    name: str
    role: Optional[str] = None
    night_available: bool = True
    max_night: int = 8
    max_consecutive_days: int = 5
    is_rookie: bool = False      # 新人フラグ（表示用 / 将来の制約用）
    can_lead: bool = False       # リーダー業務が可能か


class StaffPair(BaseModel):
    """ペア制約: 2人の同時出勤を強制 or 禁止する"""
    staff_a_id: str
    staff_b_id: str
    type: str  # "forbid" (絶対に同時出勤させない) or "require" (絶対に同時出勤させる)


class ShiftType(BaseModel):
    code: str
    name: str
    color: str


class DayCondition(BaseModel):
    date: str  # YYYY-MM-DD
    required_per_shift: dict[str, int] = Field(default_factory=dict)
    event_flag: bool = False
    event_name: Optional[str] = None
    required_staff_ids: list[str] = Field(default_factory=list)
    forbidden_staff_ids: list[str] = Field(default_factory=list)


class Wish(BaseModel):
    staff_id: str
    date: str  # YYYY-MM-DD
    type: str  # "希望休" (soft prefer O) / "有給" (hard Y) / "出勤" (hard not O/Y)


class GenerateRequest(BaseModel):
    staff: list[Staff]
    shift_types: list[ShiftType]
    day_conditions: list[DayCondition]
    wishes: list[Wish]
    year: int
    month: int
    # 前月末日のシフト（staff_id -> shift_code）。N の場合は当月1日をA強制
    prev_last_shifts: dict[str, str] = Field(default_factory=dict)
    pairs: list[StaffPair] = Field(default_factory=list)


class ShiftResult(BaseModel):
    schedule: dict[str, dict[str, str]]  # staff_id -> date -> shift_code
    summary: dict[str, dict]  # staff_id -> stats
