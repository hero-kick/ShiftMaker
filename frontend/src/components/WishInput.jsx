import React, { useState, useMemo, useEffect, useRef } from 'react'
import useStore from '../store/useStore'

const WISH_TYPES = [
  { value: '希望休', label: '希望休', color: '#FF7043' },
  { value: '有給', label: '有給', color: '#2196F3' },
]

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

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

export default function WishInput() {
  const { staff, wishes, addWish, removeWish, year, month } = useStore()
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [selectedWishType, setSelectedWishType] = useState('希望休')
  const [noStaffWarning, setNoStaffWarning] = useState(false)
  const [rangeStart, setRangeStart] = useState(null)
  const pillsRef = useRef(null)
  const isMobile = useIsMobile()

  const numDays = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  useEffect(() => {
    if (selectedStaffId && !staff.find((s) => s.id === selectedStaffId)) {
      setSelectedStaffId('')
    }
  }, [staff, selectedStaffId])

  // Auto-select first staff on mobile if none selected
  useEffect(() => {
    if (isMobile && !selectedStaffId && staff.length > 0) {
      setSelectedStaffId(staff[0].id)
    }
  }, [isMobile, staff, selectedStaffId])

  const wishMap = useMemo(() => {
    const map = {}
    wishes.forEach((w) => {
      if (!map[w.date]) map[w.date] = []
      map[w.date].push(w)
    })
    return map
  }, [wishes])

  const getDateStr = (day) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const handleDayClick = (day, e) => {
    if (!selectedStaffId) {
      setNoStaffWarning(true)
      setTimeout(() => setNoStaffWarning(false), 2500)
      return
    }

    if (e.shiftKey && rangeStart !== null && rangeStart !== day) {
      const from = Math.min(rangeStart, day)
      const to = Math.max(rangeStart, day)
      for (let d = from; d <= to; d++) {
        addWish({ staff_id: selectedStaffId, date: getDateStr(d), type: selectedWishType })
      }
      setRangeStart(null)
      return
    }

    const date = getDateStr(day)
    const existingWish = wishes.find(
      (w) => w.staff_id === selectedStaffId && w.date === date
    )
    if (existingWish) {
      if (existingWish.type === selectedWishType) {
        removeWish(selectedStaffId, date)
      } else {
        addWish({ staff_id: selectedStaffId, date, type: selectedWishType })
      }
    } else {
      addWish({ staff_id: selectedStaffId, date, type: selectedWishType })
    }
    setRangeStart(day)
  }

  const getWishColor = (day) => {
    const date = getDateStr(day)
    const dayWishes = wishMap[date] || []
    if (!selectedStaffId) return null
    const wish = dayWishes.find((w) => w.staff_id === selectedStaffId)
    if (!wish) return null
    const wt = WISH_TYPES.find((t) => t.value === wish.type)
    return wt ? wt.color : null
  }

  const getDayWishDots = (day) => {
    const date = getDateStr(day)
    return wishMap[date] || []
  }

  const calendarCells = []
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null)
  for (let d = 1; d <= numDays; d++) calendarCells.push(d)
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const weeks = []
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7))

  const selectedStaff = staff.find((s) => s.id === selectedStaffId)
  const staffWishes = wishes.filter((w) => w.staff_id === selectedStaffId)
  const kyukuCount = staffWishes.filter((w) => w.type === '希望休').length
  const yukuCount = staffWishes.filter((w) => w.type === '有給').length

  return (
    <div className="wish-input">
      {!isMobile && <h2>希望入力</h2>}

      {/* Controls */}
      <div className={isMobile ? 'wish-controls-mobile' : 'card'}>
        {isMobile ? (
          <>
            {/* Staff pills - horizontal scroll */}
            <div className="staff-pills-wrapper" ref={pillsRef}>
              <div className="staff-pills">
                {staff.map((s) => {
                  const wCount = wishes.filter((w) => w.staff_id === s.id).length
                  const isSelected = selectedStaffId === s.id
                  return (
                    <button
                      key={s.id}
                      className={`staff-pill ${isSelected ? 'staff-pill-active' : ''}`}
                      onClick={() => setSelectedStaffId(s.id)}
                    >
                      <span className="staff-pill-name">{s.name}</span>
                      {wCount > 0 && <span className="staff-pill-count">{wCount}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Wish type + count bar */}
            <div className="wish-mode-bar">
              <div className="wish-type-buttons">
                {WISH_TYPES.map((wt) => (
                  <button
                    key={wt.value}
                    className={`wish-type-btn ${selectedWishType === wt.value ? 'active' : ''}`}
                    style={{
                      borderColor: selectedWishType === wt.value ? wt.color : '#ddd',
                      backgroundColor: selectedWishType === wt.value ? wt.color : 'white',
                      color: selectedWishType === wt.value ? 'white' : wt.color,
                    }}
                    onClick={() => setSelectedWishType(wt.value)}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
              {selectedStaff && (
                <div className="wish-count-mobile">
                  <span style={{ color: '#FF7043' }}>{kyukuCount}</span>
                  <span className="wish-count-sep">/</span>
                  <span style={{ color: '#2196F3' }}>{yukuCount}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="wish-controls">
            <div className="form-group">
              <label>スタッフ選択</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="staff-select"
              >
                <option value="">-- スタッフを選択 --</option>
                {staff.map((s) => {
                  const wCount = wishes.filter((w) => w.staff_id === s.id).length
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.role ? `(${s.role})` : ''}{wCount > 0 ? ` [${wCount}件]` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="form-group">
              <label>希望種別</label>
              <div className="wish-type-buttons">
                {WISH_TYPES.map((wt) => (
                  <button
                    key={wt.value}
                    className={`wish-type-btn ${selectedWishType === wt.value ? 'active' : ''}`}
                    style={{
                      '--wish-color': wt.color,
                      borderColor: selectedWishType === wt.value ? wt.color : '#ddd',
                      backgroundColor: selectedWishType === wt.value ? wt.color : 'white',
                      color: selectedWishType === wt.value ? 'white' : wt.color,
                    }}
                    onClick={() => setSelectedWishType(wt.value)}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>
            {selectedStaff && (
              <div className="wish-count">
                <strong>{selectedStaff.name}</strong> の希望:
                <span style={{ color: '#FF7043', marginLeft: 8 }}>希望休 {kyukuCount}件</span>
                <span style={{ color: '#2196F3', marginLeft: 8 }}>有給 {yukuCount}件</span>
              </div>
            )}
          </div>
        )}
        {noStaffWarning && (
          <p className="inline-warning">スタッフを選択してからカレンダーをクリックしてください</p>
        )}
      </div>

      {/* Calendar */}
      <div className={isMobile ? '' : 'card'}>
        {!isMobile && (
          <h3>
            {year}年{month}月 カレンダー
            {!selectedStaffId && staff.length > 0 ? (
              <span className="hint-inline">← スタッフを選択するとカレンダーで希望を入力できます</span>
            ) : selectedStaffId ? (
              <span className="hint-inline">
                クリック: 1日指定 ／ Shift+クリック: {rangeStart ? `${rangeStart}日から範囲選択中...` : '範囲選択（1日目クリック後）'}
              </span>
            ) : null}
          </h3>
        )}
        {staff.length === 0 ? (
          <p className="empty-msg">先にスタッフを登録してください。</p>
        ) : (
          <div className="calendar">
            <div className="calendar-header">
              {DAY_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={`calendar-day-header ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}
                >
                  {name}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="calendar-week">
                {week.map((day, di) => {
                  if (day === null) {
                    return <div key={`empty-${di}`} className="calendar-cell empty" />
                  }
                  const wishColor = getWishColor(day)
                  const dayWishes = getDayWishDots(day)
                  const isSunday = di === 0
                  const isSaturday = di === 6

                  return (
                    <div
                      key={day}
                      className={`calendar-cell ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''} ${wishColor ? 'has-wish' : ''} ${!selectedStaffId ? 'no-staff-selected' : ''}`}
                      style={wishColor ? { backgroundColor: wishColor + '33', borderColor: wishColor } : {}}
                      onClick={(e) => handleDayClick(day, e)}
                    >
                      <span className="day-number" style={wishColor ? { color: wishColor, fontWeight: 700 } : {}}>
                        {day}
                      </span>
                      {wishColor && (
                        <span className="wish-badge" style={{ backgroundColor: wishColor }}>
                          {wishes.find(
                            (w) => w.staff_id === selectedStaffId && w.date === getDateStr(day)
                          )?.type}
                        </span>
                      )}
                      {!isMobile && (
                        <div className="wish-dots">
                          {dayWishes.slice(0, 5).map((w, i) => {
                            const wt = WISH_TYPES.find((t) => t.value === w.type)
                            return (
                              <span
                                key={i}
                                className="wish-dot"
                                style={{ backgroundColor: wt?.color || '#ccc' }}
                                title={`${staff.find((s) => s.id === w.staff_id)?.name}: ${w.type}`}
                              />
                            )
                          })}
                          {dayWishes.length > 5 && (
                            <span className="wish-dot-more">+{dayWishes.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wish list */}
      <div className="card">
        <h3>希望一覧 ({wishes.length}件)</h3>
        {wishes.length === 0 ? (
          <p className="empty-msg">希望が登録されていません。</p>
        ) : (
          <div className="wish-groups">
            {staff
              .map((s) => ({
                staff: s,
                wishes: wishes
                  .filter((w) => w.staff_id === s.id)
                  .sort((a, b) => a.date.localeCompare(b.date)),
              }))
              .filter((g) => g.wishes.length > 0)
              .map(({ staff: s, wishes: staffWishes }) => (
                <div key={s.id} className="wish-group">
                  <div className="wish-group-header">
                    <span className="wish-group-name">{s.name}</span>
                    {s.role && <span className="wish-group-role">{s.role}</span>}
                    <span className="wish-group-count">{staffWishes.length}件</span>
                  </div>
                  <div className="wish-group-items">
                    {staffWishes.map((w, i) => {
                      const wt = WISH_TYPES.find((t) => t.value === w.type)
                      const d = new Date(w.date)
                      const dayName = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
                      return (
                        <div key={i} className="wish-group-item">
                          <span className="wish-item-date">
                            {w.date.slice(5).replace('-', '/')}
                            <span className={`wish-item-day ${d.getDay() === 0 ? 'sunday' : d.getDay() === 6 ? 'saturday' : ''}`}>({dayName})</span>
                          </span>
                          <span
                            className="badge"
                            style={{ backgroundColor: wt?.color || '#ccc', color: 'white' }}
                          >
                            {w.type}
                          </span>
                          <button
                            className="wish-item-delete"
                            onClick={() => removeWish(w.staff_id, w.date)}
                            title="削除"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
