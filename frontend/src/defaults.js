// シフト必要人数の「基本値」。プロジェクト全体で参照する単一の真実。
//
// 基本構成:
//   平日   — 日勤 8人 / 夜勤 2人
//   土曜   — 日勤 5人 / 夜勤 2人
//   日曜   — 日勤 3人 / 夜勤 2人
//
// 病棟ごとに違う場合は「人数」タブで日別に上書きできる。

export function defaultRequiredForDate(dateStr) {
  // dateStr: "YYYY-MM-DD"。タイムゾーン非依存で曜日を求める。
  const [y, m, d] = dateStr.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).getDay() // 0=日 .. 6=土
  if (weekday === 0) return { D: 3, N: 2 } // 日曜
  if (weekday === 6) return { D: 5, N: 2 } // 土曜
  return { D: 8, N: 2 } // 平日
}

// 月初期化などで「空の DayCondition」を作るときの雛形
export function blankDayCondition(dateStr) {
  return {
    date: dateStr,
    required_per_shift: defaultRequiredForDate(dateStr),
    event_flag: false,
    required_staff_ids: [],
    forbidden_staff_ids: [],
  }
}

// 一括設定の初期値（DayConditionInput のクイックフィル用）
export const QUICK_FILL_DEFAULTS = {
  weekday: { D: 8, N: 2 },
  saturday: { D: 5, N: 2 },
  sunday: { D: 3, N: 2 },
}
