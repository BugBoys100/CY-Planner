# Déployer CY Planner sur un VPS (à côté d'un site existant en HTTPS)

Principe : ton site actuel garde les ports 80/443. CY Planner tourne en local sur `127.0.0.1:3100`
(invisible depuis Internet) et ton serveur web existant (Nginx ou Apache) le publie sur un **sous-domaine**
avec son propre certificat Let's Encrypt. Pas de conflit de ports, pas de second serveur web.

```
Internet ──443──▶ Nginx (déjà en place) ─┬─ monsite.fr          → ton site actuel
                                          └─ planner.monsite.fr  → http://127.0.0.1:3100 (CY Planner)
```

## 1. DNS

Chez ton registrar, ajoute un enregistrement **A** `planner` → IP du VPS (et **AAAA** si IPv6).
Vérifie : `dig +short planner.monsite.fr` doit renvoyer l'IP du VPS.

## 2. Installer l'app

Node.js 20+ requis (`node -v`). Sinon : https://github.com/nodesource/distributions

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin cyplanner
sudo mkdir -p /opt/cy-planner && sudo chown cyplanner: /opt/cy-planner
```

Copie le projet (sans `node_modules`, `.next`, `data`, `uploads`) depuis ton PC :

```bash
rsync -av --exclude node_modules --exclude .next --exclude data/app.db* --exclude 'uploads/*' ./ user@vps:/tmp/cy-planner/
```

Puis sur le VPS :

```bash
sudo rsync -a /tmp/cy-planner/ /opt/cy-planner/ && sudo chown -R cyplanner: /opt/cy-planner
cd /opt/cy-planner
sudo -u cyplanner npm ci
sudo -u cyplanner cp .env.example .env
sudo -u cyplanner npm run vapid
sudo -u cyplanner npm run build
```

Édite `/opt/cy-planner/.env.local` (créé par `npm run vapid`) et ajoute au minimum :

```ini
APP_PASSWORD=un-mot-de-passe-solide        # l'app est sur Internet : protège-la
VAPID_SUBJECT=mailto:toi@exemple.fr
CELCAT_BASE_URL=https://celcat-calendar.cyu.fr
CELCAT_RESOURCE_TYPE=104
CELCAT_RESOURCE_ID=<valeur de fid0 dans l'URL de ta page Celcat>
CELCAT_USERNAME=ton-identifiant
CELCAT_PASSWORD=ton-mot-de-passe
```

```bash
sudo chmod 600 /opt/cy-planner/.env.local
```

> ⚠️ Garde **les mêmes clés VAPID** une fois les appareils abonnés : si tu les régénères, il faut
> désactiver/réactiver les notifications sur chaque appareil.

## 3. Service systemd (démarrage auto + redémarrage)

```bash
sudo cp /opt/cy-planner/deploy/cy-planner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cy-planner
sudo systemctl status cy-planner
curl -I http://127.0.0.1:3100
```

Logs : `journalctl -u cy-planner -f` (tu dois voir `[scheduler] rappels quotidiens à 17h30`).

## 4. Reverse proxy + HTTPS

Regarde quel serveur web sert ton site actuel : `sudo ss -ltnp | grep ':443'`.

### Nginx (le plus courant)

```bash
sudo cp /opt/cy-planner/deploy/nginx-cy-planner.conf /etc/nginx/sites-available/cy-planner
sudo sed -i 's/planner.example.fr/planner.monsite.fr/' /etc/nginx/sites-available/cy-planner
sudo ln -s /etc/nginx/sites-available/cy-planner /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d planner.monsite.fr
```

Certbot obtient le certificat, ajoute le bloc `listen 443 ssl` et la redirection HTTP → HTTPS.
Le renouvellement automatique est déjà actif pour ton site existant (`sudo certbot renew --dry-run` pour vérifier).

### Apache

```bash
sudo a2enmod proxy proxy_http headers
sudo cp /opt/cy-planner/deploy/apache-cy-planner.conf /etc/apache2/sites-available/cy-planner.conf
sudo sed -i 's/planner.example.fr/planner.monsite.fr/' /etc/apache2/sites-available/cy-planner.conf
sudo a2ensite cy-planner && sudo apachectl configtest && sudo systemctl reload apache2
sudo certbot --apache -d planner.monsite.fr
```

### Pas de sous-domaine possible ?

Un sous-chemin (`monsite.fr/planner`) n'est pas recommandé (service worker, manifest et routes sont à la racine).
Prends un sous-domaine, c'est gratuit et Let's Encrypt le gère pareil.

## 5. Vérifications

1. Ouvre `https://planner.monsite.fr` → page de connexion (`APP_PASSWORD`).
2. Paramètres → « Enregistrer & synchroniser » : la synchro doit afficher « Celcat · N séances ».
3. Sur ton téléphone : installe l'app (Android : menu → Installer ; iPhone : Partager → Sur l'écran d'accueil),
   ouvre-la **depuis l'icône**, puis Paramètres → Activer les notifications → « Test via le serveur ».
4. Pare-feu : seuls 80/443 doivent être ouverts (`sudo ufw status`), le port 3100 reste local.

## Mises à jour

```bash
cd /opt/cy-planner
sudo -u cyplanner git pull            # ou rsync comme à l'étape 2
sudo -u cyplanner npm ci && sudo -u cyplanner npm run build
sudo systemctl restart cy-planner     # les migrations SQL s'appliquent au démarrage
```

## Sauvegardes

Tout l'état est dans `data/app.db` (SQLite) et `uploads/`. Exemple de cron quotidien :

```bash
sqlite3 /opt/cy-planner/data/app.db ".backup /var/backups/cy-planner-$(date +\%F).db"
tar czf /var/backups/cy-planner-uploads-$(date +\%F).tgz -C /opt/cy-planner uploads
```
