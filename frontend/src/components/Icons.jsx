// 統一スタイル: stroke-width 2px、24x24 viewBox、currentColor、丸い line-cap
// すべての Icon は size と className を受け取る
import React from 'react'

const baseProps = (size, className) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: className || '',
  'aria-hidden': true,
})

export function IconStaff({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" fill="currentColor" stroke="none" opacity=".55" />
      <path d="M14.5 19c.5-2 2-3.5 4-3.5s3.5 1.5 4 3.5" opacity=".55" />
    </svg>
  )
}

export function IconCalendar({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
      <circle cx="8" cy="14" r="1.2" fill="currentColor" />
      <circle cx="12" cy="14" r="1.2" fill="currentColor" />
      <circle cx="16" cy="14" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function IconStar({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6L12 16.8 6.6 19.6l1-6L3.3 9.4l6-.9z" fill="currentColor" fillOpacity=".15" />
    </svg>
  )
}

export function IconSettings({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5.1 6 3 9.3l2 1.5a7 7 0 0 0 0 2.4l-2 1.5L5.1 18l2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
    </svg>
  )
}

export function IconTable({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M3 14.5h18M9 5v14M15 5v14" />
    </svg>
  )
}

export function IconChart({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="13" width="3" height="5" fill="currentColor" />
      <rect x="12" y="9" width="3" height="9" fill="currentColor" />
      <rect x="17" y="6" width="3" height="12" fill="currentColor" />
    </svg>
  )
}

export function IconPlay({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
    </svg>
  )
}

export function IconSparkles({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" fill="currentColor" fillOpacity=".3" />
      <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z" fill="currentColor" />
      <path d="M5 14l.5 1.5L7 16l-1.5.5L5 18l-.5-1.5L3 16l1.5-.5z" fill="currentColor" opacity=".7" />
    </svg>
  )
}

export function IconHelp({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-2.5 3v.5" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconMenu({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function IconClose({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconCheck({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  )
}

export function IconPlus({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconChevronLeft({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

export function IconChevronRight({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function IconUser({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

export function IconTrash({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  )
}

export function IconLock({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.3" fill="currentColor" />
    </svg>
  )
}

export function IconCrown({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 8l4 8h10l4-8-5 3-4-7-4 7z" fill="currentColor" fillOpacity=".25" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function IconSeedling({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 21V10" />
      <path d="M12 10c0-4 3-7 7-7-.5 4-3 7-7 7z" fill="currentColor" fillOpacity=".25" />
      <path d="M12 14c-.5-3-3-5-7-5 .5 3 3 5 7 5z" fill="currentColor" fillOpacity=".25" />
    </svg>
  )
}

export function IconRefresh({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

export function IconWarning({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3l10 18H2z" fill="currentColor" fillOpacity=".15" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconInfo({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  )
}

// シフト種別のアイコン（小サイズで使う）
export function IconSun({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity=".3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </svg>
  )
}

export function IconMoon({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor" fillOpacity=".3" />
    </svg>
  )
}

export function IconSunrise({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 18h18" />
      <path d="M6 18a6 6 0 0 1 12 0" fill="currentColor" fillOpacity=".3" />
      <path d="M12 2v3M5 5l1.5 1.5M19 5l-1.5 1.5" />
    </svg>
  )
}

export function IconSunset({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 18h18" />
      <path d="M6 18a6 6 0 0 1 12 0" fill="currentColor" fillOpacity=".3" />
      <path d="M12 9V3M5 5l1.5 1.5M19 5l-1.5 1.5M9 7l3 3 3-3" />
    </svg>
  )
}

export function IconBed({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 18V8" />
      <path d="M3 12h18v6" />
      <circle cx="7.5" cy="10.5" r="1.5" />
    </svg>
  )
}

export function IconCoin({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity=".15" />
      <path d="M9 9.5c0-1 1.3-1.5 3-1.5s3 .5 3 1.5-1.3 1.5-3 1.5-3 .5-3 1.5 1.3 1.5 3 1.5 3-.5 3-1.5M12 7v10" />
    </svg>
  )
}
