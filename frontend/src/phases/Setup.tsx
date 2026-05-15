import { useEffect, useRef, useState } from 'react'
import { api, tailPath } from '../api'
import type { Episode, EpisodeMeta } from '../types'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  episode: Episode
  onSave: (meta: EpisodeMeta) => void
}

// 1080×1920 element constants (pixels in final output)
const LOGO_GAP_PX = 140
const LOGO_W_PX   = 833
const AG_H_PX     = 512
const AG_TOP_PCT  = (1920 - AG_H_PX) / 1920   // ~0.733

// Fake bar heights for the audiogram visualization
const BAR_HEIGHTS = [42, 68, 55, 80, 93, 72, 48, 61, 87, 74, 58, 45, 78, 91, 65, 50, 83, 70, 47, 62, 88, 75, 52, 40]

function FramePreview({
  logoDataUrl,
  subtitleYPct,
  onChange,
}: {
  logoDataUrl: string
  subtitleYPct: number
  onChange: (pct: number) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  // logoBottomPct: updated when logo image loads; fallback 0 when no logo
  const [logoBottomPct, setLogoBottomPct] = useState(0)

  const PREVIEW_W = 130
  const PREVIEW_H = Math.round(PREVIEW_W * 1920 / 1080)  // 231

  const logoTopPct = LOGO_GAP_PX / 1920
  const logoWPct   = (LOGO_W_PX / 1080) * 100

  function clampToBounds(v: number) {
    return Math.max(logoBottomPct, Math.min(AG_TOP_PCT, v))
  }

  function pctFromClientY(clientY: number) {
    if (!rootRef.current) return subtitleYPct
    const r = rootRef.current.getBoundingClientRect()
    return clampToBounds((clientY - r.top) / r.height)
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    onChange(pctFromClientY(e.clientY))
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return
    onChange(pctFromClientY(e.clientY))
  }

  function onLogoLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    if (!img.naturalWidth) return
    // Compute real logo height in the 1920px frame from intrinsic aspect ratio
    const realLogoH = img.naturalHeight * (LOGO_W_PX / img.naturalWidth)
    setLogoBottomPct((LOGO_GAP_PX + realLogoH) / 1920)
  }

  function onLogoError() {
    setLogoBottomPct(0)
  }

  // When logo is removed, reset constraint
  useEffect(() => {
    if (!logoDataUrl) setLogoBottomPct(0)
  }, [logoDataUrl])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div
        ref={rootRef}
        style={{
          position: 'relative',
          width: PREVIEW_W,
          height: PREVIEW_H,
          background: '#07080c',
          border: '1px solid var(--border-mid)',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: 'ns-resize',
          userSelect: 'none',
          flexShrink: 0,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        {/* Logo */}
        {logoDataUrl && (
          <img
            src={logoDataUrl}
            draggable={false}
            onLoad={onLogoLoad}
            onError={onLogoError}
            style={{
              position: 'absolute',
              top: `${logoTopPct * 100}%`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${logoWPct}%`,
              height: 'auto',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Drag bounds overlay — logo zone */}
        {logoBottomPct > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${logoBottomPct * 100}%`,
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px dashed rgba(255,255,255,0.1)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Audiogram */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${(1 - AG_TOP_PCT) * 100}%`,
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 3px 3px',
          gap: 1,
          background: 'rgba(0,0,0,0.2)',
          borderTop: '1px dashed rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }}>
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              background: '#FEB902',
              borderRadius: '1px 1px 0 0',
              height: `${h}%`,
              opacity: 0.75,
            }} />
          ))}
        </div>

        {/* Subtitle block — centered on subtitleYPct */}
        <div style={{
          position: 'absolute',
          top: `${subtitleYPct * 100}%`,
          left: 0,
          right: 0,
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {['WORD', 'WORD'].map((w, i) => (
              <span key={i} style={{
                background: i === 0 ? '#FEB902' : 'rgba(255,255,255,0.92)',
                color: '#000',
                borderRadius: 2,
                padding: '1px 4px',
                fontSize: 7,
                fontWeight: 700,
              }}>{w}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {['WORD', 'WORD', 'WORD'].map((w, i) => (
              <span key={i} style={{
                background: 'rgba(255,255,255,0.92)',
                color: '#000',
                borderRadius: 2,
                padding: '1px 4px',
                fontSize: 7,
                fontWeight: 700,
              }}>{w}</span>
            ))}
          </div>
        </div>

        {/* Center-line */}
        <div style={{
          position: 'absolute',
          top: `${subtitleYPct * 100}%`,
          left: 0,
          right: 0,
          height: 1,
          background: 'rgba(254,185,2,0.5)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Percentage label below preview */}
      <span style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums',
        alignSelf: 'center',
      }}>
        {Math.round(subtitleYPct * 100)}% from top
      </span>
    </div>
  )
}

export function Setup({ episode, onSave }: Props) {
  const [meta, setMeta] = useState<EpisodeMeta>({
    name: episode.meta.name ?? episode.id.split('/').pop() ?? '',
    wav_source: episode.id,
    logo: episode.meta.logo ?? '',
    font_size: episode.meta.font_size ?? 72,
    highlight_color: episode.meta.highlight_color ?? '#FEB902',
    max_words: episode.meta.max_words ?? 3,
    subtitle_y_pct: episode.meta.subtitle_y_pct ?? 0.59,
    pairings: episode.meta.pairings ?? [],
  })

  const [logoDataUrl, setLogoDataUrl] = useState('')

  useEffect(() => {
    if (!meta.logo) { setLogoDataUrl(''); return }
    api.getLogoDataUrl(meta.logo).then(setLogoDataUrl).catch(() => setLogoDataUrl(''))
  }, [meta.logo])

  function field(label: string, content: React.ReactNode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</label>
        {content}
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 6,
    padding: '7px 10px', color: 'var(--text)', fontSize: 12, outline: 'none', width: '100%',
  }

  const roStyle: React.CSSProperties = { ...inputStyle, color: 'var(--text-muted)', cursor: 'default' }

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>Setup</div>

      {field('Project source folder', (
        <input style={roStyle} value={tailPath(episode.id, 3)} readOnly title={episode.id} />
      ))}

      {field('Episode name', (
        <input style={inputStyle} value={meta.name} onChange={e => setMeta(m => ({ ...m, name: e.target.value }))} />
      ))}

      {field('Logo (auto-detected PNG)', (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input style={{ ...roStyle, flex: 1 }} value={tailPath(meta.logo, 1)} readOnly title={meta.logo} placeholder="No PNG found in project folder" />
          <button
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 6, padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={async () => {
              const win = window as any
              if (win.pywebview) {
                const files = await win.pywebview.api.show_file_dialog(['PNG Files (*.png)', 'All files (*.*)'])
                if (files?.[0]) setMeta(m => ({ ...m, logo: files[0] }))
              }
            }}
          >Override…</button>
        </div>
      ))}

      {field('Subtitle font size', (
        <input style={{ ...inputStyle, width: 100 }} type="number" value={meta.font_size}
          onChange={e => setMeta(m => ({ ...m, font_size: Number(e.target.value) }))} />
      ))}

      {field('Highlight color', (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={meta.highlight_color}
            onChange={e => setMeta(m => ({ ...m, highlight_color: e.target.value }))}
            style={{ width: 36, height: 30, border: 'none', background: 'none', cursor: 'pointer' }} />
          <input style={{ ...inputStyle, width: 120 }} value={meta.highlight_color}
            onChange={e => setMeta(m => ({ ...m, highlight_color: e.target.value }))} />
        </div>
      ))}

      {field('Max words per subtitle line', (
        <input style={{ ...inputStyle, width: 100 }} type="number" min={1} max={8} value={meta.max_words}
          onChange={e => setMeta(m => ({ ...m, max_words: Number(e.target.value) }))} />
      ))}

      {field('Subtitle vertical position', (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <FramePreview
            logoDataUrl={logoDataUrl}
            subtitleYPct={meta.subtitle_y_pct}
            onChange={pct => setMeta(m => ({ ...m, subtitle_y_pct: pct }))}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.6 }}>
            <div>Drag to set subtitle center.</div>
            <div>Constrained between logo bottom and audiogram top.</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 1, borderTop: '1px dashed rgba(255,255,255,0.25)' }} />
                <span>Logo zone (~top 7%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 1, borderTop: '1px dashed rgba(255,255,255,0.25)' }} />
                <span>Audiogram (~bottom 27%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ width: 8, height: 1, background: 'rgba(254,185,2,0.5)' }} />
                <span>Subtitle center</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={() => onSave(meta)}
        style={{ background: 'var(--yellow)', border: 'none', borderRadius: 6, padding: '9px 24px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start', marginTop: 8 }}
      >
        Save &amp; continue →
      </button>
    </div>
    </ScrollArea>
  )
}
