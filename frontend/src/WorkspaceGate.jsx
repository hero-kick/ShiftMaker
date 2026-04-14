import React, { useEffect, useState } from 'react'
import {
  listWorkspaces,
  createWorkspace,
  verifyPasscode,
  setCurrentWorkspaceId,
  deleteWorkspace,
  migrateLegacyIfNeeded,
} from './workspace'

export default function WorkspaceGate({ onEnter }) {
  const [workspaces, setWorkspaces] = useState([])
  const [mode, setMode] = useState('list') // 'list' | 'create' | 'unlock'
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [passcode, setPasscode] = useState('')
  const [passcode2, setPasscode2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => setWorkspaces(listWorkspaces())

  useEffect(() => {
    ;(async () => {
      const migrated = await migrateLegacyIfNeeded()
      refresh()
      if (migrated) {
        // 旧データを自動移行した場合はそのまま入る
        setCurrentWorkspaceId(migrated)
        onEnter(migrated)
      }
    })()
  }, [])

  // 一覧が空なら新規作成画面へ自動遷移
  useEffect(() => {
    if (mode === 'list' && workspaces.length === 0) setMode('create')
  }, [workspaces, mode])

  const handleSelect = (ws) => {
    setError('')
    setPasscode('')
    setSelected(ws)
    if (ws.hasPasscode) {
      setMode('unlock')
    } else {
      setCurrentWorkspaceId(ws.id)
      onEnter(ws.id)
    }
  }

  const handleUnlock = async (e) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    const ok = await verifyPasscode(selected, passcode)
    setBusy(false)
    if (!ok) {
      setError('PINコードが違います')
      return
    }
    setCurrentWorkspaceId(selected.id)
    onEnter(selected.id)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }
    if (passcode && passcode !== passcode2) {
      setError('PINコードが一致しません')
      return
    }
    try {
      setBusy(true)
      const id = await createWorkspace(name, passcode)
      setCurrentWorkspaceId(id)
      onEnter(id)
    } catch (err) {
      setError(err.message || '作成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = (ws, e) => {
    e.stopPropagation()
    if (!window.confirm(`「${ws.name}」を削除します。\nこのワークスペースのスタッフ・希望・シフト表がすべて消えます。本当に削除しますか？`)) return
    deleteWorkspace(ws.id)
    refresh()
  }

  return (
    <div className="ws-gate">
      <div className="ws-card">
        <div className="ws-header">
          <h1>ShiftMaker</h1>
          <p className="ws-subtitle">ワークスペースを選択してください</p>
        </div>

        {mode === 'list' && (
          <>
            <ul className="ws-list">
              {workspaces.map((ws) => (
                <li key={ws.id} className="ws-item" onClick={() => handleSelect(ws)}>
                  <div className="ws-item-main">
                    <div className="ws-item-name">{ws.name}</div>
                    <div className="ws-item-meta">
                      {ws.hasPasscode ? '🔒 PIN保護' : '未保護'}
                    </div>
                  </div>
                  <button
                    className="ws-item-delete"
                    onClick={(e) => handleDelete(ws, e)}
                    title="削除"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button className="ws-btn ws-btn-primary" onClick={() => { setMode('create'); setName(''); setPasscode(''); setPasscode2(''); setError('') }}>
              + 新しいワークスペースを作成
            </button>
          </>
        )}

        {mode === 'unlock' && selected && (
          <form onSubmit={handleUnlock} className="ws-form">
            <div className="ws-form-title">「{selected.name}」を開く</div>
            <label className="ws-label">
              PINコード
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="ws-input"
                placeholder="PINコード"
              />
            </label>
            {error && <div className="ws-error">{error}</div>}
            <div className="ws-form-actions">
              <button type="button" className="ws-btn ws-btn-secondary" onClick={() => { setMode('list'); setError('') }}>戻る</button>
              <button type="submit" className="ws-btn ws-btn-primary" disabled={busy}>開く</button>
            </div>
          </form>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="ws-form">
            <div className="ws-form-title">新しいワークスペース</div>
            <label className="ws-label">
              名前（例: 山田病棟 / 自分用）
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ws-input"
                placeholder="ワークスペース名"
                maxLength={30}
              />
            </label>
            <label className="ws-label">
              PINコード（任意・端末の覗き見防止）
              <input
                type="password"
                inputMode="numeric"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="ws-input"
                placeholder="空欄可"
              />
            </label>
            {passcode && (
              <label className="ws-label">
                PINコード（確認）
                <input
                  type="password"
                  inputMode="numeric"
                  value={passcode2}
                  onChange={(e) => setPasscode2(e.target.value)}
                  className="ws-input"
                  placeholder="もう一度"
                />
              </label>
            )}
            {error && <div className="ws-error">{error}</div>}
            <div className="ws-form-actions">
              {workspaces.length > 0 && (
                <button type="button" className="ws-btn ws-btn-secondary" onClick={() => { setMode('list'); setError('') }}>戻る</button>
              )}
              <button type="submit" className="ws-btn ws-btn-primary" disabled={busy}>作成して開く</button>
            </div>
          </form>
        )}

        <div className="ws-footer">
          データはこの端末のブラウザにのみ保存されます。サーバには送信・保存されません。
        </div>
      </div>
    </div>
  )
}
