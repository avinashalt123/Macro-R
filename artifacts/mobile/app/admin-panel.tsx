import { Redirect } from "expo-router";

import { AdminPanel } from "@/components/AdminPanel";
import { useLicense } from "@/context/LicenseContext";

export default function AdminPanelScreen() {
  const { isOwnerMode } = useLicense();
  if (!isOwnerMode) return <Redirect href="/" />;
  return <AdminPanel />;
}
