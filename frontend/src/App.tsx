import React, { useEffect, useState } from "react";
import { api, tailPath } from "./api";
import { Sidebar } from "./components/Sidebar";
import { PhaseBar } from "./components/PhaseBar";
import { AboutModal } from "./components/AboutModal";
import { ChangelogModal } from "./components/ChangelogModal";
import { Setup } from "./phases/Setup";
import { MatchProcess } from "./phases/MatchProcess";
import { Transcripts } from "./phases/Transcripts";
import { Render } from "./phases/Render";
import type { Episode, EpisodeMeta, Phase } from "./types";

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [bgLib, setBgLib] = useState<string | null>(null)
  const [whisperCli, setWhisperCli] = useState<string | null>(null)
  const [whisperModel, setWhisperModel] = useState<string | null>(null)

  useEffect(() => {
    api.getConfig().then(cfg => {
      setBgLib(cfg?.bg_library ?? '')
      setWhisperCli(cfg?.whisper_cli ?? '')
      setWhisperModel(cfg?.whisper_model ?? '')
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function pickFile(setter: (v: string) => void) {
    const files = await api.showFileDialog()
    if (files?.[0]) setter(files[0])
  }

  async function save() {
    if (bgLib) await api.setBgLibrary(bgLib)
    await api.setWhisperConfig(whisperCli ?? '', whisperModel ?? '')
    onClose()
  }

  const loading = bgLib === null

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-mid)',
    borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12, outline: 'none',
  }
  const btnStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 6,
    padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  }
  const labelStyle: React.CSSProperties = {
    color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px',
  }

  function Field({ label, value, onChange, onPick, placeholder }: {
    label: string; value: string | null; onChange: (v: string) => void
    onPick: () => void; placeholder?: string
  }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={labelStyle}>{label}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inputStyle} value={value ?? ''} onChange={e => onChange(e.target.value)}
            placeholder={value === null ? 'Loading…' : (placeholder ?? '')} title={value ?? ''} readOnly={value === null} />
          <button style={btnStyle} onClick={onPick} disabled={value === null}>Choose…</button>
        </div>
        {value && <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{tailPath(value, 3)}</div>}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 12, padding: 24, width: 500, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Settings</div>

        <Field label="BG Library folder" value={bgLib} onChange={setBgLib}
          onPick={async () => { const d = await api.showFolderDialog(); if (d?.[0]) setBgLib(d[0]) }}
          placeholder="No folder selected" />

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...labelStyle, fontSize: 11 }}>Whisper transcription</div>
          <Field label="whisper-cli binary" value={whisperCli} onChange={setWhisperCli}
            onPick={() => pickFile(setWhisperCli)} placeholder="Auto-detect or enter path" />
          <Field label="Model file (.bin)" value={whisperModel} onChange={setWhisperModel}
            onPick={() => pickFile(setWhisperModel)} placeholder="Auto-detect or enter path" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={btnStyle} onClick={onClose}>Cancel</button>
          <button onClick={save} disabled={loading} style={{
            background: 'var(--yellow)', border: 'none', borderRadius: 6, padding: '7px 20px',
            color: '#000', fontWeight: 700, fontSize: 13, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.4 : 1,
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(1);
  const [maxPhase, setMaxPhase] = useState<Phase>(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    const handler = () => setShowAbout(true);
    window.addEventListener("shorts-studio:open-about", handler);
    return () => window.removeEventListener("shorts-studio:open-about", handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.addEventListener("shorts-studio:open-settings", handler);
    return () => window.removeEventListener("shorts-studio:open-settings", handler);
  }, []);

  const activeEpisode = episodes.find((e) => e.id === activeEpisodeId) ?? null;

  useEffect(() => {
    function init() {
      api.getConfig().then((cfg) => {
        if (!cfg?.bg_library) setShowSettings(true);
      });
      api.listEpisodes().then((eps) => {
        const list = eps ?? [];
        setEpisodes(list);
        if (list.length) setActiveEpisodeId(list[0].id);
      });
    }
    if (window.pywebview) {
      init();
    } else {
      window.addEventListener("pywebviewready", init, { once: true });
    }
  }, []);

  function goToPhase(p: Phase) {
    setPhase(p);
    if (p > maxPhase) setMaxPhase(p);
  }

  async function handleOpenProject() {
    const dirs = await api.showFolderDialog();
    if (!dirs?.[0]) return;
    const episode = await api.openProject(dirs[0]);
    if (!episode || (episode as any).error) return;
    await refreshEpisodes();
    setActiveEpisodeId((episode as Episode).id);
    setPhase(1);
    setMaxPhase(1);
  }

  async function refreshEpisodes() {
    const eps = await api.listEpisodes();
    setEpisodes(eps ?? []);
  }

  async function handleRemoveProject(id: string) {
    await api.removeProject(id);
    await refreshEpisodes();
    if (activeEpisodeId === id) {
      setActiveEpisodeId(null);
      setPhase(1);
      setMaxPhase(1);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh / 1.1)",
        width: "calc(100vw / 1.1)",
        transform: "scale(1.1)",
        transformOrigin: "top left",
        overflow: "hidden",
      }}
    >
      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            refreshEpisodes();
          }}
        />
      )}
      {showAbout && (
        <AboutModal
          onClose={() => setShowAbout(false)}
          onOpenChangelog={() => setShowChangelog(true)}
        />
      )}
      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
      <Sidebar
        episodes={episodes}
        activeEpisodeId={activeEpisodeId}
        activeClip={activeClip}
        onSelectEpisode={(id) => {
          setActiveEpisodeId(id);
          setActiveClip(null);
          setPhase(1);
          setMaxPhase(1);
        }}
        onSelectClip={(name) => {
          setActiveClip(name);
          goToPhase(3);
        }}
        onOpenProject={handleOpenProject}
        onRemoveProject={handleRemoveProject}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAbout={() => setShowAbout(true)}
        onOpenChangelog={() => setShowChangelog(true)}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {activeEpisode ? (
          <>
            <PhaseBar
              active={phase}
              completed={([1, 2, 3, 4] as Phase[]).filter((p) => p < maxPhase)}
              onPhaseChange={goToPhase}
              maxPhase={maxPhase}
            />
            {phase === 1 && (
              <Setup
                episode={activeEpisode}
                onSave={async (meta: EpisodeMeta) => {
                  await api.saveEpisodeMeta(activeEpisode.id, meta);
                  await refreshEpisodes();
                  goToPhase(2);
                }}
              />
            )}
            {phase === 2 && (
              <MatchProcess
                episode={activeEpisode}
                onNext={() => goToPhase(3)}
                onMetaChange={refreshEpisodes}
              />
            )}
            {phase === 3 && (
              <Transcripts
                episode={activeEpisode}
                activeClip={activeClip}
                onNavigate={setActiveClip}
                onNext={() => goToPhase(4)}
              />
            )}
            {phase === 4 && <Render episode={activeEpisode} />}
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: 13 }}>No project open.</div>
            <button
              onClick={handleOpenProject}
              style={{
                background: "var(--yellow)",
                border: "none",
                borderRadius: 6,
                padding: "9px 24px",
                color: "#000",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Open project folder…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
