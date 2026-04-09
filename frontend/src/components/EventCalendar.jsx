import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom'
import useStore from '../store/useStore'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
const EVENT_COLOR = '#E53935'
const EVENT_LIGHT = '#FFEBEE'

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

function EventPanel({ year, month, selectedDay, staff, editName, setEditName, editStaffIds, toggleStaff, onSave, onDelete, onClose, canDelete }) {
  return (
    <>
      <div className="side-panel-header">
        <h3>{month}月{selectedDay}日</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="side-panel-body">
        <div className="form-group">
          <label>イベント名</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="例: 病棟会議、消防訓練"
            className="event-name-input"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>必須出席スタッフ</label>
          <p className="hint-text-sm">チェックしたスタッフはこの日必ず出勤になります</p>
          {staff.length === 0 ? (
            <p className="empty-msg">スタッフが未登録です</p>
          ) : (
            <div className="staff-checkbox-list">
              {staff.map((s) => (
                <label key={s.id} className="staff-checkbox-item">
                  <input
                    type="checkbox"
                    checked={editStaffIds.includes(s.id)}
                    onChange={() => toggleStaff(s.id)}
                  />
                  <span className="staff-checkbox-name">{s.name}</span>
                  {s.role && <span className="staff-checkbox-role">{s.role}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="side-panel-footer">
        <button className="btn btn-primary" onClick={onSave} disabled={editName.trim() === ''}>
          保存
        </button>
        {canDelete && (
          <button className="btn btn-danger" onClick={onDelete}>削除</button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
      </div>
    </>
  )
}

export default function EventCalendar() {
  const { staff, dayConditions, updateDayCondition, year, month } = useStore()
  const [selectedDay, setSelectedDay] = useState(null)
  const [editName, setEditName] = useState('')
  const [editStaffIds, setEditStaffIds] = useState([])
  const isMobile = useIsMobile()

  const numDays = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const getDateStr = (day) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const dcMap = useMemo(() => {
    const map = {}
    dayConditions.forEach((dc) => { map[dc.date] = dc })
    return map
  }, [dayConditions])

  const getEvent = (day) => {
    const dc = dcMap[getDateStr(day)]
    return dc?.event_flag ? dc : null
  }

  const handleDayClick = (day) => {
    const date = getDateStr(day)
    const dc = dcMap[date]
    setSelectedDay(day)
    setEditName(dc?.event_name || '')
    setEditStaffIds(dc?.required_staff_ids || [])
  }

  const handleSave = () => {
    if (!selectedDay) return
    const date = getDateStr(selectedDay)
    const hasEvent = editName.trim() !== ''
    updateDayCondition(date, {
      event_flag: hasEvent,
      event_name: hasEvent ? editName.trim() : null,
      required_staff_ids: hasEvent ? editStaffIds : [],
    })
    setSelectedDay(null)
  }

  const handleDelete = () => {
    if (!selectedDay) return
    const date = getDateStr(selectedDay)
    updateDayCondition(date, {
      event_flag: false,
      event_name: null,
      required_staff_ids: [],
    })
    setSelectedDay(null)
  }

  const toggleStaff = (id) => {
    setEditStaffIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  // Build calendar grid
  const calendarCells = []
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null)
  for (let d = 1; d <= numDays; d++) calendarCells.push(d)
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)
  const weeks = []
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7))

  // All events this month
  const events = dayConditions.filter((dc) => dc.event_flag && dc.event_name)

  const selectedDateStr = selectedDay ? getDateStr(selectedDay) : null
  const selectedDc = selectedDateStr ? dcMap[selectedDateStr] : null

  const panelProps = {
    year, month, selectedDay, staff, editName, setEditName, editStaffIds, toggleStaff,
    onSave: handleSave, onDelete: handleDelete, onClose: () => setSelectedDay(null),
    canDelete: selectedDc?.event_flag,
  }

  return (
    <div className="event-calendar-layout">
      <div className="event-calendar-main">
        <h2>イベント管理</h2>
        {!isMobile && <p className="hint-text">日付をクリックしてイベントを登録できます。イベントに設定したスタッフは、その日必ず出勤するよう制約されます。</p>}

        <div className="card">
          <h3>{year}年{month}月</h3>
          <div className="calendar">
            <div className="calendar-header">
              {DAY_NAMES.map((name, i) => (
                <div key={name} className={`calendar-day-header ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}>
                  {name}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="calendar-week">
                {week.map((day, di) => {
                  if (day === null) return <div key={`e-${di}`} className="calendar-cell empty" />
                  const event = getEvent(day)
                  const isSelected = selectedDay === day
                  const isSunday = di === 0
                  const isSaturday = di === 6
                  return (
                    <div
                      key={day}
                      className={`calendar-cell event-cell ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''} ${isSelected ? 'selected-day' : ''}`}
                      style={event ? { backgroundColor: EVENT_LIGHT, borderColor: EVENT_COLOR } : {}}
                      onClick={() => handleDayClick(day)}
                    >
                      <span
                        className="day-number"
                        style={event ? { color: EVENT_COLOR, fontWeight: 700 } : {}}
                      >
                        {day}
                      </span>
                      {event && (
                        <div className="event-label" style={{ backgroundColor: EVENT_COLOR }}>
                          <span className="event-label-text">{event.event_name}</span>
                        </div>
                      )}
                      {event && event.required_staff_ids.length > 0 && (
                        <div className="event-staff-count">
                          {event.required_staff_ids.length}名
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Event list */}
        {!isMobile && (
          <div className="card">
            <h3>イベント一覧</h3>
            {events.length === 0 ? (
              <p className="empty-msg">イベントが登録されていません。カレンダーの日付をクリックして追加してください。</p>
            ) : (
              <div className="table-wrapper">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>イベント名</th>
                      <th>必須出席スタッフ</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((dc) => (
                        <tr key={dc.date}>
                          <td>{dc.date}</td>
                          <td>
                            <span className="event-name-badge" style={{ backgroundColor: EVENT_COLOR }}>
                              {dc.event_name}
                            </span>
                          </td>
                          <td>
                            {dc.required_staff_ids.length === 0 ? (
                              <span style={{ color: '#999' }}>指定なし</span>
                            ) : (
                              <div className="staff-chips">
                                {dc.required_staff_ids.map((sid) => {
                                  const s = staff.find((st) => st.id === sid)
                                  return s ? (
                                    <span key={sid} className="staff-chip">{s.name}</span>
                                  ) : null
                                })}
                              </div>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => {
                                const day = parseInt(dc.date.split('-')[2])
                                handleDayClick(day)
                              }}
                            >
                              編集
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Mobile event list as cards */}
        {isMobile && events.length > 0 && (
          <div className="card">
            <h3>イベント一覧 ({events.length}件)</h3>
            <div className="event-card-list">
              {events
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((dc) => {
                  const d = new Date(dc.date)
                  const dayNum = d.getDate()
                  const wday = DAY_NAMES[d.getDay()]
                  return (
                    <div
                      key={dc.date}
                      className="event-card"
                      onClick={() => handleDayClick(dayNum)}
                    >
                      <div className="event-card-date">
                        <span className="event-card-day">{dayNum}</span>
                        <span className="event-card-weekday">{wday}</span>
                      </div>
                      <div className="event-card-body">
                        <span className="event-name-badge" style={{ backgroundColor: EVENT_COLOR }}>
                          {dc.event_name}
                        </span>
                        {dc.required_staff_ids.length > 0 && (
                          <div className="staff-chips" style={{ marginTop: 4 }}>
                            {dc.required_staff_ids.map((sid) => {
                              const s = staff.find((st) => st.id === sid)
                              return s ? <span key={sid} className="staff-chip">{s.name}</span> : null
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Side panel */}
      {selectedDay !== null && !isMobile && (
        <div className="event-side-panel">
          <EventPanel {...panelProps} />
        </div>
      )}

      {/* Mobile: Bottom sheet modal */}
      {selectedDay !== null && isMobile && ReactDOM.createPortal(
        <div className="mobile-sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDay(null) }}>
          <div className="mobile-sheet">
            <div className="mobile-sheet-handle" />
            <EventPanel {...panelProps} />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
