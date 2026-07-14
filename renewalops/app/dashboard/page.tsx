import { getCurrentUser } from "@/lib/current-user";
import FrontendApp from "@/components/FrontendApp";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  console.log("AppUser synced:", user?.email);

  return <FrontendApp />;
}