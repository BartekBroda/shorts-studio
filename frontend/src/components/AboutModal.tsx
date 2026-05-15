import { useEffect, useRef, useState } from "react";
import { api } from "../api";

interface Props {
  onClose: () => void;
  onOpenChangelog: () => void;
}

function AppIcon() {
  // Proportions from assets/generate_icon.py:
  // BAR_W=68, BAR_GAP=22, BAR_RADIUS=16, MAX_H=0.68*1024=696 on 1024×1024
  const heights = [0.42, 0.60, 0.78, 0.95, 1.00, 0.95, 0.78, 0.60, 0.42]
  const barW = 7
  const barGap = 2                                    // 68:22 ≈ 3:1
  const rx = 2                                        // 16/68 ≈ 24% of barW
  const maxH = 60
  const padV = 10                                     // vertical padding each side
  const totalW = heights.length * barW + (heights.length - 1) * barGap  // 79
  const svgH = maxH + padV * 2                        // 80

  return (
    <div style={{
      width: 96, height: 96, background: '#1a1a1a', borderRadius: 22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <svg width={totalW} height={svgH} viewBox={`0 0 ${totalW} ${svgH}`}>
        {heights.map((h, i) => {
          const barH = Math.round(h * maxH)
          const x = i * (barW + barGap)
          const y = (svgH - barH) / 2
          return <rect key={i} x={x} y={y} width={barW} height={barH} rx={rx} fill="#FEB902" />
        })}
      </svg>
    </div>
  )
}

export function AboutModal({ onClose, onOpenChangelog }: Props) {
  const [version, setVersion] = useState<string>("");
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getVersion().then((v) => setVersion(v ?? ""));
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-mid)",
          borderRadius: 16,
          width: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "36px 32px 28px",
          gap: 0,
        }}
      >
        <AppIcon />

        <div
          style={{
            marginTop: 20,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.3px",
            color: "var(--text)",
          }}
        >
          Shorts Studio
        </div>

        {version && (
          <div
            style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}
          >
            Version {version}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          ©2026 Bartek Jagniątkowski
        </div>

        <div
          style={{
            marginTop: 20,
            width: "100%",
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => {
              onClose();
              onOpenChangelog();
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--yellow)",
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            View Changelog →
          </button>
        </div>
      </div>
    </div>
  );
}
