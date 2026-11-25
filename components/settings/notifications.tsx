"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Send, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function NotificationsCard({
  vapidConfigured, subscriptions, lastSent, internalCron,
}: { vapidConfigured: boolean; subscriptions: number; lastSent: string | null; internalCron: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState(ios && !isStandalone ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const { publicKey, configured } = await fetch("/api/push/public-key").then((r) => r.json());
      if (!configured || !publicKey) throw new Error("Clés VAPID absentes sur le serveur (npm run vapid)");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = urlBase64ToUint8Array(publicKey);
      let sub = await reg.pushManager.getSubscription();
      // Abonnement créé avec d'anciennes clés VAPID → on le recrée, sinon le serveur reçoit un 403
      if (sub?.options.applicationServerKey) {
        const current = new Uint8Array(sub.options.applicationServerKey);
        if (current.length !== key.length || current.some((b, i) => b !== key[i])) {
          await sub.unsubscribe();
          sub = null;
        }
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("Enregistrement de l'abonnement impossible");
      setState("on");
      toast("Notifications activées 🔔");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notifications désactivées");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setDiag(null);
    try {
      // Réenregistre l'abonnement de cet appareil (au cas où la base a été réinitialisée)
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setState("off");
        throw new Error("Cet appareil n'est plus abonné : réactive les notifications.");
      }
      await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      const res = await fetch("/api/push/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(`Envoyée par le serveur à ${json.sent} appareil(s)`);
      setDiag("Le serveur a bien remis la notification au service push. Si rien ne s'affiche, fais le « Test local » : c'est alors l'OS qui la bloque.");
    } catch (e) {
      setDiag((e as Error).message);
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function localTest() {
    setDiag(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🔔 Test local CY Planner", { body: "Si tu vois ceci, l'affichage des notifications fonctionne.", icon: "/icons/icon-192.png", tag: "local-test" });
      setDiag(
        "Notification affichée par le navigateur. Rien à l'écran ? Sur macOS : Réglages Système → Notifications → Google Chrome → autoriser (et désactiver le mode Concentration). Sur Windows : Paramètres → Notifications → Chrome.",
      );
    } catch (e) {
      setDiag(`Le navigateur refuse d'afficher : ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader icon={<BellRing />} title="Rappels quotidiens à 17h30" subtitle="Révisions du soir + devoirs du lendemain" />
        <CardContent className="space-y-3">
          {!vapidConfigured && (
            <p className="rounded-lg bg-tp/10 p-2.5 text-xs">
              Clés VAPID manquantes : lance <code className="rounded bg-muted px-1">npm run vapid</code> puis redémarre le serveur.
            </p>
          )}
          {state === "loading" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {state === "unsupported" && <p className="text-sm text-muted-foreground">Ce navigateur ne supporte pas les notifications push.</p>}
          {state === "ios-install" && (
            <p className="text-sm text-muted-foreground">
              Sur iPhone, installe d&apos;abord l&apos;app : bouton <b>Partager</b> → <b>Sur l&apos;écran d&apos;accueil</b>, puis ouvre-la depuis l&apos;icône (iOS 16.4+).
            </p>
          )}
          {state === "denied" && <p className="text-sm text-destructive">Notifications bloquées : autorise-les dans les réglages du navigateur.</p>}
          {(state === "off" || state === "on") && (
            <div className="flex flex-wrap gap-2">
              {state === "off" ? (
                <Button onClick={enable} disabled={busy || !vapidConfigured}>{busy ? <Loader2 className="animate-spin" /> : <Bell />} Activer sur cet appareil</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={test} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Test via le serveur</Button>
                  <Button variant="outline" onClick={localTest} disabled={busy}><BellRing /> Test local</Button>
                  <Button variant="ghost" onClick={disable} disabled={busy}><BellOff /> Désactiver</Button>
                </>
              )}
            </div>
          )}
          {diag && <p className="rounded-lg bg-muted p-2.5 text-xs">{diag}</p>}
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• {subscriptions} appareil{subscriptions > 1 ? "s" : ""} abonné{subscriptions > 1 ? "s" : ""}</li>
            <li>• Planificateur : {internalCron ? "interne (node-cron, Europe/Paris)" : "externe via /api/cron/notifications"}</li>
            {lastSent && <li>• Dernier envoi : {lastSent}</li>}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader icon={<Smartphone />} title="Application" subtitle={standalone ? "Installée ✓" : "Installe CY Planner comme une app"} />
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p><b>Android / Chrome</b> : menu ⋮ → « Installer l&apos;application ».</p>
          <p><b>iPhone / Safari</b> : Partager → « Sur l&apos;écran d&apos;accueil ».</p>
          <p><b>Desktop</b> : icône d&apos;installation dans la barre d&apos;adresse.</p>
        </CardContent>
      </Card>
    </div>
  );
}
