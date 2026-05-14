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

export function IconHome({ size = 28, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity=".15" />
    </svg>
  )
}

export function IconPin({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 21V13" />
      <path d="M7 9a5 5 0 0 1 10 0v4H7z" fill="currentColor" fillOpacity=".25" />
    </svg>
  )
}

export function IconNote({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity=".1" />
      <path d="M8 12h8M8 16h6M8 8h5" />
    </svg>
  )
}

export function IconShield({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3l8 3v6c0 4.5-3.5 8.4-8 9-4.5-.6-8-4.5-8-9V6z" fill="currentColor" fillOpacity=".15" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

export function IconScale({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 4v16" />
      <path d="M5 9l3-5 3 5z" fill="currentColor" fillOpacity=".15" />
      <path d="M13 9l3-5 3 5z" fill="currentColor" fillOpacity=".15" />
      <path d="M4 20h16" />
    </svg>
  )
}

export function IconFlame({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3c2 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3-.5-2 0-4 0-6z" fill="currentColor" fillOpacity=".2" />
    </svg>
  )
}

export function IconLightbulb({ size = 22, className }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c1 1 1.5 1.7 1.5 2.5h5c0-.8.5-1.5 1.5-2.5A6 6 0 0 0 12 3z" fill="currentColor" fillOpacity=".2" />
    </svg>
  )
}

/* =============================================================== */
/* === シフト用 かわいいアイコン（カレンダー表示で使用）========= */
/*  baseProps は使わず、塗り中心の親しみやすいデザイン            */
/* =============================================================== */

function shiftSvg(size) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }
}

// 日勤 — にっこり太陽
export function ShiftDay({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <g stroke="#FBC02D" strokeWidth="2" strokeLinecap="round">
        <path d="M12 1.5v2.2M12 20.3v2.2M1.5 12h2.2M20.3 12h2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M19.6 4.4L18 6M6 18l-1.6 1.6" />
      </g>
      <circle cx="12" cy="12" r="6" fill="#FFD54F" />
      <circle cx="9.7" cy="11" r="1.05" fill="#6D4C00" />
      <circle cx="14.3" cy="11" r="1.05" fill="#6D4C00" />
      <path d="M9.8 13.6c.6.8 1.4 1.2 2.2 1.2s1.6-.4 2.2-1.2" stroke="#6D4C00" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8.3" cy="13" r="0.9" fill="#FF8A65" opacity="0.55" />
      <circle cx="15.7" cy="13" r="0.9" fill="#FF8A65" opacity="0.55" />
    </svg>
  )
}

// 早番 — 昇る朝日（上向き矢印つき）
export function ShiftEarly({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <g stroke="#00ACC1" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2v2.4M5.2 5.6l1.5 1.5M18.8 5.6l-1.5 1.5" />
      </g>
      <path d="M5.5 14.5a6.5 6.5 0 0 1 13 0z" fill="#4DD0E1" />
      <path d="M3 17.6h18" stroke="#00ACC1" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="10" cy="12.4" r="0.9" fill="#fff" />
      <circle cx="14" cy="12.4" r="0.9" fill="#fff" />
      <path d="M10.4 13.9c.5.5 1.1.7 1.6.7s1.1-.2 1.6-.7" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M12 8.6l-1.3 1.6h2.6z" fill="#fff" />
    </svg>
  )
}

// 夜勤（入り）— 三日月＋お星さま、すやすや顔
export function ShiftNight({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <path d="M19 4.2l.55 1.45L21 6.2l-1.45.55L19 8.2l-.55-1.45L17 6.2l1.45-.55z" fill="#CE93D8" />
      <circle cx="20.5" cy="10.5" r="0.9" fill="#CE93D8" />
      <path d="M14.5 3.2A9 9 0 1 0 21 16.4 7.2 7.2 0 0 1 14.5 3.2z" fill="#AB47BC" />
      <path d="M8.6 11.2c.5-.5 1.1-.5 1.6 0M11.6 13c.5-.5 1.1-.5 1.6 0" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9.2" cy="13.6" r="0.85" fill="#F8BBD0" opacity="0.8" />
    </svg>
  )
}

