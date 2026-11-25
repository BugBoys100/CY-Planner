// Génère une paire de clés VAPID et l'écrit dans .env.local (sans écraser des clés existantes).
import webpush from "web-push";
import fs from "node:fs";
import crypto from "node:crypto";

const file = ".env.local";
let env = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (/^VAPID_PUBLIC_KEY=.+/m.test(env) && !process.argv.includes("--force")) {
  console.log("ℹ Des clés VAPID existent déjà dans .env.local (utilise --force pour les régénérer).");
  process.exit(0);
}
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  env = re.test(env) ? env.replace(re, `${k}=${v}`) : `${env}${env && !env.endsWith("\n") ? "\n" : ""}${k}=${v}\n`;
};
set("VAPID_PUBLIC_KEY", publicKey);
set("VAPID_PRIVATE_KEY", privateKey);
if (!/^VAPID_SUBJECT=/m.test(env)) set("VAPID_SUBJECT", "mailto:admin@example.com");
if (!/^CRON_SECRET=.+/m.test(env)) set("CRON_SECRET", crypto.randomBytes(24).toString("hex"));
fs.writeFileSync(file, env);
console.log("✔ Clés VAPID écrites dans .env.local");
console.log("  VAPID_PUBLIC_KEY=" + publicKey);
