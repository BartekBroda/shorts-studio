import React, { useEffect, useRef, useState } from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { api } from '../api'
import { ScrollBar } from '@/components/ui/scroll-area'
import { TimelineBar } from '../transcript/TimelineBar'
import { WordChip } from '../transcript/WordChip'
import { WordGroup } from '../transcript/WordGroup'
import type { Episode, WordEntry } from '../types'

interface Props {
  episode: Episode
  activeClip: string | null
  onNavigate: (name: string) => void
  onNext: () => void
}

export function Transcripts({ episode, activeClip, onNavigate, onNext }: Props) {
  const clips = episode.meta.pairings.map(p => p.wav_name)
  const clipIndex = activeClip ? clips.indexOf(activeClip) : 0
  const clip = clips[Math.max(0, clipIndex)]

  const [words, setWords] = useState<WordEntry[]>([])
  const [groups, setGroups] = useState<number[][]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioSrc, setAudioSrc] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [isModified, setIsModified] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const [draggingWord, setDraggingWord] = useState<{ wi: number; text: string } | null>(null)
  const draggingWordRef = useRef<{ wi: number; text: string } | null>(null)
  const draggingGroupIdx = useRef<number | null>(null)
  const [dragOverGi, setDragOverGi] = useState<number | null>(null)
  const [ghostInsertIdx, setGhostInsertIdx] = useState<number | null>(null)
  const [viewportStart, setViewportStart] = useState(0)
  const [viewportEnd, setViewportEnd] = useState(1)
  const [hoveredGi, setHoveredGi] = useState<number | null>(null)
  const prevActiveGiRef = useRef<number>(-1)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const groupsScrollRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef(words)
  const groupsRef = useRef(groups)
  const clipRef = useRef(clip)
  const groupElsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const undoStack = useRef<{ words: WordEntry[]; groups: number[][] }[]>([])
  const redoStack = useRef<{ words: WordEntry[]; groups: number[][] }[]>([])

  wordsRef.current = words
  groupsRef.current = groups
  clipRef.current = clip

  const durationRef = useRef(duration)
  durationRef.current = duration

  const togglePlayRef = useRef(togglePlay)
  togglePlayRef.current = togglePlay
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo

  // Compute which time range is visible in the groups scroll area (vertical layout)
  function updateViewport() {
    const el = groupsScrollRef.current
    if (!el || !durationRef.current) return
    const containerRect = el.getBoundingClientRect()
    const ws = wordsRef.current
    const gs = groupsRef.current
    let minTime = Infinity
    let maxTime = -Infinity
    for (const [gi, groupEl] of groupElsRef.current.entries()) {
      const rect = groupEl.getBoundingClientRect()
      if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue
      for (const wi of gs[gi] ?? []) {
        const w = ws[wi]
        if (!w) continue
        minTime = Math.min(minTime, w.start)
        maxTime = Math.max(maxTime, w.end)
      }
    }
    const d = durationRef.current
    if (minTime !== Infinity && d > 0) {
      setViewportStart(minTime / d)
      setViewportEnd(maxTime / d)
    } else {
      setViewportStart(0)
      setViewportEnd(1)
    }
  }

  // Space bar handler
  useEffect(() => {
    function handleSpace(e: KeyboardEvent) {
      const target = e.target as Element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); togglePlayRef.current() }
    }
    document.addEventListener('keydown', handleSpace)
    return () => document.removeEventListener('keydown', handleSpace)
  }, [])

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    function handleUndoRedo(e: KeyboardEvent) {
      const target = e.target as Element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redoRef.current()
        else undoRef.current()
      }
    }
    document.addEventListener('keydown', handleUndoRedo)
    return () => document.removeEventListener('keydown', handleUndoRedo)
  }, [])

  // Undo/redo menu events
  useEffect(() => {
    const onUndo = () => undoRef.current()
    const onRedo = () => redoRef.current()
    window.addEventListener('shorts-studio:undo', onUndo)
    window.addEventListener('shorts-studio:redo', onRedo)
    return () => {
      window.removeEventListener('shorts-studio:undo', onUndo)
      window.removeEventListener('shorts-studio:redo', onRedo)
    }
  }, [])

  // Auto-save debounce
  useEffect(() => {
    if (!isModified || !clip) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await api.saveTranscript(episode.id, clip, wordsRef.current, groupsRef.current)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1500)
      } catch {
        setSaveStatus('error')
      }
    }, 800)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [words, groups, isModified])

  // Auto-scroll to active group
  useEffect(() => {
    if (!autoScroll) return
    const activeWi = words.findIndex(w => w.start <= currentTime && currentTime < w.end)
    if (activeWi < 0) return
    const gi = groups.findIndex(g => g.includes(activeWi))
    if (gi < 0 || gi === prevActiveGiRef.current) return
    prevActiveGiRef.current = gi
    groupElsRef.current.get(gi)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [currentTime, autoScroll])

  const pairing = episode.meta.pairings.find(p => p.wav_name === clip)

  // Load transcript when clip changes
  useEffect(() => {
    if (!clip) return
    const prevClip = clipRef.current
    if (prevClip && prevClip !== clip && wordsRef.current.length > 0) {
      api.saveTranscript(episode.id, prevClip, wordsRef.current, groupsRef.current)
    }
    setAudioSrc('')
    setSaveStatus('idle')
    setEditingIdx(null)
    prevActiveGiRef.current = -1
    undoStack.current = []
    redoStack.current = []
    api.setUndoState(false, false)
    api.loadTranscript(episode.id, clip).then(data => {
      if (!data) return
      const filtered = data.words.filter(
        (w: WordEntry) => w.word.trim() !== '-' && w.word.trim() !== '–' && w.word.trim() !== '—'
      )
      setWords(filtered)
      setIsModified(false)
      const savedGroups: number[][] = data.groups ?? []
      if (savedGroups.length > 0) {
        const covered = new Set(savedGroups.flat())
        const orphans = filtered.map((_: WordEntry, i: number) => i).filter((i: number) => !covered.has(i))
        const extra = orphans.map((i: number) => [i])
        setGroups([...savedGroups, ...extra])
      } else if (filtered.length > 0) {
        const max = episode.meta.max_words ?? 3
        const auto: number[][] = []
        for (let i = 0; i < filtered.length; i += max) {
          auto.push(Array.from({ length: Math.min(max, filtered.length - i) }, (_, j) => i + j))
        }
        setGroups(auto)
      } else {
        setGroups([])
      }
    })
  }, [clip, episode.id])

  // Load audio
  useEffect(() => {
    if (!pairing?.wav_path) return
    api.getAudioB64(pairing.wav_path).then(src => { if (src) setAudioSrc(src) })
  }, [pairing?.wav_path])

  // Track audio duration
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.onloadedmetadata = () => setDuration(el.duration)
  }, [audioSrc])

  function seekTo(t: number) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = t
    el.play()
    setPlaying(true)
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) } else { el.play(); setPlaying(true) }
  }

  function pushUndo() {
    undoStack.current.push({ words: [...wordsRef.current], groups: groupsRef.current.map(g => [...g]) })
    redoStack.current = []
    api.setUndoState(true, false)
  }

  function undo() {
    const snap = undoStack.current.pop()
    if (!snap) return
    redoStack.current.push({ words: [...wordsRef.current], groups: groupsRef.current.map(g => [...g]) })
    setWords(snap.words)
    setGroups(snap.groups)
    setIsModified(true)
    api.setUndoState(undoStack.current.length > 0, true)
  }

  function redo() {
    const snap = redoStack.current.pop()
    if (!snap) return
    undoStack.current.push({ words: [...wordsRef.current], groups: groupsRef.current.map(g => [...g]) })
    setWords(snap.words)
    setGroups(snap.groups)
    setIsModified(true)
    api.setUndoState(true, redoStack.current.length > 0)
  }

  function updateWord(index: number, text: string) {
    pushUndo()
    setWords(ws => ws.map((w, i) => i === index ? { ...w, word: text, probability: 1 } : w))
    setIsModified(true)
  }

  function updateWordStart(index: number, t: number) {
    pushUndo()
    setWords(ws => ws.map((w, i) => i === index ? { ...w, start: t } : w))
    setIsModified(true)
  }

  function updateWordEnd(index: number, t: number) {
    pushUndo()
    setWords(ws => ws.map((w, i) => i === index ? { ...w, end: t } : w))
    setIsModified(true)
  }

  function deleteWord(wi: number) {
    pushUndo()
    if (editingIdx === wi) {
      setEditingIdx(null)
    } else if (editingIdx !== null && editingIdx > wi) {
      setEditingIdx(editingIdx - 1)
    }
    setWords(ws => ws.filter((_, i) => i !== wi))
    setGroups(gs =>
      gs.map(g => g.filter(i => i !== wi).map(i => i > wi ? i - 1 : i))
        .filter(g => g.length > 0)
    )
    setIsModified(true)
  }

  function addWordToGroup(gi: number) {
    pushUndo()
    const grpIndices = groups[gi]
    const grpWords = grpIndices.map(wi => words[wi]).filter(Boolean)
    const start = grpWords.length > 0 ? Math.max(...grpWords.map(w => w.end)) : (words.length > 0 ? words[words.length - 1].end : 0)
    const newWord: WordEntry = { word: 'new', start, end: start + 0.5, probability: 1, speaker_id: null }
    const newIdx = words.length
    setWords(ws => [...ws, newWord])
    setGroups(gs => gs.map((g, i) => i === gi ? [...g, newIdx] : g))
    setEditingIdx(newIdx)
    setIsModified(true)
  }

  function moveWordToGroup(wordIdx: number, targetGroupSnapshot: number[]) {
    pushUndo()
    setGroups(gs => {
      const without = gs.map(g => g.filter(i => i !== wordIdx)).filter(g => g.length > 0)
      const tgi = without.findIndex(g => targetGroupSnapshot.some(x => g.includes(x)))
      if (tgi >= 0) {
        return without.map((g, i) => i === tgi ? [...g, wordIdx].sort((a, b) => a - b) : g)
      }
      return [...without, [wordIdx]]
    })
    setIsModified(true)
  }

  function moveWordToCanvas(wordIdx: number) {
    pushUndo()
    setGroups(gs => {
      const without = gs.map(g => g.filter(i => i !== wordIdx)).filter(g => g.length > 0)
      return [...without, [wordIdx]]
    })
    setIsModified(true)
  }

  function mergeGroups(fromGi: number, toGi: number) {
    pushUndo()
    setGroups(gs => {
      if (fromGi === toGi || fromGi >= gs.length || toGi >= gs.length) return gs
      const merged = [...new Set([...gs[fromGi], ...gs[toGi]])].sort((a, b) => a - b)
      return gs.filter((_, i) => i !== fromGi && i !== toGi).concat([merged])
    })
    setIsModified(true)
  }

  function sortByTime() {
    pushUndo()
    const order = words.map((_, i) => i).sort((a, b) => words[a].start - words[b].start)
    const remap = new Array(words.length)
    order.forEach((oldIdx, newIdx) => { remap[oldIdx] = newIdx })
    setWords(order.map(i => words[i]))
    setGroups(gs => gs.map(g => g.map(i => remap[i])).map(g => g.sort((a, b) => a - b)))
  }

  function handleAutoGroup() {
    pushUndo()
    const max = episode.meta.max_words ?? 3
    const auto: number[][] = []
    for (let i = 0; i < words.length; i += max) {
      auto.push(Array.from({ length: Math.min(max, words.length - i) }, (_, j) => i + j))
    }
    setGroups(auto)
    setIsModified(true)
  }

  async function handleSave() {
    setSaveStatus('saving')
    try {
      await api.saveTranscript(episode.id, clip, words, groups)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }

  // Sort groups by minimum word start time (chronological order)
  const sortedGroupIndices = groups
    .map((g, gi) => ({ gi, minStart: g.length > 0 ? Math.min(...g.map(wi => words[wi]?.start ?? 0)) : 0 }))
    .sort((a, b) => a.minStart - b.minStart)
    .map(x => x.gi)

  const activeWi = words.findIndex(w => w.start <= currentTime && currentTime < w.end)

  const hoveredRange = (() => {
    if (hoveredGi === null) return undefined
    const ws = (groups[hoveredGi] ?? []).map(wi => words[wi]).filter(Boolean)
    if (ws.length === 0) return undefined
    return { start: Math.min(...ws.map(w => w.start)), end: Math.max(...ws.map(w => w.end)) }
  })()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <select
          value={clip}
          onChange={e => onNavigate(e.target.value)}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-mid)',
            color: 'var(--text)',
            borderRadius: 5,
            padding: '4px 8px',
            fontSize: 12,
          }}
        >
          {clips.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => api.processClip(episode.id, clip, true)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 5, padding: '5px 10px', color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}
        >
          ↺ Re-transcribe
        </button>
        <button
          onClick={sortByTime}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 5, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
        >
          Sort by time
        </button>
        <button
          onClick={handleAutoGroup}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 5, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
        >
          Auto-group
        </button>
        {clipIndex > 0 && (
          <button
            onClick={() => onNavigate(clips[clipIndex - 1])}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 5, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
          >
            ◀ prev
          </button>
        )}
        {clipIndex < clips.length - 1 && (
          <button
            onClick={() => onNavigate(clips[clipIndex + 1])}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 5, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
          >
            next ▶
          </button>
        )}
      </div>

      {/* Timeline bar */}
      <TimelineBar
        audioUrl={audioSrc}
        currentTime={currentTime}
        duration={duration}
        playing={playing}
        words={words}
        autoScroll={autoScroll}
        viewportStart={viewportStart}
        viewportEnd={viewportEnd}
        hoveredRange={hoveredRange}
        onToggleAutoScroll={() => setAutoScroll(v => !v)}
        onTimeUpdate={setCurrentTime}
        onPlayPause={togglePlay}
        onSeek={t => {
          const el = audioRef.current
          if (el) el.currentTime = t
        }}
        audioRef={audioRef}
      />

      {/* Wrapping groups area — fills 2D space, scrolls vertically */}
      <ScrollAreaPrimitive.Root style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <ScrollAreaPrimitive.Viewport
        ref={groupsScrollRef}
        style={{ height: '100%', width: '100%' }}
        onScroll={updateViewport}
        onDragOver={e => {
          e.preventDefault()
          if (!draggingWordRef.current) {
            setDragOverGi(null)
            setGhostInsertIdx(null)
            return
          }
          // Find which group (if any) the cursor is directly over via DOM
          let overGi: number | null = null
          for (const [gi, el] of groupElsRef.current.entries()) {
            if (el.contains(e.target as Node)) { overGi = gi; break }
          }
          if (overGi !== null) {
            setDragOverGi(overGi)
            setGhostInsertIdx(null)
            return
          }
          // Canvas gap — compute insert position (Y-based for vertical layout)
          setDragOverGi(null)
          const cursorY = e.clientY
          const visibleGroups = sortedGroupIndices.filter(gi => groups[gi]?.length > 0)
          let insertIdx = visibleGroups.length
          for (let i = 0; i < visibleGroups.length; i++) {
            const el = groupElsRef.current.get(visibleGroups[i])
            if (!el) continue
            const rect = el.getBoundingClientRect()
            if (cursorY < rect.top + rect.height / 2) { insertIdx = i; break }
          }
          setGhostInsertIdx(insertIdx)
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragOverGi(null)
            setGhostInsertIdx(null)
          }
        }}
        onDrop={e => {
          e.preventDefault()
          const dragType = e.dataTransfer.getData('drag-type')
          if (dragType !== 'group' && draggingWordRef.current !== null) {
            moveWordToCanvas(draggingWordRef.current.wi)
            draggingWordRef.current = null
            setDraggingWord(null)
            setDragOverGi(null)
            setGhostInsertIdx(null)
          }
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          padding: '14px 16px',
          alignContent: 'flex-start',
          minHeight: '100%',
        }}>
        {(() => {
          const visibleGroups = sortedGroupIndices.filter(gi => groups[gi]?.length > 0)
          const showGhost = draggingWord !== null && ghostInsertIdx !== null && dragOverGi === null
          const ghostGroupEl = (
            <div
              key="ghost-group"
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                gap: 6,
                flexShrink: 0,
                border: '2px dashed rgba(254,185,2,0.55)',
                borderRadius: 8,
                padding: '6px 8px',
                minWidth: 72,
                opacity: 0.6,
                pointerEvents: 'none',
                alignSelf: 'flex-start',
              }}
            >
              <span style={{ fontSize: 10, color: 'rgba(254,185,2,0.5)' }}>new</span>
              <span
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  borderRadius: 4,
                  padding: '4px 8px',
                  border: '1px solid var(--yellow)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              >
                {draggingWord?.text}
              </span>
            </div>
          )
          const elements: React.ReactNode[] = []

          visibleGroups.forEach((gi, renderOrder) => {
            if (showGhost && ghostInsertIdx === renderOrder) {
              elements.push(ghostGroupEl)
            }

            const grpIndices = groups[gi]
            const grpWords = grpIndices.map((wi: number) => words[wi]).filter(Boolean)
            const sourceOrder = draggingWord
              ? sortedGroupIndices.findIndex(gi2 => groups[gi2]?.includes(draggingWord.wi))
              : -1
            const ghostWordPos: 'start' | 'end' = sourceOrder !== -1 && sourceOrder < renderOrder ? 'start' : 'end'

            elements.push(
              <div
                key={gi}
                ref={el => {
                  if (el) groupElsRef.current.set(gi, el)
                  else groupElsRef.current.delete(gi)
                }}
                style={{ alignSelf: 'flex-start' }}
                onMouseEnter={() => setHoveredGi(gi)}
                onMouseLeave={() => setHoveredGi(null)}
              >
                <WordGroup
                  groupIndex={renderOrder}
                  groupWords={grpWords}
                  onHeaderClick={() => {
                    if (grpIndices.length > 0 && words[grpIndices[0]]) {
                      seekTo(words[grpIndices[0]].start)
                    }
                  }}
                  onWordDrop={() => {
                    const wi = draggingWordRef.current?.wi ?? null
                    if (wi === null) return
                    moveWordToGroup(wi, groups[gi])
                    draggingWordRef.current = null
                    setDraggingWord(null)
                    setDragOverGi(null)
                    setGhostInsertIdx(null)
                  }}
                  onGroupDrop={() => {
                    const fromGi = draggingGroupIdx.current
                    if (fromGi === null || fromGi === gi) return
                    mergeGroups(fromGi, gi)
                    draggingGroupIdx.current = null
                  }}
                  onGroupDragStart={() => {
                    draggingGroupIdx.current = gi
                  }}
                  onAddWord={() => addWordToGroup(gi)}
                  isHovered={hoveredGi === gi}
                  ghostWord={draggingWord && dragOverGi === gi ? draggingWord.text : undefined}
                  ghostWordPosition={ghostWordPos}
                >
                  {grpIndices.map((wi: number) => {
                    const w = words[wi]
                    if (!w) return null
                    return (
                      <WordChip
                        key={wi}
                        word={w}
                        isPlaying={wi === activeWi}
                        onSingleClick={() => seekTo(w.start)}
                        onChange={text => updateWord(wi, text)}
                        onChangeStart={t => updateWordStart(wi, t)}
                        onChangeEnd={t => updateWordEnd(wi, t)}
                        onDelete={() => deleteWord(wi)}
                        onDragStart={() => {
                          draggingWordRef.current = { wi, text: w.word }
                          setDraggingWord({ wi, text: w.word })
                        }}
                        onDragEnd={() => {
                          draggingWordRef.current = null
                          setDraggingWord(null)
                          setDragOverGi(null)
                          setGhostInsertIdx(null)
                        }}
                        editRequested={editingIdx === wi}
                        onTabNext={() => setEditingIdx(wi + 1 < words.length ? wi + 1 : null)}
                        onEditDone={() => setEditingIdx(null)}
                      />
                    )
                  })}
                </WordGroup>
              </div>
            )
          })

          if (showGhost && ghostInsertIdx === visibleGroups.length) {
            elements.push(ghostGroupEl)
          }

          return elements
        })()}
        </div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      </ScrollAreaPrimitive.Root>

      {/* Bottom bar */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {clip} · {pairing?.wav_duration?.toFixed(1)}s
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{
              background: saveStatus === 'saved' ? 'var(--mint)' : saveStatus === 'error' ? 'var(--red-dim)' : 'var(--bg-card)',
              border: `1px solid ${saveStatus === 'error' ? 'var(--red)' : 'var(--border-mid)'}`,
              borderRadius: 6,
              padding: '7px 16px',
              color: saveStatus === 'saved' ? '#000' : saveStatus === 'error' ? 'var(--red)' : 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Error' : 'Save'}
          </button>
          <button
            onClick={onNext}
            style={{
              background: 'var(--mint)',
              border: 'none',
              borderRadius: 6,
              padding: '7px 18px',
              color: '#000',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ④ Render →
          </button>
        </div>
      </div>
    </div>
  )
}
