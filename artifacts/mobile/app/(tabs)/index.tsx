import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Play, Plus, Square, Users } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountCard } from "@/components/AccountCard";
import { EmptyState } from "@/components/EmptyState";
import { StatsBar } from "@/components/StatsBar";
import Colors from "@/constants/colors";
import { Account, useAccounts } from "@/context/AccountsContext";

export default function HomeScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { accounts, isRunning, startRun, stopRun } = useAccounts();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  }, []);

  const handleRunAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isRunning) {
      Alert.alert("Search Running", "Searches are in progress.", [
        { text: "Keep Running", style: "cancel" },
        { text: "Stop All", style: "destructive", onPress: stopRun },
      ]);
      return;
    }
    if (accounts.length === 0) {
      Alert.alert("No Accounts", "Add an account first to run automation.");
      return;
    }
    startRun();
    router.push({
      pathname: "/search-runner",
      params: { accountIds: JSON.stringify(accounts.map((a) => a.id)) },
    });
  };

  const handleRunAccount = (id: string) => {
    if (isRunning) {
      Alert.alert("Search Running", "Stop the current run before starting another.");
      return;
    }
    startRun();
    router.push({
      pathname: "/search-runner",
      params: { accountIds: JSON.stringify([id]) },
    });
  };

  const renderItem = useCallback(
    ({ item }: { item: Account }) => (
      <AccountCard
        account={item}
        onPress={() => router.push({ pathname: "/account/[id]", params: { id: item.id } })}
        onRun={() => handleRunAccount(item.id)}
        onRefreshSession={() => router.push({ pathname: "/login-webview", params: { accountId: item.id } })}
        isRunningGlobal={isRunning}
      />
    ),
    [isRunning]
  );

  const ListHeader = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>MS Rewards</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/add-account");
            }}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Plus size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {accounts.length > 0 && <StatsBar accounts={accounts} />}
    </View>
  );

  const ListFooter = <View style={{ height: 120 }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          <EmptyState
            icon={Users}
            title="No accounts yet"
            subtitle="Tap the + button above to add your first account"
          />
        }
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
      />

      <View style={[styles.fab, { bottom: insets.bottom + (Platform.OS === "ios" ? 90 : 72) }]}>
        <Pressable
          onPress={handleRunAll}
          style={({ pressed }) => [
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
        >
          <LinearGradient
            colors={isRunning ? ["#EF4444", "#DC2626"] : ["#3B82F6", "#1D4ED8"]}
            style={styles.fabBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isRunning ? <Square size={22} color="#fff" /> : <Play size={22} color="#fff" />}
            <Text style={styles.fabText}>{isRunning ? "Running..." : "Run All"}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: { position: "absolute", right: 20 },
  fabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
