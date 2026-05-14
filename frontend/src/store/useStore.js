import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getCurrentWorkspaceId, storageKeyFor } from '../workspace'
import { safeStorage } from '../safeStorage'
import { defaultRequiredForDate, blankDayCondition } from '../defaults'

const activeWorkspaceId = getCurrentWorkspaceId()
const STORAGE_KEY = activeWorkspaceId
  ? storageKeyFor(activeWorkspaceId)
  : 'shiftmaker-v2-__unassigned__'
const MAX_STORED_MONTHS = 3

const DEFAULT_SHIFT_TYPES = [
  { code: 'D', name: '日勤', color: '#4CAF50' },
  { code: 'E', name: '早番', color: '#26C6DA' },
  { code: 'N', name: '夜勤', color: '#9C27B0' },
  { code: 'A', name: '明け', color: '#FF9800' },
  { code: 'L', name: '遅番', color: '#5C6BC0' },
  { code: 'O', name: '休日', color: '#9E9E9E' },
  { code: 'Y', name: '有給', color: '#2196F3' },
]

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const STAFF_DEFAULTS = {
  night_available: true,
  max_night: 8,
  max_consecutive_days: 5,
  is_rookie: false,
  can_lead: false,
  max_consecutive_nights: 2,
  fixed_off_weekdays: [],
  weekend_off_target: null,
}

function withStaffDefaults(s) {
  return { ...STAFF_DEFAULTS, ...s }
}

