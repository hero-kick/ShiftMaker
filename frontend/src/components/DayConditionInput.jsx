import React, { useMemo, useState, useEffect } from 'react'
import useStore from '../store/useStore'

const DAY_NAMES_SHORT = ['日', '月', '火', '水', '木', '金', '土']

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= breakpoint
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

export default function DayConditionInput() {
  const { year, month, dayConditions, updateDayCondition, shiftTypes } = useStore()
  const isMobile = useIsMobile()

  // Quick-fill templates
  const [weekdayD, setWeekdayD] = useState(3)
  const [weekdayN, setWeekdayN] = useState(2)
  const [weekendD, setWeekendD] = useState(2)
  const [weekendN, setWeekendN] = useState(1)

  const numDays = new Date(year, month, 0).getDate()

  const days = useMemo(() => {
    const arr = []
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const weekday = new Date(year, month - 1, d).getDay()
      const dc = dayConditions.find((c) => c.date === dateStr) || {
        date: dateStr,
        required_per_shift: { D: 3, N: 2 },
        event_flag: false,
        required_staff_ids: [],
        forbidden_staff_ids: [],
      }
      arr.push({ day: d, date: dateStr, weekday, dc })
    }
    return arr
  }, [year, month, numDays, dayConditions])

  const workShifts = shiftTypes.filter((st) => ['D', 'N'].includes(st.code))

  const handleRequiredChange = (date, code, value) => {
    const existing = dayConditions.find((dc) => dc.date === date)
    const currentRequired = existing?.required_per_shift || { D: 3, N: 2 }
    updateDayCondition(date, {
      required_per_shift: {
        ...currentRequired,
        [code]: Math.max(0, Number(value)),
      },
    })
  }

  const handleEventFlag = (date, checked) => {
    updateDayCondition(date, { event_flag: checked })
  }

  const applyWeekdayTemplate = () => {
    days
      .filter((d) => d.weekday !== 0 && d.weekday !== 6)
      .forEach((d) => {
        updateDayCondition(d.date, {
          required_per_shift: { D: weekdayD, N: weekdayN },
        })
      })
  }

  const applyWeekendTemplate = () => {
    days
      .filter((d) => d.weekday === 0 || d.weekday === 6)
      .forEach((d) => {
        updateDayCondition(d.date, {
          required_per_shift: { D: weekendD, N: weekendN },
        })
      })
  }

  const applyAllTemplate = (dCount, nCount) => {
    days.forEach((d) => {
      updateDayCondition(d.date, {
        required_per_shift: { D: dCount, N: nCount },
      })
    })
  }

  // Summary stats
  const totalD = days.reduce((sum, d) => sum + (d.dc.required_per_shift?.D ?? 3), 0)
  const totalN = days.reduce((sum, d) => sum + (d.dc.required_per_shift?.N ?? 2), 0)

  return (
    <div className="day-condition-input">
      <h2>日別条件設定</h2>
      <p className="section-desc">各日のシフト必要人数を設定します。</p>

      {/* Quick Fill Bar */}
      <div className="card quick-fill-card">
        <h3>一括設定</h3>
        <div className="quick-fill-groups">
          <div className="quick-fill-group">
            <span className="quick-fill-label">平日</span>
            <label>日勤</label>
            <input
              type="number"
              min="0"
              max="20"
              value={weekdayD}
              onChange={(e) => setWeekdayD(Number(e.target.value))}
              className="count-input"
              style={{ borderColor: '#4CAF50' }}
            />
            <label>夜勤</label>
            <input
              type="number"
              min="0"
              max="20"
              value={weekdayN}
              onChange={(e) => setWeekdayN(Number(e.target.value))}
              className="count-input"
              style={{ borderColor: '#9C27B0' }}
            />
            <button className="btn btn-outline-green" onClick={applyWeekdayTemplate}>
              平日に適用
            </button>
          </div>
          <div className="quick-fill-group">
            <span className="quick-fill-label">週末</span>
            <label>日勤</label>
            <input
              type="number"
              min="0"
              max="20"
              value={weekendD}
              onChange={(e) => setWeekendD(Number(e.target.value))}
              className="count-input"
              style={{ borderColor: '#4CAF50' }}
            />
            <label>夜勤</label>
            <input
              type="number"
              min="0"
              max="20"
              value={weekendN}
              onChange={(e) => setWeekendN(Number(e.target.value))}
              className="count-input"
              style={{ borderColor: '#9C27B0' }}
            />
            <button className="btn btn-outline-blue" onClick={applyWeekendTemplate}>
              週末に適用
            </button>
          </div>
          <div className="quick-fill-group">
            <span className="quick-fill-label">全日同一</span>
            <button className="btn btn-outline" onClick={() => applyAllTemplate(weekdayD, weekdayN)}>
              全日に平日値を適用
            </button>
          </div>
        </div>
        <div className="condition-summary">
          月合計 — 日勤: <strong>{totalD}人日</strong> / 夜勤: <strong>{totalN}人日</strong>
        </div>
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
                    {workShifts.map((st) => (
                      <div key={st.code} className="dc-card-field">
                        <label style={{ color: st.color }}>{st.name}</label>
                        <div className="dc-stepper">
                          <button
                            className="dc-stepper-btn"
                            onClick={() => handleRequiredChange(date, st.code, (dc.required_per_shift?.[st.code] ?? (st.code === 'D' ? 3 : 2)) - 1)}
                          >-</button>
                          <span className="dc-stepper-value" style={{ color: st.color }}>
                            {dc.required_per_shift?.[st.code] ?? (st.code === 'D' ? 3 : 2)}
                          </span>
                          <button
                            className="dc-stepper-btn"
                            onClick={() => handleRequiredChange(date, st.code, (dc.required_per_shift?.[st.code] ?? (st.code === 'D' ? 3 : 2)) + 1)}
                          >+</button>
                        </div>
                      </div>
                    ))}
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
                            max="20"
                            value={dc.required_per_shift?.[st.code] ?? (st.code === 'D' ? 3 : 2)}
                            onChange={(e) => handleRequiredChange(date, st.code, e.target.value)}
                            className="count-input"
                            style={{ borderColor: st.color }}
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
