# Héberger CY Planner sur un Raspberry Pi (domaine Freebox)

**Oui, c'est viable.** L'app est légère : un seul process Node (~150–250 Mo de RAM), SQLite, aucune base externe.

| Modèle | Verdict |
|---|---|
| Pi 5 / Pi 4 (2 Go+) | ✅ Idéal (build ~2–4 min) |
| Pi 4 1 Go / Pi 3B+ | ⚠️ Fonctionne, build lent : ajouter `NODE_OPTIONS=--max-old-space-size=512` |
| Pi Zero / Pi 2 | ❌ Trop juste |

Système conseillé : **Raspberry Pi OS Lite 64 bits** + **Node.js 22 LTS**.

## La carte SD : faut-il s'inquiéter ?

Pour cette app, très peu. Ordres de grandeur :

- Synchro Celcat toutes les 6 h : ~160 lignes réécrites, soit quelques centaines de Ko par jour.
- Tes actions (notes, cases cochées, uploads) : écritures ponctuelles.
- Sur un an : **moins de 200 Mo écrits par l'app**, alors qu'une carte correcte encaisse des dizaines de To.

Ce qui use vraiment une carte SD, ce sont **les journaux système et le swap**. Les précautions utiles :

1. **Le mieux : démarrer sur un SSD USB** (Pi 4/5) ou un SSD NVMe (Pi 5 + HAT). Plus fiable et plus rapide.
2. Sinon, une carte **« High Endurance »** (SanDisk High Endurance, Samsung PRO Endurance).
3. Journaux en RAM : dans `/etc/systemd/journald.conf`, mettre `Storage=volatile` et `RuntimeMaxUse=50M`,
   puis `sudo systemctl restart systemd-journald` (ou installer `log2ram`).
4. Swap désactivé : `sudo dphys-swapfile swapoff && sudo systemctl disable dphys-swapfile`
   (sur les versions récentes qui utilisent zram, rien à faire).
5. `noatime` sur la partition racine dans `/etc/fstab` (souvent déjà présent).
6. **Sauvegardes** (cf. fin de page), car une carte SD finit toujours par lâcher un jour.

## 1. Freebox : rendre le Pi joignable

Dans Freebox OS (http://mafreebox.freebox.fr) :

1. **IP fixe pour le Pi** : Paramètres de la Freebox → DHCP → Baux statiques → ajouter le Pi (ex. `192.168.1.50`).
2. **Redirections de ports** : Paramètres → Gestion des ports → ajouter
   `TCP 80 → 192.168.1.50:80` et `TCP 443 → 192.168.1.50:443`.
3. Vérifie que l'**accès à distance de Freebox OS** n'utilise pas le port 443 (Paramètres → Gestion des accès).
4. ⚠️ **IPv4 partagée** : si la Freebox refuse les ports 80/443 (plage de ports limitée), c'est que ton IPv4 est
   partagée. Demande une **IPv4 full-stack** (gratuit) dans l'Espace abonné Free → Ma Freebox →
   « Demander une adresse IP fixe V4 full-stack », puis redémarre la Freebox.

Vérifie depuis le Pi : `dig +short borisbiloute.freeboxos.fr` doit donner ton IP publique (`curl -4 ifconfig.me`).

## 2. Installer Node et l'app sur le Pi

```bash
sudo apt update && sudo apt full-upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs sqlite3 git
sudo timedatectl set-timezone Europe/Paris

sudo useradd --system --create-home --shell /usr/sbin/nologin cyplanner
sudo mkdir -p /opt/cy-planner && sudo chown cyplanner: /opt/cy-planner
```

Depuis ton PC, copie le projet (sans `node_modules` ni `.next`). Copie aussi `data/` et `uploads/` si tu veux
garder ta configuration et tes fichiers actuels :

```bash
rsync -av --exclude node_modules --exclude .next ./ ton-user@IP_DU_PI:/tmp/cy-planner/
```

Sur le Pi :

```bash
sudo rsync -a /tmp/cy-planner/ /opt/cy-planner/ && sudo chown -R cyplanner: /opt/cy-planner
cd /opt/cy-planner
sudo -u cyplanner npm ci
sudo -u cyplanner npm run build
```

Dans `/opt/cy-planner/.env.local` (garde les **mêmes clés VAPID** que sur ton PC, sinon il faudra réactiver les
notifications sur chaque appareil), ajoute :

```ini
APP_PASSWORD=un-mot-de-passe-solide     # obligatoire : l'app sera visible depuis Internet
```

```bash
sudo chmod 600 /opt/cy-planner/.env.local
```

## 3. Service systemd

```bash
sudo cp /opt/cy-planner/deploy/cy-planner.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now cy-planner
curl -I http://127.0.0.1:3100        # doit répondre 307/200
journalctl -u cy-planner -f          # "[scheduler] rappels quotidiens à 17h30"
```

## 4. HTTPS automatique avec Caddy

Caddy obtient et renouvelle seul le certificat Let's Encrypt, sans certbot.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo cp /opt/cy-planner/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
journalctl -u caddy -f               # "certificate obtained successfully"
```

Ouvre https://borisbiloute.freeboxos.fr : cadenas valide, puis la page de connexion.

## 5. Sécurité (le Pi est chez toi)

```bash
sudo apt install -y ufw unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades   # mises à jour de sécurité automatiques
```

- SSH par clé uniquement (`PasswordAuthentication no` dans `/etc/ssh/sshd_config`), et **ne redirige pas le port 22** sur la Freebox.
- Le port 3100 reste local : seul Caddy est exposé.

## 6. Sauvegardes automatiques

```bash
sudo mkdir -p /var/backups/cy-planner
sudo crontab -e
```

```cron
15 3 * * * sqlite3 /opt/cy-planner/data/app.db ".backup /var/backups/cy-planner/app-$(date +\%u).db" && tar czf /var/backups/cy-planner/uploads.tgz -C /opt/cy-planner uploads
```

(7 sauvegardes tournantes, une par jour de la semaine). Idéalement, copie aussi `/var/backups/cy-planner` ailleurs : clé USB,
disque de la Freebox, ou ton PC via `rsync`.

## Mise à jour de l'app

```bash
cd /opt/cy-planner && sudo -u cyplanner npm ci && sudo -u cyplanner npm run build && sudo systemctl restart cy-planner
```
