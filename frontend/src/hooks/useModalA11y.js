import { useEffect, useRef } from 'react'

/**
 * モーダル/ダイアログのアクセシビリティを担保するフック。
 * - Escape キーで onClose を呼ぶ
 * - 開いている間、Tab フォーカスをモーダル内に閉じ込める（フォーカストラップ）
 * - 開いたときに最初のフォーカス可能要素へ移動し、閉じたら元の要素へ復帰
 *
 * 使い方:
 *   const ref = useModalA11y(isOpen, onClose)
 *   <div ref={ref} role="dialog" aria-modal="true"> ... </div>
 */
export default function useModalA11y(isOpen, onClose) {
  const containerRef = useRef(null)
  const prevFocusRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // 開いた時点のフォーカス要素を覚えておく
    prevFocusRef.current = document.activeElement

    const container = containerRef.current
    const getFocusable = () => {
      if (!container) return []
      return Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
    }

    // 最初のフォーカス可能要素へ
    const focusable = getFocusable()
    if (focusable.length > 0) {
      focusable[0].focus()
    } else if (container) {
      container.focus()
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // フォーカスを元の要素へ戻す
      const prev = prevFocusRef.current
      if (prev && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [isOpen, onClose])

  return containerRef
}
