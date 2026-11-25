import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";
import { buildDailyReminders } from "@/lib/notifications";

export const runtime = "nodejs";

/** Envoie une notification de test + aperçu de ce que le rappel de 17h30 enverrait. */
export async function POST() {
  try {
    const preview = buildDailyReminders();
    const r = await sendPushToAll({
      title: "🔔 Notifications activées",
      body: preview.length
        ? `À 17h30 tu recevras : ${preview.map((p) => p.title).join(" · ")}`
        : "Tu recevras un rappel chaque jour à 17h30 (révisions du soir + devoirs du lendemain).",
      url: "/",
      tag: "test",
    });
    if (r.subscriptions === 0) {
      return NextResponse.json({ error: "Aucun appareil abonné en base : réactive les notifications." }, { status: 400 });
    }
    if (r.sent === 0) {
      const vapid = r.errors.some((e) => /^40[13]/.test(e));
      return NextResponse.json(
        {
          error: vapid
            ? `Le service push refuse la signature (clés VAPID changées ?) : clique « Désactiver » puis « Activer ». Détail : ${r.errors[0]}`
            : r.removed
              ? "Abonnement expiré, supprimé : réactive les notifications."
              : `Échec d'envoi : ${r.errors[0] ?? "inconnu"} (le serveur doit pouvoir joindre fcm.googleapis.com / push.services.mozilla.com)`,
          ...r,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ...r, preview });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
