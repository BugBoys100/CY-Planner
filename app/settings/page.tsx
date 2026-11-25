import { PageHeader } from "@/components/page-header";
import { CelcatSettingsForm } from "@/components/settings/celcat-form";
import { ExamImportCard } from "@/components/settings/exam-import";
import { countImportedExams, getDismissedExams, getExamImportSettings } from "@/lib/exam-import";
import { NotificationsCard } from "@/components/settings/notifications";
import { getCelcatSettings, getLastSync } from "@/lib/settings";
import { pushConfigured } from "@/lib/push";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres" };

export default function SettingsPage() {
  const cfg = getCelcatSettings();
  const subs = db.select({ n: sql<number>`count(*)` }).from(pushSubscriptions).get()?.n ?? 0;
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Celcat, notifications, application" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
        <CelcatSettingsForm
          initial={{ baseUrl: cfg.baseUrl, resourceId: cfg.resourceId, resourceType: cfg.resourceType, resourceLabel: cfg.resourceLabel, hasCookie: !!cfg.cookie, username: cfg.username, hasPassword: !!cfg.password }}
          lastSync={getLastSync()}
        />
        <ExamImportCard initial={getExamImportSettings()} imported={countImportedExams()} dismissed={getDismissedExams().size} />
        </div>
        <NotificationsCard
          vapidConfigured={pushConfigured()}
          subscriptions={subs}
          lastSent={getSetting<string | null>("reminders.lastSent", null)}
          internalCron={process.env.ENABLE_INTERNAL_CRON !== "false"}
        />
      </div>
    </>
  );
}
