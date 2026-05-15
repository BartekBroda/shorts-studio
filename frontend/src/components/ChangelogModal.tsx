import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

interface Props {
  onClose: () => void
}

function renderChangelog(md: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const lines = md.split('\n')
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('# ')) continue

    if (line.startsWith('## ')) {
      const text = line.slice(3).trim()
      nodes.push(
        <div key={key++} style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: nodes.length ? 28 : 0, marginBottom: 10 }}>
          <span style={{ color: 'var(--yellow)', fontWeight: 700, fontSize: 15 }}>{text}</span>
        </div>
      )
      continue
    }

    if (line.startsWith('### ')) {
      const text = line.slice(4).trim()
      nodes.push(
        <div key={key++} style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 12, marginBottom: 4 }}>
          {text}
        </div>
      )
      continue
    }

    if (line.startsWith('- ')) {
      const content = line.slice(2)
      const boldMatch = content.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)/)
      if (boldMatch) {
        nodes.push(
          <div key={key++} style={{ display: 'flex', gap: 6, fontSize: 12, lineHeight: 1.5, padding: '1px 0' }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>·</span>
            <span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{boldMatch[1]}</span>
              <span style={{ color: 'var(--text-muted)' }}> — {boldMatch[2]}</span>
            </span>
          </div>
        )
      } else {
        const plain = content.replace(/\*\*(.+?)\*\*/g, '$1')
        nodes.push(
          <div key={key++} style={{ display: 'flex', gap: 6, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', padding: '1px 0' }}>
            <span style={{ flexShrink: 0 }}>·</span>
            <span>{plain}</span>
          </div>
        )
      }
      continue
    }

    if (line.trim() === '---') {
      nodes.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />)
      continue
    }
  }

  return nodes
}

export function ChangelogModal({ onClose }: Props) {
  const [changelog, setChangelog] = useState<string | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getChangelog().then(md => setChangelog(md ?? ''))
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 14, width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Changelog</div>
          <span onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {changelog === null
            ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
            : changelog === ''
              ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>CHANGELOG.md not found.</div>
              : renderChangelog(changelog)
          }
        </div>
      </div>
    </div>
  )
}
