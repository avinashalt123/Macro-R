import { CheckCircle, Circle, LucideIcon, Search, Star } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { RunLog } from "@/context/AccountsContext";

export function LogItem({ log }: { log: RunLog }) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const isSuccess = log.status === "success";

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderLeftColor: isSuccess ? colors.success : colors.error }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: isSuccess ? colors.success : colors.error }]} />
          <Text style={[styles.name, { color: colors.text }]}>{log.accountName}</Text>
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatDateTime(log.timestamp)}
        </Text>
      </View>

      <View style={styles.stats}>
        <Chip icon={Search} label={`${log.searchesDone} searches`} color={colors.tint} colors={colors} />
        <Chip
          icon={log.dailySetDone ? CheckCircle : Circle}
          label="Daily Set"
          color={log.dailySetDone ? colors.success : colors.textMuted}
          colors={colors}
        />
        <Chip icon={Star} label={`+${log.pointsEarned} pts`} color={colors.warning} colors={colors} />
      </View>
    </View>
  );
}

function Chip({ icon: Icon, label, color, colors }: {
  icon: LucideIcon;
  label: string;
  color: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
      <Icon size={11} color={color} />
      <Text style={[styles.chipText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    " · " + d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  stats: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
