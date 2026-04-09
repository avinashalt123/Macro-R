import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, Clock, RefreshCw, Timer, Zap } from "lucide-react-native";
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

interface TimeoutRowProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  value: string;
  onChangeText: (v: string) => void;
  onCommit: () => void;
  inputStyle: object[];
  textMuted: string;
}

function TimeoutRow({
  icon, iconBg, title, description, value, onChangeText, onCommit, inputStyle, textMuted,
}: TimeoutRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.iconBg, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={styles.labelWrap}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={[styles.settingDesc, { color: textMuted }]}>{description}</Text>
      </View>
      <View style={styles.inputWithUnit}>
        <TextInput
          style={inputStyle as any}
          value={value}
          onChangeText={onChangeText}
          onBlur={onCommit}
          onSubmitEditing={onCommit}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={2}
          selectTextOnFocus
        />
        <Text style={[styles.unit, { color: textMuted }]}>s</Text>
      </View>
    </View>
  );
}

const STEPS = [
  {
    key: "dsTimeoutInitialLoad" as const,
    iconColor: "#F97316",
    iconBg: "#FFF7ED",
    label: "Initial Rewards page load",
    desc: "First load of rewards.bing.com (5–60s)",
    default: 30,
    renderIcon: (c: string) => <Clock size={18} color={c} />,
  },
  {
    key: "dsTimeoutReturnLoad" as const,
    iconColor: "#3B82F6",
    iconBg: "#EFF6FF",
    label: "Return to Rewards between cards",
    desc: "Reload after each completed card (5–60s)",
    default: 25,
    renderIcon: (c: string) => <RefreshCw size={18} color={c} />,
  },
  {
    key: "dsTimeoutCardScan" as const,
    iconColor: "#8B5CF6",
    iconBg: "#F5F3FF",
    label: "Scanning for activity cards",
    desc: "Wait for card script to find & click (5–60s)",
    default: 20,
    renderIcon: (c: string) => <Zap size={18} color={c} />,
  },
  {
    key: "dsTimeoutPostClick" as const,
    iconColor: "#10B981",
    iconBg: "#ECFDF5",
    label: "After clicking a card",
    desc: "Page settle time after each click (5–60s)",
    default: 15,
    renderIcon: (c: string) => <Timer size={18} color={c} />,
  },
];

export default function DailySetSettingsScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();

  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      STEPS.map((s) => [s.key, String((settings as any)[s.key] ?? s.default)])
    )
  );

  const handleChange = (key: string, val: string) => {
    setTexts((prev) => ({ ...prev, [key]: val }));
  };

  const handleCommit = (key: string, defaultVal: number) => {
    const parsed = parseInt(texts[key], 10);
    const clamped = isNaN(parsed) ? defaultVal : Math.max(5, Math.min(60, parsed));
    const clamped_ = String(clamped);
    setTexts((prev) => ({ ...prev, [key]: clamped_ }));
    if (clamped !== ((settings as any)[key] ?? defaultVal)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateSettings({ [key]: clamped } as any);
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
              Timeout for each step of the Daily Set flow
            </Text>
          </View>
        </View>

        {/* ── Info banner ─────────────────────────────────────── */}
        <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Each step in the Daily Set flow has its own timeout. Increase a value if that step is timing out on a slow connection.
          </Text>
        </View>

        {/* ── Settings card ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>STEP TIMEOUTS</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {STEPS.map((step, i) => (
              <View key={step.key}>
                {i > 0 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
                <View style={styles.settingRow}>
                  <View style={[styles.iconBg, { backgroundColor: step.iconBg }]}>
                    {step.renderIcon(step.iconColor)}
                  </View>
                  <View style={styles.labelWrap}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>{step.label}</Text>
                    <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>{step.desc}</Text>
                  </View>
                  <View style={styles.inputWithUnit}>
                    <TextInput
                      style={inputStyle as any}
                      value={texts[step.key]}
                      onChangeText={(v) => handleChange(step.key, v)}
                      onBlur={() => handleCommit(step.key, step.default)}
                      onSubmitEditing={() => handleCommit(step.key, step.default)}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={2}
                      selectTextOnFocus
                    />
                    <Text style={[styles.unit, { color: colors.textMuted }]}>s</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── What each step does ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>WHAT EACH STEP DOES</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {STEPS.map((step, i) => (
              <View key={step.key}>
                {i > 0 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
                <View style={styles.explainRow}>
                  <View style={[styles.iconBg, { backgroundColor: step.iconBg }]}>
                    {step.renderIcon(step.iconColor)}
                  </View>
                  <View style={styles.explainText}>
                    <Text style={[styles.explainTitle, { color: colors.text }]}>
                      {step.label}
                    </Text>
                    <Text style={[styles.explainDesc, { color: colors.textSecondary }]}>
                      {i === 0 && "Waits for the Rewards homepage to fully load the first time before looking for activity cards."}
                      {i === 1 && "After finishing an activity card, the app returns to the Rewards homepage. This controls how long it waits for that reload."}
                      {i === 2 && "The app injects a script to find and click the next unfinished card. This controls how long it waits for the script to respond."}
                      {i === 3 && "After a card is clicked, the page may navigate away. This controls how long to wait for it to settle before continuing."}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
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
  settingTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  settingDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  inputWithUnit: { flexDirection: "row", alignItems: "center", gap: 4 },
  numberInput: {
    width: 52,
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
  explainTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  explainDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
