import type { DragEvent, ReactNode } from 'react'
import type { WordEntry } from '../types'

interface Props {
  groupIndex: number
  groupWords: WordEntry[]
  onHeaderClick: () => void
  onWordDrop: () => void
  onGroupDrop: (fromGroupIndex: number) => void
  onGroupDragStart: () => void
  onAddWord: () => void
  ghostWord?: string
  ghostWordPosition?: 'start' | 'end'
  isHovered?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onDragEnter?: () => void
  onDragLeave?: () => void
  children: ReactNode
}

const BORDERS = ['var(--yellow)', 'var(--mint)']

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`

export function WordGroup({
  groupIndex,
  groupWords,
  onHeaderClick,
  onWordDrop,
  onGroupDrop,
  onGroupDragStart,
  onAddWord,
  ghostWord,
  ghostWordPosition = 'end',
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  onDragEnter,
  onDragLeave,
  children,
}: Props) {
  const color = BORDERS[groupIndex % BORDERS.length]
  const isYellow = color === 'var(--yellow)'

  const minStart = groupWords.length > 0 ? Math.min(...groupWords.map(w => w.start)) : 0
  const maxEnd = groupWords.length > 0 ? Math.max(...groupWords.map(w => w.end)) : 0

  const handleHeaderDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('drag-type', 'group')
    e.dataTransfer.setData('group-index', String(groupIndex))
    e.dataTransfer.effectAllowed = 'move'
    onGroupDragStart()
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const dragType = e.dataTransfer.getData('drag-type')

    if (dragType === 'word') {
      onWordDrop()
    } else if (dragType === 'group') {
      const fromGroupIndex = parseInt(e.dataTransfer.getData('group-index'), 10)
      if (!isNaN(fromGroupIndex) && fromGroupIndex !== groupIndex) {
        onGroupDrop(fromGroupIndex)
      }
    }
  }

  const bgBase = isYellow ? 'rgba(254,185,2,' : 'rgba(110,231,183,'
  const bgOpacity = isHovered ? '0.13)' : '0.06)'

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0,
        border: `1px solid ${color}`,
        background: bgBase + bgOpacity,
        borderRadius: 8,
        padding: '6px 8px',
        transition: 'background 0.1s',
        boxShadow: isHovered ? `0 0 0 1px ${color}` : 'none',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={e => {
        e.preventDefault()
        onDragEnter?.()
      }}
      onDragLeave={e => {
        if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave?.()
        }
      }}
    >
      <div
        onClick={onHeaderClick}
        onDragStart={handleHeaderDragStart}
        draggable
        style={{
          fontSize: 10,
          color: color,
          fontVariantNumeric: 'tabular-nums',
          cursor: 'grab',
          userSelect: 'none',
          letterSpacing: '0.02em',
        }}
      >
        {fmt(minStart)} – {fmt(maxEnd)}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {ghostWord && ghostWordPosition === 'start' && (
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1, borderRadius: 4, padding: '4px 8px', border: '1px solid var(--yellow)', background: 'var(--bg-surface)', color: 'var(--text)', opacity: 0.35, pointerEvents: 'none', userSelect: 'none' }}>
            <span style={{ fontSize: 13 }}>{ghostWord}</span>
          </span>
        )}
        {children}
        {ghostWord && ghostWordPosition === 'end' && (
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1, borderRadius: 4, padding: '4px 8px', border: '1px solid var(--yellow)', background: 'var(--bg-surface)', color: 'var(--text)', opacity: 0.35, pointerEvents: 'none', userSelect: 'none' }}>
            <span style={{ fontSize: 13 }}>{ghostWord}</span>
          </span>
        )}
        <span
          onClick={e => { e.stopPropagation(); onAddWord() }}
          style={{
            display: 'inline-flex', alignItems: 'center', alignSelf: 'center',
            border: '1px dashed var(--border-mid)', borderRadius: 4,
            padding: '2px 6px', color: 'var(--text-muted)',
            fontSize: 11, cursor: 'pointer', flexShrink: 0, userSelect: 'none',
          }}
        >+</span>
      </div>
    </div>
  )
}
