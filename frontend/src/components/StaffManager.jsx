import React, { useState } from 'react'
import useStore from '../store/useStore'
import useIsMobile from '../hooks/useIsMobile'

const defaultForm = {
  name: '',
  role: '',
  night_available: true,
  max_night: 8,
  max_consecutive_days: 5,
  max_consecutive_nights: 2,
  is_rookie: false,
  can_lead: false,
  fixed_off_weekdays: [],
}

const defaultBulkForm = {
  role: '看護師',
  count: 5,
  night_available: true,
  max_night: 8,
  max_consecutive_days: 5,
  max_consecutive_nights: 2,
  is_rookie: false,
  can_lead: false,
  fixed_off_weekdays: [],
}

const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日']

function WeekdayPicker({ value = [], onChange, idPrefix }) {
  const toggle = (i) => {
    const set = new Set(value)
    if (set.has(i)) set.delete(i)
    else set.add(i)
    onChange([...set].sort((a, b) => a - b))
  }
  return (
    <div className="weekday-picker">
      {WEEKDAY_NAMES.map((n, i) => {
        const on = value.includes(i)
        return (
          <button
            type="button"
            key={i}
            className={`weekday-pick-btn ${on ? 'is-on' : ''} ${i === 5 ? 'sat' : ''} ${i === 6 ? 'sun' : ''}`}
            onClick={() => toggle(i)}
            aria-label={`${n}曜固定休 ${on ? '解除' : '設定'}`}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

export default function StaffManager() {
  const { staff, pairs, addStaff, addStaffBulk, updateStaff, removeStaff, addPair, removePair, moveStaff } = useStore()
  const [form, setForm] = useState(defaultForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState(defaultBulkForm)
  const [bulkError, setBulkError] = useState('')

  // ペア制約フォーム
  const [pairForm, setPairForm] = useState({ a: '', b: '', type: 'forbid' })
  const [pairError, setPairError] = useState('')

  const submitPair = () => {
    setPairError('')
    if (!pairForm.a || !pairForm.b) {
      setPairError('2名を選択してください')
      return
    }
    if (pairForm.a === pairForm.b) {
      setPairError('同じスタッフは選べません')
      return
    }
    addPair({ staff_a_id: pairForm.a, staff_b_id: pairForm.b, type: pairForm.type })
    setPairForm({ a: '', b: '', type: pairForm.type })
  }

  const staffNameById = (id) => staff.find((s) => s.id === id)?.name || '?'

  const isMobile = useIsMobile()

  const handleBulkChange = (e) => {
    const { name, value, type, checked } = e.target
    setBulkForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  const handleBulkSubmit = (e) => {
    e.preventDefault()
    const role = bulkForm.role.trim()
    if (!role) {
      setBulkError('役職名を入力してください')
      return
    }
    if (!bulkForm.count || bulkForm.count < 1 || bulkForm.count > 50) {
      setBulkError('人数は 1〜50 の範囲で指定してください')
      return
    }
    addStaffBulk({ ...bulkForm, role })
    setBulkError('')
    setBulkOpen(false)
    setBulkForm(defaultBulkForm)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('名前を入力してください')
      return
    }
    if (staff.some((s) => s.name === form.name.trim())) {
      setError('同名のスタッフが既に登録されています')
      return
    }
    addStaff({ ...form, name: form.name.trim() })
    setForm(defaultForm)
    setError('')
    if (isMobile) setFormOpen(false)
  }

  const startEdit = (s) => {
    setEditingId(s.id)
    setEditForm({ ...s })
  }

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  const [editError, setEditError] = useState('')

  const saveEdit = (id) => {
    const name = (editForm.name || '').trim()
    if (!name) {
      setEditError('名前を入力してください')
      return
    }
    // 自分以外に同名がいないか
    if (staff.some((s) => s.id !== id && s.name === name)) {
      setEditError('同名のスタッフが既に登録されています')
      return
    }
    // 数値フィールドの範囲を丸める
    const clamp = (v, lo, hi, dflt) => {
      const n = Number(v)
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt
    }
    updateStaff(id, {
      ...editForm,
      name,
      role: (editForm.role || '').trim(),
      max_night: clamp(editForm.max_night, 0, 31, 8),
      max_consecutive_days: clamp(editForm.max_consecutive_days, 1, 31, 5),
      max_consecutive_nights: clamp(editForm.max_consecutive_nights, 1, 31, 2),
    })
    setEditingId(null)
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const handleDelete = (s) => {
    if (!window.confirm(`「${s.name}」を削除しますか？`)) return
    removeStaff(s.id)
  }

  const nightCount = staff.filter((s) => s.night_available).length
  const dayOnlyCount = staff.length - nightCount

  // Bulk add form (shared between mobile / desktop)
  const bulkAddForm = (
    <form onSubmit={handleBulkSubmit} className="staff-form bulk-form">
      <div className="bulk-hint">
        役職名 + 人数で <strong>「{bulkForm.role || '役職'}1, {bulkForm.role || '役職'}2 ...」</strong> のように
        まとめて登録します。あとから個別に名前を編集できます。
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>役職名 <span className="required">*</span></label>
          <input
            type="text"
            name="role"
            value={bulkForm.role}
            onChange={handleBulkChange}
            placeholder="例: 看護師 / 主任 / 准看護師"
            maxLength={20}
          />
        </div>
        <div className="form-group">
          <label>人数 <span className="required">*</span></label>
          <input type="number" name="count" value={bulkForm.count} onChange={handleBulkChange} min="1" max="50" />
        </div>
        <div className="form-group">
          <label>夜勤上限</label>
          <input type="number" name="max_night" value={bulkForm.max_night} onChange={handleBulkChange} min="0" max="20" />
        </div>
        <div className="form-group">
          <label>連続勤務上限</label>
          <input type="number" name="max_consecutive_days" value={bulkForm.max_consecutive_days} onChange={handleBulkChange} min="1" max="14" />
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="night_available" checked={bulkForm.night_available} onChange={handleBulkChange} />
            全員 夜勤可能
          </label>
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="can_lead" checked={bulkForm.can_lead} onChange={handleBulkChange} />
            全員 リーダー可能
          </label>
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="is_rookie" checked={bulkForm.is_rookie} onChange={handleBulkChange} />
            全員 新人
          </label>
        </div>
        <div className="form-group">
          <label>連続夜勤上限</label>
          <input type="number" name="max_consecutive_nights" value={bulkForm.max_consecutive_nights} onChange={handleBulkChange} min="1" max="5" />
        </div>
        <button type="submit" className="btn btn-primary">{bulkForm.count}名 一括追加</button>
      </div>
      {bulkError && <p className="error-msg">{bulkError}</p>}
    </form>
  )

  // Mobile: collapsible add form
  const addForm = (
    <form onSubmit={handleSubmit} className="staff-form">
      <div className="form-row">
        <div className="form-group">
          <label>名前 <span className="required">*</span></label>
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="例: 田中 花子" autoFocus={isMobile} />
        </div>
        <div className="form-group">
          <label>役職</label>
          <input type="text" name="role" value={form.role} onChange={handleChange} placeholder="例: 看護師" />
        </div>
        <div className="form-group">
          <label>夜勤上限</label>
          <input type="number" name="max_night" value={form.max_night} onChange={handleChange} min="0" max="20" />
        </div>
        <div className="form-group">
          <label>連続勤務上限</label>
          <input type="number" name="max_consecutive_days" value={form.max_consecutive_days} onChange={handleChange} min="1" max="14" />
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="night_available" checked={form.night_available} onChange={handleChange} />
            夜勤可能
          </label>
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="can_lead" checked={form.can_lead} onChange={handleChange} />
            リーダー可能
          </label>
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="is_rookie" checked={form.is_rookie} onChange={handleChange} />
            新人
          </label>
        </div>
        <div className="form-group">
          <label>連続夜勤上限</label>
          <input type="number" name="max_consecutive_nights" value={form.max_consecutive_nights} onChange={handleChange} min="1" max="5" />
        </div>
        <div className="form-group form-group-wide">
          <label>固定休曜日（任意・複数選択可）</label>
          <WeekdayPicker
            value={form.fixed_off_weekdays || []}
            onChange={(v) => setForm({ ...form, fixed_off_weekdays: v })}
            idPrefix="add"
          />
        </div>
        <button type="submit" className="btn btn-primary">追加</button>
      </div>
      {error && <p className="error-msg">{error}</p>}
    </form>
  )

  return (
    <div className="staff-manager">
      {!isMobile && <h2>スタッフ管理</h2>}

      {/* Mobile: collapsible form / Desktop: always visible */}
      {isMobile ? (
        <>
          {formOpen ? (
            <div className="card mobile-form-card">
              <div className="mobile-form-header">
                <h3 style={{ margin: 0, border: 'none', padding: 0 }}>新規追加</h3>
                <button className="mobile-form-close" onClick={() => { setFormOpen(false); setError('') }}>✕</button>
              </div>
              {addForm}
            </div>
          ) : bulkOpen ? (
            <div className="card mobile-form-card">
              <div className="mobile-form-header">
                <h3 style={{ margin: 0, border: 'none', padding: 0 }}>まとめて追加</h3>
                <button className="mobile-form-close" onClick={() => { setBulkOpen(false); setBulkError('') }}>✕</button>
              </div>
              {bulkAddForm}
            </div>
          ) : (
            <div className="mobile-add-row">
              <button className="mobile-add-btn mobile-add-btn-secondary" onClick={() => setBulkOpen(true)}>
                <span className="mobile-add-icon">⚡</span>
                まとめて追加
              </button>
              <button className="mobile-add-btn" onClick={() => setFormOpen(true)}>
                <span className="mobile-add-icon">+</span>
                1名追加
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card">
            <div className="staff-form-tabs">
              <button
                className={`staff-form-tab ${!bulkOpen ? 'active' : ''}`}
                onClick={() => setBulkOpen(false)}
              >
                1名ずつ追加
              </button>
              <button
                className={`staff-form-tab ${bulkOpen ? 'active' : ''}`}
                onClick={() => setBulkOpen(true)}
              >
                ⚡ まとめて追加（おすすめ）
              </button>
            </div>
            {bulkOpen ? bulkAddForm : addForm}
          </div>
        </>
      )}

      {/* Staff list */}
      <div className={isMobile ? '' : 'card'}>
        <div className="staff-list-header">
          <span className="staff-list-title">
            {staff.length}名{staff.length > 0 && <span className="staff-list-sub"> (夜勤可{nightCount} / 不可{dayOnlyCount})</span>}
          </span>
        </div>

        {staff.length === 0 ? (
          <div className="empty-msg empty-staff" style={{ padding: isMobile ? '32px 16px' : undefined }}>
            <div className="empty-staff-icon">👥</div>
            <div className="empty-staff-title">まだスタッフが登録されていません</div>
            <div className="empty-staff-desc">
              はじめての方は <strong>「⚡ まとめて追加」</strong> がおすすめです。
              <br />役職名と人数を指定するだけで、暫定の名前で一気に登録できます。
              <br />本名は後で1人ずつタップして編集できます。
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { setBulkOpen(true); if (isMobile) setFormOpen(false) }}
              style={{ marginTop: 14 }}
            >
              ⚡ まとめて追加する
            </button>
          </div>
        ) : isMobile ? (
          <div className="staff-card-list">
            {staff.map((s) =>
              editingId === s.id ? (
                <div key={s.id} className="staff-card staff-card-editing">
                  <div className="staff-card-field">
                    <label>名前</label>
                    <input type="text" name="name" value={editForm.name} onChange={handleEditChange} className="inline-input" />
                  </div>
                  <div className="staff-card-field">
                    <label>役職</label>
                    <input type="text" name="role" value={editForm.role || ''} onChange={handleEditChange} className="inline-input" />
                  </div>
                  <div className="staff-card-row">
                    <div className="staff-card-field" style={{ flex: 1 }}>
                      <label>夜勤上限</label>
                      <input type="number" name="max_night" value={editForm.max_night} onChange={handleEditChange} min="0" max="20" className="inline-input narrow" />
                    </div>
                    <div className="staff-card-field" style={{ flex: 1 }}>
                      <label>連続上限</label>
                      <input type="number" name="max_consecutive_days" value={editForm.max_consecutive_days} onChange={handleEditChange} min="1" max="14" className="inline-input narrow" />
                    </div>
                  </div>
                  <div className="staff-card-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <label className="staff-card-checkbox">
                      <input type="checkbox" name="night_available" checked={editForm.night_available} onChange={handleEditChange} />
                      夜勤可
                    </label>
                    <label className="staff-card-checkbox">
                      <input type="checkbox" name="can_lead" checked={!!editForm.can_lead} onChange={handleEditChange} />
                      リーダー可
                    </label>
                    <label className="staff-card-checkbox">
                      <input type="checkbox" name="is_rookie" checked={!!editForm.is_rookie} onChange={handleEditChange} />
                      新人
                    </label>
                  </div>
                  <div className="staff-card-row" style={{ alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 90 }}>連続夜勤上限</span>
                    <input
                      type="number" name="max_consecutive_nights"
                      value={editForm.max_consecutive_nights ?? 2}
                      onChange={handleEditChange} min="1" max="5"
                      className="inline-input narrow"
                    />
                  </div>
                  <div className="staff-card-field">
                    <label>固定休曜日</label>
                    <WeekdayPicker
                      value={editForm.fixed_off_weekdays || []}
                      onChange={(v) => setEditForm({ ...editForm, fixed_off_weekdays: v })}
                    />
                  </div>
                  {editError && <p className="error-msg">{editError}</p>}
                  <div className="staff-card-actions">
                    <button className="btn btn-success btn-sm" onClick={() => saveEdit(s.id)}>保存</button>
                    <button className="btn btn-sm" onClick={cancelEdit} style={{ background: '#757575', color: 'white' }}>戻す</button>
                  </div>
                </div>
              ) : (
                <div key={s.id} className="staff-card" onClick={() => startEdit(s)}>
                  <div className="staff-card-header">
                    <div className="staff-card-info">
                      <span className="staff-card-name">{s.name}</span>
                      {s.role && <span className="staff-card-role">{s.role}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className={`badge ${s.night_available ? 'badge-success' : 'badge-gray'}`}>
                        {s.night_available ? '夜勤可' : '日勤のみ'}
                      </span>
                      {s.can_lead && <span className="badge badge-lead">リーダー可</span>}
                      {s.is_rookie && <span className="badge badge-rookie">新人</span>}
                    </div>
                  </div>
                  <div className="staff-card-bottom">
                    <div className="staff-card-details">
                      <span>夜勤 {s.max_night}回</span>
                      <span>連続{s.max_consecutive_days}日</span>
                      {s.fixed_off_weekdays?.length > 0 && (
                        <span style={{ color: '#1565C0' }}>
                          固定休: {s.fixed_off_weekdays.map((i) => WEEKDAY_NAMES[i]).join('')}
                        </span>
                      )}
                    </div>
                    <button
                      className="staff-card-delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(s) }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>役職</th>
                  <th>夜勤可能</th>
                  <th>リーダー可</th>
                  <th>夜勤上限</th>
                  <th>連続勤務上限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) =>
                  editingId === s.id ? (
                    <tr key={s.id} className="editing-row">
                      <td>
                        <input type="text" name="name" value={editForm.name} onChange={handleEditChange} className="inline-input" />
                        <label style={{ fontSize: 11, marginLeft: 6 }}>
                          <input type="checkbox" name="is_rookie" checked={!!editForm.is_rookie} onChange={handleEditChange} /> 新人
                        </label>
                      </td>
                      <td><input type="text" name="role" value={editForm.role || ''} onChange={handleEditChange} className="inline-input" /></td>
                      <td><input type="checkbox" name="night_available" checked={editForm.night_available} onChange={handleEditChange} /></td>
                      <td><input type="checkbox" name="can_lead" checked={!!editForm.can_lead} onChange={handleEditChange} /></td>
                      <td><input type="number" name="max_night" value={editForm.max_night} onChange={handleEditChange} min="0" max="20" className="inline-input narrow" /></td>
                      <td><input type="number" name="max_consecutive_days" value={editForm.max_consecutive_days} onChange={handleEditChange} min="1" max="14" className="inline-input narrow" /></td>
                      <td>
                        <button className="btn btn-success btn-sm" onClick={() => saveEdit(s.id)}>保存</button>
                        <button className="btn btn-secondary btn-sm" onClick={cancelEdit} style={{ background: '#757575' }}>キャンセル</button>
                        {editError && <div className="error-msg" style={{ marginTop: 4 }}>{editError}</div>}
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td className="staff-name">
                        {s.name}
                        {s.is_rookie && <span className="badge badge-rookie" style={{ marginLeft: 6 }}>新人</span>}
                        {s.fixed_off_weekdays?.length > 0 && (
                          <span className="badge" style={{ marginLeft: 6, background: '#E3F2FD', color: '#1565C0' }}>
                            固定休 {s.fixed_off_weekdays.map((i) => WEEKDAY_NAMES[i]).join('')}
                          </span>
                        )}
                      </td>
                      <td>{s.role || '-'}</td>
                      <td><span className={`badge ${s.night_available ? 'badge-success' : 'badge-gray'}`}>{s.night_available ? '可' : '不可'}</span></td>
                      <td>{s.can_lead ? <span className="badge badge-lead">可</span> : <span className="badge badge-gray">-</span>}</td>
                      <td>{s.max_night}回</td>
                      <td>{s.max_consecutive_days}日 / 夜勤{s.max_consecutive_nights ?? 2}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          title="上に移動"
                          onClick={() => moveStaff(s.id, 'up')}
                          style={{ minHeight: 32, padding: '4px 8px' }}
                        >↑</button>
                        <button
                          className="btn btn-sm"
                          title="下に移動"
                          onClick={() => moveStaff(s.id, 'down')}
                          style={{ minHeight: 32, padding: '4px 8px' }}
                        >↓</button>
                        <button className="btn btn-warning btn-sm" onClick={() => startEdit(s)}>編集</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>削除</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* === ペア制約セクション === */}
      <div className={isMobile ? '' : 'card'} style={{ marginTop: 16 }}>
        <div className="staff-list-header" style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className="staff-list-title">出勤ペア制約</span>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong>同シフトマスト</strong>: 片方が「新人」のとき<u>指導ペア</u>として扱います。
            指導者が有給・固定休・絶対休みの日は新人も自動的に休みになります。
            両者とも非新人なら同格ペアとして同じシフトに揃えます。
            <br />
            <strong>夜勤NG</strong>: 2人とも同日に夜勤しません（日勤や明けの被りはOK）。
          </div>
        </div>

        {staff.length < 2 ? (
          <p className="empty-msg" style={{ marginTop: 12 }}>
            スタッフを2名以上登録するとペアを設定できます。
          </p>
        ) : (
          <>
            <div className="pair-add-row">
              <select
                value={pairForm.a}
                onChange={(e) => setPairForm({ ...pairForm, a: e.target.value })}
                className="pair-select"
              >
                <option value="">スタッフA</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span style={{ color: 'var(--text-secondary)' }}>と</span>
              <select
                value={pairForm.b}
                onChange={(e) => setPairForm({ ...pairForm, b: e.target.value })}
                className="pair-select"
              >
                <option value="">スタッフB</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={pairForm.type}
                onChange={(e) => setPairForm({ ...pairForm, type: e.target.value })}
                className="pair-select"
              >
                <option value="forbid">夜勤NG（同日に2人とも夜勤させない）</option>
                <option value="require">同シフトマスト（新人ペアは指導者の不在日に新人も自動休）</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={submitPair}>追加</button>
            </div>
            {pairError && <p className="error-msg">{pairError}</p>}

            {pairs.length === 0 ? (
              <p className="empty-msg" style={{ marginTop: 12 }}>
                ペアはまだ設定されていません。
              </p>
            ) : (
              <ul className="pair-list">
                {pairs.map((p) => {
                  const a = staff.find((s) => s.id === p.staff_a_id)
                  const b = staff.find((s) => s.id === p.staff_b_id)
                  const isMentor = p.type === 'require' && a && b && (!!a.is_rookie !== !!b.is_rookie)
                  return (
                  <li key={p.id} className={`pair-item ${p.type === 'forbid' ? 'pair-forbid' : 'pair-require'}`}>
                    <span className="pair-names">
                      <strong>{staffNameById(p.staff_a_id)}</strong>
                      {a?.is_rookie && <span className="badge badge-rookie" style={{ marginLeft: 4 }}>新人</span>}
                      <span className="pair-rel">
                        {p.type === 'forbid' ? '✕ 夜勤NG' :
                          isMentor ? '🎓 指導ペア（同シフト）' : '◯ 同シフトマスト'}
                      </span>
                      <strong>{staffNameById(p.staff_b_id)}</strong>
                      {b?.is_rookie && <span className="badge badge-rookie" style={{ marginLeft: 4 }}>新人</span>}
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={() => removePair(p.id)}>削除</button>
                  </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
