import { useEffect, useRef, useState } from 'react'
import type { WordEntry } from '../types'

interface Props {
  word: WordEntry
  isPlaying: boolean
  onSingleClick: () => void
  onChange: (text: string) => void
  onChangeStart: (t: number) => void
  onChangeEnd: (t: number) => void
  onDelete?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  editRequested?: boolean
  onTabNext?: () => void
  onEditDone?: () => void
}

export function WordChip({
  word, isPlaying, onSingleClick, onChange, onChangeStart, onChangeEnd,
  onDelete, onDragStart, onDragEnd, editRequested, onTabNext, onEditDone,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draftWord, setDraftWord] = useState(word.word)
  const [draftStart, setDraftStart] = useState(word.start)
  const [draftEnd, setDraftEnd] = useState(word.end)
  const [hovered, setHovered] = useState(false)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lowConf = word.probability < 0.4

  useEffect(() => {
    if (editRequested) {
      setDraftWord(word.word)
      setDraftStart(word.start)
      setDraftEnd(word.end)
      setEditing(true)
    }
  }, [editRequested, word])

  function commitEdit() {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
    const s = isNaN(draftStart) ? word.start : draftStart
    const e = isNaN(draftEnd) ? word.end : draftEnd
    onChange(draftWord)
    onChangeStart(Math.min(s, e))
    onChangeEnd(Math.max(s, e))
    setEditing(false)
    onEditDone?.()
  }

  if (editing) {
    const inputBase: React.CSSProperties = {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-mid)',
      borderRadius: 3,
      color: 'var(--text)',
      outline: 'none',
      padding: '2px 5px',
    }
    return (
      <div
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) commitEdit()
        }}
        tabIndex={-1}
        style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '6px 8px',
          background: 'var(--bg-card)',
          border: '1px solid var(--yellow)',
          borderRadius: 6,
          minWidth: 90,
          outline: 'none',
        }}
      >
        <input
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={draftWord}
          style={{ ...inputBase, fontSize: 13, width: `${Math.max(draftWord.length, 4) + 2}ch` }}
          onChange={e => setDraftWord(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); commitEdit(); onTabNext?.() }
            else if (e.key === 'Enter' || e.key === 'Escape') commitEdit()
          }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 26, flexShrink: 0 }}>start</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={draftStart}
            style={{ ...inputBase, fontSize: 11, width: 70 }}
            onChange={e => setDraftStart(parseFloat(e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') commitEdit()
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 26, flexShrink: 0 }}>end</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={draftEnd}
            style={{ ...inputBase, fontSize: 11, width: 70 }}
            onChange={e => setDraftEnd(parseFloat(e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') commitEdit()
              else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); onTabNext?.() }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={!!onDragStart}
      onDragStart={e => {
        e.dataTransfer.setData('drag-type', 'word')
        e.dataTransfer.setData('text/plain', 'word')
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          userSelect: 'none',
          border: lowConf ? '1px solid var(--red)' : '1px solid var(--border-mid)',
          background: isPlaying ? 'var(--yellow)' : lowConf ? 'var(--red-dim)' : 'var(--bg-surface)',
          color: isPlaying ? '#000' : lowConf ? 'var(--red)' : 'var(--text)',
          fontWeight: isPlaying ? 700 : 400,
          opacity: hovered && onDragStart ? 0.7 : 1,
        }}
        onClick={() => {
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
            setDraftWord(word.word)
            setDraftStart(word.start)
            setDraftEnd(word.end)
            setEditing(true)
            return
          }
          clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null
            onSingleClick()
          }, 220)
        }}
      >
        <span style={{ fontSize: 13 }}>{word.word}</span>
        <span style={{
          fontSize: 9,
          color: isPlaying ? 'rgba(0,0,0,0.55)' : 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {word.start.toFixed(3)}s
        </span>
      </span>
      {hovered && onDelete && (
        <span
          onClick={e => { e.stopPropagation(); onDelete!() }}
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--red)', color: '#fff',
            fontSize: 10, lineHeight: '14px', textAlign: 'center',
            cursor: 'pointer', zIndex: 10,
          }}
        >×</span>
      )}
    </span>
  )
}
