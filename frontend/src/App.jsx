import React, { useState, useEffect } from 'react'
import useStore from './store/useStore'
import { generateShift, getSampleData } from './api/client'
import { getCurrentWorkspace, setCurrentWorkspaceId } from './workspace'
import StaffManager from './components/StaffManager'
import WishInput from './components/WishInput'
import DayConditionInput from './components/DayConditionInput'
import EventCalendar from './components/EventCalendar'
import ShiftTable from './components/ShiftTable'
import ShiftSummary from './components/ShiftSummary'

const TABS = [
  { id: 'staff', label: 'スタッフ管理', shortLabel: 'スタッフ' },
  { id: 'wish', label: '希望入力', shortLabel: '希望' },
  { id: 'event', label: 'イベント', shortLabel: 'イベント' },
  { id: 'condition', label: '日別条件', shortLabel: '条件' },
  { id: 'table', label: 'シフト表', shortLabel: 'シフト' },
  { id: 'summary', label: '集計', shortLabel: '集計' },
]

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

export default function App() {
  const [activeTab, setActiveTab] = useState('staff')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const isMobile = useIsMobile()
  const currentWs = getCurrentWorkspace()

  const handleSwitchWorkspace = () => {
    if (!window.confirm('ワークスペースを切り替えますか？（未保存の操作がある場合は先に完了してください）')) return
    setCurrentWorkspaceId(null)
    window.location.reload()
  }

  const {
    staff,
    wishes,
    dayConditions,
    shiftTypes,
    year,
    month,
    schedule,
    schedules,
    setYear,
    setMonth,
    setScheduleForMonth,
    loadScheduleForMonth,
    getPrevLastShifts,
    loadSampleData,
    initDayConditions,
    clearAll,
  } = useStore()

  // 月切り替え時: dayConditions初期化 + その月のスケジュールを復元
  useEffect(() => {
    initDayConditions()
    loadScheduleForMonth(year, month)
  }, [year, month])

  // ページ初期化時もスケジュール復元
  useEffect(() => {
    loadScheduleForMonth(year, month)
  }, [])

  // 成功メッセージ自動消去（3.5秒）
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 3500)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  // Close mobile more menu on outside tap
  useEffect(() => {
    if (!mobileMoreOpen) return
    const handler = (e) => {
      if (!e.target.closest('.mobile-more-menu') && !e.target.closest('.mobile-more-toggle')) {
        setMobileMoreOpen(false)
      }
    }
    document.addEventListener('touchstart', handler)
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('mousedown', handler)
    }
  }, [mobileMoreOpen])

  // 前月末シフトの引き継ぎ情報
  const prevLastShifts = getPrevLastShifts()
  const prevNightCarryovers = Object.entries(prevLastShifts)
    .filter(([, sc]) => sc === 'N')
    .map(([sid]) => staff.find((s) => s.id === sid)?.name)
    .filter(Boolean)

  const handleGenerate = async () => {
    if (staff.length === 0) {
      setError('スタッフを登録してください')
      return
    }
    setLoading(true)
    setError('')
    setSuccessMsg('')

    const numDays = new Date(year, month, 0).getDate()
    const fullDayConditions = []
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const existing = dayConditions.find((dc) => dc.date === dateStr)
      fullDayConditions.push(
        existing || {
          date: dateStr,
          required_per_shift: { D: 3, N: 2 },
          event_flag: false,
          required_staff_ids: [],
          forbidden_staff_ids: [],
        }
      )
    }

    const payload = {
      staff,
      shift_types: shiftTypes,
      day_conditions: fullDayConditions,
      wishes,
      year,
      month,
      prev_last_shifts: prevLastShifts,
    }

    try {
      const res = await generateShift(payload)
      setScheduleForMonth(year, month, res.data.schedule, res.data.summary)
      setSuccessMsg('シフトの生成が完了しました！')
      setActiveTab('table')
    } catch (err) {
      setError(err.message || 'シフト生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSample = async () => {
    if (staff.length > 0) {
      if (!window.confirm('現在のスタッフ・希望データがサンプルデータで上書きされます。続けますか？')) return
    }
    try {
      setLoading(true)
      setError('')
      const res = await getSampleData()
      loadSampleData(res.data)
      setSuccessMsg('サンプルデータを読み込みました')
    } catch (err) {
      setError(err.message || 'サンプルデータの読み込みに失敗しました')
    } finally {
      setLoading(false)
      setMobileMoreOpen(false)
    }
  }

  const handleClearAll = () => {
    if (!window.confirm('すべてのデータ（スタッフ・希望・シフト表）を削除しますか？')) return
    clearAll()
    setSuccessMsg('データを消去しました')
    setMobileMoreOpen(false)
  }

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const hasPrevSchedule = !!schedules[`${prevYear}-${String(prevMonth).padStart(2, '0')}`]

  const tabBadge = (tabId) => {
    if (tabId === 'staff' && staff.length > 0) return staff.length
    if (tabId === 'wish' && wishes.length > 0) return wishes.length
    if (tabId === 'event') {
      const cnt = dayConditions.filter((dc) => dc.event_flag).length
      if (cnt > 0) return cnt
    }
    if (tabId === 'table' && schedule) return '✓'
    return null
  }

  return (
    <div className={`app ${isMobile ? 'is-mobile' : ''}`}>
      {/* === Mobile Header === */}
      {isMobile ? (
        <header className="app-header mobile-header">
          <div className="mobile-header-row">
            <h1 className="app-title">ShiftMaker</h1>
            <div className="mobile-header-month">
              <select
                value={`${year}-${month}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setYear(y)
                  setMonth(m)
                }}
                className="mobile-month-select"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={`${year}-${m}`}>
                    {year}年{m}月{schedules[`${year}-${String(m).padStart(2, '0')}`] ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="mobile-generate-btn"
              onClick={handleGenerate}
              disabled={loading || staff.length === 0}
            >
              {loading ? <span className="spinner" /> : '生成'}
            </button>
            <div className="mobile-more-wrapper">
              <button
                className="mobile-more-toggle"
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
              >
                ···
              </button>
              {mobileMoreOpen && (
                <div className="mobile-more-menu">
                  <div className="mobile-more-ws">WS: {currentWs?.name || '-'}</div>
                  <button onClick={handleSwitchWorkspace}>ワークスペース切替</button>
                  <button onClick={handleLoadSample} disabled={loading}>サンプル読込</button>
                  <button onClick={handleClearAll} disabled={loading} className="danger-text">全消去</button>
                </div>
              )}
            </div>
          </div>
        </header>
      ) : (
        /* === Desktop Header === */
        <header className="app-header">
          <div className="header-left">
            <h1 className="app-title">ShiftMaker</h1>
            <span className="app-subtitle">看護師シフト管理システム</span>
            {currentWs && (
              <button
                className="ws-switch-btn"
                onClick={handleSwitchWorkspace}
                title="ワークスペースを切り替える"
              >
                👤 {currentWs.name}
              </button>
            )}
          </div>
          <div className="header-controls">
            <div className="month-selector">
              <label>対象月</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min="2020"
                max="2030"
                className="year-input"
              />
              年
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="month-input"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}月
                    {schedules[`${year}-${String(m).padStart(2, '0')}`] ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary" onClick={handleLoadSample} disabled={loading}>
              サンプル読込
            </button>
            <button
              className="btn btn-clear"
              onClick={handleClearAll}
              disabled={loading}
              title="全データを消去"
            >
              消去
            </button>
            <button
              className="btn btn-primary generate-btn"
              onClick={handleGenerate}
              disabled={loading || staff.length === 0}
              title={staff.length === 0 ? 'スタッフを登録してください' : `${staff.length}名のシフトを生成`}
            >
              {loading ? (
                <span className="loading-spinner">
                  <span className="spinner" /> 生成中...
                </span>
              ) : (
                'シフト生成'
              )}
            </button>
          </div>
        </header>
      )}

      {/* 前月末夜勤の引き継ぎ通知 */}
      {prevNightCarryovers.length > 0 && (
        <div className="carryover-bar">
          <span className="carryover-icon">↩</span>
          <strong>前月引き継ぎ:</strong>{' '}
          {prevNightCarryovers.join('・')}
          {' '}が{prevYear}年{prevMonth}月末に夜勤 → {month}月1日は自動でA（明け）に設定されます
        </div>
      )}

      {/* Toast messages */}
      {(error || successMsg) && (
        <div className={`message-toast ${error ? 'message-error' : 'message-success'} ${isMobile ? 'message-toast-mobile' : ''}`}>
          <span>{error || successMsg}</span>
          <button className="message-close" onClick={() => { setError(''); setSuccessMsg('') }}>×</button>
        </div>
      )}

      {/* Desktop tab nav */}
      {!isMobile && (
        <nav className="tab-nav">
          {TABS.map((tab) => {
            const badge = tabBadge(tab.id)
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {badge !== null && (
                  <span className="tab-badge" style={
                    tab.id === 'event' ? { backgroundColor: '#E53935' } :
                    tab.id === 'table' ? { backgroundColor: '#388E3C' } : {}
                  }>{badge}</span>
                )}
              </button>
            )
          })}
        </nav>
      )}

      <main className="app-main">
        {activeTab === 'staff' && <StaffManager />}
        {activeTab === 'wish' && <WishInput />}
        {activeTab === 'event' && <EventCalendar />}
        {activeTab === 'condition' && <DayConditionInput />}
        {activeTab === 'table' && <ShiftTable />}
        {activeTab === 'summary' && <ShiftSummary />}
      </main>

      {/* Full-screen loading overlay */}
      {loading && isMobile && (
        <div className="loading-overlay">
          <div className="loading-overlay-content">
            <div className="loading-overlay-spinner" />
            <div className="loading-overlay-text">シフト生成中...</div>
            <div className="loading-overlay-sub">最大1分ほどかかる場合があります</div>
          </div>
        </div>
      )}

      {!isMobile && (
        <footer className="app-footer">
          <span>ShiftMaker v2.1 &copy; 2026 — データはブラウザに自動保存（直近3ヶ月）</span>
        </footer>
      )}

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          {TABS.map((tab) => {
            const badge = tabBadge(tab.id)
            return (
              <button
                key={tab.id}
                className={`mobile-bottom-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); window.scrollTo(0, 0) }}
              >
                <span className="mobile-tab-label">{tab.shortLabel}</span>
                {badge !== null && (
                  <span className={`mobile-tab-badge ${tab.id === 'event' ? 'badge-event' : tab.id === 'table' ? 'badge-done' : ''}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
