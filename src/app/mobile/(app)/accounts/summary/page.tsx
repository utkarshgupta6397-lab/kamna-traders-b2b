import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasMobileFeatureAccess } from "@/lib/mobile-auth";
import MobileAccountsSummaryClient from "./MobileAccountsSummaryClient";

export const metadata = {
  title: "Accounts Summary | Kamna B2B ERP",
};

export default async function MobileAccountsSummaryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const canViewSummary = hasMobileFeatureAccess(session, "mobile_accounts", "mobile_accounts_summary_view");

  if (!canViewSummary) {
    redirect("/mobile/accounts");
  }

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <MobileAccountsSummaryClient userName={session.name?.split(" ")[0] || "User"} />
    </div>
  );
}
