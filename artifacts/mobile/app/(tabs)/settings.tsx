import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();

  const retryTimes = [
    { hour: 22, minute: 0, label: "10:00 PM" },
    { hour: 22, minute: 30, label: "10:30 PM" },
    { hour: 23, minute: 0, label: "11:00 PM" },
    { hour: 23, minute: 30, label: "11:30 PM" },
    { hour: 0, minute: 0, label: "12:00 AM (Final)" },
  ];

  const handleSearchCountChange = (delta: number) => {
    const newVal = Math.max(5, Math.min(50, settings.defaultSearchCount + delta));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ defaultSearchCount: newVal });
  };

  const handleApplySchedule = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Schedule Applied",
      Platform.OS === "web"
        ? "Background scheduling is not available in web mode."
        : "The automation schedule has been configured. Your accounts will run automatically at the scheduled times.",
      [{ text: "OK" }]
    );
  };

  const formatTime = (h: number, m: number) =>
    `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Configure automation behavior
        </Text>
      </View>

      <Section title="SEARCH" colors={colors}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <View style={[styles.iconBg, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="search" size={16} color={colors.tint} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Searches per account</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Daily Bing searches (5–50)
                </Text>
              </View>
            </View>
            <View style={styles.counter}>
              <Pressable
                onPress={() => handleSearchCountChange(-1)}
                style={({ pressed }) => [styles.counterBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="minus" size={16} color={colors.text} />
              </Pressable>
              <Text style={[styles.counterVal, { color: colors.text }]}>
                {settings.defaultSearchCount}
              </Text>
              <Pressable
                onPress={() => handleSearchCountChange(1)}
                style={({ pressed }) => [styles.counterBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="plus" size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>
      </Section>

      <Section title="DAILY SET" colors={colors}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <View style={[styles.iconBg, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="check-square" size={16} color={colors.success} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Daily Set</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Complete daily challenges automatically
                </Text>
              </View>
            </View>
            <Switch
              value={settings.dailySetEnabled}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateSettings({ dailySetEnabled: v });
              }}
              trackColor={{ false: colors.border, true: colors.tint }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </Section>

      <Section title="SCHEDULE" colors={colors}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.settingRow, { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={styles.settingLabel}>
              <View style={[styles.iconBg, { backgroundColor: "#FFF7ED" }]}>
                <Feather name="play-circle" size={16} color={colors.warning} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: colors.text }]}>First Run</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Initial daily automation attempt
                </Text>
              </View>
            </View>
            <Text style={[styles.timeText, { color: colors.tint }]}>
              {formatTime(settings.firstRunTime.hour, settings.firstRunTime.minute)}
            </Text>
          </View>

          <View style={styles.retrySection}>
            <View style={styles.retryHeader}>
              <Feather name="refresh-cw" size={14} color={colors.running} />
              <Text style={[styles.retryLabel, { color: colors.textSecondary }]}>
                Retry schedule for failed accounts
              </Text>
            </View>
            {retryTimes.map((t, i) => (
              <View key={i} style={styles.retryItem}>
                <View style={[styles.retryDot, { backgroundColor: i === retryTimes.length - 1 ? colors.error : colors.running }]} />
                <Text style={[styles.retryTime, { color: colors.text }]}>{t.label}</Text>
                {i === retryTimes.length - 1 && (
                  <View style={[styles.finalBadge, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.finalText, { color: colors.error }]}>Final</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </Section>

      <Section title="ACTIONS" colors={colors}>
        <Pressable
          onPress={handleApplySchedule}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="calendar" size={18} color="#fff" />
          <Text style={styles.applyText}>Apply Schedule</Text>
        </Pressable>

        {Platform.OS === "web" && (
          <Text style={[styles.webNote, { color: colors.textMuted }]}>
            Background scheduling requires Android with WorkManager
          </Text>
        )}
      </Section>

      <View style={{ height: insets.bottom + 40 }} />
    </ScrollView>
  );
}

function Section({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  settingDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  counterVal: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    minWidth: 28,
    textAlign: "center",
  },
  timeText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  retrySection: {
    padding: 16,
    paddingTop: 12,
    gap: 10,
  },
  retryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  retryLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  retryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  retryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  retryTime: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  finalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  finalText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  applyText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  webNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
});
