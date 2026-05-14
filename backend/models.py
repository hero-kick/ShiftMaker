from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional


# ── 入力上限（ソルバーのハング / メモリ枯渇 / DoS を防ぐ）──
MAX_STAFF = 80
MAX_DAYS = 31
MAX_NIGHT_CAP = 31
MAX_CONSEC = 31
MAX_REQUIRED_PER_SHIFT = 80


class Staff(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=40)
    role: Optional[str] = Field(default=None, max_length=40)
    night_available: bool = True
    max_night: int = Field(default=8, ge=0, le=MAX_NIGHT_CAP)
    max_consecutive_days: int = Field(default=5, ge=1, le=MAX_CONSEC)
    is_rookie: bool = False
    can_lead: bool = False
    max_consecutive_nights: int = Field(default=2, ge=1, le=MAX_CONSEC)
    fixed_off_weekdays: list[int] = Field(default_factory=list)
    weekend_off_target: Optional[int] = Field(default=None, ge=0, le=MAX_DAYS)

    @field_validator("fixed_off_weekdays")
    @classmethod
    def _valid_weekdays(cls, v):
        # 0=月 .. 6=日。範囲外は除外、重複も排除
        return sorted({w for w in v if isinstance(w, int) and 0 <= w <= 6})

    @field_validator("name", "role")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class StaffPair(BaseModel):
    staff_a_id: str
    staff_b_id: str
    type: str  # "forbid" or "require"

    @field_validator("type")
    @classmethod
    def _valid_type(cls, v):
        if v not in ("forbid", "require"):
            raise ValueError("ペアの種別は forbid か require のみ有効です")
        return v

    @model_validator(mode="after")
    def _not_same(self):
        if self.staff_a_id == self.staff_b_id:
            raise ValueError("ペアに同じスタッフは指定できません")
        return self


class ShiftType(BaseModel):
    code: str = Field(min_length=1, max_length=2)
    name: str = Field(min_length=1, max_length=10)
    color: str = Field(min_length=1, max_length=20)


class DayCondition(BaseModel):
    date: str  # YYYY-MM-DD
    required_per_shift: dict[str, int] = Field(default_factory=dict)
    event_flag: bool = False
    event_name: Optional[str] = Field(default=None, max_length=60)
    required_staff_ids: list[str] = Field(default_factory=list)
    forbidden_staff_ids: list[str] = Field(default_factory=list)
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("required_per_shift")
    @classmethod
    def _clamp_required(cls, v):
        # 各シフトの必要人数を 0..MAX_REQUIRED_PER_SHIFT に丸める
        out = {}
        for code, count in v.items():
            try:
                n = int(count)
            except (TypeError, ValueError):
                continue
            out[code] = max(0, min(n, MAX_REQUIRED_PER_SHIFT))
        return out


class Wish(BaseModel):
    staff_id: str
    date: str  # YYYY-MM-DD
    type: str  # "希望休" / "有給" / "出勤"

    @field_validator("type")
    @classmethod
    def _valid_wish_type(cls, v):
        if v not in ("希望休", "有給", "出勤"):
            raise ValueError(f"希望の種別が不正です: {v}")
        return v


class GenerateRequest(BaseModel):
    staff: list[Staff]
    shift_types: list[ShiftType]
    day_conditions: list[DayCondition]
    wishes: list[Wish]
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    prev_last_shifts: dict[str, str] = Field(default_factory=dict)
    # 前月末時点の連続勤務日数（staff_id -> 連勤数）。月またぎの連勤抑制に使う。
    prev_consecutive_work: dict[str, int] = Field(default_factory=dict)
    pairs: list[StaffPair] = Field(default_factory=list)
    locked_shifts: dict[str, dict[str, str]] = Field(default_factory=dict)

    @field_validator("staff")
    @classmethod
    def _staff_limits(cls, v):
        if len(v) > MAX_STAFF:
            raise ValueError(f"スタッフ数の上限は {MAX_STAFF} 名です（現在 {len(v)} 名）")
        # ID 重複チェック
        ids = [s.id for s in v]
        if len(ids) != len(set(ids)):
            raise ValueError("スタッフIDが重複しています")
        return v

    @model_validator(mode="after")
    def _cross_checks(self):
        # ペア・希望・ロックが実在スタッフを参照しているか（不明IDは無視するが、ここで軽く検査）
        staff_ids = {s.id for s in self.staff}
        # prev_last_shifts のコードを検証
        valid_codes = {"D", "E", "N", "A", "L", "O", "Y"}
        for sid, code in list(self.prev_last_shifts.items()):
            if code not in valid_codes:
                # 不正コードは黙って除去
                del self.prev_last_shifts[sid]
        return self


class ShiftResult(BaseModel):
    schedule: dict[str, dict[str, str]]
    summary: dict[str, dict]
