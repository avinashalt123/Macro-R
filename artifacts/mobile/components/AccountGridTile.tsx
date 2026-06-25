import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  CheckCircle,
  CheckSquare,
  Clock,
  Loader,
  Play,
  PowerOff,
  RefreshCw,
  Search,
  Shield,
  Star,
  XCircle,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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
  width: number;
  onPress: () => void;
  onRun: () => void;
  onDailySet: () => void;
  onRefreshSession: () => void;
  onToggleEnabled: () => void;
  isRunningGlobal: boolean;
  showDailySet?: boolean;
}

function isSessionExpired(account: Account): boolean {
  const hasCookies = Object.keys(account.cookies ?? {}).length > 0;
  if (!hasCookies) return true;
  if (!account.lastRun) return false;
  const hoursSinceRun =
    (Date.now() - new Date(account.lastRun).getTime()) / (1000 * 60 * 60);
  return hoursSinceRun > 24;
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

export function AccountGridTile({
  account,
  width,
  onPress,
  onRun,
  onDailySet,
  onRefreshSession,
  onToggleEnabled,
  isRunningGlobal,
  showDailySet = true,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isEnabled = account.enabled ?? true;

  const initial = account.name.charAt(0).toUpperCase();
  const [avatarError, setAvatarError] = useState(false);
  const noCookies = Object.keys(account.cookies ?? {}).length === 0;
  const sessionExpired = isSessionExpired(account);
  const progressPercent =
    account.searchCount > 0
      ? (account.searchesCompleted / account.searchCount) * 100
      : 0;

  useEffect(() => {
    if (account.status === "running") {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [account.status]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  const statusColor =
    account.status === "idle"
      ? "#94A3B8"
      : account.status === "running"
      ? "#7C3AED"
      : account.status === "done"
      ? "#22C55E"
      : "#EF4444";

  const statusLabel =
    account.status === "running"
      ? `${account.searchesCompleted}/${account.searchCount}`
      : account.status === "idle"
      ? "Idle"
      : account.status === "done"
      ? "Done"
      : "Failed";

  const StatusIcon =
    account.status === "idle"
      ? Clock
      : account.status === "running"
      ? RefreshCw
      : account.status === "done"
      ? CheckCircle
      : XCircle;

  const statusBg =
    account.status === "idle"
      ? "rgba(148, 163, 184, 0.15)"
      : account.status === "running"
      ? "rgba(139, 92, 246, 0.15)"
      : account.status === "done"
      ? "rgba(34, 197, 94, 0.2)"
      : "rgba(239, 68, 68, 0.15)";

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }], width }, !isEnabled && { opacity: 0.45 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.tile,
          { backgroundColor: colors.surface, shadowColor: colors.cardShadow },
        ]}
      >
        <View style={styles.statusPosition}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Animated.View style={{ opacity: account.status === "running" ? pulseAnim : 1 }}>
              <StatusIcon size={10} color={statusColor} />
            </Animated.View>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.topSection}>
          <View style={styles.avatarContainer}>
            {account.totalPoints > 0 && (
              <View style={styles.pointsBadge}>
                <Star size={10} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.pointsBadgeText}>
                  {account.totalPoints.toLocaleString()}
                </Text>
              </View>
            )}
            {account.avatarUrl && !avatarError ? (
              <Image
                source={{ uri: account.avatarUrl }}
                style={styles.avatar}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <LinearGradient
                colors={["#3B82F6", "#1D4ED8"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
            )}
          </View>

          <View style={styles.info}>
            <Text
              style={[styles.name, { color: colors.text }]}
              numberOfLines={1}
            >
              {account.name}
            </Text>
            <Text
              style={[styles.email, { color: colors.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {account.email}
            </Text>
          </View>
        </View>

        {account.status === "running" && (
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%` as any,
                  backgroundColor: "#7C3AED",
                },
              ]}
            />
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Search size={10} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {account.searchCount} searches
            </Text>
          </View>
          {account.totalPoints > 0 && (
            <>
              <View style={styles.statDot} />
              <View style={styles.statItem}>
                <Star size={10} color="#F59E0B" fill="#F59E0B" />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {account.totalPoints.toLocaleString()}
                </Text>
              </View>
            </>
          )}
        </View>

        {account.lastRun && (
          <Text style={[styles.timeAgo, { color: colors.textMuted }]}>
            {formatRelativeTime(account.lastRun)}
          </Text>
        )}

        {account.status !== "running" && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRefreshSession();
            }}
            style={({ pressed }) => [
              styles.sessionBanner,
              {
                borderColor: noCookies
                  ? "#FCA5A5"
                  : sessionExpired
                  ? "#FCD34D"
                  : "#86EFAC",
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {noCookies ? (
              <AlertCircle size={11} color={colors.error} />
            ) : sessionExpired ? (
              <Clock size={11} color={colors.warning} />
            ) : (
              <Shield size={11} color={colors.success} />
            )}
            <Text
              style={[
                styles.sessionText,
                {
                  color: noCookies
                    ? colors.error
                    : sessionExpired
                    ? "#B45309"
                    : colors.success,
                },
              ]}
              numberOfLines={1}
            >
              {noCookies
                ? "No session"
                : sessionExpired
                ? "Session expired"
                : "Session active"}
            </Text>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleEnabled();
            }}
            disabled={account.status === "running"}
            style={({ pressed }) => [
              styles.toggleBtn,
              {
                backgroundColor: isEnabled
                  ? scheme === "dark" ? "#1e3a1e" : "#dcfce7"
                  : "#dc2626",
                borderColor: isEnabled ? "#4ade80" : "#991b1b",
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <PowerOff size={11} color={isEnabled ? "#4ade80" : "#fff"} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRun();
            }}
            disabled={account.status === "running" || isRunningGlobal || !isEnabled}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor:
                  account.status === "running"
                    ? colors.border
                    : pressed
                    ? colors.tintDark
                    : colors.tint,
                opacity:
                  account.status === "running" || isRunningGlobal || !isEnabled ? 0.4 : 1,
              },
            ]}
          >
            {account.status === "running" ? (
              <Loader size={14} color="#fff" />
            ) : (
              <Play size={14} color="#fff" />
            )}
          </Pressable>

          {showDailySet && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDailySet();
              }}
              disabled={account.status === "running" || isRunningGlobal || !isEnabled}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor:
                    account.status === "running" || isRunningGlobal || !isEnabled
                      ? colors.border
                      : pressed
                      ? "#5B21B6"
                      : "#7C3AED",
                  opacity:
                    account.status === "running" || isRunningGlobal || !isEnabled ? 0.4 : 1,
                },
              ]}
            >
              <CheckSquare size={14} color="#fff" />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    padding: 12,
    marginVertical: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
  },
  statusPosition: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingRight: 55,
  },
  avatarContainer: {
    position: "relative",
    flexShrink: 0,
  },
  pointsBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 3,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pointsBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 21,
    fontFamily: "Inter_700Bold",
  },
  info: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  email: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#64748B",
  },
  statText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  timeAgo: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 2,
  },
  sessionText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
