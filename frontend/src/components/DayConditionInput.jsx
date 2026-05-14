import React, { useMemo, useState } from 'react'
import useStore from '../store/useStore'
import useIsMobile from '../hooks/useIsMobile'
import { defaultRequiredForDate, blankDayCondition, QUICK_FILL_DEFAULTS } from '../defaults'

const DAY_NAMES_SHORT = ['日', '月', '火', '水', '木', '金', '土']

export default function DayConditionInput() {
  const { year, month, dayConditions, updateDayCondition, shiftTypes } = useStore()
  const isMobile = useIsMobile()

  // 早番・遅番の必要人数も設定するか（多くの病棟は日勤・夜勤のみなので既定は非表示）
  const [showEarlyLate, setShowEarlyLate] = useState(false)

  // 一括設定の値（基本構成: 平日 D8/N2・土曜 D5/N2・日曜 D3/N2）
  const [weekdayD, setWeekdayD] = useState(QUICK_FILL_DEFAULTS.weekday.D)
  const [weekdayN, setWeekdayN] = useState(QUICK_FILL_DEFAULTS.weekday.N)
  const [satD, setSatD] = useState(QUICK_FILL_DEFAULTS.saturday.D)
  const [satN, setSatN] = useState(QUICK_FILL_DEFAULTS.saturday.N)
  const [sunD, setSunD] = useState(QUICK_FILL_DEFAULTS.sunday.D)
  const [sunN, setSunN] = useState(QUICK_FILL_DEFAULTS.sunday.N)

  const numDays = new Date(year, month, 0).getDate()

  const days = useMemo(() => {
    const arr = []
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const weekday = new Date(year, month - 1, d).getDay()
      const dc = dayConditions.find((c) => c.date === dateStr) || blankDayCondition(dateStr)
      arr.push({ day: d, date: dateStr, weekday, dc })
    }
    return arr
  }, [year, month, numDays, dayConditions])

  // 表示対象シフト: 既定は日勤・夜勤。トグルで早番・遅番を追加。
  const visibleCodes = showEarlyLate ? ['D', 'E', 'L', 'N'] : ['D', 'N']
  const workShifts = visibleCodes
    .map((code) => shiftTypes.find((st) => st.code === code))
    .filter(Boolean)

  // その日付の「基本値」。D/N は曜日で変わる（平日8/土5/日3）。E/L は基本0。
  const defaultFor = (date, code) => {
    const base = defaultRequiredForDate(date)
    return base[code] ?? 0
  }

  const handleRequiredChange = (date, code, value) => {
    const existing = dayConditions.find((dc) => dc.date === date)
    const currentRequired = existing?.required_per_shift || defaultRequiredForDate(date)
    const n = Number(value)
    const safe = Number.isFinite(n) ? Math.max(0, Math.min(80, Math.round(n))) : 0
    updateDayCondition(date, {
      required_per_shift: {
        ...currentRequired,
        [code]: safe,
      },
    })
  }

  const handleEventFlag = (date, checked) => {
    updateDayCondition(date, { event_flag: checked })
  }

  // 既存の required_per_shift を保ちつつ D/N だけ上書き（E/L 設定を消さない）
  const applyToDays = (filterFn, dCount, nCount) => {
    days.filter(filterFn).forEach((d) => {
      const cur = d.dc.required_per_shift || {}
      updateDayCondition(d.date, {
        required_per_shift: { ...cur, D: dCount, N: nCount },
      })
    })
  }

  const applyWeekdayTemplate = () =>
    applyToDays((d) => d.weekday >= 1 && d.weekday <= 5, weekdayD, weekdayN)
  const applySaturdayTemplate = () =>
    applyToDays((d) => d.weekday === 6, satD, satN)
  const applySundayTemplate = () =>
    applyToDays((d) => d.weekday === 0, sunD, sunN)

  // 基本構成（平日8/土5/日3・夜勤2）を一括適用
  const applyBasicTemplate = () => {
    days.forEach((d) => {
      const base = defaultRequiredForDate(d.date)
      const cur = d.dc.required_per_shift || {}
      updateDayCondition(d.date, {
        required_per_shift: { ...cur, ...base },
      })
    })
  }

  // Summary stats
  const totalD = days.reduce(
    (sum, d) => sum + (d.dc.required_per_shift?.D ?? defaultRequiredForDate(d.date).D), 0
  )
  const totalN = days.reduce(
    (sum, d) => sum + (d.dc.required_per_shift?.N ?? defaultRequiredForDate(d.date).N), 0
  )

  return (
    <div className="day-condition-input">
      <h2>日別条件設定</h2>
      <p className="section-desc">各日のシフト必要人数を設定します。</p>

      {/* Quick Fill Bar */}
      <div className="card quick-fill-card">
        <h3>一括設定</h3>
        <p className="hint-text-sm">
          基本構成: 平日 日勤8・夜勤2 / 土曜 日勤5・夜勤2 / 日曜 日勤3・夜勤2
        </p>
        <div className="quick-fill-groups">
          {[
            { key: 'wd', label: '平日', d: weekdayD, sd: setWeekdayD, n: weekdayN, sn: setWeekdayN, apply: applyWeekdayTemplate, cls: 'btn-outline-green' },
            { key: 'sat', label: '土曜', d: satD, sd: setSatD, n: satN, sn: setSatN, apply: applySaturdayTemplate, cls: 'btn-outline-blue' },
            { key: 'sun', label: '日曜', d: sunD, sd: setSunD, n: sunN, sn: setSunN, apply: applySundayTemplate, cls: 'btn-outline-blue' },
          ].map((g) => (
            <div className="quick-fill-group" key={g.key}>
              <span className="quick-fill-label">{g.label}</span>
              <label>日勤</label>
              <input
                type="number" min="0" max="80"
                value={g.d}
                onChange={(e) => g.sd(Math.max(0, Math.min(80, Number(e.target.value) || 0)))}
                className="count-input"
                style={{ borderColor: '#4CAF50' }}
                aria-label={`${g.label}の日勤人数`}
              />
              <label>夜勤</label>
              <input
                type="number" min="0" max="80"
                value={g.n}
                onChange={(e) => g.sn(Math.max(0, Math.min(80, Number(e.target.value) || 0)))}
                className="count-input"
                style={{ borderColor: '#9C27B0' }}
                aria-label={`${g.label}の夜勤人数`}
              />
              <button className={`btn ${g.cls}`} onClick={g.apply}>
                {g.label}に適用
              </button>
            </div>
          ))}
          <div className="quick-fill-group">
            <span className="quick-fill-label">基本構成</span>
            <button className="btn btn-outline" onClick={applyBasicTemplate}>
              基本構成を全日に適用
            </button>
          </div>
        </div>
        <div className="condition-summary">
          月合計 — 日勤: <strong>{totalD}人日</strong> / 夜勤: <strong>{totalN}人日</strong>
        </div>
        <label className="dc-toggle-earlylate">
          <input
            type="checkbox"
            checked={showEarlyLate}
            onChange={(e) => setShowEarlyLate(e.target.checked)}
          />
          早番・遅番の必要人数も設定する
        </label>
      </div>

      <div className="card">
        {isMobile ? (
          /* Mobile: Card layout */
          <div className="dc-card-list">
            {days.map(({ day, date, weekday, dc }) => {
              const isSunday = weekday === 0
              const isSaturday = weekday === 6
              return (
                <div
                  key={date}
                  className={`dc-card ${isSunday ? 'dc-card-sunday' : ''} ${isSaturday ? 'dc-card-saturday' : ''}`}
                >
                  <div className="dc-card-date">
                    <span className="dc-card-day">{day}</span>
                    <span className={`dc-card-weekday ${isSunday ? 'sunday' : isSaturday ? 'saturday' : ''}`}>
                      {DAY_NAMES_SHORT[weekday]}
                    </span>
                  </div>
                  <div className="dc-card-inputs">
                    {workShifts.map((st) => {
                      const cur = dc.required_per_shift?.[st.code] ?? defaultFor(date, st.code)
                      return (
                      <div key={st.code} className="dc-card-field">
                        <label style={{ color: st.color }}>{st.name}</label>
                        <div className="dc-stepper">
                          <button
                            className="dc-stepper-btn"
                            onClick={() => handleRequiredChange(date, st.code, cur - 1)}
                            aria-label={`${st.name}を1人減らす`}
                          >-</button>
                          <span className="dc-stepper-value" style={{ color: st.color }}>
                            {cur}
                          </span>
                          <button
                            className="dc-stepper-btn"
                            onClick={() => handleRequiredChange(date, st.code, cur + 1)}
                            aria-label={`${st.name}を1人増やす`}
                          >+</button>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Desktop: Table layout */
          <div className="table-wrapper">
            <table className="day-condition-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>曜日</th>
                  {workShifts.map((st) => (
                    <th key={st.code} style={{ color: st.color }}>
                      {st.name}({st.code}) 必要人数
                    </th>
                  ))}
                  <th>特別日</th>
                </tr>
              </thead>
              <tbody>
                {days.map(({ day, date, weekday, dc }) => {
                  const isSunday = weekday === 0
                  const isSaturday = weekday === 6
                  return (
                    <tr
                      key={date}
                      className={isSunday ? 'sunday-row' : isSaturday ? 'saturday-row' : ''}
                    >
                      <td className="date-cell">
                        {month}/{day}
                      </td>
                      <td className={`weekday-cell ${isSunday ? 'sunday' : isSaturday ? 'saturday' : ''}`}>
                        {DAY_NAMES_SHORT[weekday]}
                      </td>
                      {workShifts.map((st) => (
                        <td key={st.code} className="number-cell">
                          <input
                            type="number"
                            min="0"
                            max="80"
                            value={dc.required_per_shift?.[st.code] ?? defaultFor(date, st.code)}
                            onChange={(e) => handleRequiredChange(date, st.code, e.target.value)}
                            className="count-input"
                            style={{ borderColor: st.color }}
                            aria-label={`${month}月${day}日 ${st.name}の必要人数`}
                          />
                        </td>
                      ))}
                      <td className="event-cell">
                        <input
                          type="checkbox"
                          checked={dc.event_flag || false}
                          onChange={(e) => handleEventFlag(date, e.target.checked)}
                          title="特別日フラグ"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
