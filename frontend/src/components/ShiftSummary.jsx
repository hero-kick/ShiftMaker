import React, { useMemo } from 'react'
import useStore from '../store/useStore'
import useIsMobile from '../hooks/useIsMobile'
import { IconScale, IconShield, IconCheck, IconWarning, IconChart } from './Icons'

function exportSummaryCSV(statsRows, year, month) {
  const header = ['スタッフ名', '役職', '日勤', '早番', '夜勤', '明け', '遅番', '休日', '有給', '土日休み', '2連休', '合計']
  const rows = [header]
  statsRows.forEach((r) => {
    rows.push([
      r.name, r.role || '',
      r.work_count, r.early_count, r.night_count, r.ake_count, r.late_count,
      r.off_count, r.paid_leave_count, r.weekend_off, r.two_off_blocks, r.total_days,
    ])
  })
  const csv = '﻿' + rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `summary_${year}${String(month).padStart(2, '0')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function countWeekendOff(schedule, days) {
  let off = 0
  days.forEach(({ date, weekday }) => {
    if ((weekday === 0 || weekday === 6) && (schedule[date] === 'O' || schedule[date] === 'Y')) off++
  })
  return off
}

function countTwoOffBlocks(schedule, days) {
  let n = 0
  let prevO = false
  days.forEach(({ date }) => {
    const isO = schedule[date] === 'O'
    if (isO && prevO) { n++; prevO = false }
    else prevO = isO
  })
  return n
}

// 公平性スコア（0-100）: 全指標を合算
function fairnessScore(staffRow, avg) {
  let score = 100
  // 夜勤差ペナルティ
  score -= Math.abs(staffRow.night_count - avg.night) * 5
  // 公休差ペナルティ
  score -= Math.abs(staffRow.off_count - avg.off) * 4
  // 土日休み差
  score -= Math.abs(staffRow.weekend_off - avg.weekend) * 3
  return Math.max(0, Math.min(100, Math.round(score)))
}

export default function ShiftSummary() {
  const { staff, schedule, wishes, year, month } = useStore()
  const isMobile = useIsMobile()

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

  const statsRows = useMemo(() => {
    if (!schedule) return []
    return staff.map((s) => {
      const staffSchedule = schedule[s.id] || {}
      const shifts = Object.values(staffSchedule)
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        night_available: s.night_available,
        is_rookie: s.is_rookie,
        can_lead: s.can_lead,
        night_count: shifts.filter((sc) => sc === 'N').length,
        ake_count: shifts.filter((sc) => sc === 'A').length,
        off_count: shifts.filter((sc) => sc === 'O').length,
        paid_leave_count: shifts.filter((sc) => sc === 'Y').length,
        work_count: shifts.filter((sc) => sc === 'D').length,
        early_count: shifts.filter((sc) => sc === 'E').length,
        late_count: shifts.filter((sc) => sc === 'L').length,
        weekend_off: countWeekendOff(staffSchedule, days),
        two_off_blocks: countTwoOffBlocks(staffSchedule, days),
        total_days: numDays,
      }
    })
  }, [staff, schedule, days, numDays])

  if (!schedule) {
    return (
      <div className="shift-summary-empty">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>集計データがありません</h3>
          <p>シフトを生成すると集計が表示されます。</p>
        </div>
      </div>
    )
  }

  const totalNights = statsRows.reduce((sum, r) => sum + r.night_count, 0)
  const totalOff = statsRows.reduce((sum, r) => sum + r.off_count, 0)
  const totalPaid = statsRows.reduce((sum, r) => sum + r.paid_leave_count, 0)
  const totalWork = statsRows.reduce((sum, r) => sum + r.work_count, 0)
  const maxNightCount = Math.max(...statsRows.map((r) => r.night_count), 0)

  const nightCapableRows = statsRows.filter((r) => r.night_available)
  const nightCounts = nightCapableRows.map((r) => r.night_count)
  const avgNights = nightCounts.length > 0
    ? (nightCounts.reduce((a, b) => a + b, 0) / nightCounts.length).toFixed(1)
    : '-'
  const minNights = nightCounts.length > 0 ? Math.min(...nightCounts) : '-'
  const maxNights = nightCounts.length > 0 ? Math.max(...nightCounts) : '-'
  const stdDev = nightCounts.length > 1
    ? Math.sqrt(
        nightCounts.reduce((sum, n) => sum + Math.pow(n - avgNights, 2), 0) / nightCounts.length
      ).toFixed(1)
    : '-'

  const MIN_OFF_DAYS = 8
  const lowOffStaff = statsRows.filter((r) => r.off_count + r.paid_leave_count < MIN_OFF_DAYS)

  // 明け翌日O率
  let akeTotal = 0
  let akeFollowedByO = 0
  staff.forEach((s) => {
    const staffSchedule = schedule[s.id] || {}
    const dates = Object.keys(staffSchedule).sort()
    dates.forEach((d, i) => {
      if (staffSchedule[d] === 'A' && i + 1 < dates.length) {
        akeTotal++
        if (staffSchedule[dates[i + 1]] === 'O') akeFollowedByO++
      }
    })
  })
  const akeORate = akeTotal > 0 ? Math.round((akeFollowedByO / akeTotal) * 100) : null

  // 希望休達成率（個人別も計算）
  const kyukuWishes = wishes.filter((w) => w.type === '希望休')
  const fulfilledKyuku = kyukuWishes.filter((w) => schedule[w.staff_id]?.[w.date] === 'O')
  const wishFulfillRate = kyukuWishes.length > 0
    ? Math.round((fulfilledKyuku.length / kyukuWishes.length) * 100)
    : null
  const wishesByStaff = {}
  kyukuWishes.forEach((w) => {
    if (!wishesByStaff[w.staff_id]) wishesByStaff[w.staff_id] = { req: 0, ok: 0 }
    wishesByStaff[w.staff_id].req++
    if (schedule[w.staff_id]?.[w.date] === 'O') wishesByStaff[w.staff_id].ok++
  })

  // 平均値（公平性スコア用）
  const avg = {
    night: nightCounts.length > 0 ? nightCounts.reduce((a, b) => a + b, 0) / nightCounts.length : 0,
    off: statsRows.reduce((a, r) => a + r.off_count, 0) / Math.max(statsRows.length, 1),
    weekend: statsRows.reduce((a, r) => a + r.weekend_off, 0) / Math.max(statsRows.length, 1),
  }

  // 数値→ヒートマップ色（low to high）
  const heatColor = (val, min, max, palette = 'green') => {
    if (max === min) return '#E8EAF6'
    const t = (val - min) / (max - min) // 0..1
    if (palette === 'green') {
      const r = Math.round(232 - t * 100)
      const g = Math.round(234 - t * 50 + t * 60)
      const b = Math.round(230 - t * 130)
      return `rgb(${r},${g},${b})`
    }
    // purple for night
    const r = Math.round(243 - t * 95)
    const g = Math.round(229 - t * 190)
    const b = Math.round(245 - t * 80)
    return `rgb(${r},${g},${b})`
  }

  // 偏差を「公平性スコア」表記に
  const fairnessOverall = nightCounts.length > 1
    ? Math.max(0, Math.min(100, Math.round(100 - stdDev * 18)))
    : 100

  return (
    <div className="shift-summary">
      <div className="table-actions">
        <h2 style={{ margin: 0 }}>シフト集計</h2>
        <button
          className="btn btn-outline"
          onClick={() => exportSummaryCSV(statsRows, year, month)}
        >
          CSV出力
        </button>
      </div>

      {/* === ヒーロー: 公平性スコア === */}
      <div className="summary-hero">
        <div className="summary-hero-score">
          <div className="summary-hero-score-num">{fairnessOverall}</div>
          <div className="summary-hero-score-label">公平性スコア</div>
        </div>
        <div className="summary-hero-meta">
          <div className="hero-meta-row">
            <span><IconScale size={18} /> 夜勤偏差</span>
            <strong style={{ color: stdDev > 1.5 ? '#C62828' : '#2E7D32' }}>{stdDev}</strong>
          </div>
          <div className="hero-meta-row">
            <span><IconShield size={18} /> 公休 ≥ 8日</span>
            <strong style={{ color: lowOffStaff.length > 0 ? '#C62828' : '#2E7D32' }}>
              {staff.length - lowOffStaff.length}/{staff.length}名
            </strong>
          </div>
          {akeORate !== null && (
            <div className="hero-meta-row">
              <span>明け→休</span>
              <strong style={{ color: akeORate < 80 ? '#EF6C00' : '#2E7D32' }}>{akeORate}%</strong>
            </div>
          )}
          {wishFulfillRate !== null && (
            <div className="hero-meta-row">
              <span><IconCheck size={18} /> 希望休達成</span>
              <strong style={{ color: wishFulfillRate < 80 ? '#EF6C00' : '#2E7D32' }}>
                {wishFulfillRate}%
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* === 数値カード === */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-card-value">{totalNights}</div>
          <div className="summary-card-label">総夜勤回数</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-value">{totalWork}</div>
          <div className="summary-card-label">総日勤日数</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-value">{totalOff}</div>
          <div className="summary-card-label">総休日数</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-value">{totalPaid}</div>
          <div className="summary-card-label">総有給日数</div>
        </div>
      </div>

      {/* === 警告 === */}
      {lowOffStaff.length > 0 && (
        <div className="alert-card alert-danger">
          <strong><IconWarning size={18} /> 公休8日未満</strong>
          <ul>
            {lowOffStaff.map((r) => (
              <li key={r.id}>
                {r.name}：公休{r.off_count}+有給{r.paid_leave_count} = {r.off_count + r.paid_leave_count}日
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* === 公平性ヒートマップ === */}
      <div className="card">
        <h3><IconChart size={20} /> 個人別 公平性ヒートマップ</h3>
        <div className="heat-table-wrap">
          <table className="heat-table">
            <thead>
              <tr>
                <th>スタッフ</th>
                <th>夜勤</th>
                <th>休日</th>
                <th>有給</th>
                <th>土日休</th>
                <th>2連休</th>
                <th>希望達成</th>
                <th>公平性</th>
              </tr>
            </thead>
            <tbody>
              {statsRows.map((r) => {
                const score = fairnessScore(r, avg)
                const wf = wishesByStaff[r.id]
                const wfPct = wf ? Math.round((wf.ok / wf.req) * 100) : null
                return (
                  <tr key={r.id}>
                    <td className="heat-name">
                      <div>{r.name}</div>
                      {r.role && <div className="heat-role">{r.role}</div>}
                      <div className="heat-flags">
                        {r.can_lead && <span className="badge badge-lead">L</span>}
                        {r.is_rookie && <span className="badge badge-rookie">新</span>}
                        {!r.night_available && <span className="badge badge-gray">日勤</span>}
                      </div>
                    </td>
                    <td className="heat-cell" style={{ backgroundColor: heatColor(r.night_count, 0, maxNightCount, 'purple') }}>
                      {r.night_count}
                    </td>
                    <td className="heat-cell" style={{ backgroundColor: heatColor(r.off_count, 4, 14) }}>
                      {r.off_count}
                    </td>
                    <td className="heat-cell">{r.paid_leave_count}</td>
                    <td className="heat-cell" style={{ backgroundColor: heatColor(r.weekend_off, 0, 8) }}>
                      {r.weekend_off}
                    </td>
                    <td className="heat-cell">{r.two_off_blocks}</td>
                    <td className="heat-cell">
                      {wfPct === null ? '-' : (
                        <span style={{ color: wfPct >= 80 ? '#2E7D32' : '#C62828', fontWeight: 700 }}>
                          {wf.ok}/{wf.req}
                        </span>
                      )}
                    </td>
                    <td className="heat-cell heat-score">
                      <span
                        className="heat-score-pill"
                        style={{ backgroundColor: score >= 80 ? '#2E7D32' : score >= 60 ? '#EF6C00' : '#C62828' }}
                      >
                        {score}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="heat-total">
                <td>平均</td>
                <td>{avg.night.toFixed(1)}</td>
                <td>{avg.off.toFixed(1)}</td>
                <td>{(totalPaid / staff.length).toFixed(1)}</td>
                <td>{avg.weekend.toFixed(1)}</td>
                <td>
                  {(statsRows.reduce((a, r) => a + r.two_off_blocks, 0) / staff.length).toFixed(1)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="heat-legend">
          <span>濃いほど多い</span>
          <span className="heat-legend-bar" />
          <span>公平性スコア = 平均からの距離（高いほど均等）</span>
        </div>
      </div>

      {/* === 既存: 夜勤分布 === */}
      <div className="card">
        <h3>夜勤分布（夜勤可スタッフ）</h3>
        <div className="night-chart">
          {statsRows
            .filter((r) => r.night_available)
            .sort((a, b) => b.night_count - a.night_count)
            .map((row) => (
              <div key={row.id} className="night-bar-row">
                <div className="night-bar-label">{row.name}</div>
                <div className="night-bar-track">
                  <div
                    className="night-bar-fill"
                    style={{
                      width: `${maxNightCount > 0 ? (row.night_count / maxNightCount) * 100 : 0}%`,
                      backgroundColor: '#9C27B0',
                    }}
                  />
                </div>
                <div className="night-bar-count">{row.night_count}回</div>
              </div>
            ))}
        </div>
      </div>

      {/* === スタッフ別カード／表（既存）=== */}
      <div className="card">
        {isMobile ? (
          <div className="summary-staff-cards">
            {statsRows.map((row) => (
              <div key={row.id} className="summary-staff-card">
                <div className="summary-staff-header">
                  <span className="summary-staff-name">{row.name}</span>
                  {row.role && <span className="summary-staff-role">{row.role}</span>}
                </div>
                <div className="summary-staff-grid">
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#4CAF50' }}>{row.work_count}</span>
                    <span className="summary-stat-label">日勤</span>
                  </div>
                  {row.early_count > 0 && (
                    <div className="summary-stat">
                      <span className="summary-stat-value" style={{ color: '#26C6DA' }}>{row.early_count}</span>
                      <span className="summary-stat-label">早番</span>
                    </div>
                  )}
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#9C27B0' }}>{row.night_count}</span>
                    <span className="summary-stat-label">夜勤</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#FF9800' }}>{row.ake_count}</span>
                    <span className="summary-stat-label">明け</span>
                  </div>
                  {row.late_count > 0 && (
                    <div className="summary-stat">
                      <span className="summary-stat-value" style={{ color: '#5C6BC0' }}>{row.late_count}</span>
                      <span className="summary-stat-label">遅番</span>
                    </div>
                  )}
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#9E9E9E' }}>{row.off_count}</span>
                    <span className="summary-stat-label">休日</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#2196F3' }}>{row.paid_leave_count}</span>
                    <span className="summary-stat-label">有給</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>スタッフ名</th>
                  <th>役職</th>
                  <th>日勤</th>
                  <th>夜勤</th>
                  <th>明け</th>
                  <th>休日</th>
                  <th>有給</th>
                  <th>合計</th>
                </tr>
              </thead>
              <tbody>
                {statsRows.map((row) => (
                  <tr key={row.id}>
                    <td className="staff-name">{row.name}</td>
                    <td>{row.role || '-'}</td>
                    <td className="number-cell">
                      <span style={{ color: '#4CAF50', fontWeight: 600 }}>{row.work_count}</span>
                    </td>
                    <td className="number-cell">
                      <span
                        className={`count-badge ${row.night_count === maxNightCount && maxNightCount > 0 ? 'count-badge-max' : ''}`}
                        style={{ color: '#9C27B0' }}
                      >
                        {row.night_count}
                      </span>
                    </td>
                    <td className="number-cell">
                      <span style={{ color: '#FF9800' }}>{row.ake_count}</span>
                    </td>
                    <td className="number-cell">
                      <span style={{ color: '#9E9E9E' }}>{row.off_count}</span>
                    </td>
                    <td className="number-cell">
                      <span style={{ color: '#2196F3' }}>{row.paid_leave_count}</span>
                    </td>
                    <td className="number-cell">{row.total_days}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2}>合計</td>
                  <td className="number-cell">{totalWork}</td>
                  <td className="number-cell">{totalNights}</td>
                  <td className="number-cell">
                    {statsRows.reduce((s, r) => s + r.ake_count, 0)}
                  </td>
                  <td className="number-cell">{totalOff}</td>
                  <td className="number-cell">{totalPaid}</td>
                  <td className="number-cell">{numDays * staff.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
