import { ImageResponse } from "next/og";

export const socialImageAlt = "Orwell Bridge Status: live A14 open, delayed or closed status, wind warnings and closure alerts";
export const socialImageSize = { width: 1200, height: 630 };

const legend = [
  { label: "Open", color: "#34d399" },
  { label: "Delays", color: "#fbbf24" },
  { label: "Closed", color: "#fb7185" },
];

// A deliberately state-free card: shared links must never show a stale "open" or "closed".
export function renderSocialImage() {
  const piers = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #070d18 0%, #0f1c30 55%, #182b46 100%)",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#94a3b8" }}>
          <div style={{ display: "flex", letterSpacing: 4, textTransform: "uppercase" }}>Orwell Bridge Status</div>
          <div style={{ display: "flex" }}>orwellbridgestatus.com</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 88, lineHeight: 1.05, letterSpacing: -2 }}>Is the Orwell Bridge open?</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 34, color: "#cbd5e1", lineHeight: 1.35 }}>
            Live A14 status in both directions, high-wind warnings and closure alerts.
          </div>
          <div style={{ display: "flex", marginTop: 36, gap: 16 }}>
            {legend.map(({ label, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "2px solid rgba(148, 163, 184, 0.35)",
                  fontSize: 26,
                  color: "#e2e8f0",
                }}
              >
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 10, borderRadius: 5, background: "#e2e8f0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 40px" }}>
            {piers.map(pier => (
              <div
                key={pier}
                style={{ display: "flex", width: 10, height: pier === 4 || pier === 5 ? 46 : 32, background: "#64748b" }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <div style={{ display: "flex", flex: 1, height: 4, borderRadius: 2, background: "#38bdf8", opacity: 0.6 }} />
            <div style={{ display: "flex", marginLeft: 24, fontSize: 22, color: "#94a3b8" }}>Independent, unofficial site</div>
          </div>
        </div>
      </div>
    ),
    socialImageSize,
  );
}
