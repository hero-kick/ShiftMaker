import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'

const SECTIONS = [
  { id: 'flow', label: '全体の流れ', icon: '🚀' },
  { id: 'tabs', label: '各タブの使い方', icon: '📑' },
  { id: 'codes', label: 'シフト記号', icon: '🎨' },
  { id: 'tips', label: 'コツとヒント', icon: '💡' },
  { id: 'data', label: 'データと安全性', icon: '🔒' },
  { id: 'faq', label: 'よくある質問', icon: '❓' },
]

export default function Guide({ open, onClose, onJumpToTab }) {
  const [active, setActive] = useState('flow')

  useEffect(() => {
    if (!open) return
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const jump = (tabId) => {
    if (onJumpToTab) onJumpToTab(tabId)
    onClose()
  }

  return ReactDOM.createPortal(
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <header className="guide-header">
          <div>
            <h2 className="guide-title">使い方ガイド</h2>
            <p className="guide-subtitle">ShiftMaker の操作と仕組み</p>
          </div>
          <button className="guide-close" onClick={onClose} aria-label="閉じる">×</button>
        </header>

        <nav className="guide-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`guide-nav-btn ${active === s.id ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span className="guide-nav-icon">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <main className="guide-body">
          {active === 'flow' && <SectionFlow jump={jump} />}
          {active === 'tabs' && <SectionTabs jump={jump} />}
          {active === 'codes' && <SectionCodes />}
          {active === 'tips' && <SectionTips />}
          {active === 'data' && <SectionData />}
          {active === 'faq' && <SectionFAQ />}
        </main>
      </div>
    </div>,
    document.body
  )
}

function SectionFlow({ jump }) {
  const steps = [
    { n: 1, tab: 'staff', title: 'スタッフを登録', desc: '名前、夜勤可否、月の夜勤上限、連勤の上限を入力します。', cta: 'スタッフ管理を開く' },
    { n: 2, tab: 'wish', title: '希望休・有給を入力', desc: 'カレンダーをタップして、休みたい日や有給を取りたい日を指定します。', cta: '希望入力を開く' },
    { n: 3, tab: 'event', title: 'イベントを設定（任意）', desc: '会議や研修など「特定のスタッフが必ず出勤する日」を登録します。', cta: 'イベントを開く' },
    { n: 4, tab: 'condition', title: '日別の必要人数を確認', desc: '各日に必要な日勤・夜勤の人数を確認・調整します。', cta: '日別条件を開く' },
    { n: 5, tab: null, title: 'シフト生成', desc: '画面右上の「シフト生成」ボタンを押します。最大1分待ちます。', cta: null },
    { n: 6, tab: 'table', title: '結果の確認', desc: 'シフト表で結果を確認。気になる箇所はセルを直接タップして編集できます。', cta: 'シフト表を見る' },
    { n: 7, tab: 'summary', title: '集計でバランスチェック', desc: '各スタッフの夜勤回数や休日日数を確認し、偏りがないか見ます。', cta: '集計を見る' },
  ]
  return (
    <div className="guide-section">
      <p className="guide-lead">
        スタッフ登録 → 希望入力 → 生成 → 確認、の順で進めます。<br />
        全部で <strong>5分〜10分</strong>で1ヶ月分のシフトが完成します。
      </p>
      <ol className="guide-steps">
        {steps.map((s) => (
          <li key={s.n} className="guide-step">
            <div className="guide-step-num">{s.n}</div>
            <div className="guide-step-body">
              <div className="guide-step-title">{s.title}</div>
              <div className="guide-step-desc">{s.desc}</div>
              {s.tab && s.cta && (
                <button className="guide-step-cta" onClick={() => jump(s.tab)}>{s.cta} →</button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function SectionTabs({ jump }) {
  const tabs = [
    {
      id: 'staff',
      title: 'スタッフ管理',
      icon: '👥',
      body: [
        '勤務するスタッフを登録します。',
        '・「⚡まとめて追加」: 役職と人数を指定すると「看護師1, 看護師2...」と一気に登録（本名は後で編集可）',
        '・夜勤可否: 夜勤を入れない人は OFF にします',
        '・月の夜勤上限: 例 8 にすると月8回まで',
        '・連勤の上限: 例 5 にすると6連勤以上を避けます',
      ],
    },
    {
      id: 'wish',
      title: '希望入力',
      icon: '📅',
      body: [
        'スタッフを選んで、カレンダー上で日付をタップすると希望が登録できます。',
        '・希望休: 可能な限り「休み」になります（必ずではない）',
        '・有給: 指定した日に有給が割り当てられます',
        '・出勤: 会議など、その日は必ず出勤する（休み・有給にしない）',
        '※ もう一度タップすると取り消せます',
      ],
    },
    {
      id: 'event',
      title: 'イベント',
      icon: '⭐',
      body: [
        '病棟会議や研修など、特定スタッフが必ず出勤する日を登録します。',
        '・「必須スタッフ」に追加した人はその日に休みになりません',
        '・「不可スタッフ」に追加した人はその日に必ず休みになります',
      ],
    },
    {
      id: 'condition',
      title: '日別条件',
      icon: '🔢',
      body: [
        '各日の必要人数を調整します（初期値は日勤3名、夜勤2名）。',
        '休日や繁忙日に合わせて増減できます。',
      ],
    },
    {
      id: 'table',
      title: 'シフト表',
      icon: '📋',
      body: [
        '生成されたシフトを確認します。',
        '・セルをタップして手動編集も可能',
        '・スマホでは「個人別」「全体」を切り替え表示',
      ],
    },
    {
      id: 'summary',
      title: '集計',
      icon: '📊',
      body: [
        '各スタッフの集計を確認します。',
        '・日勤、夜勤、休み、有給の回数',
        '・偏りがないかチェックして、気になれば手動編集に戻ります',
      ],
    },
  ]
  return (
    <div className="guide-section">
      {tabs.map((t) => (
        <div key={t.id} className="guide-tab-card">
          <div className="guide-tab-head">
            <span className="guide-tab-icon">{t.icon}</span>
            <span className="guide-tab-name">{t.title}</span>
            <button className="guide-tab-jump" onClick={() => jump(t.id)}>開く →</button>
          </div>
          <ul className="guide-tab-body">
            {t.body.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

function SectionCodes() {
  const codes = [
    { code: 'D', name: '日勤', color: '#4CAF50', desc: '通常の日勤' },
    { code: 'N', name: '夜勤', color: '#9C27B0', desc: '夜勤。翌日は必ず「A（明け）」になります' },
    { code: 'A', name: '明け', color: '#FF9800', desc: '夜勤明け。前日は必ず「N」、翌日は休みになりやすい' },
    { code: 'O', name: '休み', color: '#9E9E9E', desc: '通常の休日' },
    { code: 'Y', name: '有給', color: '#2196F3', desc: '希望入力で指定した日にのみ割当' },
  ]
  return (
    <div className="guide-section">
      <p className="guide-lead">シフト表に表示される記号と意味です。</p>
      <div className="guide-codes">
        {codes.map((c) => (
          <div key={c.code} className="guide-code-row">
            <span className="guide-code-chip" style={{ background: c.color }}>{c.code}</span>
            <div className="guide-code-info">
              <div className="guide-code-name">{c.name}</div>
              <div className="guide-code-desc">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="guide-note">
        <strong>夜勤のルール:</strong> N（夜勤）の翌日は必ず A（明け）になります。A の翌日は休みになりやすい設定です。
      </div>
    </div>
  )
}

function SectionTips() {
  return (
    <div className="guide-section">
      <ul className="guide-tips">
        <li>
          <strong>シフト生成に失敗するとき</strong><br />
          スタッフが少ない、夜勤可能者の上限が少なすぎる、必要人数が多すぎる、などが原因です。エラーメッセージに具体的な原因が表示されます。
        </li>
        <li>
          <strong>夜勤回数のバランス</strong><br />
          各スタッフの「月の夜勤上限」を同じくらいにそろえると、生成結果のバランスが良くなります。
        </li>
        <li>
          <strong>セルの手動修正</strong><br />
          シフト表でセルをタップすると、その場でシフトコードを変更できます。生成結果を微調整したいときに便利です。
        </li>
        <li>
          <strong>前月の引き継ぎ</strong><br />
          前月のシフトを生成しておくと、月末の夜勤が翌月1日に自動で「明け」として引き継がれます。
        </li>
        <li>
          <strong>月切り替え</strong><br />
          画面上部の年月セレクタから別の月に切り替えられます。直近3ヶ月のシフトは自動で保存されます。
        </li>
      </ul>
    </div>
  )
}

function SectionData() {
  return (
    <div className="guide-section">
      <h3 className="guide-h3">データはどこに保存されますか？</h3>
      <p>
        スタッフ名、希望、シフト表などすべての情報は <strong>あなたのスマホ（ブラウザ）の中にのみ</strong> 保存されます。
        サーバには一切送信・保存されません。
      </p>

      <h3 className="guide-h3">他の人にはデータが見えますか？</h3>
      <p>
        いいえ。同じURLを使っていても、 <strong>端末（スマホ）ごとに独立した保存領域</strong> を持っています。
        他人のスタッフ・希望・シフトは見えません。
      </p>

      <h3 className="guide-h3">ワークスペースとは？</h3>
      <p>
        1つの端末で複数の人（例えば家族）が使えるよう、データを分ける仕組みです。
        画面右上の「👤名前」ボタンから切り替えられます。
      </p>

      <h3 className="guide-h3">PINコードについて</h3>
      <p>
        ワークスペース作成時に任意で設定できます。設定すると、ブラウザのタブを開き直したときに PIN 入力が必要になり、
        端末を他人が触ってもデータが見られません。PIN自体はハッシュ化されて保存され、原文は残りません。
      </p>

      <h3 className="guide-h3">データをバックアップしたい</h3>
      <p>
        現状はバックアップ機能がありません。機種変更などでデータを移したい場合は、必要に応じて追加機能を依頼してください。
      </p>
    </div>
  )
}

function SectionFAQ() {
  const items = [
    {
      q: '画面が真っ白で動かない',
      a: 'サーバが起き上がっている最中（無料プランの仕様で15分アクセスがないとスリープ）。30〜60秒待つと表示されます。閉じずに待ってください。',
    },
    {
      q: 'シフト生成に時間がかかる',
      a: '内部の最適化計算に最大55秒かかります。スピナーが回っている間はそのまま待ってください。',
    },
    {
      q: '「実行不可能」と出る',
      a: '制約が厳しすぎる状態です。夜勤可能スタッフを増やす、夜勤上限を上げる、必要人数を下げる、などで解消します。',
    },
    {
      q: '希望を入れたのに反映されない',
      a: '希望休は「ソフト制約」なので、必ずではなく可能な限り反映します。どうしても外せない予定は「有給」または「イベントの不可スタッフ」に入れてください。',
    },
    {
      q: 'スタッフを削除したらデータは戻る？',
      a: 'いいえ、削除すると元に戻せません。間違えた場合は再登録してください。',
    },
    {
      q: 'スマホアプリのように使いたい',
      a: 'Safari/Chromeの共有ボタンから「ホーム画面に追加」をすると、アプリのアイコンのように起動できます。',
    },
  ]
  return (
    <div className="guide-section">
      {items.map((it, i) => (
        <details key={i} className="guide-faq">
          <summary>{it.q}</summary>
          <p>{it.a}</p>
        </details>
      ))}
    </div>
  )
}
