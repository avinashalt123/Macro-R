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
    card: "#FFFFFF",
    cardShadow: "rgba(0, 0, 0, 0.06)",
    overlay: "rgba(0, 0, 0, 0.4)",
    statusIdle: "#9CA3AF",
    statusRunning: running,
    statusDone: success,
    statusFailed: error,
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#D1D5DB",
    textMuted: "#6B7280",
    background: "#0F172A",
    surface: "#1E293B",
    surfaceSecondary: "#334155",
    border: "#334155",
    borderLight: "#1E293B",
    tint: accent,
    tintDark: primary,
    accent,
    success,
    warning,
    error,
    running,
    tabIconDefault: "#6B7280",
    tabIconSelected: accent,
    card: "#1E293B",
    cardShadow: "rgba(0, 0, 0, 0.3)",
    overlay: "rgba(0, 0, 0, 0.6)",
    statusIdle: "#6B7280",
    statusRunning: running,
    statusDone: success,
    statusFailed: error,
  },
};
