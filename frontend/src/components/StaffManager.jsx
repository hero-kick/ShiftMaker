import React, { useState, useEffect } from 'react'
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

const defaultForm = {
  name: '',
  role: '',
  night_available: true,
  max_night: 8,
  max_consecutive_days: 5,
}

export default function StaffManager() {
  const { staff, addStaff, updateStaff, removeStaff } = useStore()
  const [form, setForm] = useState(defaultForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const isMobile = useIsMobile()

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

  const saveEdit = (id) => {
    updateStaff(id, editForm)
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleDelete = (s) => {
    if (!window.confirm(`「${s.name}」を削除しますか？`)) return
    removeStaff(s.id)
  }

  const nightCount = staff.filter((s) => s.night_available).length
  const dayOnlyCount = staff.length - nightCount

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
          ) : (
            <button className="mobile-add-btn" onClick={() => setFormOpen(true)}>
              <span className="mobile-add-icon">+</span>
              スタッフを追加
            </button>
          )}
        </>
      ) : (
        <div className="card">
          <h3>新規スタッフ追加</h3>
          {addForm}
        </div>
      )}

      {/* Staff list */}
      <div className={isMobile ? '' : 'card'}>
        <div className="staff-list-header">
          <span className="staff-list-title">
            {staff.length}名{staff.length > 0 && <span className="staff-list-sub"> (夜勤可{nightCount} / 不可{dayOnlyCount})</span>}
          </span>
        </div>

        {staff.length === 0 ? (
          <div className="empty-msg" style={{ padding: isMobile ? '32px 16px' : undefined }}>
            スタッフが登録されていません。<br />
            {isMobile ? '上の「+」ボタンから追加するか、' : '上のフォームから追加するか、'}ヘッダーのサンプル読込をお試しください。
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
                    <label className="staff-card-checkbox">
                      <input type="checkbox" name="night_available" checked={editForm.night_available} onChange={handleEditChange} />
                      夜勤可
                    </label>
                  </div>
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
                    <span className={`badge ${s.night_available ? 'badge-success' : 'badge-gray'}`}>
                      {s.night_available ? '夜勤可' : '日勤のみ'}
                    </span>
                  </div>
                  <div className="staff-card-bottom">
                    <div className="staff-card-details">
                      <span>夜勤上限 {s.max_night}回</span>
                      <span>連続 {s.max_consecutive_days}日</span>
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
                  <th>夜勤上限</th>
                  <th>連続勤務上限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) =>
                  editingId === s.id ? (
                    <tr key={s.id} className="editing-row">
                      <td><input type="text" name="name" value={editForm.name} onChange={handleEditChange} className="inline-input" /></td>
                      <td><input type="text" name="role" value={editForm.role || ''} onChange={handleEditChange} className="inline-input" /></td>
                      <td><input type="checkbox" name="night_available" checked={editForm.night_available} onChange={handleEditChange} /></td>
                      <td><input type="number" name="max_night" value={editForm.max_night} onChange={handleEditChange} min="0" max="20" className="inline-input narrow" /></td>
                      <td><input type="number" name="max_consecutive_days" value={editForm.max_consecutive_days} onChange={handleEditChange} min="1" max="14" className="inline-input narrow" /></td>
                      <td>
                        <button className="btn btn-success btn-sm" onClick={() => saveEdit(s.id)}>保存</button>
                        <button className="btn btn-secondary btn-sm" onClick={cancelEdit} style={{ background: '#757575' }}>キャンセル</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td className="staff-name">{s.name}</td>
                      <td>{s.role || '-'}</td>
                      <td><span className={`badge ${s.night_available ? 'badge-success' : 'badge-gray'}`}>{s.night_available ? '可' : '不可'}</span></td>
                      <td>{s.max_night}回</td>
                      <td>{s.max_consecutive_days}日</td>
                      <td>
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
    </div>
  )
}
