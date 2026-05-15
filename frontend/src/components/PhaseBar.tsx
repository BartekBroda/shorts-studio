import type { Phase } from '../types'

interface Props {
  active: Phase
  completed: Phase[]
  onPhaseChange?: (p: Phase) => void
  maxPhase?: Phase
}

const LABELS: Record<Phase, string> = {
  1: '① Setup',
  2: '② Match & Process',
  3: '③ Transcripts',
  4: '④ Render',
}

export function PhaseBar({ active, completed, onPhaseChange, maxPhase }: Props) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '0 16px', flexShrink: 0 }}>
      {([1, 2, 3, 4] as Phase[]).map(p => {
        const isDone = completed.includes(p)
        const isActive = p === active
        const isClickable = onPhaseChange != null && p <= (maxPhase ?? active)
        return (
          <div
            key={p}
            onClick={() => isClickable && onPhaseChange(p)}
            style={{
              padding: '11px 16px',
              color: isDone ? 'var(--mint)' : isActive ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive ? '2px solid var(--yellow)' : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              cursor: isClickable ? 'pointer' : 'default',
            }}
          >
            {LABELS[p]}
          </div>
        )
      })}
    </div>
  )
}
