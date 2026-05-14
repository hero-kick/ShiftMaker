import React, { useMemo } from 'react'
import useStore from '../store/useStore'
import { defaultRequiredForDate } from '../defaults'
import {
  IconStaff, IconCalendar, IconStar, IconSettings, IconTable, IconChart,
  IconCheck, IconWarning, IconShield, IconScale, IconPlay, IconLightbulb,
  IconRefresh, IconLock,
} from './Icons'

const SHIFT_NAMES = { D: '日勤', E: '早番', N: '夜勤', A: '明け', L: '遅番', O: '休日', Y: '有給' }

export default function Dashboard({ onJumpToTab, onGenerate, loading }) {
  const {
    staff, wishes, dayConditions, pairs, schedule, summary,
    year, month, locks, schedules,
  } = useStore()

  const numDays = useMemo(() => new Date(year, month, 0).getDate(), [year, month])
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`

  // ─── 準備状況チェック ───
  const wishCount = wishes.filter((w) => w.date?.startsWith(monthPrefix)).length
  const eventCount = dayConditions.filter((dc) => dc.date.startsWith(monthPrefix) && dc.event_flag).length
  // 基本構成（曜日ごとの既定値）から変更されている日をカスタム扱い
  const customDayCount = dayConditions.filter((dc) => {
    if (!dc.date.startsWith(monthPrefix)) return false
    const base = defaultRequiredForDate(dc.date)
    const r = dc.required_per_shift || {}
    return (r.D ?? base.D) !== base.D || (r.N ?? base.N) !== base.N
  }).length

  const nightCap = staff.filter((s) => s.night_available).length
  const totalMaxNight = staff.reduce((sum, s) => sum + (s.night_available ? s.max_night : 0), 0)
  const totalReqN = dayConditions
    .filter((dc) => dc.date.startsWith(monthPrefix))
    .reduce((sum, dc) => sum + (dc.required_per_shift?.N ?? defaultRequiredForDate(dc.date).N), 0)
  const nightFeasible = nightCap >= 2 && totalMaxNight >= totalReqN

  const steps = [
    {
      id: 'staff',
      label: 'スタッフ登録',
      Icon: IconStaff,
      status: staff.length >= 5 ? 'done' : staff.length > 0 ? 'partial' : 'todo',
      detail: staff.length === 0 ? '0名 — 最低5名以上推奨' : `${staff.length}名（夜勤可${nightCap}名）`,
    },
    {
      id: 'wish',
      label: '希望休・有給',
      Icon: IconCalendar,
      status: wishCount > 0 ? 'done' : 'optional',
      detail: wishCount > 0 ? `${wishCount}件登録` : '希望休が無くてもOK',
    },
    {
      id: 'event',
      label: 'イベント',
      Icon: IconStar,
      status: eventCount > 0 ? 'done' : 'optional',
      detail: eventCount > 0 ? `${eventCount}件登録` : '会議・研修などあれば',
    },
    {
      id: 'condition',
      label: '日別人数',
      Icon: IconSettings,
      status: customDayCount > 0 ? 'done' : 'optional',
      detail: customDayCount > 0 ? `${customDayCount}日カスタム` : 'デフォルト（日勤3名・夜勤2名）',
    },
  ]

  // ─── シフトの健全性チェック ───
  const issues = []
  const wins = []

  if (schedule && summary) {
    // 夜勤公平性
    const nightCapStaff = staff.filter((s) => s.night_available)
    const nightCounts = nightCapStaff.map((s) => summary[s.id]?.night_count ?? 0)
    if (nightCounts.length > 1) {
      const max = Math.max(...nightCounts)
      const min = Math.min(...nightCounts)
      const diff = max - min
      if (diff <= 1) {
        wins.push({ Icon: IconScale, label: '夜勤公平性 ◎', detail: `最大差 ${diff}回` })
      } else if (diff <= 2) {
        wins.push({ Icon: IconScale, label: '夜勤公平性 ○', detail: `最大差 ${diff}回` })
      } else {
        issues.push({
          severity: 'warn',
          Icon: IconScale,
          label: `夜勤に偏りあり (最大差 ${diff}回)`,
          hint: 'スタッフのmax_nightや希望休を見直してください',
        })
      }
    }

    // 法定公休
    const lowOff = staff.filter((s) => {
      const sm = summary[s.id]
      if (!sm) return false
      return (sm.off_count + sm.paid_leave_count) < 8
    })
    if (lowOff.length > 0) {
      issues.push({
        severity: 'danger',
        Icon: IconShield,
        label: `公休8日未満: ${lowOff.length}名`,
        detail: lowOff.map((s) => s.name).join('、'),
        hint: '夜勤上限を増やすか、希望休を減らしてみてください',
      })
    } else {
      wins.push({ Icon: IconShield, label: '法定公休 ◎', detail: '全員8日以上' })
    }

    // 希望休達成率
    const monthWishes = wishes.filter((w) => w.date.startsWith(monthPrefix) && w.type === '希望休')
    if (monthWishes.length > 0) {
      const fulfilled = monthWishes.filter((w) => schedule[w.staff_id]?.[w.date] === 'O').length
      const rate = Math.round((fulfilled / monthWishes.length) * 100)
      if (rate >= 90) {
        wins.push({ Icon: IconCheck, label: `希望休 ${rate}%`, detail: `${fulfilled}/${monthWishes.length}件達成` })
      } else if (rate >= 70) {
        wins.push({ Icon: IconCheck, label: `希望休 ${rate}%`, detail: `${fulfilled}/${monthWishes.length}件達成` })
      } else {
        issues.push({
          severity: 'warn',
          Icon: IconWarning,
          label: `希望休達成率 ${rate}%`,
          hint: '一部の希望休が叶っていません。集計画面で確認できます',
        })
      }
    }

    // N→A 違反チェック（手動編集後のため）
    let chainErrors = 0
    Object.entries(schedule).forEach(([sid, days]) => {
      const dates = Object.keys(days).sort()
      dates.forEach((d, i) => {
        if (days[d] === 'N' && i + 1 < dates.length && days[dates[i + 1]] !== 'A') chainErrors++
      })
    })
    if (chainErrors > 0) {
      issues.push({
        severity: 'danger',
        Icon: IconWarning,
        label: `夜勤→明けの違反: ${chainErrors}件`,
        hint: '手動編集で N の翌日が A 以外になっています',
      })
    }

    // 日勤・夜勤の充足チェック
    let shortageDays = 0
    dayConditions
      .filter((dc) => dc.date.startsWith(monthPrefix))
      .forEach((dc) => {
        const base = defaultRequiredForDate(dc.date)
        const reqD = dc.required_per_shift?.D ?? base.D
        const reqN = dc.required_per_shift?.N ?? base.N
        const dCount = staff.filter((s) => schedule[s.id]?.[dc.date] === 'D').length
        const nCount = staff.filter((s) => schedule[s.id]?.[dc.date] === 'N').length
        if (dCount < reqD || nCount < reqN) shortageDays++
      })
    if (shortageDays > 0) {
      issues.push({
        severity: 'warn',
        Icon: IconWarning,
        label: `人員不足の日: ${shortageDays}日`,
        hint: 'シフト表で「実績<必要」の日を確認してください',
      })
    } else {
      wins.push({ Icon: IconCheck, label: '人員充足 ◎', detail: '全日とも必要人数を満たしています' })
    }

    // ロック数
    const lockCount = Object.values(locks || {}).reduce((s, m) => s + Object.keys(m).length, 0)
    if (lockCount > 0) {
      wins.push({ Icon: IconLock, label: `ロック中: ${lockCount}セル`, detail: '再生成しても保持されます' })
    }
  }

  const lockCount = Object.values(locks || {}).reduce((s, m) => s + Object.keys(m).length, 0)
  const hasSchedule = !!schedule

  // メイン CTA
  const cta = !hasSchedule
    ? { label: 'シフトを生成', sub: '入力した条件で自動生成します', enabled: staff.length > 0 }
    : lockCount > 0
      ? { label: `ロックを保持して再生成（${lockCount}セル固定）`, sub: '固定したセル以外を作り直します', enabled: true }
      : { label: 'シフトを再生成', sub: '条件を変えた場合に押してください', enabled: true }

  return (
    <div className="dashboard">
      {/* === ヘッダーカード === */}
      <div className="dash-hero">
        <div className="dash-hero-left">
          <div className="dash-hero-month">{year}年 {month}月のシフト</div>
          <div className="dash-hero-sub">{numDays}日間 · スタッフ {staff.length}名</div>
        </div>
        <div className="dash-hero-right">
          <button
            className="dash-generate-btn"
            onClick={onGenerate}
            disabled={!cta.enabled || loading}
          >
            {loading ? <span className="spinner" /> : <IconPlay size={26} />}
            <div className="dash-gen-label">
              <div className="dash-gen-main">{cta.label}</div>
              <div className="dash-gen-sub">{cta.sub}</div>
            </div>
          </button>
        </div>
      </div>

      {/* === 準備状況 === */}
      <div className="dash-section">
        <h3 className="dash-section-title">準備状況</h3>
        <div className="dash-steps">
          {steps.map(({ id, label, Icon, status, detail }) => (
            <button
              key={id}
              className={`dash-step dash-step-${status}`}
              onClick={() => onJumpToTab(id)}
            >
              <div className="dash-step-icon"><Icon size={28} /></div>
              <div className="dash-step-body">
                <div className="dash-step-label">{label}</div>
                <div className="dash-step-detail">{detail}</div>
              </div>
              <div className="dash-step-status">
                {status === 'done' && <IconCheck size={22} />}
                {status === 'partial' && <span className="dash-status-dot dash-dot-warn" />}
                {status === 'todo' && <span className="dash-status-dot dash-dot-todo" />}
                {status === 'optional' && <span className="dash-step-skip">任意</span>}
              </div>
            </button>
          ))}
        </div>
        {!nightFeasible && staff.length > 0 && (
          <div className="dash-alert dash-alert-danger">
            <IconWarning size={22} />
            <div>
              <strong>夜勤の供給不足:</strong> 必要 {totalReqN} 回 / スタッフ上限合計 {totalMaxNight} 回。
              スタッフの max_night を見直してください。
            </div>
          </div>
        )}
      </div>

      {/* === 健全性 === */}
      {hasSchedule && (
        <div className="dash-section">
          <h3 className="dash-section-title">シフト健全性</h3>
          <div className="dash-health">
            <div className="dash-wins">
              {wins.length === 0 ? (
                <div className="dash-empty-muted">表示できるOK項目がありません</div>
              ) : (
                wins.map((w, i) => (
                  <div key={i} className="dash-win">
                    <span className="dash-win-icon"><w.Icon size={20} /></span>
                    <span className="dash-win-label">{w.label}</span>
                    <span className="dash-win-detail">{w.detail}</span>
                  </div>
                ))
              )}
            </div>
            {issues.length > 0 && (
              <div className="dash-issues">
                {issues.map((iss, i) => (
                  <div key={i} className={`dash-issue dash-issue-${iss.severity}`}>
                    <span className="dash-issue-icon"><iss.Icon size={22} /></span>
                    <div className="dash-issue-body">
                      <div className="dash-issue-label">{iss.label}</div>
                      {iss.detail && <div className="dash-issue-detail">{iss.detail}</div>}
                      {iss.hint && <div className="dash-issue-hint"><IconLightbulb size={16} /> {iss.hint}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === クイックリンク === */}
      <div className="dash-section">
        <h3 className="dash-section-title">クイックジャンプ</h3>
        <div className="dash-quick">
          <button className="dash-quick-card" onClick={() => onJumpToTab('table')}>
            <IconTable size={28} />
            <div>
              <div className="dash-quick-label">シフト表</div>
              <div className="dash-quick-sub">{hasSchedule ? '生成済み' : '未生成'}</div>
            </div>
          </button>
          <button className="dash-quick-card" onClick={() => onJumpToTab('summary')}>
            <IconChart size={28} />
            <div>
              <div className="dash-quick-label">集計</div>
              <div className="dash-quick-sub">公平性スコア・夜勤分布</div>
            </div>
          </button>
          <button className="dash-quick-card" onClick={() => onJumpToTab('staff')}>
            <IconStaff size={28} />
            <div>
              <div className="dash-quick-label">スタッフ</div>
              <div className="dash-quick-sub">{staff.length}名 · ペア{pairs.length}件</div>
            </div>
          </button>
          <button className="dash-quick-card" onClick={() => onJumpToTab('wish')}>
            <IconCalendar size={28} />
            <div>
              <div className="dash-quick-label">希望入力</div>
              <div className="dash-quick-sub">今月 {wishCount}件</div>
            </div>
          </button>
        </div>
      </div>

      {/* === 月別バッジ === */}
      <div className="dash-section">
        <h3 className="dash-section-title">最近のシフト</h3>
        <div className="dash-months">
          {Object.keys(schedules || {})
            .sort()
            .reverse()
            .slice(0, 6)
            .map((k) => {
              const [y, m] = k.split('-')
              return (
                <span key={k} className={`dash-month-chip ${k === `${year}-${String(month).padStart(2, '0')}` ? 'current' : ''}`}>
                  {y}/{Number(m)}月 <IconCheck size={14} />
                </span>
              )
            })}
          {Object.keys(schedules || {}).length === 0 && (
            <span className="dash-empty-muted">まだ生成済みのシフトはありません</span>
          )}
        </div>
      </div>
    </div>
  )
}
