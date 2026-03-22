import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, CheckCircle, CheckSquare, Clock, Loader, Play, RefreshCw, Search, Shield, Star, XCircle } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Account, AccountStatus } from "@/context/AccountsContext";
import Colors from "@/constants/colors";

interface Props {
  account: Account;
  onPress: () => void;
  onRun: () => void;
  onDailySet: () => void;
  onRefreshSession: () => void;
  isRunningGlobal: boolean;
  showDailySet?: boolean;
}

function StatusBadge({ status, searchesCompleted, searchCount }: { status: AccountStatus; searchesCompleted: number; searchCount: number }) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "running") {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  const configs = {
    idle: { Icon: Clock, color: "#94A3B8", bg: "rgba(148, 163, 184, 0.15)", label: "Idle" },
    running: { Icon: RefreshCw, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.15)", label: `${searchesCompleted}/${searchCount}` },
    done: { Icon: CheckCircle, color: "#22C55E", bg: "rgba(34, 197, 94, 0.2)", label: "Done" },
    failed: { Icon: XCircle, color: "#EF4444", bg: "rgba(239, 68, 68, 0.15)", label: "Failed" },
  };

  const cfg = configs[status];

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Animated.View style={{ opacity: status === "running" ? pulseAnim : 1 }}>
        <cfg.Icon size={12} color={cfg.color} />
      </Animated.View>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function isSessionExpired(account: Account): boolean {
  const hasCookies = Object.keys(account.cookies ?? {}).length > 0;
  if (!hasCookies) return true;
  if (!account.lastRun) return false;
  const hoursSinceRun = (Date.now() - new Date(account.lastRun).getTime()) / (1000 * 60 * 60);
  return hoursSinceRun > 24;
}

export function AccountCard({ account, onPress, onRun, onDailySet, onRefreshSession, isRunningGlobal, showDailySet = true }: Props) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  const handleRun = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRun();
  };

  const handleDailySet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDailySet();
  };

  const handleSessionRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRefreshSession();
  };

  const progressPercent = account.searchCount > 0
    ? (account.searchesCompleted / account.searchCount) * 100
    : 0;

  const initial = account.name.charAt(0).toUpperCase();
  const sessionExpired = isSessionExpired(account);
  const noCookies = Object.keys(account.cookies ?? {}).length === 0;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
      >
        <View style={styles.badgePosition}>
          <StatusBadge
            status={account.status}
            searchesCompleted={account.searchesCompleted}
            searchCount={account.searchCount}
          />
        </View>

        <View style={styles.topRow}>
          <LinearGradient colors={["#3B82F6", "#1D4ED8"]} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>

          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {account.name}
            </Text>
            <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
              {account.email}
            </Text>
          </View>
        </View>

        {account.status === "running" && (
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` as any, backgroundColor: colors.running }]} />
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Search size={12} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{account.searchCount} searches</Text>
          </View>
          {account.todayPoints > 0 && (
            <View style={styles.statItem}>
              <Star size={12} color={colors.warning} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>{account.todayPoints.toLocaleString()} pts today</Text>
            </View>
          )}
        </View>

        {account.lastRun && (
          <Text style={[styles.timeAgo, { color: colors.textMuted }]}>{formatRelativeTime(account.lastRun)}</Text>
        )}

        {account.status !== "running" && (
          <Pressable
            onPress={handleSessionRefresh}
            style={({ pressed }) => [
              styles.sessionBanner,
              {
                backgroundColor: noCookies
                  ? "transparent"
                  : sessionExpired
                  ? "transparent"
                  : "transparent",
                borderColor: noCookies ? "#FCA5A5" : sessionExpired ? "#FCD34D" : "#86EFAC",
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {noCookies ? (
              <AlertCircle size={13} color={colors.error} />
            ) : sessionExpired ? (
              <Clock size={13} color={colors.warning} />
            ) : (
              <Shield size={13} color={colors.success} />
            )}
            <Text
              style={[
                styles.sessionText,
                { color: noCookies ? colors.error : sessionExpired ? "#B45309" : colors.success, flex: 1 },
              ]}
              numberOfLines={1}
            >
              {noCookies
                ? "No session — tap to sign in"
                : sessionExpired
                ? "Session may be expired — tap to refresh"
                : "Session active"}
            </Text>
            {(noCookies || sessionExpired) && (
              <RefreshCw size={12} color={noCookies ? colors.error : "#B45309"} />
            )}
          </Pressable>
        )}

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleRun}
            disabled={account.status === "running" || isRunningGlobal}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor:
                  account.status === "running" ? colors.border : pressed ? colors.tintDark : colors.tint,
                opacity: account.status === "running" || isRunningGlobal ? 0.5 : 1,
              },
            ]}
          >
            {account.status === "running" ? (
              <Loader size={16} color="#fff" />
            ) : (
              <Play size={16} color="#fff" />
            )}
          </Pressable>

          {showDailySet && (
            <Pressable
              onPress={handleDailySet}
              disabled={account.status === "running" || isRunningGlobal}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor:
                    account.status === "running" || isRunningGlobal
                      ? colors.border
                      : pressed
                      ? "#5B21B6"
                      : "#7C3AED",
                  opacity: account.status === "running" || isRunningGlobal ? 0.4 : 1,
                },
              ]}
            >
              <CheckSquare size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    position: "relative",
  },
  badgePosition: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
    paddingRight: 70,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  email: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  timeAgo: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  sessionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
