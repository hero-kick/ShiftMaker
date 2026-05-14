import React, { useMemo, useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import useStore from '../store/useStore'
import useIsMobile from '../hooks/useIsMobile'
import useModalA11y from '../hooks/useModalA11y'
import { defaultRequiredForDate } from '../defaults'
import { IconLock, IconPin, IconNote, IconWarning, ShiftIcon } from './Icons'

const DAY_NAMES_SHORT = ['日', '月', '火', '水', '木', '金', '土']
const SHIFT_CODES = ['D', 'E', 'N', 'A', 'L', 'O', 'Y']
const SHIFT_NAMES = { D: '日勤', E: '早番', N: '夜勤', A: '明け', L: '遅番', O: '休日', Y: '有給' }

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
  const csv = '﻿' + rows.map((r) => r.join(',')).join('\n')
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

/**
 * 制約違反の検出（手動編集に対するリアルタイム警告用）
 * 返り値: { byCell: Map "sid-date" -> [warnings], total: number }
 */
function detectViolations(staff, schedule, days, dayConditions) {
  const byCell = new Map()
  const add = (sid, date, msg, severity = 'warn') => {
    const k = `${sid}-${date}`
    const arr = byCell.get(k) || []
    arr.push({ msg, severity })
    byCell.set(k, arr)
  }
  if (!schedule) return { byCell, total: 0 }

  const dateList = days.map((d) => d.date)
  const dateIndex = Object.fromEntries(dateList.map((d, i) => [d, i]))

  // N→A の連鎖
  staff.forEach((s) => {
    const sched = schedule[s.id] || {}
    dateList.forEach((d, i) => {
      if (sched[d] === 'N' && i + 1 < dateList.length) {
        const next = sched[dateList[i + 1]]
        if (next !== 'A') add(s.id, d, `翌日が${SHIFT_NAMES[next] || '?'}（明けにする必要）`, 'danger')
      }
      if (sched[d] === 'A' && i > 0) {
        const prev = sched[dateList[i - 1]]
        if (prev !== 'N') add(s.id, d, `前日が${SHIFT_NAMES[prev] || '?'}（明けは夜勤翌日のみ）`, 'danger')
      }
    })
    // 夜勤不可スタッフが N/A
    if (!s.night_available) {
      dateList.forEach((d) => {
        if (sched[d] === 'N') add(s.id, d, '夜勤不可スタッフです', 'danger')
        if (sched[d] === 'A') add(s.id, d, '夜勤不可スタッフです', 'danger')
      })
    }
    // 連続夜勤上限
    const maxCN = s.max_consecutive_nights || 2
    let streak = 0
    dateList.forEach((d) => {
      if (sched[d] === 'N') {
        streak++
        if (streak > maxCN) add(s.id, d, `連続夜勤が ${streak} 回（上限 ${maxCN}）`, 'warn')
      } else {
        streak = 0
      }
    })
    // 連勤上限
    const maxC = s.max_consecutive_days || 5
    let workStreak = 0
    dateList.forEach((d) => {
      const c = sched[d]
      if (c === 'D' || c === 'E' || c === 'L' || c === 'N') {
        workStreak++
        if (workStreak > maxC) add(s.id, d, `連勤が ${workStreak} 日（上限 ${maxC}）`, 'warn')
      } else if (c === 'A') {
        // A は連勤の流れの中ではある（休みではない）が、別系統。リセット弱め。
      } else {
        workStreak = 0
      }
    })
    // 月の夜勤上限
    const nightCount = dateList.filter((d) => sched[d] === 'N').length
    if (nightCount > s.max_night) {
      const lastN = [...dateList].reverse().find((d) => sched[d] === 'N')
      if (lastN) add(s.id, lastN, `今月の夜勤 ${nightCount} 回（上限 ${s.max_night}）`, 'warn')
    }
  })

  // 必要人数充足
  const reqByDate = {}
  dayConditions.forEach((dc) => { reqByDate[dc.date] = dc.required_per_shift || {} })
  dateList.forEach((d) => {
    const base = defaultRequiredForDate(d)
    const reqD = reqByDate[d]?.D ?? base.D
    const reqN = reqByDate[d]?.N ?? base.N
    const dCount = staff.filter((s) => schedule[s.id]?.[d] === 'D').length
    const nCount = staff.filter((s) => schedule[s.id]?.[d] === 'N').length
    if (dCount < reqD) {
      staff.forEach((s) => {
        if (schedule[s.id]?.[d] === 'D') {
          add(s.id, d, `日勤 ${dCount}/${reqD}人（不足）`, 'warn')
        }
      })
    }
    if (nCount < reqN) {
      staff.forEach((s) => {
        if (schedule[s.id]?.[d] === 'N') {
          add(s.id, d, `夜勤 ${nCount}/${reqN}人（不足）`, 'warn')
        }
      })
    }
  })

  let total = 0
  byCell.forEach((arr) => { total += arr.length })
  return { byCell, total }
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

function PersonalView({ staff, schedule, days, shiftColorMap, wishes, year, month, locks }) {
  const [staffIndex, setStaffIndex] = useState(0)

  useEffect(() => {
    if (staffIndex >= staff.length) setStaffIndex(Math.max(0, staff.length - 1))
  }, [staff, staffIndex])

  const selectedStaff = staff[staffIndex]
  const selectedStaffId = selectedStaff?.id || ''
  const staffSchedule = schedule[selectedStaffId] || {}
  const staffLocks = locks?.[selectedStaffId] || {}

  const goPrev = () => setStaffIndex((i) => (i > 0 ? i - 1 : staff.length - 1))
  const goNext = () => setStaffIndex((i) => (i < staff.length - 1 ? i + 1 : 0))

  const shifts = Object.values(staffSchedule)
  const stats = {
    D: shifts.filter((s) => s === 'D').length,
    N: shifts.filter((s) => s === 'N').length,
    A: shifts.filter((s) => s === 'A').length,
    O: shifts.filter((s) => s === 'O').length,
    Y: shifts.filter((s) => s === 'Y').length,
  }

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  days.forEach((d) => cells.push(d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const wishColor = (wishType) => {
    if (wishType === '有給') return '#2196F3'
    if (wishType === '出勤') return '#22863a'
    return '#FF7043'
  }

  return (
    <div className="personal-view">
      {/* 印刷時のみ表示される見出し（誰の・いつのシフトか） */}
      <div className="personal-print-title">
        {year}年{month}月 シフト表 — {selectedStaff?.name || ''}
        {selectedStaff?.role ? `（${selectedStaff.role}）` : ''}
      </div>
      <div className="personal-nav">
        <button className="personal-nav-btn" onClick={goPrev} aria-label="前のスタッフ">&lt;</button>
        <div className="personal-nav-center">
          <span className="personal-nav-name">{selectedStaff?.name || '-'}</span>
          {selectedStaff?.role && <span className="personal-nav-role">{selectedStaff.role}</span>}
          <div className="personal-nav-stats">
            <span style={{ color: shiftColorMap.D || '#4CAF50' }}>日勤 {stats.D}</span>
            <span style={{ color: shiftColorMap.N || '#9C27B0' }}>夜勤 {stats.N}</span>
            <span style={{ color: shiftColorMap.A || '#FF9800' }}>明け {stats.A}</span>
            <span style={{ color: shiftColorMap.O || '#9E9E9E' }}>休み {stats.O}</span>
            {stats.Y > 0 && (
              <span style={{ color: shiftColorMap.Y || '#2196F3' }}>有給 {stats.Y}</span>
            )}
          </div>
        </div>
        <button className="personal-nav-btn" onClick={goNext} aria-label="次のスタッフ">&gt;</button>
      </div>

      <div className="personal-print-row print-hide">
        <span className="personal-print-hint">
          {selectedStaff?.name} さん個人のシフトを印刷・PDF保存できます
        </span>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => window.print()}
          title="この個人カレンダーを印刷（ブラウザのPDF保存も可）"
        >
          この人のシフトを印刷
        </button>
      </div>

      <div className="personal-calendar">
        <div className="personal-calendar-header">
          {DAY_NAMES_SHORT.map((name, i) => (
            <div
              key={i}
              className={`personal-cal-head ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}
            >
              {name}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="personal-calendar-week">
            {week.map((cell, di) => {
              if (cell === null) {
                return <div key={`empty-${wi}-${di}`} className="personal-day-card empty" />
              }
              const { day, date, weekday } = cell
              const shiftCode = staffSchedule[date] || '-'
              const color = shiftColorMap[shiftCode]
              const wish = wishes.find((w) => w.staff_id === selectedStaffId && w.date === date)
              const isSunday = weekday === 0
              const isSaturday = weekday === 6
              const isLocked = !!staffLocks[date]
              return (
                <div
                  key={date}
                  className={`personal-day-card ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''} ${wish ? 'has-wish' : ''}`}
                  style={color ? { borderTop: `3px solid ${color}`, background: `${color}10` } : {}}
                >
                  <div className="personal-day-header">
                    <span className="personal-day-num">{day}</span>
                    {isLocked && <span className="personal-day-lock" title="ロック中"><IconLock size={14} /></span>}
                  </div>
                  <div className="personal-day-icon">
                    <ShiftIcon code={shiftCode} size={30} />
                  </div>
                  <div
                    className="personal-day-shift-name"
                    style={{ color: color || 'var(--text-secondary)' }}
                  >
                    {SHIFT_NAMES[shiftCode] || '-'}
                  </div>
                  {wish && (
                    <div
                      className="personal-day-wish"
                      style={{ backgroundColor: wishColor(wish.type) }}
                    >
                      {wish.type}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// メモ編集モーダル（Escで閉じる・フォーカストラップ付き）
function NoteModal({ noteEditing, setNoteEditing, setNote }) {
  const close = () => setNoteEditing(null)
  const modalRef = useModalA11y(true, close)
  return ReactDOM.createPortal(
    <div className="note-overlay" onClick={close}>
      <div
        className="note-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${noteEditing.date.slice(5).replace('-', '/')} のメモ編集`}
      >
        <div className="note-modal-title">
          {noteEditing.date.slice(5).replace('-', '/')} のメモ
        </div>
        {noteEditing.event && (
          <div className="note-modal-event">★ {noteEditing.event}</div>
        )}
        <textarea
          className="note-modal-text"
          placeholder="メモ（例: 病棟会議15時から / 申し送り注意 など）"
          value={noteEditing.text}
          onChange={(e) => setNoteEditing({ ...noteEditing, text: e.target.value })}
          rows={4}
        />
        <div className="note-modal-actions">
          {noteEditing.text && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => { setNote(noteEditing.date, ''); close() }}
            >削除</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={close}>キャンセル</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setNote(noteEditing.date, noteEditing.text); close() }}
          >保存</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function ShiftTable() {
  const {
    staff, schedule, shiftTypes, year, month, dayConditions, pairs,
    updateShiftCell, wishes, locks, notes, toggleLock, clearLocks, setNote,
    undoCellEdit, _cellUndo, isMonthFinalized, setMonthFinalized,
  } = useStore()
  const [editingCell, setEditingCell] = useState(null)
  const [noteEditing, setNoteEditing] = useState(null)
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState(isMobile ? 'personal' : 'staff')
  const [showViolations, setShowViolations] = useState(true)

  const finalized = isMonthFinalized(year, month)

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

  const eventMap = useMemo(() => {
    const map = {}
    dayConditions.forEach((dc) => {
      if (dc.event_flag) map[dc.date] = dc.event_name || 'イベント'
    })
    return map
  }, [dayConditions])

  const violations = useMemo(
    () => detectViolations(staff, schedule || {}, days, dayConditions),
    [staff, schedule, days, dayConditions]
  )

  const lockCount = useMemo(
    () => Object.values(locks || {}).reduce((s, m) => s + Object.keys(m).length, 0),
    [locks]
  )

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

  // 編集中セルの背景情報（なぜこのシフトか、を理解する助け）
  const cellInfo = useMemo(() => {
    if (!editingCell) return null
    const { staffId, date } = editingCell
    const s = staff.find((st) => st.id === staffId)
    const day = Number(date.split('-')[2])
    const lines = []
    // 希望
    const w = wishes.find((ww) => ww.staff_id === staffId && ww.date === date)
    if (w) lines.push({ icon: '🙏', text: `本人の希望: ${w.type}` })
    // ペア
    pairs.forEach((p) => {
      let partnerId = null
      if (p.staff_a_id === staffId) partnerId = p.staff_b_id
      else if (p.staff_b_id === staffId) partnerId = p.staff_a_id
      if (partnerId) {
        const partner = staff.find((st) => st.id === partnerId)
        const kind = p.type === 'forbid' ? '夜勤NG' : '同シフト'
        lines.push({ icon: '👥', text: `ペア(${kind}): ${partner?.name || '?'}` })
      }
    })
    // イベント
    const dc = dayConditions.find((d) => d.date === date)
    if (dc?.required_staff_ids?.includes(staffId)) lines.push({ icon: '★', text: 'イベント: 必ず出勤' })
    if (dc?.forbidden_staff_ids?.includes(staffId)) lines.push({ icon: '★', text: 'イベント: 絶対休み' })
    // 固定休曜日
    const wd = new Date(year, month - 1, day).getDay() // 0=日
    const wdMonFirst = wd === 0 ? 6 : wd - 1
    if (s?.fixed_off_weekdays?.includes(wdMonFirst)) {
      lines.push({ icon: '🗓', text: '固定休の曜日' })
    }
    // その日の必要人数 vs 実績
    const reqD = requiredMap[date]?.D ?? defaultRequiredForDate(date).D
    const reqN = requiredMap[date]?.N ?? defaultRequiredForDate(date).N
    const dCnt = staff.filter((st) => schedule?.[st.id]?.[date] === 'D').length
    const nCnt = staff.filter((st) => schedule?.[st.id]?.[date] === 'N').length
    lines.push({ icon: '📊', text: `この日: 日勤 ${dCnt}/${reqD}・夜勤 ${nCnt}/${reqN}` })
    // 違反
    const v = violations.byCell.get(`${staffId}-${date}`)
    if (v && v.length > 0) {
      v.forEach((vv) => lines.push({ icon: '⚠', text: vv.msg, warn: true }))
    }
    return { staffName: s?.name || '', day, lines }
  }, [editingCell, staff, wishes, pairs, dayConditions, requiredMap, schedule, violations, year, month])

  const popoverPortal = editingCell?.rect
    ? ReactDOM.createPortal(
        <div
          className="shift-popover"
          style={{
            position: 'fixed',
            top: Math.min(editingCell.rect.bottom + 6, window.innerHeight - 280),
            left: Math.max(10, Math.min(
              editingCell.rect.left + editingCell.rect.width / 2,
              window.innerWidth - 230
            )),
            transform: 'translateX(-50%)',
          }}
        >
          {cellInfo && (
            <div className="shift-popover-info">
              <div className="shift-popover-info-title">
                {cellInfo.staffName} ・ {month}/{cellInfo.day}
              </div>
              {cellInfo.lines.map((ln, i) => (
                <div key={i} className={`shift-popover-info-line ${ln.warn ? 'is-warn' : ''}`}>
                  <span className="spi-icon">{ln.icon}</span>
                  <span>{ln.text}</span>
                </div>
              ))}
            </div>
          )}
          <div className="shift-popover-actions">
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
                  {SHIFT_NAMES[code]}
                </button>
              )
            })}
            <button
              className={`shift-popover-lock ${locks?.[editingCell.staffId]?.[editingCell.date] ? 'is-locked' : ''}`}
              onClick={() => { toggleLock(editingCell.staffId, editingCell.date); setEditingCell(null) }}
              title={locks?.[editingCell.staffId]?.[editingCell.date] ? 'ロックを解除' : 'このセルをロック'}
            >
              <IconLock size={16} />
              {locks?.[editingCell.staffId]?.[editingCell.date] ? 'ロック解除' : 'ロック'}
            </button>
          </div>
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
          {_cellUndo && (
            <button
              className="btn btn-outline"
              onClick={undoCellEdit}
              title="直前のセル編集を取り消す"
            >
              ↩ 元に戻す
            </button>
          )}
          <button
            className="btn btn-outline"
            onClick={() => exportCSV(staff, schedule, days, year, month)}
          >
            CSV出力
          </button>
          <button className="btn btn-outline print-btn" onClick={() => window.print()}>
            印刷
          </button>
          <button
            className={`btn ${finalized ? 'btn-clear' : 'btn-outline'}`}
            onClick={() => {
              if (finalized) {
                setMonthFinalized(year, month, false)
              } else if (
                window.confirm(
                  `${year}年${month}月のシフトを「確定」しますか？\n` +
                  '確定後も編集はできますが、ヘッダーに確定マークが付きます。'
                )
              ) {
                setMonthFinalized(year, month, true)
              }
            }}
            title={finalized ? '確定を解除' : 'この月のシフトを確定する'}
          >
            {finalized ? '✓ 確定済み（解除）' : 'シフトを確定'}
          </button>
        </div>
      </div>

      {finalized && (
        <div className="finalized-banner print-hide">
          ✓ この月のシフトは「確定済み」です。編集すると内容が変わります。
        </div>
      )}

      {/* バー: ロック状況 + 違反警告 + メモ機能 */}
      <div className="shift-bar print-hide">
        <div className="shift-bar-left">
          <span className="shift-legend-inline">
            {shiftTypes.map((st) => (
              <span key={st.code} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: st.color }} />
                {st.name}
              </span>
            ))}
          </span>
        </div>
        <div className="shift-bar-right">
          {lockCount > 0 && (
            <span className="bar-chip bar-chip-lock">
              <IconLock size={14} /> ロック {lockCount}
              <button className="bar-chip-x" onClick={() => { if (window.confirm('全ロックを解除しますか？')) clearLocks() }}>×</button>
            </span>
          )}
          {violations.total > 0 && (
            <button
              className={`bar-chip bar-chip-warn ${showViolations ? 'is-on' : ''}`}
              onClick={() => setShowViolations(!showViolations)}
              title="制約違反のセルを赤枠で表示"
            >
              <IconWarning size={14} /> 警告 {violations.total} {showViolations ? '表示中' : '隠す'}
            </button>
          )}
          {violations.total === 0 && schedule && (
            <span className="bar-chip bar-chip-ok">違反なし</span>
          )}
        </div>
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
          locks={locks}
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
                {days.map(({ day, date, weekday }) => {
                  const ev = eventMap[date]
                  const note = notes?.[date]
                  return (
                    <th
                      key={day}
                      className={`day-col ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''} ${ev ? 'has-event-col' : ''}`}
                      title={ev ? `イベント: ${ev}` : note ? `メモ: ${note}` : ''}
                    >
                      <div className="day-col-num">{day}</div>
                      <div className="weekday-label">{DAY_NAMES_SHORT[weekday]}</div>
                      {(ev || note) && (
                        <button
                          className="day-col-mark"
                          onClick={() => setNoteEditing({ date, text: note || '', event: ev })}
                          title={ev || note}
                        >
                          {ev ? '★' : <IconNote size={12} />}
                        </button>
                      )}
                      {!ev && !note && (
                        <button
                          className="day-col-add-note print-hide"
                          onClick={() => setNoteEditing({ date, text: '', event: null })}
                          title="メモ追加"
                        >
                          +
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const staffSchedule = schedule[s.id] || {}
                const staffLocks = locks?.[s.id] || {}
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
                      const isLocked = !!staffLocks[date]
                      const cellViolations = violations.byCell.get(`${s.id}-${date}`) || []
                      const hasViol = showViolations && cellViolations.length > 0
                      const violSev = cellViolations.some((v) => v.severity === 'danger') ? 'danger' : 'warn'

                      return (
                        <td
                          key={day}
                          className={`shift-cell ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''} ${isEditing ? 'shift-cell-editing' : ''} ${isLocked ? 'shift-cell-locked' : ''} ${hasViol ? `shift-cell-${violSev}` : ''}`}
                          style={!isEditing && color ? { backgroundColor: color + '28', borderBottomColor: color } : {}}
                          title={hasViol ? cellViolations.map((v) => v.msg).join(' / ') : ''}
                        >
                          <span
                            className={`shift-code ${isEditing ? 'shift-code-active' : ''}`}
                            style={color ? { color, fontWeight: 700 } : {}}
                            onClick={(e) => handleCellClick(s.id, date, e)}
                          >
                            <span className="shift-code-icon">
                              <ShiftIcon code={shiftCode} size={17} />
                            </span>
                            <span className="shift-code-letter">{shiftCode}</span>
                          </span>
                          {isLocked && (
                            <span className="shift-cell-lock-mark"><IconLock size={10} /></span>
                          )}
                          {hasViol && (
                            <span className="shift-cell-warn-mark">!</span>
                          )}
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
                  const dReq = requiredMap[date]?.D ?? defaultRequiredForDate(date).D
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
                  const nReq = requiredMap[date]?.N ?? defaultRequiredForDate(date).N
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
                    {requiredMap[date]?.D ?? defaultRequiredForDate(date).D}
                  </td>
                ))}
              </tr>
              <tr className="summary-row required-row night-required">
                <td className="staff-name-cell req-label">必要（夜勤）</td>
                {days.map(({ day, date }) => (
                  <td key={day} className="shift-cell count-cell req-cell">
                    {requiredMap[date]?.N ?? defaultRequiredForDate(date).N}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* メモ編集モーダル */}
      {noteEditing && (
        <NoteModal
          noteEditing={noteEditing}
          setNoteEditing={setNoteEditing}
          setNote={setNote}
        />
      )}
    </div>
  )
}
