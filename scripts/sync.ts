// Synchronisation Celcat en ligne de commande : npm run sync
process.env.TZ = process.env.APP_TIMEZONE || "Europe/Paris";
const { syncCelcat } = await import("../lib/sync");
const r = await syncCelcat();
console.log(r.ok ? `✔ ${r.mode} : ${r.upserted} séances, ${r.removed} supprimées, ${r.coursesCreated} nouvelles matières` : `✖ ${r.error}`);
process.exit(r.ok ? 0 : 1);
export {};
