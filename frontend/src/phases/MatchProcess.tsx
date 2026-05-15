import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Episode, FileEntry, Pairing } from '../types'

interface Props {
  episode: Episode
  onNext: () => void
  onMetaChange: () => void
}

export function MatchProcess({ episode, onNext, onMetaChange }: Props) {
  const [bgs, setBgs] = useState<FileEntry[]>([])
  const [wavs, setWavs] = useState<FileEntry[]>([])
  const [pairs, setPairs] = useState<Pairing[]>(episode.meta.pairings ?? [])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, { state: string; progress: string }>>({})
  const [activeClip, setActiveClip] = useState<string | null>(null)
  const [pendingClips, setPendingClips] = useState<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingRef = useRef(false)

  useEffect(() => {
    api.listBgLibrary().then(b => setBgs(b ?? []))
    api.listWavSource(episode.id).then(w => setWavs(w ?? []))
  }, [episode.id])

  useEffect(() => {
    if (!wavs.length || !bgs.length || pairs.length) return
    api.matchAssets(wavs, bgs).then(async p => {
      if (!p?.length) return
      setPairs(p)
      await api.saveEpisodeMeta(episode.id, { ...episode.meta, pairings: p })
      onMetaChange()
    })
  }, [wavs, bgs])

  useEffect(() => {
    if (!openDropdown) return
    function handleOutside(e: MouseEvent) {
      const target = e.target as Element
      if (!target.closest('[data-dropdown]')) setOpenDropdown(null)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [openDropdown])

  // poll clip statuses for display only
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const next: typeof statuses = {}
      for (const p of pairs) {
        const s = await api.getClipStatus(episode.id, p.wav_name)
        if (s) next[p.wav_name] = s
      }
      setStatuses(next)
    }, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pairs, episode.id])

  async function savePairings(updated: Pairing[]) {
    setPairs(updated)
    const meta = { ...episode.meta, pairings: updated }
    await api.saveEpisodeMeta(episode.id, meta)
    onMetaChange()
  }

  async function waitUntilDone(clipName: string): Promise<void> {
    while (true) {
      await new Promise(r => setTimeout(r, 1000))
      const s = await api.getClipStatus(episode.id, clipName)
      if (s?.state === 'done' || s?.state === 'error') return
    }
  }

  async function processAll() {
    if (processingRef.current) return
    processingRef.current = true
    const toProcess = pairs.filter(p => statuses[p.wav_name]?.state !== 'done')
    setPendingClips(toProcess.map(p => p.wav_name))
    try {
      for (const p of toProcess) {
        setActiveClip(p.wav_name)
        setPendingClips(prev => prev.filter(n => n !== p.wav_name))
        await api.processClip(episode.id, p.wav_name)
        await waitUntilDone(p.wav_name)
      }
    } finally {
      setActiveClip(null)
      setPendingClips([])
      processingRef.current = false
    }
  }

  function assignedBgPaths(exceptWav: string) {
    return pairs.filter(p => p.wav_name !== exceptWav).map(p => p.bg_path)
  }

  function availableBgsFor(wav: Pairing): FileEntry[] {
    const assigned = assignedBgPaths(wav.wav_name)
    return bgs.filter(b => !assigned.includes(b.path))
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

  const btn = (label: string, onClick: () => void, style?: React.CSSProperties) => (
    <button onClick={onClick} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', ...style }}>{label}</button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{episode.meta.name} — {pairs.length} clips</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={async () => {
              const p = await api.matchAssets(wavs, bgs)
              if (p?.length) { setPairs(p); await api.saveEpisodeMeta(episode.id, { ...episode.meta, pairings: p }); onMetaChange() }
            }} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 6, padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>↺ Re-match</button>
            <button onClick={processAll} style={{ background: 'var(--yellow)', border: 'none', borderRadius: 6, padding: '7px 16px', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>▶ Process all</button>
          </div>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          WAVs: {wavs.length} · BGs: {bgs.length} · wav_source: {episode.meta.wav_source || '(not set)'}
        </div>

        {!wavs.length && (
          <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 6 }}>
            No WAV files found. Set WAV source folder in Phase ① Setup.
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          {pairs.map((pair, i) => {
            const status = statuses[pair.wav_name]
            const isRunning = activeClip === pair.wav_name
            const isDone = !isRunning && status?.state === 'done'
            const isError = !isRunning && status?.state === 'error'
            const isDropOpen = openDropdown === pair.wav_name
            const availBgs = availableBgsFor(pair)

            return (
              <div key={pair.wav_name} style={{
                display: 'grid',
                gridTemplateColumns: '16px 160px 14px minmax(0,1fr) 30px 48px 280px',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderBottom: i < pairs.length - 1 ? '1px solid var(--border)' : 'none',
                background: pair.loops ? 'var(--red-dim)' : 'transparent',
                position: 'relative',
              }}>
                {/* status dot */}
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: isDone ? 'var(--mint)' : isRunning ? 'var(--yellow)' : '#2a2b3a', boxShadow: isRunning ? '0 0 6px var(--yellow)' : 'none' }} />

                {/* WAV info */}
                <div>
                  <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>{pair.wav_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{fmt(pair.wav_duration)}</div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>→</div>

                {/* BG selector */}
                <div data-dropdown style={{ position: 'relative', minWidth: 0 }}>
                  <div
                    onClick={() => setOpenDropdown(isDropOpen ? null : pair.wav_name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '4px 7px', borderRadius: 5, border: `1px solid ${isDropOpen ? 'var(--yellow)' : 'transparent'}`, background: isDropOpen ? 'var(--yellow-dim)' : 'transparent', minWidth: 0 }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{pair.bg_name}</span>
                    <span style={{ color: '#333', fontSize: 10, flexShrink: 0 }}>{fmt(pair.bg_duration)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{isDropOpen ? '▴' : '▾'}</span>
                  </div>

                  {isDropOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', minWidth: 260 }}>
                      <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {availBgs.filter(b => b.duration >= pair.wav_duration).length} fit · {availBgs.filter(b => b.duration < pair.wav_duration).length} loop
                      </div>
                      {availBgs.map(bg => {
                        const willLoop = bg.duration < pair.wav_duration
                        return (
                          <div
                            key={bg.path}
                            onClick={() => {
                              const updated = pairs.map(p => p.wav_name === pair.wav_name
                                ? { ...p, bg_name: bg.name, bg_path: bg.path, bg_duration: bg.duration, loops: willLoop }
                                : p)
                              savePairings(updated)
                              setOpenDropdown(null)
                            }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: bg.path === pair.bg_path ? 'var(--yellow-dim)' : 'transparent' }}
                          >
                            <span style={{ color: willLoop ? 'var(--red)' : 'var(--text)', fontSize: 12 }}>{bg.name}</span>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {willLoop && <span style={{ color: 'var(--red)', fontSize: 10 }}>↺</span>}
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmt(bg.duration)}</span>
                              {bg.path === pair.bg_path && <span style={{ color: 'var(--yellow)', fontSize: 11 }}>✓</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* from label */}
                <div style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>from</div>

                {/* start time */}
                <input
                  style={{ background: 'var(--bg-base)', border: `1px solid ${pair.bg_start !== '0:00' ? 'var(--yellow)' : 'var(--border-mid)'}`, borderRadius: 4, padding: '3px 0', color: pair.bg_start !== '0:00' ? 'var(--yellow)' : 'var(--text-muted)', fontSize: 11, textAlign: 'center', width: '100%' }}
                  value={pair.bg_start}
                  onChange={e => {
                    const updated = pairs.map(p => p.wav_name === pair.wav_name ? { ...p, bg_start: e.target.value } : p)
                    savePairings(updated)
                  }}
                />

                {/* status column */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: 280 }}>
                  {pair.loops && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, padding: '2px 6px', color: 'var(--red)', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap' }}>↺ loops</span>
                  )}
                  {isRunning && <span style={{ color: 'var(--yellow)', fontSize: 11, whiteSpace: 'nowrap' }}>{status.progress || 'running…'}</span>}
                  {isDone && (
                    <>
                      {btn('↺ Re-transcribe', () => api.processClip(episode.id, pair.wav_name, true, false))}
                      {btn('🎵 Re-audiogram', () => api.processClip(episode.id, pair.wav_name, false, true))}
                      <span style={{ color: 'var(--mint)', fontSize: 11, whiteSpace: 'nowrap' }}>✓</span>
                    </>
                  )}
                  {isError && <span style={{ color: 'var(--red)', fontSize: 11, whiteSpace: 'nowrap' }}>✗ error</span>}
                  {!isRunning && !isDone && !isError && pendingClips.includes(pair.wav_name) && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>⏳ queued</span>}
                  {!isRunning && !isDone && !isError && !pendingClips.includes(pair.wav_name) && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Full-text error panel — shown when any clip has an error */}
      {pairs.some(p => statuses[p.wav_name]?.state === 'error') && (
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.07)', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          <div style={{ color: 'var(--red)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Errors</div>
          {pairs.filter(p => statuses[p.wav_name]?.state === 'error').map(p => (
            <div key={p.wav_name}>
              <span style={{ color: 'var(--red)', fontSize: 11, fontWeight: 600 }}>{p.wav_name}: </span>
              <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{statuses[p.wav_name]?.progress || 'unknown error'}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {pairs.filter(p => statuses[p.wav_name]?.state === 'done').length} / {pairs.length} processed
          {pairs.filter(p => p.loops).length > 0 && ` · ${pairs.filter(p => p.loops).length} will loop`}
        </span>
        <button onClick={onNext} style={{ background: 'var(--mint)', border: 'none', borderRadius: 6, padding: '7px 18px', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>③ Transcripts →</button>
      </div>
    </div>
  )
}
