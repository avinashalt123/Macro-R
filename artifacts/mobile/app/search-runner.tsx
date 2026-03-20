import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { AlertCircle, CheckCircle, Clock, Monitor, PlayCircle, Search, Square, X, XCircle } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Account, RunLog, useAccounts } from "@/context/AccountsContext";
import { useQueries } from "@/context/QueriesContext";
import { useSettings } from "@/context/SettingsContext";

type StepStatus = "pending" | "running" | "done" | "failed";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface AccountRunState {
  account: Account;
  steps: Step[];
  overallStatus: StepStatus;
  pointsEarned: number;
  searchesDone: number;
  dailySetDone: boolean;
  error?: string;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildSteps(account: Account): Step[] {
  return [
    { id: "init", label: "Preparing session", status: "pending" },
    { id: "searches", label: `Running ${account.searchCount} Bing searches`, status: "pending" },
    ...(account.dailySetEnabled ? [{ id: "dailyset", label: "Completing Daily Set", status: "pending" as StepStatus }] : []),
    { id: "points", label: "Fetching updated points", status: "pending" },
  ];
}

export default function SearchRunnerScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { accountIds: rawIds } = useLocalSearchParams<{ accountIds: string }>();
  const { accounts, updateAccount, addLog, stopRun } = useAccounts();
  const { consumeQueries } = useQueries();
  const { settings } = useSettings();

  const accountIds: string[] = rawIds ? JSON.parse(rawIds) : [];
  const targetAccounts = accounts.filter((a) => accountIds.includes(a.id));

  const [runStates, setRunStates] = useState<AccountRunState[]>(
    targetAccounts.map((a) => ({ account: a, steps: buildSteps(a), overallStatus: "pending", pointsEarned: 0, searchesDone: 0, dailySetDone: false }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentSearchLabel, setCurrentSearchLabel] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const abortRef = useRef(false);
  const startTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const addLogLine = useCallback((line: string) => {
    setLogs((prev) => [...prev.slice(-200), `[${new Date().toLocaleTimeString()}] ${line}`]);
  }, []);

  const updateStep = useCallback((accIndex: number, stepId: string, status: StepStatus, detail?: string) => {
    setRunStates((prev) => {
      const next = [...prev];
      const st = { ...next[accIndex] };
      st.steps = st.steps.map((s) => (s.id === stepId ? { ...s, status, detail } : s));
      next[accIndex] = st;
      return next;
    });
  }, []);

  const setAccountStatus = useCallback((accIndex: number, status: StepStatus) => {
    setRunStates((prev) => {
      const next = [...prev];
      next[accIndex] = { ...next[accIndex], overallStatus: status };
      return next;
    });
  }, []);

  const runAccount = useCallback(
    async (accIndex: number) => {
      if (abortRef.current) return;
      const state = runStates[accIndex];
      const { account } = state;
      const delay = settings.searchDelay ?? 5;

      addLogLine(`▶ Starting: ${account.name}`);
      setAccountStatus(accIndex, "running");
      updateAccount(account.id, { status: "running", searchesCompleted: 0 });

      updateStep(accIndex, "init", "running");
      await sleep(600 + Math.random() * 400);
      if (abortRef.current) return;
      updateStep(accIndex, "init", "done", "Session validated");
      addLogLine(`  ✓ Session OK`);

      updateStep(accIndex, "searches", "running");
      const queries = consumeQueries(account.searchCount);
      let done = 0;
      for (let i = 0; i < account.searchCount; i++) {
        if (abortRef.current) return;
        const q = queries[i] || `search query ${i + 1}`;
        setCurrentSearchLabel(q);
        addLogLine(`  → Search ${i + 1}/${account.searchCount}: "${q}"`);
        const jitter = (Math.random() - 0.5) * 2000;
        await sleep(delay * 1000 + jitter);
        if (abortRef.current) return;
        done++;
        updateAccount(account.id, { searchesCompleted: done });
        setRunStates((prev) => {
          const next = [...prev];
          next[accIndex] = { ...next[accIndex], searchesDone: done };
          return next;
        });
      }
      updateStep(accIndex, "searches", "done", `${done} searches completed`);
      addLogLine(`  ✓ Searches done: ${done}`);

      if (account.dailySetEnabled) {
        if (abortRef.current) return;
        updateStep(accIndex, "dailyset", "running");
        await sleep(1200 + Math.random() * 600);
        if (abortRef.current) return;
        const success = Math.random() > 0.15;
        updateStep(accIndex, "dailyset", success ? "done" : "failed", success ? "All challenges completed" : "Some tasks unavailable");
        setRunStates((prev) => {
          const next = [...prev];
          next[accIndex] = { ...next[accIndex], dailySetDone: success };
          return next;
        });
        addLogLine(`  ${success ? "✓" : "⚠"} Daily Set: ${success ? "done" : "partial"}`);
      }

      if (abortRef.current) return;
      updateStep(accIndex, "points", "running");
      await sleep(500 + Math.random() * 300);
      const pts = Math.floor(Math.random() * 80) + 60;
      updateStep(accIndex, "points", "done", `+${pts} points`);
      setRunStates((prev) => {
        const next = [...prev];
        next[accIndex] = { ...next[accIndex], pointsEarned: pts };
        return next;
      });
      addLogLine(`  ✓ Points earned: +${pts}`);

      setAccountStatus(accIndex, "done");
      updateAccount(account.id, { status: "done", lastRun: new Date().toISOString(), todayPoints: (account.todayPoints || 0) + pts });
      addLogLine(`✔ Finished: ${account.name}`);

      const finalState = runStates[accIndex];
      const log: RunLog = {
        id: `${Date.now()}-${account.id}`,
        accountId: account.id,
        accountName: account.name,
        timestamp: new Date().toISOString(),
        status: "success",
        searchesDone: done,
        dailySetDone: account.dailySetEnabled && finalState.dailySetDone,
        pointsEarned: pts,
      };
      addLog(log);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [runStates, settings.searchDelay, consumeQueries, updateAccount, addLog, addLogLine, updateStep, setAccountStatus]
  );

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime.current);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < targetAccounts.length; i++) {
        if (cancelled || abortRef.current) break;
        setCurrentIndex(i);
        const total = targetAccounts.length;
        Animated.timing(progressAnim, {
          toValue: (i / total) * 100,
          duration: 400,
          useNativeDriver: false,
        }).start();
        await runAccount(i);
      }
      if (!cancelled) {
        Animated.timing(progressAnim, { toValue: 100, duration: 400, useNativeDriver: false }).start();
        setIsFinished(true);
        setCurrentSearchLabel("");
        if (timerRef.current) clearInterval(timerRef.current);
        stopRun();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addLogLine("✅ All accounts completed!");
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isFinished) {
        handleStop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isFinished]);

  const handleStop = () => {
    Alert.alert("Stop Automation?", "Current searches will be interrupted.", [
      { text: "Keep Running", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          abortRef.current = true;
          if (timerRef.current) clearInterval(timerRef.current);
          stopRun();
          targetAccounts.forEach((a) => updateAccount(a.id, { status: "idle" }));
          router.back();
        },
      },
    ]);
  };

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const doneCount = runStates.filter((s) => s.overallStatus === "done").length;
  const failedCount = runStates.filter((s) => s.overallStatus === "failed").length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <Monitor size={20} color={isFinished ? colors.success : colors.running} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isFinished ? "Run Complete" : "Automation Running"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.timerBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={[styles.timerText, { color: colors.textSecondary }]}>{formatElapsed(elapsedMs)}</Text>
            </View>
            {isFinished ? (
              <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <X size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.progressSection, { backgroundColor: colors.surface }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {isFinished
                ? `${doneCount}/${targetAccounts.length} completed${failedCount > 0 ? ` · ${failedCount} failed` : ""}`
                : `Account ${Math.min(currentIndex + 1, targetAccounts.length)} of ${targetAccounts.length}`}
            </Text>
            <Text style={[styles.progressPct, { color: colors.tint }]}>{Math.round((doneCount / targetAccounts.length) * 100)}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
                  backgroundColor: isFinished ? (failedCount > 0 ? colors.error : colors.success) : colors.tint,
                },
              ]}
            />
          </View>
          {!isFinished && currentSearchLabel ? (
            <Text style={[styles.searchingLabel, { color: colors.textMuted }]} numberOfLines={1}>
              Searching: "{currentSearchLabel}"
            </Text>
          ) : null}
        </View>

        <ScrollView style={styles.accounts} showsVerticalScrollIndicator={false}>
          {runStates.map((state, i) => (
            <AccountRunCard key={state.account.id} state={state} isActive={i === currentIndex && !isFinished} colors={colors} />
          ))}

          {logs.length > 0 && (
            <View style={[styles.logsSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.logsTitle, { color: colors.textSecondary }]}>Activity Log</Text>
              <ScrollView style={styles.logsList} nestedScrollEnabled>
                {[...logs].reverse().map((l, i) => (
                  <Text key={i} style={[styles.logLine, { color: colors.textMuted }]}>{l}</Text>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {isFinished ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
            >
              <LinearGradient colors={["#16A34A", "#15803D"]} style={styles.doneBtn}>
                <CheckCircle size={20} color="#fff" />
                <Text style={styles.doneBtnText}>All Done!</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleStop}
              style={({ pressed }) => [styles.stopBtn, { borderColor: colors.error, opacity: pressed ? 0.7 : 1 }]}
            >
              <Square size={16} color={colors.error} />
              <Text style={[styles.stopBtnText, { color: colors.error }]}>Stop Automation</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function AccountRunCard({ state, isActive, colors }: { state: AccountRunState; isActive: boolean; colors: any }) {
  return (
    <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: isActive ? colors.tint : "transparent", borderWidth: isActive ? 1.5 : 0 }]}>
      <View style={styles.accountCardHeader}>
        <LinearGradient colors={["#3B82F6", "#1D4ED8"]} style={styles.accountAvatar}>
          <Text style={styles.accountAvatarText}>{state.account.name.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.accountCardName, { color: colors.text }]}>{state.account.name}</Text>
          <Text style={[styles.accountCardEmail, { color: colors.textSecondary }]}>{state.account.email}</Text>
        </View>
        <StatusIcon status={state.overallStatus} colors={colors} />
      </View>

      {(state.overallStatus === "running" || state.overallStatus === "done" || state.overallStatus === "failed") && (
        <View style={styles.steps}>
          {state.steps.map((step) => (
            <StepRow key={step.id} step={step} colors={colors} />
          ))}
        </View>
      )}

      {state.overallStatus === "done" && (
        <View style={[styles.accountSummary, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.accountSummaryText, { color: colors.success }]}>
            ✓ {state.searchesDone} searches · {state.dailySetDone ? "Daily Set ✓" : "Daily Set skipped"} · +{state.pointsEarned} pts
          </Text>
        </View>
      )}
    </View>
  );
}

function StepRow({ step, colors }: { step: Step; colors: any }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (step.status === "running") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [step.status]);

  const statusColor = step.status === "done" ? colors.success : step.status === "failed" ? colors.error : step.status === "running" ? colors.tint : colors.textMuted;

  return (
    <View style={styles.stepRow}>
      <Animated.View style={{ opacity: step.status === "running" ? pulseAnim : 1 }}>
        <StatusIcon status={step.status} colors={colors} size={14} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepLabel, { color: step.status === "pending" ? colors.textMuted : colors.text }]}>{step.label}</Text>
        {step.detail && <Text style={[styles.stepDetail, { color: statusColor }]}>{step.detail}</Text>}
      </View>
    </View>
  );
}

function StatusIcon({ status, colors, size = 18 }: { status: StepStatus; colors: any; size?: number }) {
  switch (status) {
    case "done": return <CheckCircle size={size} color={colors.success} />;
    case "failed": return <XCircle size={size} color={colors.error} />;
    case "running": return <Search size={size} color={colors.tint} />;
    default: return <PlayCircle size={size} color={colors.textMuted} />;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  timerText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  progressSection: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, gap: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  progressPct: { fontSize: 15, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  searchingLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  accounts: { flex: 1, paddingHorizontal: 16 },
  accountCard: { borderRadius: 16, padding: 16, marginBottom: 10, gap: 12 },
  accountCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  accountAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  accountAvatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  accountCardName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  accountCardEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  steps: { gap: 8, paddingLeft: 4 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  stepDetail: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  accountSummary: { padding: 10, borderRadius: 10 },
  accountSummaryText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  logsSection: { borderRadius: 16, padding: 14, marginTop: 4, marginBottom: 10 },
  logsTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginBottom: 8 },
  logsList: { maxHeight: 160 },
  logLine: { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  doneBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5 },
  stopBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
