import * as Haptics from "expo-haptics";
import { FileText, Trash2 } from "lucide-react-native";
import React from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { LogItem } from "@/components/LogItem";
import Colors from "@/constants/colors";
import { RunLog, useAccounts } from "@/context/AccountsContext";

export default function LogsScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { logs, clearLogs } = useAccounts();

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Clear All Logs?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearLogs();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: RunLog }) => <LogItem log={item} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Run Logs</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {logs.length} {logs.length === 1 ? "entry" : "entries"} (last 200 kept)
          </Text>
        </View>
        {logs.length > 0 && (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearBtn,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Trash2 size={16} color={colors.error} />
            <Text style={[styles.clearText, { color: colors.error }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={FileText}
            title="No logs yet"
            subtitle="Run some accounts and their results will appear here"
          />
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
        ListHeaderComponent={<View style={{ height: 8 }} />}
      />
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
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
