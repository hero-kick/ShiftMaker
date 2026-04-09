import React, { useMemo, useState, useEffect } from 'react'
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

function exportSummaryCSV(statsRows, year, month) {
  const header = ['スタッフ名', '役職', '日勤', '夜勤', '明け', '休日', '有給', '合計日数']
  const rows = [header]
  statsRows.forEach((r) => {
    rows.push([r.name, r.role || '', r.work_count, r.night_count, r.ake_count, r.off_count, r.paid_leave_count, r.total_days])
  })
  const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n')
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

export default function ShiftSummary() {
  const { staff, schedule, wishes, year, month } = useStore()
  const isMobile = useIsMobile()

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

  const numDays = new Date(year, month, 0).getDate()

  // Compute per-staff stats directly from schedule (reflects manual edits)
  const statsRows = staff.map((s) => {
    const staffSchedule = schedule[s.id] || {}
    const shifts = Object.values(staffSchedule)
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      night_available: staff.find((st) => st.id === s.id)?.night_available,
      night_count: shifts.filter((sc) => sc === 'N').length,
      ake_count: shifts.filter((sc) => sc === 'A').length,
      off_count: shifts.filter((sc) => sc === 'O').length,
      paid_leave_count: shifts.filter((sc) => sc === 'Y').length,
      work_count: shifts.filter((sc) => sc === 'D').length,
      total_days: numDays,
    }
  })

  // Totals
  const totalNights = statsRows.reduce((sum, r) => sum + r.night_count, 0)
  const totalOff = statsRows.reduce((sum, r) => sum + r.off_count, 0)
  const totalPaid = statsRows.reduce((sum, r) => sum + r.paid_leave_count, 0)
  const totalWork = statsRows.reduce((sum, r) => sum + r.work_count, 0)

  const maxNightCount = Math.max(...statsRows.map((r) => r.night_count), 0)

  // Fairness metrics (night-capable staff only)
  const nightCapableRows = statsRows.filter((r) => r.night_available)
  const nightCounts = nightCapableRows.map((r) => r.night_count)
  const avgNights =
    nightCounts.length > 0
      ? (nightCounts.reduce((a, b) => a + b, 0) / nightCounts.length).toFixed(1)
      : '-'
  const minNights = nightCounts.length > 0 ? Math.min(...nightCounts) : '-'
  const maxNights = nightCounts.length > 0 ? Math.max(...nightCounts) : '-'
  const stdDev =
    nightCounts.length > 1
      ? Math.sqrt(
          nightCounts.reduce((sum, n) => sum + Math.pow(n - avgNights, 2), 0) / nightCounts.length
        ).toFixed(1)
      : '-'

  // 法定最低公休数チェック（月8日未満は警告）
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

  // Wish fulfillment
  const kyukuWishes = wishes.filter((w) => w.type === '希望休')
  const fulfilledKyuku = kyukuWishes.filter((w) => {
    const s = schedule[w.staff_id]
    return s && s[w.date] === 'O'
  })
  const wishFulfillRate =
    kyukuWishes.length > 0
      ? Math.round((fulfilledKyuku.length / kyukuWishes.length) * 100)
      : null

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
        {wishFulfillRate !== null && (
          <div className={`summary-card ${wishFulfillRate < 80 ? 'summary-card-warn' : ''}`}>
            <div className="summary-card-value">{wishFulfillRate}%</div>
            <div className="summary-card-label">
              希望休達成率 ({fulfilledKyuku.length}/{kyukuWishes.length})
            </div>
          </div>
        )}
      </div>

      {/* 法定公休数警告 */}
      {lowOffStaff.length > 0 && (
        <div className="alert-card alert-danger">
          <strong>法定公休数不足の可能性（基準: 月{MIN_OFF_DAYS}日以上）</strong>
          <ul>
            {lowOffStaff.map((r) => (
              <li key={r.id}>
                {r.name}：公休+有給 {r.off_count + r.paid_leave_count}日
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Night Fairness Metrics */}
      <div className="card fairness-card">
        <h3>夜勤公平性（夜勤可 {nightCapableRows.length}名）</h3>
        <div className="fairness-metrics">
          <div className="fairness-item">
            <span className="fairness-label">平均</span>
            <span className="fairness-value">{avgNights}回</span>
          </div>
          <div className="fairness-item">
            <span className="fairness-label">最小</span>
            <span className="fairness-value">{minNights}回</span>
          </div>
          <div className="fairness-item">
            <span className="fairness-label">最大</span>
            <span className="fairness-value">{maxNights}回</span>
          </div>
          <div className="fairness-item">
            <span className="fairness-label">偏差</span>
            <span
              className="fairness-value"
              style={{ color: stdDev > 2 ? '#D32F2F' : '#388E3C' }}
            >
              {stdDev}
            </span>
          </div>
          {akeORate !== null && (
            <div className="fairness-item">
              <span className="fairness-label">明け翌日O</span>
              <span
                className="fairness-value"
                style={{ color: akeORate < 80 ? '#D32F2F' : '#388E3C' }}
              >
                {akeORate}%
              </span>
            </div>
          )}
          <div className="fairness-item">
            <span className="fairness-label">最大差</span>
            <span
              className="fairness-value"
              style={{
                color:
                  maxNights !== '-' && minNights !== '-' && maxNights - minNights > 3
                    ? '#D32F2F'
                    : '#388E3C',
              }}
            >
              {maxNights !== '-' && minNights !== '-' ? maxNights - minNights : '-'}回
            </span>
          </div>
        </div>
      </div>

      {/* Staff stats */}
      <div className="card">
        {isMobile ? (
          /* Mobile: Card layout */
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
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#9C27B0' }}>{row.night_count}</span>
                    <span className="summary-stat-label">夜勤</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value" style={{ color: '#FF9800' }}>{row.ake_count}</span>
                    <span className="summary-stat-label">明け</span>
                  </div>
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
          /* Desktop: Table layout */
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

      <div className="card">
        <h3>夜勤分布</h3>
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
    </div>
  )
}
