import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardLayout from "./layout";
import DashboardPage from "./page";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}
