# CY Planner — vie étudiante CY Tech

PWA Next.js 15 (App Router) + SQLite (Drizzle ORM) : emploi du temps Celcat, espaces de cours (fichiers, notes, liens),
partiels avec générateur de révisions, devoirs liés au prochain TD/CM, rappels Web Push à 17h30.

## Démarrage rapide

Prérequis : **Node.js 20+** (testé avec Node 24).

```bash
npm install
cp .env.example .env
npm run vapid          # génère les clés VAPID + CRON_SECRET dans .env.local
npm run db:migrate     # crée ./data/app.db (aussi fait automatiquement au démarrage)
npm run build
npm start              # http://localhost:3000
```

En développement : `npm run dev`.

Sans URL Celcat, l'app tourne en **mode démo** (emploi du temps fictif réaliste généré au format brut Celcat,
qui passe par le vrai parseur). Renseigne ton instance dans **Paramètres** (ou `.env`) pour basculer en réel :
les données de démo sont alors purgées automatiquement.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run vapid` | Génère les clés VAPID (+ `CRON_SECRET`) dans `.env.local` (`-- --force` pour régénérer) |
| `npm run db:generate` | Génère une migration après modification de `lib/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:studio` | Explorateur Drizzle Studio |
| `npm run sync` | Synchronise Celcat en ligne de commande |
| `npm run test:logic` | Tests du parseur Celcat et du générateur de révisions |
| `npm run icons` | Régénère les icônes PWA |

## Celcat

`lib/celcat.ts` réimplémente en TypeScript l'API interne de Celcat Calendar :

- `POST {base}/Home/GetCalendarData` (`start`, `end`, `resType`, `calView`, `federationIds[]`, `colourScheme`) — par tranches de 4 semaines ;
- `GET {base}/Home/ReadResourceListItems` — recherche de groupe (utilisée dans Paramètres) ;
- `POST {base}/Home/GetSideBarEvent` — détail d'un événement.

Le parseur extrait de la description HTML la **matière normalisée** (codes `INFO2104 -`, mentions CM/TD/TP, groupes retirés,
majuscules corrigées), le **type strict `CM | TD | TP | AUTRE`** (catégorie brute conservée : Projet, Examen…),
la salle, l'enseignant et les groupes. Chaque matière détectée crée automatiquement son espace (`/courses/[slug]`)
avec les dossiers `CM`, `TD`, `TP`, `Annales`, `Fiches`.

Synchronisation : bouton « Synchroniser », automatique au premier lancement, puis toutes les 6 h (planificateur interne).
Fenêtre : 6 semaines passées → ~5 mois à venir ; les séances annulées sont supprimées.

**CY Tech / CYU** : l'instance `https://celcat-calendar.cyu.fr` exige une connexion. Le plus simple : dans Paramètres,
colle l'URL de ta page Celcat (`…/cal?vt=month&…&et=student&fid0=XXXX`) : l'URL de base, le type (étudiant = 104)
et l'identifiant sont déduits. Renseigne ensuite ton **identifiant + mot de passe Celcat** : le serveur se connecte
via `/LdapLogin/Logon` (jeton anti-CSRF géré) et se reconnecte seul quand la session expire. Le mode « cookie »
(valeur de `.Calendar.Cookies`, nom ajouté automatiquement) reste disponible pour dépanner mais expire vite.

Variables : `CELCAT_BASE_URL`, `CELCAT_RESOURCE_ID`, `CELCAT_RESOURCE_TYPE` (103 = groupe, 104 = étudiant),
`CELCAT_USERNAME` / `CELCAT_PASSWORD`, `CELCAT_COOKIE`. Les valeurs saisies dans Paramètres priment sur le `.env`.

## Notifications (17h30)

1. `npm run vapid`, redémarrer le serveur.
2. Paramètres → « Activer sur cet appareil ». Sur iPhone, installer d'abord l'app sur l'écran d'accueil (iOS 16.4+).
   Le push exige **HTTPS** en production (localhost est toléré en dev).
3. Chaque jour à 17h30 (Europe/Paris) : récap des révisions du jour non cochées + devoirs/événements du lendemain
   (+ partiel du lendemain).

Le planificateur `node-cron` démarre avec le serveur (`instrumentation.ts`). Si l'hébergement n'a pas de process
permanent (serverless), mets `ENABLE_INTERNAL_CRON=false` et appelle l'endpoint depuis un cron externe :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ton-domaine/api/cron/notifications
```

(crontab : `30 17 * * *`, fuseau Europe/Paris). Idempotent : un seul envoi par jour. `?force` pour tester.
Même principe pour `/api/cron/sync`.

## Architecture

```
app/                    pages (server components) + actions.ts (server actions) + api/ (route handlers)
  api/files             upload multipart → ./uploads/{courseId}/{uuid}.ext ; GET /api/files/[id] sécurisé
  api/calendar          agrégation cours/révisions/partiels/événements pour le calendrier
  api/push, api/cron    abonnements Web Push, tâches planifiées protégées par CRON_SECRET
components/             UI (ui/ = primitives type shadcn), calendrier, explorateur, modales
lib/
  celcat.ts             client + parseur Celcat      celcat-mock.ts  emploi du temps de démo
  sync.ts               synchronisation → SQLite     revision.ts     générateur de sessions (pur, client+serveur)
  smart-link.ts         dernier cours / prochain cours du même type
  notifications.ts      rappels 17h30                push.ts         web-push      scheduler.ts  node-cron
  db/schema.ts          schéma Drizzle               drizzle/        migrations SQL
public/sw.js            service worker (cache offline + push)      public/manifest.json
```

**Révisions** : jours candidats = d'aujourd'hui à la veille du partiel ; nombre = `round(jours × %)` (min. 1) ;
répartition uniforme ancrée sur la veille. Faible 25 %, Moyen 50 %, Beaucoup 75 %, Personnalisé 1–100 %.
La liste est régénérée instantanément et éditable (date, heure, titre, objectifs, ajout/suppression) avant validation.

**Événement intelligent** : en choisissant une matière, l'app cherche le cours en cours ou le dernier passé, puis le
prochain cours **du même type** (TD → TD, CM → CM, TP → TP) et propose d'y caler l'échéance en un clic.

## Sécurité

- `APP_PASSWORD` (optionnel) protège toute l'app par mot de passe (cookie httpOnly) — recommandé si exposée sur Internet.
- Fichiers : noms stockés aléatoires, chemin vérifié sous `UPLOADS_DIR`, `nosniff`, HTML/SVG jamais rendus inline
  (servis en téléchargement avec CSP `sandbox`).
- Liens rapides limités à `http(s)`.

## Déploiement

Raspberry Pi + domaine Freebox (Caddy, HTTPS automatique) : **[RASPBERRY.md](RASPBERRY.md)**.
VPS : voir **[DEPLOY.md](DEPLOY.md)** : VPS avec un site existant sur 80/443 → sous-domaine, Nginx/Apache en reverse proxy,
certificat Let's Encrypt via certbot, service systemd (`deploy/`).