const useStore = create(
  persist(
    (set, get) => ({
      // ── マスタデータ（persisted）──
      staff: [],
      wishes: [],
      dayConditions: [],
      pairs: [],
      shiftTypes: DEFAULT_SHIFT_TYPES,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,

      // ── 月別スケジュール（persisted）──
      // { "YYYY-MM": { schedule, summary, locks, notes } }
      schedules: {},

      // ── アクティブ（non-persisted）──
      schedule: null,
      summary: null,
      locks: {},   // staffId -> { date: code }
      notes: {},   // date -> string

      // ── 年月 ──
      setYear: (year) => set({ year }),
      setMonth: (month) => set({ month }),

      // ── スタッフ ──
      addStaff: (staffMember) =>
        set((state) => ({
          staff: [...state.staff, withStaffDefaults({ ...staffMember, id: `s_${Date.now()}` })],
        })),

      addStaffBulk: ({ role, count, ...rest }) =>
        set((state) => {
          const base = (role || '').trim() || 'スタッフ'
          const usedNumbers = new Set(
            state.staff
              .map((s) => {
                const m = s.name.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`))
                return m ? Number(m[1]) : null
              })
              .filter((n) => n != null)
          )
          let nextNum = 1
          const newOnes = []
          const now = Date.now()
          for (let i = 0; i < count; i++) {
            while (usedNumbers.has(nextNum)) nextNum += 1
            newOnes.push(withStaffDefaults({
              id: `s_${now}_${i}`,
              name: `${base}${nextNum}`,
              role: base,
              ...rest,
            }))
            usedNumbers.add(nextNum)
            nextNum += 1
          }
          return { staff: [...state.staff, ...newOnes] }
        }),

      updateStaff: (id, updates) =>
        set((state) => ({
          staff: state.staff.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      removeStaff: (id) =>
        set((state) => ({
          staff: state.staff.filter((s) => s.id !== id),
          wishes: state.wishes.filter((w) => w.staff_id !== id),
          pairs: state.pairs.filter((p) => p.staff_a_id !== id && p.staff_b_id !== id),
        })),

      moveStaff: (id, direction) =>
        set((state) => {
          const idx = state.staff.findIndex((s) => s.id === id)
          if (idx < 0) return state
          const newIdx = direction === 'up' ? idx - 1 : idx + 1
          if (newIdx < 0 || newIdx >= state.staff.length) return state
          const arr = [...state.staff]
          ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
          return { staff: arr }
        }),

      // ── ペア制約 ──
      addPair: (pair) =>
        set((state) => {
          const filtered = state.pairs.filter(
            (p) =>
              !(
                (p.staff_a_id === pair.staff_a_id && p.staff_b_id === pair.staff_b_id) ||
                (p.staff_a_id === pair.staff_b_id && p.staff_b_id === pair.staff_a_id)
              )
          )
          return { pairs: [...filtered, { ...pair, id: `pair_${Date.now()}` }] }
        }),

      removePair: (id) =>
        set((state) => ({ pairs: state.pairs.filter((p) => p.id !== id) })),

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
              { ...blankDayCondition(date), ...updates },
            ],
          }
        }),

      // ── スケジュール（月別保存）──
      setScheduleForMonth: (year, month, schedule, summary) =>
        set((state) => {
          const key = monthKey(year, month)
          const prev = state.schedules[key] || {}
          const newSchedules = {
            ...state.schedules,
            [key]: {
              ...prev,
              schedule,
              summary,
            },
          }
          const keys = Object.keys(newSchedules).sort().reverse()
          if (keys.length > MAX_STORED_MONTHS) {
            keys.slice(MAX_STORED_MONTHS).forEach((k) => delete newSchedules[k])
          }
          return {
            schedule,
            summary,
            schedules: newSchedules,
            locks: prev.locks || {},
            notes: prev.notes || {},
          }
        }),

      loadScheduleForMonth: (year, month) =>
        set((state) => {
          const key = monthKey(year, month)
          const data = state.schedules[key]
          return {
            schedule: data?.schedule ?? null,
            summary: data?.summary ?? null,
            locks: data?.locks ?? {},
            notes: data?.notes ?? {},
          }
        }),

      updateShiftCell: (staffId, date, shiftCode) =>
        set((state) => {
          if (!state.schedule) return state
          const newSchedule = {
            ...state.schedule,
            [staffId]: { ...state.schedule[staffId], [date]: shiftCode },
          }
          // ロック中のセルを編集したらロック値も追従させる
          let newLocks = state.locks
          if (state.locks?.[staffId]?.[date] != null) {
            newLocks = {
              ...state.locks,
              [staffId]: { ...state.locks[staffId], [date]: shiftCode },
            }
          }
          const [y, m] = date.split('-')
          const key = `${y}-${m}`
          return {
            // Undo 用に直前の状態を 1 段階だけ保持
            _cellUndo: {
              date,
              schedule: state.schedule,
              locks: state.locks,
            },
            locks: newLocks,
            schedule: newSchedule,
            schedules: {
              ...state.schedules,
              [key]: {
                ...state.schedules[key],
                schedule: newSchedule,
                locks: newLocks,
              },
            },
          }
        }),

      // ── ロック ──
      toggleLock: (staffId, date) =>
        set((state) => {
          const key = date.slice(0, 7)
          const cur = state.locks[staffId]?.[date]
          const cellCode = state.schedule?.[staffId]?.[date]
          const newLocks = { ...state.locks }
          if (cur != null) {
            // ロック解除
            const map = { ...(newLocks[staffId] || {}) }
            delete map[date]
            if (Object.keys(map).length === 0) delete newLocks[staffId]
            else newLocks[staffId] = map
          } else if (cellCode) {
            // ロック追加（現在のシフトを固定）
            newLocks[staffId] = { ...(newLocks[staffId] || {}), [date]: cellCode }
          }
          return {
            locks: newLocks,
            schedules: {
              ...state.schedules,
              [key]: { ...state.schedules[key], locks: newLocks },
            },
          }
        }),

      clearLocks: () =>
        set((state) => {
          const key = monthKey(state.year, state.month)
          return {
            locks: {},
            schedules: {
              ...state.schedules,
              [key]: { ...state.schedules[key], locks: {} },
            },
          }
        }),

      isLocked: (staffId, date) => !!get().locks?.[staffId]?.[date],

      // ── 日別メモ ──
      setNote: (date, text) =>
        set((state) => {
          const key = date.slice(0, 7)
          const newNotes = { ...state.notes, [date]: text }
          if (!text) delete newNotes[date]
          return {
            notes: newNotes,
            schedules: {
              ...state.schedules,
              [key]: { ...state.schedules[key], notes: newNotes },
            },
          }
        }),

      // ── 前月末シフト取得 ──
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

      // 前月末時点の「連続勤務日数」を算出（月またぎ連勤の抑制用）
      getPrevConsecutiveWork: () => {
        const { year, month, schedules } = get()
        const prevYear = month === 1 ? year - 1 : year
        const prevMonth = month === 1 ? 12 : month - 1
        const key = monthKey(prevYear, prevMonth)
        const prevSchedule = schedules[key]?.schedule
        if (!prevSchedule) return {}

        const lastDay = new Date(prevYear, prevMonth, 0).getDate()
        const WORK = ['D', 'E', 'L', 'N']
        const result = {}
        Object.entries(prevSchedule).forEach(([sid, days]) => {
          let streak = 0
          for (let d = lastDay; d >= 1; d--) {
            const ds = `${monthKey(prevYear, prevMonth)}-${String(d).padStart(2, '0')}`
            if (WORK.includes(days[ds])) streak++
            else break
          }
          if (streak > 0) result[sid] = streak
        })
        return result
      },

      // ── 月の確定ロック ──
      // schedules[key].finalized で「この月は確定済み」を表す
      setMonthFinalized: (year, month, finalized) =>
        set((state) => {
          const key = monthKey(year, month)
          if (!state.schedules[key]) return state
          return {
            schedules: {
              ...state.schedules,
              [key]: { ...state.schedules[key], finalized },
            },
          }
        }),

      isMonthFinalized: (year, month) =>
        !!get().schedules[monthKey(year, month)]?.finalized,

      // ── 希望: スタッフ単位で一括削除 ──
      clearWishesForStaff: (staffId, monthPrefix) =>
        set((state) => ({
          wishes: state.wishes.filter(
            (w) =>
              w.staff_id !== staffId ||
              (monthPrefix && !w.date.startsWith(monthPrefix))
          ),
        })),

      // ── シフトセル編集の Undo ──
      // 直近の updateShiftCell の前状態を保持（1段階）
      _cellUndo: null,
      undoCellEdit: () =>
        set((state) => {
          const u = state._cellUndo
          if (!u) return state
          const key = u.date.slice(0, 7)
          return {
            schedule: u.schedule,
            locks: u.locks,
            schedules: {
              ...state.schedules,
              [key]: {
                ...state.schedules[key],
                schedule: u.schedule,
                locks: u.locks,
              },
            },
            _cellUndo: null,
          }
        }),

      // ── サンプル ──
      loadSampleData: (data) => {
        const { year, month } = get()
        const numDays = new Date(year, month, 0).getDate()
        const dayConditions = []
        for (let d = 1; d <= numDays; d++) {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const existing = data.day_conditions?.find((dc) => dc.date === date)
          dayConditions.push(existing || blankDayCondition(date))
        }
        set({
          staff: (data.staff || []).map(withStaffDefaults),
          wishes: data.wishes || [],
          dayConditions,
          shiftTypes: data.shift_types || DEFAULT_SHIFT_TYPES,
          schedule: null,
          summary: null,
          locks: {},
          notes: {},
        })
      },

      initDayConditions: () => {
        const { year, month, dayConditions } = get()
        const numDays = new Date(year, month, 0).getDate()
        const prefix = `${year}-${String(month).padStart(2, '0')}-`

        const existing = dayConditions.filter((dc) => dc.date.startsWith(prefix))
        if (existing.length === numDays) return

        const otherMonths = dayConditions.filter((dc) => !dc.date.startsWith(prefix))
        const thisMonthConditions = []
        for (let d = 1; d <= numDays; d++) {
          const date = `${prefix}${String(d).padStart(2, '0')}`
          const existingDc = dayConditions.find((dc) => dc.date === date)
          thisMonthConditions.push(existingDc || blankDayCondition(date))
        }
        set({ dayConditions: [...otherMonths, ...thisMonthConditions] })
      },

      clearAll: () =>
        set({
          staff: [],
          wishes: [],
          dayConditions: [],
          pairs: [],
          schedules: {},
          schedule: null,
          summary: null,
          locks: {},
          notes: {},
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        staff: state.staff,
        wishes: state.wishes,
        dayConditions: state.dayConditions,
        pairs: state.pairs,
        year: state.year,
        month: state.month,
        shiftTypes: state.shiftTypes,
        schedules: state.schedules,
      }),
      // 旧データから移行時のスタッフデフォルト補完
      onRehydrateStorage: () => (state) => {
        if (state?.staff) {
          state.staff = state.staff.map(withStaffDefaults)
        }
      },
    }
  )
)

export default useStore
