import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle, LucideIcon, RefreshCw, XCircle } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { Account } from "@/context/AccountsContext";

interface Props {
  accounts: Account[];
}

export function StatsBar({ accounts }: Props) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const doneCount = accounts.filter((a) => a.status === "done").length;
  const runningCount = accounts.filter((a) => a.status === "running").length;
  const failedCount = accounts.filter((a) => a.status === "failed").length;

  return (
    <LinearGradient
      colors={scheme === "dark" ? ["#1E3A5F", "#1E293B"] : ["#EFF6FF", "#DBEAFE"]}
      style={styles.container}
    >
      <StatItem icon={CheckCircle} iconColor={colors.success} label="Done" value={`${doneCount}/${accounts.length}`} colors={colors} />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <StatItem icon={RefreshCw} iconColor={colors.running} label="Running" value={String(runningCount)} colors={colors} />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <StatItem icon={XCircle} iconColor={colors.error} label="Failed" value={String(failedCount)} colors={colors} />
    </LinearGradient>
  );
}

function StatItem({ icon: Icon, iconColor, label, value, colors }: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.statItem}>
      <Icon size={12} color={iconColor} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
});
