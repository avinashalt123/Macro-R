import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock, KeyRound, ScanLine, X } from "lucide-react-native";
import { CameraView } from "expo-camera";
import { useLicense } from "@/context/LicenseContext";
import { AdminPanel } from "@/components/AdminPanel";
import Colors from "@/constants/colors";

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const license = useLicense();
  const { isLicensed, isAdmin, isLoading, error, activateKey } = license;
  const scheme = useColorScheme() ?? "dark";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [keyInput, setKeyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (isLicensed && isAdmin && !license.isOwnerMode) {
    return <AdminPanel />;
  }

  if (isLicensed) {
    return <>{children}</>;
  }

  const handleActivate = async () => {
    if (!keyInput.trim() || submitting) return;
    setSubmitting(true);
    await activateKey(keyInput);
    setSubmitting(false);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setShowScanner(false);
    const scanned = data.trim().toUpperCase();
    setKeyInput(scanned);
    setTimeout(async () => {
      setSubmitting(true);
      await activateKey(scanned);
      setSubmitting(false);
    }, 300);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
          <Lock size={48} color="#3b82f6" />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>License Required</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your license key or scan a QR code
        </Text>

        <View style={styles.inputContainer}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: error ? "#ef4444" : colors.border }]}>
            <KeyRound size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textSecondary}
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleActivate}
            />
            {Platform.OS !== "web" && (
              <Pressable onPress={() => setShowScanner(true)} style={{ padding: 4 }}>
                <ScanLine size={22} color="#3b82f6" />
              </Pressable>
            )}
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <Pressable
            onPress={handleActivate}
            disabled={submitting || !keyInput.trim()}
            style={({ pressed }) => [
              styles.button,
              {
                opacity: submitting || !keyInput.trim() ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Activate</Text>
            )}
          </Pressable>

          {Platform.OS !== "web" && (
            <Pressable
              onPress={() => setShowScanner(true)}
              style={({ pressed }) => [
                styles.scanButton,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ScanLine size={20} color="#3b82f6" />
              <Text style={[styles.scanButtonText, { color: colors.text }]}>Scan QR Code</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal visible={showScanner} animationType="slide" presentationStyle="fullScreen">
        <View style={[styles.scannerContainer, { backgroundColor: "#000" }]}>
          <View style={[styles.scannerHeader, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.scannerTitle}>Scan License QR Code</Text>
            <Pressable onPress={() => setShowScanner(false)} style={styles.closeBtn}>
              <X size={24} color="#fff" />
            </Pressable>
          </View>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
          </View>
          <Text style={styles.scanHint}>Point your camera at the QR code</Text>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 360,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 32,
  },
  inputContainer: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    height: 50,
    marginTop: 12,
    borderWidth: 1,
  },
  scanButtonText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  scannerContainer: {
    flex: 1,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  scannerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  closeBtn: {
    padding: 8,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderRadius: 20,
  },
  scanHint: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingBottom: 40,
    paddingTop: 12,
  },
});
