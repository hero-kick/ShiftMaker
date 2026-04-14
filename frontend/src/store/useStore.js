import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCurrentWorkspaceId, storageKeyFor } from '../workspace'

// 現在選択中のワークスペース単位で独立した localStorage キーを使う。
// ワークスペース未選択のときは一時的な揮発領域に書く（Gate 画面通過前の保険）。
const activeWorkspaceId = getCurrentWorkspaceId()
const STORAGE_KEY = activeWorkspaceId
  ? storageKeyFor(activeWorkspaceId)
  : 'shiftmaker-v2-__unassigned__'
const MAX_STORED_MONTHS = 3  // 直近3ヶ月分のスケジュールを保持

const DEFAULT_SHIFT_TYPES = [
  { code: 'D', name: '日勤', color: '#4CAF50' },
  { code: 'N', name: '夜勤', color: '#9C27B0' },
  { code: 'A', name: '明け', color: '#FF9800' },
  { code: 'O', name: '休み', color: '#9E9E9E' },
  { code: 'Y', name: '有給', color: '#2196F3' },
]

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const useStore = create(
  persist(
    (set, get) => ({
      // --- マスタデータ（persisted）---
      staff: [],
      wishes: [],
      dayConditions: [],
      shiftTypes: DEFAULT_SHIFT_TYPES,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,

      // --- 月別スケジュール（persisted, 直近3ヶ月）---
      // { "2026-03": { schedule: {...}, summary: {...} }, ... }
      schedules: {},

      // --- アクティブスケジュール（non-persisted, 月切り替えで更新）---
      schedule: null,
      summary: null,

      // ── 年月 ──
      setYear: (year) => set({ year }),
      setMonth: (month) => set({ month }),

      // ── スタッフ ──
      addStaff: (staffMember) =>
        set((state) => ({
          staff: [...state.staff, { ...staffMember, id: `s_${Date.now()}` }],
        })),

      updateStaff: (id, updates) =>
        set((state) => ({
          staff: state.staff.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      removeStaff: (id) =>
        set((state) => ({
          staff: state.staff.filter((s) => s.id !== id),
          wishes: state.wishes.filter((w) => w.staff_id !== id),
        })),

      // ── 希望 ──
      addWish: (wish) =>
        set((state) => {
          const filtered = state.wishes.filter(
            (w) => !(w.staff_id === wish.staff_id && w.date === wish.date)
          )
          return { wishes: [...filtered, wish] }
        }),

      removeWish: (staffId, date) =>
        set((state) => ({
          wishes: state.wishes.filter(
            (w) => !(w.staff_id === staffId && w.date === date)
          ),
        })),

      // ── 日別条件 ──
      setDayConditions: (dayConditions) => set({ dayConditions }),

      updateDayCondition: (date, updates) =>
        set((state) => {
          const existing = state.dayConditions.find((dc) => dc.date === date)
          if (existing) {
            return {
              dayConditions: state.dayConditions.map((dc) =>
                dc.date === date ? { ...dc, ...updates } : dc
              ),
            }
          }
          return {
            dayConditions: [
              ...state.dayConditions,
              {
                date,
                required_per_shift: { D: 3, N: 2 },
                event_flag: false,
                required_staff_ids: [],
                forbidden_staff_ids: [],
                ...updates,
              },
            ],
          }
        }),

      // ── スケジュール（月別保存）──
      setScheduleForMonth: (year, month, schedule, summary) =>
        set((state) => {
          const key = monthKey(year, month)
          const newSchedules = {
            ...state.schedules,
            [key]: { schedule, summary },
          }
          // 直近 MAX_STORED_MONTHS ヶ月のみ保持
          const keys = Object.keys(newSchedules).sort().reverse()
          if (keys.length > MAX_STORED_MONTHS) {
            keys.slice(MAX_STORED_MONTHS).forEach((k) => delete newSchedules[k])
          }
          return { schedule, summary, schedules: newSchedules }
        }),

      // 月切り替え時にその月のスケジュールを復元
      loadScheduleForMonth: (year, month) =>
        set((state) => {
          const key = monthKey(year, month)
          const data = state.schedules[key]
          return {
            schedule: data?.schedule ?? null,
            summary: data?.summary ?? null,
          }
        }),

      // 手動セル編集（schedules にも反映）
      updateShiftCell: (staffId, date, shiftCode) =>
        set((state) => {
          if (!state.schedule) return state
          const newSchedule = {
            ...state.schedule,
            [staffId]: { ...state.schedule[staffId], [date]: shiftCode },
          }
          // date から月キーを取得
          const [y, m] = date.split('-')
          const key = `${y}-${m}`
          return {
            schedule: newSchedule,
            schedules: {
              ...state.schedules,
              [key]: { ...state.schedules[key], schedule: newSchedule },
            },
          }
        }),

      // ── 前月末シフト取得（前月末日のシフト → 翌月引き継ぎ用）──
      getPrevLastShifts: () => {
        const { year, month, schedules } = get()
        const prevYear = month === 1 ? year - 1 : year
        const prevMonth = month === 1 ? 12 : month - 1
        const key = monthKey(prevYear, prevMonth)
        const prevSchedule = schedules[key]?.schedule
        if (!prevSchedule) return {}

        const lastDay = new Date(prevYear, prevMonth, 0).getDate()
        const lastDate = `${monthKey(prevYear, prevMonth)}-${String(lastDay).padStart(2, '0')}`

        const result = {}
        Object.entries(prevSchedule).forEach(([sid, days]) => {
          if (days[lastDate]) result[sid] = days[lastDate]
        })
        return result
      },

      // ── サンプルデータ読み込み ──
      loadSampleData: (data) => {
        const { year, month } = get()
        const numDays = new Date(year, month, 0).getDate()
        const dayConditions = []
        for (let d = 1; d <= numDays; d++) {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const existing = data.day_conditions?.find((dc) => dc.date === date)
          dayConditions.push(
            existing || {
              date,
              required_per_shift: { D: 3, N: 2 },
              event_flag: false,
              required_staff_ids: [],
              forbidden_staff_ids: [],
            }
          )
        }
        set({
          staff: data.staff || [],
          wishes: data.wishes || [],
          dayConditions,
          shiftTypes: data.shift_types || DEFAULT_SHIFT_TYPES,
          schedule: null,
          summary: null,
        })
      },

      // ── 日別条件初期化（月切り替え時）──
      initDayConditions: () => {
        const { year, month, dayConditions } = get()
        const numDays = new Date(year, month, 0).getDate()
        const prefix = `${year}-${String(month).padStart(2, '0')}-`

        const existing = dayConditions.filter((dc) => dc.date.startsWith(prefix))
        if (existing.length === numDays) return

        // 他の月の条件は保持したまま、今月分だけ補完
        const otherMonths = dayConditions.filter((dc) => !dc.date.startsWith(prefix))
        const thisMonthConditions = []
        for (let d = 1; d <= numDays; d++) {
          const date = `${prefix}${String(d).padStart(2, '0')}`
          const existingDc = dayConditions.find((dc) => dc.date === date)
          thisMonthConditions.push(
            existingDc || {
              date,
              required_per_shift: { D: 3, N: 2 },
              event_flag: false,
              required_staff_ids: [],
              forbidden_staff_ids: [],
            }
          )
        }
        set({ dayConditions: [...otherMonths, ...thisMonthConditions] })
      },

      // ── 全消去 ──
      clearAll: () =>
        set({
          staff: [],
          wishes: [],
          dayConditions: [],
          schedules: {},
          schedule: null,
          summary: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        staff: state.staff,
        wishes: state.wishes,
        dayConditions: state.dayConditions,
        year: state.year,
        month: state.month,
        shiftTypes: state.shiftTypes,
        schedules: state.schedules,  // 月別スケジュールを永続化
      }),
    }
  )
)

export default useStore
