import cron from "node-cron";

const g = globalThis as unknown as { __schedulerStarted?: boolean };

/** Planificateur interne (process Node long : `next start` / `next dev`). */
export function startScheduler() {
  if (g.__schedulerStarted) return;
  g.__schedulerStarted = true;
  const timezone = process.env.APP_TIMEZONE || "Europe/Paris";

  cron.schedule(
    "30 17 * * *",
    async () => {
      try {
        const { runDailyReminders } = await import("./notifications");
        const r = await runDailyReminders();
        console.log("[cron 17:30] rappels :", r.skipped ? r.reason : `${r.notifications} notification(s)`);
      } catch (e) {
        console.error("[cron 17:30] échec :", e);
      }
    },
    { timezone, name: "daily-reminders", noOverlap: true },
  );

  cron.schedule(
    "15 */6 * * *",
    async () => {
      try {
        const { syncCelcat } = await import("./sync");
        const r = await syncCelcat();
        console.log(`[cron sync] Celcat ${r.mode} : ${r.ok ? `${r.upserted} événements` : r.error}`);
      } catch (e) {
        console.error("[cron sync] échec :", e);
      }
    },
    { timezone, name: "celcat-sync", noOverlap: true },
  );

  console.log(`[scheduler] rappels quotidiens à 17h30 (${timezone}) + sync Celcat toutes les 6h`);
}
