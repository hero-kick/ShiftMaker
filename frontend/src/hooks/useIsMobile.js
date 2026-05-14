import { useState, useEffect } from 'react'

/**
 * 画面幅が breakpoint 以下かどうかを返すフック。
 * 以前は各コンポーネントに同じ実装がコピペされていたため共通化。
 */
export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= breakpoint
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e) => setIsMobile(e.matches)
    // 初期同期（マウント時に既にリサイズ済みのケース）
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}
