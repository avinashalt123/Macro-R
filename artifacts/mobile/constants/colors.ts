const primary = "#2563EB";
const primaryDark = "#1D4ED8";
const accent = "#3B82F6";
const success = "#22C55E";
const warning = "#F59E0B";
const error = "#EF4444";
const running = "#8B5CF6";

export default {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    background: "#F9FAFB",
    surface: "#FFFFFF",
    surfaceSecondary: "#F3F4F6",
    border: "#E5E7EB",
    borderLight: "#F3F4F6",
    tint: primary,
    tintDark: primaryDark,
    accent,
    success,
    warning,
    error,
    running,
    tabIconDefault: "#9CA3AF",
    tabIconSelected: primary,
    cardShadow: "rgba(0, 0, 0, 0.06)",
    overlay: "rgba(0, 0, 0, 0.4)",
    statusIdle: "#9CA3AF",
    statusRunning: running,
    statusDone: success,
    statusFailed: error,
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#94A3B8",
    textMuted: "#566880",
    background: "#0D1B2A",
    surface: "#132336",
    surfaceSecondary: "#1A2D45",
    border: "#1F3452",
    borderLight: "#132336",
    tint: accent,
    tintDark: primary,
    accent,
    success,
    warning,
    error,
    running,
    tabIconDefault: "#566880",
    tabIconSelected: accent,
    cardShadow: "rgba(0, 0, 0, 0.45)",
    overlay: "rgba(0, 0, 0, 0.65)",
    statusIdle: "#566880",
    statusRunning: running,
    statusDone: success,
    statusFailed: error,
  },
};
