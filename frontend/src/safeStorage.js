// localStorage の容量超過・アクセス不可を安全に扱うラッパー。
// Zustand persist の storage オプションに渡して使う。
//
// - setItem が QuotaExceededError を投げたら window に 'shiftmaker-storage-error'
//   イベントを dispatch（App 側でバナー表示）
// - localStorage 自体が使えない環境（プライベートモード等）でもアプリが落ちないよう
//   メモリ上のフォールバックを用意

let quotaWarned = false

function emitStorageError(detail) {
  if (quotaWarned) return
  quotaWarned = true
  try {
    window.dispatchEvent(
      new CustomEvent('shiftmaker-storage-error', { detail })
    )
  } catch {
    /* noop */
  }
}

// メモリフォールバック（localStorage が完全に使えない時のみ）
const memoryStore = new Map()
let useMemory = false

try {
  const testKey = '__shiftmaker_probe__'
  localStorage.setItem(testKey, '1')
  localStorage.removeItem(testKey)
} catch {
  useMemory = true
}

export const safeStorage = {
  getItem(name) {
    try {
      if (useMemory) return memoryStore.get(name) ?? null
      return localStorage.getItem(name)
    } catch {
      return memoryStore.get(name) ?? null
    }
  },

  setItem(name, value) {
    if (useMemory) {
      memoryStore.set(name, value)
      return
    }
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      // 容量超過 or 書き込み不可
      const isQuota =
        e &&
        (e.name === 'QuotaExceededError' ||
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22 ||
          e.code === 1014)
      emitStorageError({
        reason: isQuota ? 'quota' : 'unknown',
        message: e?.message || String(e),
      })
      // 直近の状態だけはメモリに退避（セッション中は失わない）
      memoryStore.set(name, value)
    }
  },

  removeItem(name) {
    try {
      if (!useMemory) localStorage.removeItem(name)
    } catch {
      /* noop */
    }
    memoryStore.delete(name)
  },
}

// 現在のおおよその使用量（バイト）を推定。warning バナー用。
export function estimateUsageBytes() {
  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const v = localStorage.getItem(k) || ''
      total += k.length + v.length
    }
    // UTF-16 換算でおおよそ2倍
    return total * 2
  } catch {
    return 0
  }
}

// localStorage の一般的上限は 5MB。80% を超えたら警告対象。
export const STORAGE_SOFT_LIMIT = 5 * 1024 * 1024
export const STORAGE_WARN_THRESHOLD = STORAGE_SOFT_LIMIT * 0.8

export function isStorageNearFull() {
  return estimateUsageBytes() > STORAGE_WARN_THRESHOLD
}
