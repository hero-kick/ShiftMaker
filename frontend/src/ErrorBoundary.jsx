import React from 'react'

/**
 * アプリ全体を包む Error Boundary。
 * 子コンポーネントが描画中に throw しても画面が真っ白にならず、
 * 復旧 UI（リロード / データ書き出し）を表示する。
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // 本番では監視サービスへ送る想定。今はコンソールに残す。
    console.error('[ShiftMaker] Uncaught error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleExportBackup = () => {
    // localStorage 全体をダウンロードして、復旧不能時のデータ救出に使う
    try {
      const dump = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('shiftmaker')) {
          dump[k] = localStorage.getItem(k)
        }
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shiftmaker-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('バックアップの書き出しに失敗しました: ' + e.message)
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const msg = this.state.error?.message || '不明なエラー'
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-icon">⚠️</div>
          <h1 className="error-boundary-title">予期しないエラーが発生しました</h1>
          <p className="error-boundary-lead">
            ご迷惑をおかけします。下のボタンで画面を再読み込みすると復旧することがほとんどです。
            データはこの端末に保存されているため、消えていません。
          </p>
          <div className="error-boundary-detail">
            <code>{msg}</code>
          </div>
          <div className="error-boundary-actions">
            <button className="error-boundary-btn error-boundary-btn-primary" onClick={this.handleReload}>
              画面を再読み込み
            </button>
            <button className="error-boundary-btn" onClick={this.handleExportBackup}>
              データをバックアップ保存
            </button>
          </div>
          <p className="error-boundary-help">
            再読み込みしても直らない場合は、上の「データをバックアップ保存」でファイルを保存してから、
            管理者にお問い合わせください。
          </p>
        </div>
      </div>
    )
  }
}
