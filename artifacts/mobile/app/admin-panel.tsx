import { Redirect } from "expo-router";

import { AdminPanel } from "@/components/AdminPanel";
import { OWNER_MODE } from "@/context/LicenseContext";

export default function AdminPanelScreen() {
  if (!OWNER_MODE) return <Redirect href="/" />;
  return <AdminPanel />;
}
