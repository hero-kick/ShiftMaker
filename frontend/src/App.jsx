import React, { useState, useEffect } from 'react'
import useStore from './store/useStore'
import { generateShift, getSampleData } from './api/client'
import { getCurrentWorkspace, setCurrentWorkspaceId } from './workspace'
import Dashboard from './components/Dashboard'
import StaffManager from './components/StaffManager'
import WishInput from './components/WishInput'
import DayConditionInput from './components/DayConditionInput'
import EventCalendar from './components/EventCalendar'
import ShiftTable from './components/ShiftTable'
import ShiftSummary from './components/ShiftSummary'
import Guide from './components/Guide'
import {
  IconStaff, IconCalendar, IconStar, IconSettings, IconTable, IconChart,
  IconPlay, IconHelp, IconMenu, IconUser, IconRefresh, IconTrash, IconHome,
} from './components/Icons'
import useIsMobile from './hooks/useIsMobile'
import useModalA11y from './hooks/useModalA11y'
import { checkHealth } from './api/client'
import { isStorageNearFull } from './safeStorage'
import { blankDayCondition } from './defaults'

const TABS = [
  { id: 'home',      label: 'ホーム',   shortLabel: 'ホーム',   step: 0, Icon: IconHome },
  { id: 'staff',     label: 'スタッフ', shortLabel: 'スタッフ', step: 1, Icon: IconStaff },
  { id: 'wish',      label: '希望',     shortLabel: '希望',     step: 2, Icon: IconCalendar },
  { id: 'event',     label: 'イベント', shortLabel: 'イベント', step: 3, Icon: IconStar },
  { id: 'condition', label: '人数',     shortLabel: '人数',     step: 4, Icon: IconSettings },
  { id: 'table',     label: 'シフト表', shortLabel: 'シフト',   step: 5, Icon: IconTable },
  { id: 'summary',   label: '集計',     shortLabel: '集計',     step: 6, Icon: IconChart },
]

