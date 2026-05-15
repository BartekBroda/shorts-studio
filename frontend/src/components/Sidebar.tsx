import { tailPath } from '../api'
import type { Episode, ClipMeta } from '../types'

interface Props {
  episodes: Episode[]
  activeEpisodeId: string | null
  activeClip: string | null
  onSelectEpisode: (id: string) => void
  onSelectClip: (name: string) => void
  onOpenProject: () => void
  onRemoveProject: (id: string) => void
  onOpenSettings: () => void
  onOpenAbout: () => void
  onOpenChangelog: () => void
}

const BADGE: Record<ClipMeta['status'], { label: string; color: string }> = {
  rendered:  { label: '✓', color: 'var(--mint)' },
  edited:    { label: '✎', color: 'var(--yellow)' },
  processed: { label: '~', color: 'var(--text-muted)' },
  untouched: { label: '—', color: '#333' },
}

export function Sidebar({ episodes, activeEpisodeId, activeClip, onSelectEpisode, onSelectClip, onOpenProject, onRemoveProject, onOpenSettings, onOpenAbout, onOpenChangelog }: Props) {
  return (
    <div style={{ width: 210, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.2px' }}>Projects</span>
        <span style={{ color: 'var(--yellow)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} onClick={onOpenProject} title="Open project folder">+</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {episodes.length === 0 && (
          <div style={{ padding: '20px 14px', color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            No projects yet.<br />Click + to open a folder.
          </div>
        )}
        {episodes.map(ep => (
          <div key={ep.id}>
            <div
              onClick={() => onSelectEpisode(ep.id)}
              style={{
                padding: '8px 14px',
                cursor: 'pointer',
                borderLeft: `3px solid ${ep.id === activeEpisodeId ? 'var(--yellow)' : 'transparent'}`,
                background: ep.id === activeEpisodeId ? 'var(--yellow-dim)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 4,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.meta.name || ep.id.split('/').pop()}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ep.id}>{tailPath(ep.id, 2)}</div>
              </div>
              <span
                onClick={e => { e.stopPropagation(); onRemoveProject(ep.id) }}
                style={{ color: '#333', fontSize: 12, cursor: 'pointer', flexShrink: 0, marginTop: 1 }}
                title="Remove from list"
              >×</span>
            </div>

            {ep.id === activeEpisodeId && ep.clips.map(clip => {
              const badge = BADGE[clip.status]
              return (
                <div
                  key={clip.name}
                  onClick={() => onSelectClip(clip.name)}
                  style={{
                    padding: '5px 14px 5px 26px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderRadius: 4,
                    margin: '0 4px',
                    background: clip.name === activeClip ? 'var(--bg-hover)' : 'transparent',
                  }}
                >
                  <span style={{ color: clip.name === activeClip ? 'var(--yellow)' : 'var(--text-muted)', fontSize: 12, fontWeight: clip.name === activeClip ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clip.name}
                  </span>
                  <span style={{ color: badge.color, fontSize: 11, flexShrink: 0 }}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div onClick={onOpenSettings} style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
          ⚙ BG Library settings
        </div>
        <div onClick={onOpenAbout} style={{ padding: '8px 14px', paddingTop: 0, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
          ℹ About
        </div>
        <div onClick={onOpenChangelog} style={{ padding: '8px 14px', paddingTop: 0, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
          ≡ Changelog
        </div>
      </div>
    </div>
  )
}
