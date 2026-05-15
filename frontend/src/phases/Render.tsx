import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Episode } from '../types'

interface ClipState {
  state: 'idle' | 'running' | 'done' | 'error'
  progress: string
  out_path?: string
}

interface Props {
  episode: Episode
}

export function Render({ episode }: Props) {
  const [clipStates, setClipStates] = useState<Record<string, ClipState>>({})
  const [elapsed, setElapsed] = useState<Record<string, number>>({})
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const polls = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const clips = episode.meta.pairings ?? []

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearInterval)
      Object.values(polls.current).forEach(clearInterval)
    }
  }, [])

  // On mount (or when episode changes), restore state for in-progress or finished renders
  useEffect(() => {
    let cancelled = false
    async function restoreStates() {
      for (const pair of clips) {
        if (cancelled) break
        try {
          const st = await api.getRenderStatus(episode.id, pair.wav_name)
          if (cancelled) break
          if (st.state === 'running') {
            setClipStates(s => ({ ...s, [pair.wav_name]: st as ClipState }))
            startTimer(pair.wav_name)
            startPoll(episode.id, pair.wav_name)
          } else if (st.state === 'done' || st.state === 'error') {
            setClipStates(s => ({ ...s, [pair.wav_name]: st as ClipState }))
          }
          // 'idle' — skip
        } catch {
          // status file may not exist yet; ignore
        }
      }
    }
    restoreStates()
    return () => { cancelled = true }
  }, [episode.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function startTimer(name: string) {
    const start = Date.now()
    timers.current[name] = setInterval(() => {
      setElapsed(e => ({ ...e, [name]: Math.floor((Date.now() - start) / 1000) }))
    }, 1000)
  }

  function stopTimer(name: string) {
    clearInterval(timers.current[name])
  }

  function stopPoll(name: string) {
    clearInterval(polls.current[name])
  }

  function startPoll(episodeId: string, clipName: string) {
    stopPoll(clipName)
    polls.current[clipName] = setInterval(async () => {
      const st = await api.getRenderStatus(episodeId, clipName)
      setClipStates(s => ({ ...s, [clipName]: st as ClipState }))
      if (st.state === 'done' || st.state === 'error') {
        stopPoll(clipName)
        stopTimer(clipName)
      }
    }, 800)
  }

  async function renderClip(clipName: string) {
    setClipStates(s => ({ ...s, [clipName]: { state: 'running', progress: 'starting…' } }))
    setElapsed(e => ({ ...e, [clipName]: 0 }))
    startTimer(clipName)
    try {
      await api.renderClip(episode.id, clipName)
      startPoll(episode.id, clipName)
    } catch (e: any) {
      stopTimer(clipName)
      setClipStates(s => ({ ...s, [clipName]: { state: 'error', progress: String(e) } }))
    }
  }

  async function renderAll() {
    for (const p of clips) {
      if (clipStates[p.wav_name]?.state === 'running') continue
      await renderClip(p.wav_name)
      while (true) {
        await new Promise(r => setTimeout(r, 1000))
        const st = await api.getRenderStatus(episode.id, p.wav_name)
        if (st.state === 'done' || st.state === 'error') break
      }
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  function progressWidth(progress: string): string {
    const m = progress.match(/(\d+)%/)
    if (m) return `${m[1]}%`
    const sub = progress.match(/subtitles (\d+)\/(\d+)/)
    if (sub) return `${Math.round(parseInt(sub[1]) / parseInt(sub[2]) * 50)}%`
    return '5%'
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{episode.meta.name} — render queue</span>
          <button onClick={renderAll} style={{ background: 'var(--mint)', border: 'none', borderRadius: 6, padding: '7px 16px', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>▶▶ Render all</button>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          {clips.map((pair, i) => {
            const cs = clipStates[pair.wav_name] ?? { state: 'idle', progress: '' }
            const st = cs.state
            const secs = elapsed[pair.wav_name] ?? 0
            return (
              <div key={pair.wav_name} style={{ display: 'flex', flexDirection: 'column', padding: '10px 14px', borderBottom: i < clips.length - 1 ? '1px solid var(--border)' : 'none', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: st === 'done' ? 'var(--mint)' : st === 'running' ? 'var(--yellow)' : st === 'error' ? 'var(--red)' : '#2a2b3a', boxShadow: st === 'running' ? '0 0 6px var(--yellow)' : 'none', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500, flex: 1 }}>{pair.wav_name}</span>
                  {st === 'running' && <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{cs.progress || '…'}</span>}
                  {st === 'running' && <span style={{ color: 'var(--yellow)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmt(secs)}</span>}
                  {st === 'done' && cs.out_path && (
                    <button onClick={() => api.openInFinder(cs.out_path!)} style={{ background: 'transparent', border: '1px solid var(--border-mid)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>Show in Finder</button>
                  )}
                  {st === 'error' && <span style={{ color: 'var(--red)', fontSize: 11 }} title={cs.progress}>error</span>}
                  <button
                    onClick={() => renderClip(pair.wav_name)}
                    disabled={st === 'running'}
                    style={{ background: 'var(--yellow)', border: 'none', borderRadius: 5, padding: '5px 12px', color: '#000', fontWeight: 700, fontSize: 11, cursor: st === 'running' ? 'default' : 'pointer', opacity: st === 'running' ? 0.5 : 1 }}
                  >▶ Render</button>
                </div>
                {st === 'running' && (
                  <div style={{ height: 3, background: 'var(--border-mid)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--yellow)', borderRadius: 2, width: progressWidth(cs.progress), transition: 'width 0.6s ease' }} />
                  </div>
                )}
                {st === 'done' && (
                  <div style={{ height: 3, background: 'var(--mint)', borderRadius: 2 }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
