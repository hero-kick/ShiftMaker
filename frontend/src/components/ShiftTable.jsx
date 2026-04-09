import React, { useMemo, useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import useStore from '../store/useStore'

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

const DAY_NAMES_SHORT = ['日', '月', '火', '水', '木', '金', '土']
const SHIFT_CODES = ['D', 'N', 'A', 'O', 'Y']
const SHIFT_NAMES = { D: '日勤', N: '夜勤', A: '明け', O: '休み', Y: '有給' }

function exportCSV(staff, schedule, days, year, month) {
  const header = [
    'スタッフ名',
    '役職',
    ...days.map((d) => `${month}/${d.day}(${DAY_NAMES_SHORT[d.weekday]})`),
  ]
  const rows = [header]
  staff.forEach((s) => {
    const staffSchedule = schedule[s.id] || {}
    rows.push([s.name, s.role || '', ...days.map((d) => staffSchedule[d.date] || '')])
  })
  const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `shift_${year}${String(month).padStart(2, '0')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function NightPairView({ staff, schedule, days, shiftTypes }) {
  const nightDays = useMemo(() => {
    return days
      .map((d) => {
        const nurses = staff.filter((s) => (schedule[s.id] || {})[d.date] === 'N')
        return { ...d, nurses }
      })
      .filter((d) => d.nurses.length > 0)
  }, [staff, schedule, days])

  const nColor = shiftTypes.find((s) => s.code === 'N')?.color || '#9C27B0'

  return (
    <div className="night-pair-view">
      <p className="night-pair-desc">
        夜勤が割り当てられている日と担当者の一覧です。
      </p>
      <div className="table-wrapper">
        <table className="night-pair-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>曜日</th>
              <th style={{ color: nColor }}>夜勤担当者</th>
              <th>人数</th>
            </tr>
          </thead>
          <tbody>
            {nightDays.map(({ day, date, weekday, nurses }) => (
              <tr key={date} className={weekday === 0 ? 'sunday-row' : weekday === 6 ? 'saturday-row' : ''}>
                <td className="date-cell">{date.slice(5).replace('-', '/')}</td>
                <td className={`weekday-cell ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''}`}>
                  {DAY_NAMES_SHORT[weekday]}
                </td>
                <td>
                  <div className="nurse-chips">
                    {nurses.map((n) => (
                      <span key={n.id} className="nurse-chip" style={{ borderColor: nColor, color: nColor }}>
                        {n.name}
                        {n.role ? <span className="chip-role">（{n.role}）</span> : ''}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="number-cell">
                  <span className="count-badge" style={{ backgroundColor: nColor }}>
                    {nurses.length}名
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ fontWeight: 700 }}>夜勤日数合計</td>
              <td colSpan={2}>{nightDays.length}日</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function PersonalView({ staff, schedule, days, shiftColorMap, wishes, year, month }) {
  const [staffIndex, setStaffIndex] = useState(0)

  useEffect(() => {
    if (staffIndex >= staff.length) setStaffIndex(Math.max(0, staff.length - 1))
  }, [staff, staffIndex])

  const selectedStaff = staff[staffIndex]
  const selectedStaffId = selectedStaff?.id || ''
  const staffSchedule = schedule[selectedStaffId] || {}

  const goPrev = () => setStaffIndex((i) => (i > 0 ? i - 1 : staff.length - 1))
  const goNext = () => setStaffIndex((i) => (i < staff.length - 1 ? i + 1 : 0))

  // Shift stats for this person
  const shifts = Object.values(staffSchedule)
  const stats = {
    D: shifts.filter((s) => s === 'D').length,
    N: shifts.filter((s) => s === 'N').length,
    O: shifts.filter((s) => s === 'O').length,
  }

  return (
    <div className="personal-view">
      {/* Staff selector - prev/next on mobile */}
      <div className="personal-nav">
        <button className="personal-nav-btn" onClick={goPrev}>&lt;</button>
        <div className="personal-nav-center">
          <span className="personal-nav-name">{selectedStaff?.name || '-'}</span>
          {selectedStaff?.role && <span className="personal-nav-role">{selectedStaff.role}</span>}
          <div className="personal-nav-stats">
            <span style={{ color: shiftColorMap.D || '#4CAF50' }}>D:{stats.D}</span>
            <span style={{ color: shiftColorMap.N || '#9C27B0' }}>N:{stats.N}</span>
            <span style={{ color: shiftColorMap.O || '#9E9E9E' }}>O:{stats.O}</span>
          </div>
        </div>
        <button className="personal-nav-btn" onClick={goNext}>&gt;</button>
      </div>
      {/* Day cards */}
      <div className="personal-view-list">
        {days.map(({ day, date, weekday }) => {
          const shiftCode = staffSchedule[date] || '-'
          const color = shiftColorMap[shiftCode]
          const wish = wishes.find((w) => w.staff_id === selectedStaffId && w.date === date)
          const isSunday = weekday === 0
          const isSaturday = weekday === 6
          return (
            <div
              key={date}
              className={`personal-day-card ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''} ${wish ? 'has-wish' : ''}`}
              style={color ? { borderTop: `3px solid ${color}`, background: `${color}10` } : {}}
            >
              <div className="personal-day-header">
                <span className="personal-day-num">{day}</span>
                <span className={`personal-day-weekday ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}`}>
                  {DAY_NAMES_SHORT[weekday]}
                </span>
              </div>
              <div
                className="personal-day-shift"
                style={{ color: color || 'var(--text-secondary)' }}
              >
                {shiftCode}
              </div>
              <div className="personal-day-label">{SHIFT_NAMES[shiftCode] || ''}</div>
              {wish && (
                <div
                  className="personal-day-wish"
                  style={{ backgroundColor: wish.type === '有給' ? '#2196F3' : '#FF7043' }}
                >
                  {wish.type}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ShiftTable() {
  const { staff, schedule, shiftTypes, year, month, dayConditions, updateShiftCell, wishes } = useStore()
  const [editingCell, setEditingCell] = useState(null)
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState(isMobile ? 'personal' : 'staff') // 'staff' | 'night' | 'personal'

  const numDays = new Date(year, month, 0).getDate()

  const days = useMemo(() => {
    const arr = []
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const weekday = new Date(year, month - 1, d).getDay()
      arr.push({ day: d, date: dateStr, weekday })
    }
    return arr
  }, [year, month, numDays])

  const shiftColorMap = useMemo(() => {
    const map = {}
    shiftTypes.forEach((st) => { map[st.code] = st.color })
    return map
  }, [shiftTypes])

  const requiredMap = useMemo(() => {
    const map = {}
    dayConditions.forEach((dc) => { map[dc.date] = dc.required_per_shift || {} })
    return map
  }, [dayConditions])

  useEffect(() => {
    if (!editingCell) return
    const close = (e) => {
      if (!e.target.closest('.shift-popover') && !e.target.closest('.shift-code')) {
        setEditingCell(null)
      }
    }
    const closeOnScroll = () => setEditingCell(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [editingCell])

  const handleCellClick = (staffId, date, e) => {
    if (editingCell?.staffId === staffId && editingCell?.date === date) {
      setEditingCell(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setEditingCell({ staffId, date, rect })
    }
  }

  const handleShiftChange = (staffId, date, newCode) => {
    updateShiftCell(staffId, date, newCode)
    setEditingCell(null)
  }

  if (!schedule) {
    return (
      <div className="empty-state-page">
        <div className="empty-state-icon">📅</div>
        <h3 className="empty-state-title">シフトがまだ生成されていません</h3>
        <p className="empty-state-desc">スタッフと希望を入力したら、画面上部の「シフト生成」ボタンを押してください。</p>
        <div className="empty-state-steps">
          <div className="empty-step"><span className="empty-step-num">1</span>スタッフ管理でメンバーを登録</div>
          <div className="empty-step"><span className="empty-step-num">2</span>希望入力で休み・有給を設定</div>
          <div className="empty-step"><span className="empty-step-num">3</span>「シフト生成」を実行</div>
        </div>
      </div>
    )
  }

  const popoverPortal = editingCell?.rect
    ? ReactDOM.createPortal(
        <div
          className="shift-popover"
          style={{
            position: 'fixed',
            top: Math.min(editingCell.rect.bottom + 6, window.innerHeight - 70),
            left: Math.max(10, Math.min(
              editingCell.rect.left + editingCell.rect.width / 2,
              window.innerWidth - 230
            )),
            transform: 'translateX(-50%)',
          }}
        >
          {SHIFT_CODES.map((code) => {
            const c = shiftColorMap[code] || '#9E9E9E'
            const currentCode = (schedule[editingCell.staffId] || {})[editingCell.date] || '-'
            return (
              <button
                key={code}
                className={`shift-popover-btn ${currentCode === code ? 'current' : ''}`}
                style={{
                  backgroundColor: c,
                  boxShadow: currentCode === code ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                }}
                onClick={() => handleShiftChange(editingCell.staffId, editingCell.date, code)}
                title={SHIFT_NAMES[code]}
              >
                {code}
              </button>
            )
          })}
        </div>,
        document.body
      )
    : null

  return (
    <div className="shift-table-container">
      {popoverPortal}
      <div className="table-actions">
        <h2 style={{ margin: 0 }}>
          {year}年{month}月 シフト表
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'staff' ? 'active' : ''}`}
              onClick={() => setViewMode('staff')}
            >
              一覧表示
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'personal' ? 'active' : ''}`}
              onClick={() => setViewMode('personal')}
            >
              個人表示
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'night' ? 'active' : ''}`}
              onClick={() => setViewMode('night')}
            >
              夜勤ペア
            </button>
          </div>
          <button
            className="btn btn-outline"
            onClick={() => exportCSV(staff, schedule, days, year, month)}
          >
            CSV出力
          </button>
          <button className="btn btn-outline print-btn" onClick={() => window.print()}>
            印刷
          </button>
        </div>
      </div>

      <div className="shift-legend print-hide">
        {shiftTypes.map((st) => (
          <span key={st.code} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: st.color }} />
            {st.code}: {st.name}
          </span>
        ))}
      </div>

      {viewMode === 'personal' ? (
        <PersonalView
          staff={staff}
          schedule={schedule}
          days={days}
          shiftColorMap={shiftColorMap}
          wishes={wishes}
          year={year}
          month={month}
        />
      ) : viewMode === 'night' ? (
        <NightPairView
          staff={staff}
          schedule={schedule}
          days={days}
          shiftTypes={shiftTypes}
        />
      ) : (
        <div className="table-wrapper shift-table-wrapper">
          <table className="shift-table">
            <thead>
              <tr>
                <th className="staff-col">スタッフ</th>
                {days.map(({ day, weekday }) => (
                  <th
                    key={day}
                    className={`day-col ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''}`}
                  >
                    <div>{day}</div>
                    <div className="weekday-label">{DAY_NAMES_SHORT[weekday]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const staffSchedule = schedule[s.id] || {}
                return (
                  <tr key={s.id}>
                    <td className="staff-name-cell">
                      <div className="staff-name-main">{s.name}</div>
                      {s.role && <div className="staff-role">{s.role}</div>}
                    </td>
                    {days.map(({ day, date, weekday }) => {
                      const shiftCode = staffSchedule[date] || '-'
                      const color = shiftColorMap[shiftCode]
                      const isEditing = editingCell?.staffId === s.id && editingCell?.date === date

                      return (
                        <td
                          key={day}
                          className={`shift-cell ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''} ${isEditing ? 'shift-cell-editing' : ''}`}
                          style={!isEditing && color ? { backgroundColor: color + '28', borderBottomColor: color } : {}}
                        >
                          <span
                            className={`shift-code ${isEditing ? 'shift-code-active' : ''}`}
                            style={color ? { color, fontWeight: 700 } : {}}
                            onClick={(e) => handleCellClick(s.id, date, e)}
                          >
                            {shiftCode}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="summary-row">
                <td className="staff-name-cell">実績（日勤）</td>
                {days.map(({ day, date }) => {
                  const dCount = staff.filter((s) => (schedule[s.id] || {})[date] === 'D').length
                  const dReq = requiredMap[date]?.D ?? 3
                  const shortage = dCount < dReq
                  return (
                    <td
                      key={day}
                      className="shift-cell count-cell"
                      style={shortage ? { color: '#D32F2F', fontWeight: 700 } : {}}
                      title={shortage ? `必要${dReq}人 / 実際${dCount}人` : `${dCount}人`}
                    >
                      {dCount > 0 ? dCount : ''}
                      {shortage && <span className="shortage-mark">!</span>}
                    </td>
                  )
                })}
              </tr>
              <tr className="summary-row night-summary">
                <td className="staff-name-cell">実績（夜勤）</td>
                {days.map(({ day, date }) => {
                  const nCount = staff.filter((s) => (schedule[s.id] || {})[date] === 'N').length
                  const nReq = requiredMap[date]?.N ?? 2
                  const shortage = nCount < nReq
                  return (
                    <td
                      key={day}
                      className="shift-cell count-cell"
                      style={shortage ? { color: '#D32F2F', fontWeight: 700 } : {}}
                      title={shortage ? `必要${nReq}人 / 実際${nCount}人` : `${nCount}人`}
                    >
                      {nCount > 0 ? nCount : ''}
                      {shortage && <span className="shortage-mark">!</span>}
                    </td>
                  )
                })}
              </tr>
              <tr className="summary-row required-row">
                <td className="staff-name-cell req-label">必要（日勤）</td>
                {days.map(({ day, date }) => (
                  <td key={day} className="shift-cell count-cell req-cell">
                    {requiredMap[date]?.D ?? 3}
                  </td>
                ))}
              </tr>
              <tr className="summary-row required-row night-required">
                <td className="staff-name-cell req-label">必要（夜勤）</td>
                {days.map(({ day, date }) => (
                  <td key={day} className="shift-cell count-cell req-cell">
                    {requiredMap[date]?.N ?? 2}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
