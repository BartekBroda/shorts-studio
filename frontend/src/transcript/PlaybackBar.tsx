import React from 'react'

interface Props {
  audioUrl: string
  currentTime: number
  duration: number
  playing: boolean
  onTimeUpdate: (t: number) => void
  onPlayPause: () => void
  onSeek: (t: number) => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export function PlaybackBar({ audioUrl, currentTime, duration, playing, onTimeUpdate, onPlayPause, onSeek, audioRef }: Props) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <audio ref={audioRef} src={audioUrl} onTimeUpdate={e => onTimeUpdate((e.target as HTMLAudioElement).currentTime)} />
      <span onClick={onPlayPause} style={{ color: 'var(--yellow)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>{playing ? '⏸' : '▶'}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(currentTime)}</span>
      <div
        style={{ flex: 1, height: 3, background: 'var(--border-mid)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}
        onClick={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          onSeek(((e.clientX - rect.left) / rect.width) * duration)
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--yellow)', borderRadius: 2 }} />
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(duration)}</span>
      <span style={{ color: '#333', fontSize: 11 }}>click word to seek</span>
    </div>
  )
}