// 夜勤明け — ほかほかコーヒー（おつかれさま）、にっこり顔
export function ShiftAke({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <path d="M8.5 3c.9.9.9 1.8 0 2.7M12 2.4c.9.9.9 1.8 0 2.7M15.5 3c.9.9.9 1.8 0 2.7"
        stroke="#FFB74D" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 8.5h12v5.2a4.3 4.3 0 0 1-4.3 4.3H8.8a4.3 4.3 0 0 1-4.3-4.3z" fill="#FB8C00" />
      <path d="M16.5 9.8h2.1a2.2 2.2 0 0 1 0 4.4h-2.1" stroke="#FB8C00" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="8.7" cy="12" r="0.95" fill="#fff" />
      <circle cx="12.3" cy="12" r="0.95" fill="#fff" />
      <path d="M9 14c.7.7 1.5 1 2.5 1s1.8-.3 2.5-1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 19.5h13" stroke="#E65100" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// 遅番 — 沈む夕日（下向き矢印つき）
export function ShiftLate({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <path d="M5.5 14.5a6.5 6.5 0 0 1 13 0z" fill="#7986CB" />
      <path d="M3 17.6h18" stroke="#3949AB" strokeWidth="2.2" strokeLinecap="round" />
      <g stroke="#3949AB" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.2v2.2M5.6 5.4l1.4 1.4M18.4 5.4l-1.4 1.4" />
      </g>
      <circle cx="10" cy="12.4" r="0.9" fill="#fff" />
      <circle cx="14" cy="12.4" r="0.9" fill="#fff" />
      <path d="M10.4 14.3c.5-.5 1.1-.7 1.6-.7s1.1.2 1.6.7" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M12 10.4l1.3-1.6h-2.6z" fill="#fff" />
    </svg>
  )
}

// 休日 — おうちでのんびり（ハートの窓）
export function ShiftOff({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <path d="M12 3.4l8.2 6.7v9.5a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1v-9.5z" fill="#90A4AE" />
      <path d="M12 3l9 7.4H3z" fill="#607D8B" />
      <rect x="9.8" y="14.5" width="4.4" height="5.6" rx="1" fill="#ECEFF1" />
      <path d="M12 9.2c-.7-.95-2.4-.6-2.4.65 0 .9 1.1 1.6 2.4 2.45 1.3-.85 2.4-1.55 2.4-2.45 0-1.25-1.7-1.6-2.4-.65z" fill="#FF8A80" />
    </svg>
  )
}

// 有給 — 南国気分のヤシの木とお日さま
export function ShiftPaid({ size = 26 }) {
  return (
    <svg {...shiftSvg(size)}>
      <circle cx="18.5" cy="5.5" r="2.6" fill="#FFD54F" />
      <path d="M10.5 20.5c0-5 .6-9 1-12.5" stroke="#8D6E63" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M11.5 8c-3-2.2-6.2-1.3-7.5.8 3-.7 5.2-.2 7.5-.8z" fill="#2196F3" />
      <path d="M11.5 8c2.8-2.4 6.1-1.8 7.7.2-3-.9-5.3-.6-7.7-.2z" fill="#42A5F5" />
      <path d="M11.5 8c-1.1-3 .1-6.1 2.3-7.2-1.1 3-1.2 5.1-2.3 7.2z" fill="#1E88E5" />
      <path d="M4 20.5h16" stroke="#FFD54F" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

// シフトコード → かわいいアイコン の振り分け
const SHIFT_ICON_MAP = {
  D: ShiftDay,
  E: ShiftEarly,
  N: ShiftNight,
  A: ShiftAke,
  L: ShiftLate,
  O: ShiftOff,
  Y: ShiftPaid,
}

export function ShiftIcon({ code, size = 26 }) {
  const Cmp = SHIFT_ICON_MAP[code]
  if (!Cmp) return null
  return <Cmp size={size} />
}
