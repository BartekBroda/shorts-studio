export interface WordEntry {
  word: string
  start: number
  end: number
  probability: number
  speaker_id: null
}

export interface FileEntry {
  name: string
  path: string
  duration: number
}

export interface Pairing {
  wav_name: string
  wav_path: string
  wav_duration: number
  bg_name: string
  bg_path: string
  bg_duration: number
  bg_start: string
  loops: boolean
}

export interface ClipMeta {
  name: string
  slot: string
  status: 'untouched' | 'processed' | 'edited' | 'rendered'
}

export interface EpisodeMeta {
  name: string
  wav_source: string
  logo: string
  font_size: number
  highlight_color: string
  max_words: number
  subtitle_y_pct: number
  pairings: Pairing[]
}

export interface Episode {
  id: string
  path: string
  meta: EpisodeMeta
  clips: ClipMeta[]
}

export type Phase = 1 | 2 | 3 | 4
