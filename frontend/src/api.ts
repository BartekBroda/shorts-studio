import type { Episode, EpisodeMeta, FileEntry, Pairing, WordEntry } from './types'

declare global {
  interface Window {
    pywebview?: {
      api: Record<string, (...args: unknown[]) => Promise<unknown>>
    }
  }
}

function waitForBridge(): Promise<void> {
  if (window.pywebview) return Promise.resolve()
  return new Promise(resolve => window.addEventListener('pywebviewready', () => resolve(), { once: true }))
}

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  await waitForBridge()
  return window.pywebview!.api[method](...args) as Promise<T>
}

export const api = {
  getConfig:        ()                                              => call<Record<string,string>>('get_config'),
  setBgLibrary:     (path: string)                                  => call<{ok:boolean}>('set_bg_library', path),
  setWhisperConfig: (cli: string, model: string)                    => call<{ok:boolean}>('set_whisper_config', cli, model),
  showFileDialog:   (types?: string[])                              => call<string[]>('show_file_dialog', types ?? []),

  listEpisodes:     ()                                              => call<Episode[]>('list_episodes'),
  openProject:      (folderPath: string)                            => call<Episode>('open_project', folderPath),
  removeProject:    (episodeId: string)                             => call<{ok:boolean}>('remove_project', episodeId),
  saveEpisodeMeta:  (episodeId: string, meta: EpisodeMeta)          => call<{ok:boolean}>('save_episode_meta', episodeId, meta),

  listBgLibrary:    ()                                              => call<FileEntry[]>('list_bg_library'),
  listWavSource:    (episodeId: string)                             => call<FileEntry[]>('list_wav_source', episodeId),

  matchAssets:      (wavs: FileEntry[], bgs: FileEntry[])           => call<Pairing[]>('match_assets', wavs, bgs),

  processClip:      (episodeId: string, clipName: string, force?: boolean, forceAudiogram?: boolean) => call<{ok:boolean}>('process_clip', episodeId, clipName, force ?? false, forceAudiogram ?? false),
  getClipStatus:    (episodeId: string, clipName: string)           => call<{state:string,progress:string}>('get_clip_status', episodeId, clipName),

  loadTranscript:   (episodeId: string, clipName: string)           => call<{words:WordEntry[],groups:number[][]}>('load_transcript', episodeId, clipName),
  saveTranscript:   (episodeId: string, clipName: string, words: WordEntry[], groups: number[][]) => call<{ok:boolean}>('save_transcript', episodeId, clipName, words, groups),

  renderClip:       (episodeId: string, clipName: string)           => call<{ok:boolean}>('render_clip', episodeId, clipName),
  getRenderStatus:  (episodeId: string, clipName: string)           => call<{state:string,progress:string,out_path?:string}>('get_render_status', episodeId, clipName),

  getAudioB64:      (path: string)                                   => call<string>('get_audio_b64', path),
  showFolderDialog: ()                                               => call<string[]>('show_folder_dialog'),
  openInFinder:     (path: string)                                   => call<void>('open_in_finder', path),
  getLogoDataUrl:   (path: string)                                   => call<string>('get_logo_data_url', path),
  getChangelog:     ()                                               => call<string>('get_changelog'),
  getVersion:       ()                                               => call<string>('get_version'),
  setUndoState:     (canUndo: boolean, canRedo: boolean)             => call<void>('set_undo_state', canUndo, canRedo),
}

/** Show last N path segments with … prefix */
export function tailPath(p: string, segments = 2): string {
  if (!p) return ''
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= segments) return p
  return '…/' + parts.slice(-segments).join('/')
}
