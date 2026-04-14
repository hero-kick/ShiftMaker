// ワークスペース（ユーザー単位のデータ領域）管理
// - 各ワークスペースのデータは localStorage の `shiftmaker-v2-{id}` に独立保存
// - ワークスペース一覧は `shiftmaker-workspaces` に保存
// - 現在選択中のワークスペース id は sessionStorage に保持
//   （useStore がモジュール初期化時に読むので、ブラウザを閉じたら再選択が必要）

const INDEX_KEY = 'shiftmaker-workspaces'
const CURRENT_KEY = 'shiftmaker-current-workspace'
const LEGACY_STORE_KEY = 'shiftmaker-v2'

export function listWorkspaces() {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveIndex(list) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

export function getCurrentWorkspaceId() {
  return sessionStorage.getItem(CURRENT_KEY)
}

export function setCurrentWorkspaceId(id) {
  if (id) sessionStorage.setItem(CURRENT_KEY, id)
  else sessionStorage.removeItem(CURRENT_KEY)
}

export function getCurrentWorkspace() {
  const id = getCurrentWorkspaceId()
  if (!id) return null
  return listWorkspaces().find((w) => w.id === id) || null
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

function newWorkspaceId() {
  return 'ws_' + randomHex(6) + '_' + Date.now().toString(36)
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashPasscode(passcode, salt) {
  return sha256Hex(`${salt}:${passcode}`)
}

export async function createWorkspace(name, passcode) {
  const trimmed = (name || '').trim()
  if (!trimmed) throw new Error('ワークスペース名を入力してください')
  const id = newWorkspaceId()
  const salt = randomHex(16)
  const hash = passcode ? await hashPasscode(passcode, salt) : null
  const list = listWorkspaces()
  list.push({
    id,
    name: trimmed,
    salt,
    hash,
    hasPasscode: !!hash,
    createdAt: Date.now(),
  })
  saveIndex(list)
  return id
}

export async function verifyPasscode(workspace, passcode) {
  if (!workspace?.hash) return true
  const hash = await hashPasscode(passcode || '', workspace.salt)
  return hash === workspace.hash
}

export function renameWorkspace(id, name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return
  const list = listWorkspaces().map((w) =>
    w.id === id ? { ...w, name: trimmed } : w
  )
  saveIndex(list)
}

export async function changePasscode(id, newPasscode) {
  const list = listWorkspaces()
  const idx = list.findIndex((w) => w.id === id)
  if (idx < 0) return
  if (newPasscode) {
    const salt = randomHex(16)
    list[idx] = {
      ...list[idx],
      salt,
      hash: await hashPasscode(newPasscode, salt),
      hasPasscode: true,
    }
  } else {
    list[idx] = { ...list[idx], salt: randomHex(16), hash: null, hasPasscode: false }
  }
  saveIndex(list)
}

export function deleteWorkspace(id) {
  const list = listWorkspaces().filter((w) => w.id !== id)
  saveIndex(list)
  localStorage.removeItem(storageKeyFor(id))
  if (getCurrentWorkspaceId() === id) setCurrentWorkspaceId(null)
}

export function storageKeyFor(id) {
  return `shiftmaker-v2-${id}`
}

// 旧バージョン（workspace なしの `shiftmaker-v2`）のデータがあれば
// 初回に「デフォルト」ワークスペースへ移行する。
export async function migrateLegacyIfNeeded() {
  const legacy = localStorage.getItem(LEGACY_STORE_KEY)
  if (!legacy) return null
  const list = listWorkspaces()
  if (list.length > 0) {
    // すでに新方式で使われている → 古いデータは削除して重複を防ぐ
    localStorage.removeItem(LEGACY_STORE_KEY)
    return null
  }
  const id = await createWorkspace('デフォルト', '')
  localStorage.setItem(storageKeyFor(id), legacy)
  localStorage.removeItem(LEGACY_STORE_KEY)
  return id
}
