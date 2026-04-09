import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, Clock, Zap } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";

export default function DailySetSettingsScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();

  const [dsLoadTimeoutText, setDsLoadTimeoutText] = useState(
    String(settings.dailySetLoadTimeout ?? 30)
  );
  const [dsCardTimeoutText, setDsCardTimeoutText] = useState(
    String(settings.dailySetCardTimeout ?? 20)
  );

  const commitDsLoadTimeout = () => {
    const parsed = parseInt(dsLoadTimeoutText, 10);
    const clamped = isNaN(parsed) ? 30 : Math.max(5, Math.min(60, parsed));
    setDsLoadTimeoutText(String(clamped));
    if (clamped !== (settings.dailySetLoadTimeout ?? 30)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateSettings({ dailySetLoadTimeout: clamped });
    }
  };

  const commitDsCardTimeout = () => {
    const parsed = parseInt(dsCardTimeoutText, 10);
    const clamped = isNaN(parsed) ? 20 : Math.max(5, Math.min(60, parsed));
    setDsCardTimeoutText(String(clamped));
    if (clamped !== (settings.dailySetCardTimeout ?? 20)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateSettings({ dailySetCardTimeout: clamped });
    }
  };

  const inputStyle = [
    styles.numberInput,
    {
      color: colors.text,
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.border,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Daily Set Timing</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Timeout values for Daily Set automation
            </Text>
          </View>
        </View>

        {/* ── Info banner ─────────────────────────────────────── */}
        <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            These control how long the app waits during each step of the Daily Set flow. Increase them if your internet connection is slow or the Rewards page loads slowly.
          </Text>
        </View>

        {/* ── Settings card ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TIMING</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>

            {/* Page load timeout */}
            <View style={styles.settingRow}>
              <View style={[styles.iconBg, { backgroundColor: "#FFF7ED" }]}>
                <Clock size={18} color="#F97316" />
              </View>
              <View style={styles.labelWrap}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Page load timeout
                </Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Wait for Rewards page to load (5–60s)
                </Text>
              </View>
              <View style={styles.inputWithUnit}>
                <TextInput
                  style={inputStyle}
                  value={dsLoadTimeoutText}
                  onChangeText={setDsLoadTimeoutText}
                  onBlur={commitDsLoadTimeout}
                  onSubmitEditing={commitDsLoadTimeout}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={2}
                  selectTextOnFocus
                />
                <Text style={[styles.unit, { color: colors.textMuted }]}>s</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Card scan timeout */}
            <View style={styles.settingRow}>
              <View style={[styles.iconBg, { backgroundColor: "#FFF7ED" }]}>
                <Zap size={18} color="#F97316" />
              </View>
              <View style={styles.labelWrap}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Card scan timeout
                </Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Wait for activity cards to respond (5–60s)
                </Text>
              </View>
              <View style={styles.inputWithUnit}>
                <TextInput
                  style={inputStyle}
                  value={dsCardTimeoutText}
                  onChangeText={setDsCardTimeoutText}
                  onBlur={commitDsCardTimeout}
                  onSubmitEditing={commitDsCardTimeout}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={2}
                  selectTextOnFocus
                />
                <Text style={[styles.unit, { color: colors.textMuted }]}>s</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Explanation cards ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>WHAT EACH DOES</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.explainRow}>
              <View style={[styles.iconBg, { backgroundColor: "#FFF7ED" }]}>
                <Clock size={18} color="#F97316" />
              </View>
              <View style={styles.explainText}>
                <Text style={[styles.explainTitle, { color: colors.text }]}>Page load timeout</Text>
                <Text style={[styles.explainDesc, { color: colors.textSecondary }]}>
                  Used when loading the Rewards homepage and when returning to it between activities. If the page takes longer than this to load, the app continues anyway.
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.explainRow}>
              <View style={[styles.iconBg, { backgroundColor: "#FFF7ED" }]}>
                <Zap size={18} color="#F97316" />
              </View>
              <View style={styles.explainText}>
                <Text style={[styles.explainTitle, { color: colors.text }]}>Card scan timeout</Text>
                <Text style={[styles.explainDesc, { color: colors.textSecondary }]}>
                  Used when waiting for the activity card script to respond, and when waiting for the page to settle after clicking a card. Increase this if activities appear to be skipped.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: { flex: 1 },
  settingTitle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  settingDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  inputWithUnit: { flexDirection: "row", alignItems: "center", gap: 4 },
  numberInput: {
    width: 56,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  unit: { fontSize: 14, fontFamily: "Inter_500Medium" },
  divider: { height: 1, marginHorizontal: 16 },
  explainRow: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    alignItems: "flex-start",
  },
  explainText: { flex: 1 },
  explainTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  explainDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
