import React from 'react'
import type { WordEntry } from '../types'

interface Props {
  audioUrl: string
  currentTime: number
  duration: number
  playing: boolean
  words: WordEntry[]
  autoScroll: boolean
  viewportStart: number
  viewportEnd: number
  hoveredRange?: { start: number; end: number }
  onToggleAutoScroll: () => void
  onTimeUpdate: (t: number) => void
  onPlayPause: () => void
  onSeek: (t: number) => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export function TimelineBar({
  audioUrl, currentTime, duration, playing, words,
  autoScroll, viewportStart, viewportEnd, hoveredRange,
  onToggleAutoScroll, onTimeUpdate, onPlayPause, onSeek, audioRef,
}: Props) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(((e.clientX - rect.left) / rect.width) * duration)
  }

  return (
    <div style={{ background: '#000', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={e => onTimeUpdate((e.target as HTMLAudioElement).currentTime)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          onClick={onPlayPause}
          style={{ color: 'var(--yellow)', fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0, userSelect: 'none' }}
        >
          {playing ? '⏸' : '▶'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 50 }}>
          {currentTime.toFixed(3)}s
        </span>
        <div
          style={{ flex: 1, height: 24, background: 'var(--bg-surface)', borderRadius: 3, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
          onClick={handleBarClick}
        >
          {/* progress fill */}
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'rgba(254,185,2,0.15)', pointerEvents: 'none' }} />
          {/* hovered group time range */}
          {hoveredRange && duration > 0 && (
            <div style={{
              position: 'absolute', top: 0, height: '100%',
              left: `${(hoveredRange.start / duration) * 100}%`,
              width: `${((hoveredRange.end - hoveredRange.start) / duration) * 100}%`,
              background: 'rgba(254,185,2,0.28)',
              borderLeft: '1px solid rgba(254,185,2,0.7)',
              borderRight: '1px solid rgba(254,185,2,0.7)',
              pointerEvents: 'none',
              transition: 'left 0.1s, width 0.1s',
            }} />
          )}
          {/* viewport indicator — which portion of groups is currently scrolled into view */}
          {viewportEnd > viewportStart && (
            <div style={{
              position: 'absolute', top: 0, height: '100%',
              left: `${viewportStart * 100}%`,
              width: `${(viewportEnd - viewportStart) * 100}%`,
              background: 'rgba(255,255,255,0.07)',
              borderLeft: '1px solid rgba(255,255,255,0.25)',
              borderRight: '1px solid rgba(255,255,255,0.25)',
              pointerEvents: 'none',
            }} />
          )}
          {/* word ticks */}
          {duration > 0 && words.map((w, i) => (
            <div
              key={`${w.start}-${i}`}
              style={{
                position: 'absolute', top: 0, width: 1, height: '100%',
                background: 'rgba(255,255,255,0.18)',
                left: `${(w.start / duration) * 100}%`,
                pointerEvents: 'none',
              }}
            />
          ))}
          {/* playhead */}
          <div style={{
            position: 'absolute', top: 0, height: '100%', width: 2,
            background: 'var(--yellow)',
            left: `${pct}%`,
            transform: 'translateX(-1px)',
            pointerEvents: 'none',
          }} />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 50, textAlign: 'right' }}>
          {duration.toFixed(3)}s
        </span>
        <button
          onClick={onToggleAutoScroll}
          style={{
            background: autoScroll ? 'var(--yellow-dim)' : 'var(--bg-card)',
            border: `1px solid ${autoScroll ? 'var(--yellow)' : 'var(--border-mid)'}`,
            borderRadius: 4, padding: '3px 9px',
            color: autoScroll ? 'var(--yellow)' : 'var(--text-muted)',
            fontSize: 11, cursor: 'pointer', flexShrink: 0,
          }}
        >
          ⟳ Auto-scroll
        </button>
      </div>
    </div>
  )
}
