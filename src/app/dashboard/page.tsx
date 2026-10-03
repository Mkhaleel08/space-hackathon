import Dashboard from "@/components/dashboard/dashboard";
import { getDashboard } from "@/lib/server/dashboard";

export const metadata = { title: "Operator dashboard | Machine Memory" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboard();
  return <Dashboard initial={data} />;
}
