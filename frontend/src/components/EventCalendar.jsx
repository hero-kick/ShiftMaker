import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom'
import useStore from '../store/useStore'
import useIsMobile from '../hooks/useIsMobile'
import useModalA11y from '../hooks/useModalA11y'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
const EVENT_COLOR = '#E53935'
const EVENT_LIGHT = '#FFEBEE'

function EventPanel({
  year, month, selectedDay, staff,
  editName, setEditName,
  editStaffIds, toggleStaff,
  editForbiddenIds, toggleForbidden,
  onSave, onDelete, onClose, canDelete,
}) {
  // 同じスタッフが必須出勤 と 絶対休み の両方に入らないようにする
  const hasConflict = editStaffIds.some((id) => editForbiddenIds.includes(id))
  const canSave = editName.trim() !== '' || editStaffIds.length > 0 || editForbiddenIds.length > 0
  return (
    <>
      <div className="side-panel-header">
        <h3>{month}月{selectedDay}日</h3>
        <button className="close-btn" onClick={onClose} aria-label="閉じる">✕</button>
      </div>
      <div className="side-panel-body">
        <div className="form-group">
          <label>イベント名（任意）</label>
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
          <label>この日 必ず出勤するスタッフ</label>
          <p className="hint-text-sm">チェックしたスタッフはこの日 必ず出勤になります（休み・有給にならない）</p>
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
        <div className="form-group">
          <label>この日 絶対に休みにするスタッフ</label>
          <p className="hint-text-sm">チェックしたスタッフはこの日 必ず休み（O）になります。確実に休ませたい時に使います</p>
          {staff.length === 0 ? (
            <p className="empty-msg">スタッフが未登録です</p>
          ) : (
            <div className="staff-checkbox-list">
              {staff.map((s) => (
                <label key={s.id} className="staff-checkbox-item staff-checkbox-forbidden">
                  <input
                    type="checkbox"
                    checked={editForbiddenIds.includes(s.id)}
                    onChange={() => toggleForbidden(s.id)}
                  />
                  <span className="staff-checkbox-name">{s.name}</span>
                  {s.role && <span className="staff-checkbox-role">{s.role}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        {hasConflict && (
          <p className="error-msg">
            同じスタッフを「必ず出勤」と「絶対休み」の両方に指定することはできません
          </p>
        )}
      </div>
      <div className="side-panel-footer">
        <button className="btn btn-primary" onClick={onSave} disabled={!canSave || hasConflict}>
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
  const [editForbiddenIds, setEditForbiddenIds] = useState([])
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
    setEditForbiddenIds(dc?.forbidden_staff_ids || [])
  }

  const handleSave = () => {
    if (!selectedDay) return
    const date = getDateStr(selectedDay)
    // イベント名がある、または必須出勤/絶対休みが1人でも居れば「特別日」とみなす
    const hasContent =
      editName.trim() !== '' || editStaffIds.length > 0 || editForbiddenIds.length > 0
    updateDayCondition(date, {
      event_flag: hasContent,
      event_name: editName.trim() || null,
      required_staff_ids: editStaffIds,
      forbidden_staff_ids: editForbiddenIds,
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
      forbidden_staff_ids: [],
    })
    setSelectedDay(null)
  }

  const toggleStaff = (id) => {
    setEditStaffIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const toggleForbidden = (id) => {
    setEditForbiddenIds((prev) =>
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
    year, month, selectedDay, staff,
    editName, setEditName,
    editStaffIds, toggleStaff,
    editForbiddenIds, toggleForbidden,
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
                          <span className="event-label-text">
                            {event.event_name || '休み/出勤 指定'}
                          </span>
                        </div>
                      )}
                      {event && (
                        <div className="event-staff-count">
                          {event.required_staff_ids?.length > 0 && (
                            <span title="必ず出勤">出{event.required_staff_ids.length}</span>
                          )}
                          {event.forbidden_staff_ids?.length > 0 && (
                            <span title="絶対休み" style={{ marginLeft: 4 }}>
                              休{event.forbidden_staff_ids.length}
                            </span>
                          )}
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
                      <th>必ず出勤</th>
                      <th>絶対休み</th>
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
                            {dc.event_name ? (
                              <span className="event-name-badge" style={{ backgroundColor: EVENT_COLOR }}>
                                {dc.event_name}
                              </span>
                            ) : (
                              <span style={{ color: '#999' }}>（名前なし）</span>
                            )}
                          </td>
                          <td>
                            {(dc.required_staff_ids || []).length === 0 ? (
                              <span style={{ color: '#999' }}>—</span>
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
                            {(dc.forbidden_staff_ids || []).length === 0 ? (
                              <span style={{ color: '#999' }}>—</span>
                            ) : (
                              <div className="staff-chips">
                                {dc.forbidden_staff_ids.map((sid) => {
                                  const s = staff.find((st) => st.id === sid)
                                  return s ? (
                                    <span key={sid} className="staff-chip staff-chip-off">{s.name}</span>
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
                  // タイムゾーン非依存で曜日算出
                  const [ey, em, ed] = dc.date.split('-').map(Number)
                  const dayNum = ed
                  const wday = DAY_NAMES[new Date(ey, em - 1, ed).getDay()]
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
                          {dc.event_name || '休み/出勤 指定'}
                        </span>
                        {dc.required_staff_ids?.length > 0 && (
                          <div className="staff-chips" style={{ marginTop: 4 }}>
                            <span className="chip-label">出勤:</span>
                            {dc.required_staff_ids.map((sid) => {
                              const s = staff.find((st) => st.id === sid)
                              return s ? <span key={sid} className="staff-chip">{s.name}</span> : null
                            })}
                          </div>
                        )}
                        {dc.forbidden_staff_ids?.length > 0 && (
                          <div className="staff-chips" style={{ marginTop: 4 }}>
                            <span className="chip-label">休み:</span>
                            {dc.forbidden_staff_ids.map((sid) => {
                              const s = staff.find((st) => st.id === sid)
                              return s ? <span key={sid} className="staff-chip staff-chip-off">{s.name}</span> : null
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
      {selectedDay !== null && isMobile && (
        <EventSheet onClose={() => setSelectedDay(null)} panelProps={panelProps} />
      )}
    </div>
  )
}

// モバイル用ボトムシート（Escで閉じる・フォーカストラップ付き）
function EventSheet({ onClose, panelProps }) {
  const sheetRef = useModalA11y(true, onClose)
  return ReactDOM.createPortal(
    <div
      className="mobile-sheet-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mobile-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="イベント編集"
      >
        <div className="mobile-sheet-handle" />
        <EventPanel {...panelProps} />
      </div>
    </div>,
    document.body
  )
}
