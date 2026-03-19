import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAccounts } from "@/context/AccountsContext";
import { useSettings } from "@/context/SettingsContext";

export default function AddAccountScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { addAccount } = useAccounts();
  const { settings } = useSettings();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [searchCount, setSearchCount] = useState(settings.defaultSearchCount);
  const [dailySetEnabled, setDailySetEnabled] = useState(settings.dailySetEnabled);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const emailRef = useRef<TextInput>(null);

  const validate = () => {
    const errs: { name?: string; email?: string } = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email address";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addAccount({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      searchCount,
      dailySetEnabled,
      lastRun: null,
      cookies: {},
    });
    router.back();
  };

  const handleSearchCount = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchCount((v) => Math.max(5, Math.min(50, v + delta)));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Add Account</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="x" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.infoNote}>
          <Feather name="info" size={14} color={colors.tint} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Add your Microsoft account details. Cookies are managed via the login flow.
          </Text>
        </View>

        <Field label="Display Name" error={errors.name} colors={colors}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: errors.name ? colors.error : colors.border }]}
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }}
            placeholder="e.g. My Main Account"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </Field>

        <Field label="Microsoft Email" error={errors.email} colors={colors}>
          <TextInput
            ref={emailRef}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: errors.email ? colors.error : colors.border }]}
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
            placeholder="account@outlook.com"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Daily Searches</Text>
          <View style={[styles.counterCard, { backgroundColor: colors.surfaceSecondary }]}>
            <Pressable
              onPress={() => handleSearchCount(-5)}
              style={({ pressed }) => [styles.counterBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="minus" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.counterCenter}>
              <Text style={[styles.counterVal, { color: colors.text }]}>{searchCount}</Text>
              <Text style={[styles.counterUnit, { color: colors.textSecondary }]}>searches / day</Text>
            </View>
            <Pressable
              onPress={() => handleSearchCount(5)}
              style={({ pressed }) => [styles.counterBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="plus" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.sliderHint}>
            {[5, 10, 20, 30, 40, 50].map((v) => (
              <Pressable key={v} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSearchCount(v); }}>
                <Text style={[styles.hintChip, { color: searchCount === v ? colors.tint : colors.textMuted, fontFamily: searchCount === v ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.switchCard, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={styles.switchLeft}>
            <View style={[styles.iconBg, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="check-square" size={16} color={colors.success} />
            </View>
            <View>
              <Text style={[styles.switchTitle, { color: colors.text }]}>Enable Daily Set</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Auto-complete daily challenges
              </Text>
            </View>
          </View>
          <Switch
            value={dailySetEnabled}
            onValueChange={(v) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDailySetEnabled(v);
            }}
            trackColor={{ false: colors.border, true: colors.tint }}
            thumbColor="#fff"
          />
        </View>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="user-plus" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>Add Account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, error, colors, children }: { label: string; error?: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {children}
      {error && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={12} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  input: {
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  counterCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
  },
  counterBtn: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  counterCenter: {
    flex: 1,
    alignItems: "center",
  },
  counterVal: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  counterUnit: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  sliderHint: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  hintChip: {
    fontSize: 13,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  switchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
  },
  switchLeft: {
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
  switchTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  switchDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