const ONBOARDING_KEY = 'shiftmaker-seen-onboarding'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [apiOffline, setApiOffline] = useState(false)
  const isMobile = useIsMobile()
  const currentWs = getCurrentWorkspace()

  useEffect(() => {
    try {
      const seen = localStorage.getItem(ONBOARDING_KEY)
      if (!seen) setOnboardingOpen(true)
    } catch {}
  }, [])

  // localStorage 容量超過の検知
  useEffect(() => {
    const onStorageError = () => setStorageWarning(true)
    window.addEventListener('shiftmaker-storage-error', onStorageError)
    // 起動時にも近接チェック
    if (isStorageNearFull()) setStorageWarning(true)
    return () => window.removeEventListener('shiftmaker-storage-error', onStorageError)
  }, [])

  // バックエンド疎通チェック（起動時 + 失敗時の再確認は generate でカバー）
  useEffect(() => {
    let cancelled = false
    checkHealth()
      .then(() => { if (!cancelled) setApiOffline(false) })
      .catch(() => { if (!cancelled) setApiOffline(true) })
    return () => { cancelled = true }
  }, [])

  const dismissOnboarding = (openGuide = false) => {
    try { localStorage.setItem(ONBOARDING_KEY, '1') } catch {}
    setOnboardingOpen(false)
    if (openGuide) setGuideOpen(true)
  }

  // オンボーディングモーダルの a11y（Escで閉じる・フォーカストラップ）
  const onboardingRef = useModalA11y(onboardingOpen, () => dismissOnboarding(false))

  const handleSwitchWorkspace = () => {
    if (!window.confirm('ワークスペースを切り替えますか？（未保存の操作がある場合は先に完了してください）')) return
    setCurrentWorkspaceId(null)
    window.location.reload()
  }

  const {
    staff, wishes, dayConditions, pairs, shiftTypes,
    year, month, schedule, schedules, locks,
    setYear, setMonth, setScheduleForMonth, loadScheduleForMonth,
    getPrevLastShifts, getPrevConsecutiveWork, loadSampleData, initDayConditions, clearAll,
    isMonthFinalized,
  } = useStore()

  const monthFinalized = isMonthFinalized(year, month)

  useEffect(() => {
    initDayConditions()
    loadScheduleForMonth(year, month)
  }, [year, month])

  useEffect(() => {
    loadScheduleForMonth(year, month)
  }, [])

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 3500)
      return () => clearTimeout(t)
    }
  }, [successMsg])

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
      fullDayConditions.push(existing || blankDayCondition(dateStr))
    }

    const payload = {
      staff,
      shift_types: shiftTypes,
      day_conditions: fullDayConditions,
      wishes,
      pairs,
      year,
      month,
      prev_last_shifts: prevLastShifts,
      prev_consecutive_work: getPrevConsecutiveWork(),
      locked_shifts: locks || {},
    }

    try {
      const res = await generateShift(payload)
      setScheduleForMonth(year, month, res.data.schedule, res.data.summary)
      setSuccessMsg('シフトの生成が完了しました！')
      setApiOffline(false)
      setActiveTab('table')
    } catch (err) {
      // ネットワーク起因か業務エラーかを区別
      const msg = err.message || 'シフト生成に失敗しました'
      const isNetwork =
        /Network Error|timeout|ECONNREFUSED|Failed to fetch|サーバーとの通信/.test(msg)
      if (isNetwork) {
        setApiOffline(true)
        setError(
          'サーバーに接続できませんでした。\n' +
          'しばらく待ってから再度お試しください。問題が続く場合は管理者にご連絡ください。'
        )
      } else {
        setError(msg)
      }
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
      const res = await getSampleData(year, month)
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

  const tabBadge = (tabId) => {
    if (tabId === 'staff' && staff.length > 0) return staff.length
    if (tabId === 'wish' && wishes.length > 0) return wishes.length
    if (tabId === 'event') {
      const cnt = dayConditions.filter((dc) => dc.event_flag).length
      if (cnt > 0) return cnt
    }
    if (tabId === 'table' && schedule) {
      const lockCount = Object.values(locks || {}).reduce((s, m) => s + Object.keys(m).length, 0)
      return lockCount > 0 ? `🔒${lockCount}` : '✓'
    }
    return null
  }

  return (
    <div className={`app ${isMobile ? 'is-mobile' : ''}`}>
      {/* === Mobile Header === */}
      {isMobile ? (
        <header className="app-header mobile-header">
          <div className="mobile-header-row">
            <h1 className="app-title">ShiftMaker</h1>
            <button
              className="mobile-help-btn"
              onClick={() => setGuideOpen(true)}
              aria-label="使い方ガイド"
            >
              <IconHelp size={22} />
            </button>
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
              aria-label="シフト生成"
            >
              {loading ? <span className="spinner" /> : <><IconPlay size={20} /> 生成</>}
            </button>
            <div className="mobile-more-wrapper">
              <button
                className="mobile-more-toggle"
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                aria-label="その他のメニュー"
              >
                <IconMenu size={22} />
              </button>
              {mobileMoreOpen && (
                <div className="mobile-more-menu">
                  <div className="mobile-more-ws">WS: {currentWs?.name || '-'}</div>
                  <button onClick={() => { setGuideOpen(true); setMobileMoreOpen(false) }}>使い方ガイド</button>
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
                <IconUser size={18} /> {currentWs.name}
              </button>
            )}
          </div>
          <div className="header-controls">
            <button
              className="btn btn-help"
              onClick={() => setGuideOpen(true)}
              title="使い方ガイドを開く"
            >
              <IconHelp size={22} /> 使い方
            </button>
            <div className="month-selector">
              <label htmlFor="year-input">対象月</label>
              <select
                id="year-input"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="month-input"
                aria-label="年を選択"
              >
                {(() => {
                  const cur = new Date().getFullYear()
                  return Array.from({ length: 7 }, (_, i) => cur - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}年</option>
                  ))
                })()}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="month-input"
                aria-label="月を選択"
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
              <IconRefresh size={20} /> サンプル
            </button>
            <button
              className="btn btn-clear"
              onClick={handleClearAll}
              disabled={loading}
              title="全データを消去"
            >
              <IconTrash size={20} /> 消去
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
                <><IconPlay size={22} /> シフト生成</>
              )}
            </button>
          </div>
        </header>
      )}

      {prevNightCarryovers.length > 0 && (
        <div className="carryover-bar">
          <span className="carryover-icon">↩</span>
          <strong>前月引き継ぎ:</strong>{' '}
          {prevNightCarryovers.join('・')}
          {' '}が{prevYear}年{prevMonth}月末に夜勤 → {month}月1日は自動でA（明け）に設定されます
        </div>
      )}

      {/* API 障害バナー */}
      {apiOffline && (
        <div className="offline-banner" role="alert">
          ⚠ サーバーに接続できません。シフト生成は一時的に利用できませんが、入力したデータは保存されています。
        </div>
      )}

      {/* localStorage 容量警告 */}
      {storageWarning && (
        <div className="storage-warning" role="alert">
          <span>
            ⚠ 端末の保存容量が上限に近づいています。不要なワークスペースや古い月のデータを整理してください。
          </span>
          <button onClick={() => setStorageWarning(false)}>閉じる</button>
        </div>
      )}

      {(error || successMsg) && (
        <div
          className={`message-toast ${error ? 'message-error' : 'message-success'} ${isMobile ? 'message-toast-mobile' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          <span>{error || successMsg}</span>
          <button
            className="message-close"
            onClick={() => { setError(''); setSuccessMsg('') }}
            aria-label="メッセージを閉じる"
          >×</button>
        </div>
      )}

      {!isMobile && (
        <nav className="tab-nav" role="tablist" aria-label="メイン画面切り替え">
          {TABS.map((tab) => {
            const badge = tabBadge(tab.id)
            const Icon = tab.Icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon"><Icon size={26} /></span>
                {tab.step > 0 && <span className="tab-step">{tab.step}</span>}
                <span className="tab-label">{tab.label}</span>
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
        {activeTab === 'home' && (
          <Dashboard
            onJumpToTab={(id) => setActiveTab(id)}
            onGenerate={handleGenerate}
            loading={loading}
          />
        )}
        {activeTab === 'staff' && <StaffManager />}
        {activeTab === 'wish' && <WishInput />}
        {activeTab === 'event' && <EventCalendar />}
        {activeTab === 'condition' && <DayConditionInput />}
        {activeTab === 'table' && <ShiftTable />}
        {activeTab === 'summary' && <ShiftSummary />}
      </main>

      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-overlay-content">
            <div className="loading-overlay-spinner" />
            <div className="loading-overlay-text">シフト生成中...</div>
            <div className="loading-overlay-sub">
              公平性を最適化しています。最大1分ほどかかる場合があります
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <footer className="app-footer">
          <span>ShiftMaker v3.0 &copy; 2026 — データはブラウザに自動保存（直近3ヶ月）</span>
        </footer>
      )}

      {onboardingOpen && (
        <div className="onboarding-overlay" onClick={() => dismissOnboarding(false)}>
          <div
            className="onboarding-card"
            onClick={(e) => e.stopPropagation()}
            ref={onboardingRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <div className="onboarding-icon">👋</div>
            <h2 className="onboarding-title" id="onboarding-title">ようこそ</h2>
            <p className="onboarding-lead">
              3ステップでシフトが完成します
            </p>
            <div className="onboarding-flow">
              <div className="onboarding-step">
                <div className="onboarding-step-num">1</div>
                <div className="onboarding-step-icon"><IconStaff size={36} /></div>
                <div className="onboarding-step-text">スタッフを登録</div>
              </div>
              <div className="onboarding-step-arrow">→</div>
              <div className="onboarding-step">
                <div className="onboarding-step-num">2</div>
                <div className="onboarding-step-icon"><IconCalendar size={36} /></div>
                <div className="onboarding-step-text">希望休を入力</div>
              </div>
              <div className="onboarding-step-arrow">→</div>
              <div className="onboarding-step">
                <div className="onboarding-step-num">3</div>
                <div className="onboarding-step-icon"><IconPlay size={36} /></div>
                <div className="onboarding-step-text">生成ボタン</div>
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="ws-btn ws-btn-secondary" onClick={() => dismissOnboarding(true)}>
                <IconHelp size={20} /> 詳しく見る
              </button>
              <button className="ws-btn ws-btn-primary" onClick={() => dismissOnboarding(false)}>
                <IconPlay size={20} /> 始める
              </button>
            </div>
          </div>
        </div>
      )}

      <Guide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onJumpToTab={(tabId) => setActiveTab(tabId)}
      />

      {isMobile && (
        <nav className="mobile-bottom-nav" role="tablist" aria-label="メイン画面切り替え">
          {TABS.map((tab) => {
            const badge = tabBadge(tab.id)
            const Icon = tab.Icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                className={`mobile-bottom-tab ${isActive ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); window.scrollTo(0, 0) }}
              >
                <span className="mobile-tab-icon"><Icon size={26} /></span>
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
