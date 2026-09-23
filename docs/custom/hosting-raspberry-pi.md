# Hosting on a Raspberry Pi at home

A companion to [hosting.md](hosting.md) for the case where the server is a Raspberry Pi on your
home network. The game itself is light: a Pi 4 or Pi 5 runs it comfortably for a group. The two
things that need care are the one-time build (memory hungry) and giving friends an HTTPS
address without opening your router to the internet.

## What you need

- A **Raspberry Pi 4 or 5 with at least 4 GB of RAM**, running **Raspberry Pi OS 64-bit**
  (Bookworm or newer). A Pi 3 or a 32-bit OS is not worth the fight: the Node 22 image and
  the build both assume 64-bit and more memory.
- An SSD or a good SD card. Game saves are small, but SQLite writes on every action; an SD
  card works, an SSD over USB lasts longer.
- A free [Tailscale](https://tailscale.com) account (the recommended way to publish the site).
- The Discord items from `hosting.md` steps 4 and 5 (bot token and/or webhook).

## 1. Prepare the Pi

```
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl
```

Give the build room to breathe. The client bundle is built with webpack and can use 2 to 3 GB
during the build; on a 4 GB Pi, add swap so it never runs out:

```
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
```

Install Docker (the official convenience script installs Docker Engine and the Compose plugin
on Raspberry Pi OS):

```
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in so your user can run `docker` without `sudo`. Check with
`docker compose version`.

## 2. Get the code and configure it

```
cd ~
git clone https://github.com/An4zz/terraforming-mars-custom.git
cd terraforming-mars-custom
cp .env.sample .env
nano .env
```

Set these (leave the rest commented for now):

```
PORT=8080
URL_ROOT=https://<pi-name>.<your-tailnet>.ts.net   # filled in after step 4; see below
DISCORD_BOT_TOKEN=...          # hosting.md step 4
DISCORD_WEBHOOK_URL=...        # hosting.md step 5
DISCORD_CLIENT_ID=...          # optional, for Discord login
DISCORD_CLIENT_SECRET=...
```

SQLite is the default and right for a Pi; the database lives in the `tm-db` Docker volume.

## 3. Build and start

```
docker compose up -d --build
```

The first build compiles native modules and bundles the client. On a Pi 4 expect 15 to 30
minutes; on a Pi 5 about a third of that. Later rebuilds are faster because dependencies are
cached. When it finishes:

```
docker compose logs -f
```

You should see `Custom store: JSON files`, `Workshop: 0 custom card(s).`, `Discord notifier:
…`, and `Server is ready.` Open `http://<pi-ip>:8080` from a computer on your network to
check. `restart: unless-stopped` in `docker-compose.yml` means the container comes back after a
reboot on its own.

If the build dies with `Killed` or a heap error, the Pi ran out of memory: confirm the swap
from step 1 is on (`free -h`), close other services, and run the build again.

## 4. Publish it to your friends

You want an `https://` address that works from anywhere, without forwarding ports on your
router (many home connections cannot forward ports at all). Three options, best first.

### Option A: Tailscale Funnel (recommended: free, no domain, no port forwarding)

Funnel publishes one port of your Pi on a public HTTPS address that Tailscale gives you, with
the certificate handled for you.

```
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the login link it prints. Then, in the Tailscale admin console, turn on **MagicDNS** and
**HTTPS certificates** (DNS settings), and enable **Funnel** for the Pi when the next command
asks you to (it prints a link that adds the needed policy). Then:

```
sudo tailscale funnel --bg 8080
sudo tailscale funnel status
```

The status shows the public address, of the form `https://<pi-name>.<tailnet>.ts.net`. Put
exactly that into `URL_ROOT` in `.env` (no trailing slash), use it as the Discord login
redirect (`<URL_ROOT>/auth/discord/callback`) in `hosting.md` step 4, and restart:

```
docker compose up -d
```

Funnel survives reboots (`--bg` makes it persistent). Your friends need nothing installed;
they just open the address.

### Option B: Cloudflare Tunnel (free, needs a domain you manage at Cloudflare)

If you own a domain, `cloudflared` gives you `https://mars.yourdomain.com` without port
forwarding. Install `cloudflared`, create a tunnel in the Cloudflare Zero Trust dashboard,
point a public hostname at `http://localhost:8080`, and run the connector as a service as the
dashboard instructs. Set `URL_ROOT=https://mars.yourdomain.com`.

### Option C: Port forwarding plus a reverse proxy

If your router can forward ports and you have a domain or a dynamic DNS name: forward 80 and
443 to the Pi and run Caddy in front of port 8080 (`reverse_proxy localhost:8080`). Caddy
fetches a Let's Encrypt certificate itself. This exposes your home IP to your friends and to
the internet; prefer A or B.

Whatever you choose, do not put `http://<pi-ip>:8080` in `URL_ROOT`: Discord login only
redirects to HTTPS addresses (or localhost), and links in Discord messages must work from
outside your network.

## 5. Check Discord and play

```
docker compose exec terraforming-mars npm run discord:check:built
docker compose exec terraforming-mars npm run discord:check:built -- --send <your discord user id>
```

(`discord:check:built` is the compiled form of the check that ships in the image.) Then open the public address, make
a game, and have a friend opt in from their player page.

## 6. Backups and updates

Everything the server remembers is in the `tm-db` volume: games, presets, workshop cards,
Discord opt-ins. Back it up with:

```
docker run --rm -v terraforming-mars-custom_tm-db:/db -v ~/backups:/out alpine \
  tar czf /out/tm-db-$(date +%F).tgz -C /db .
```

(The volume name is the folder name plus `_tm-db`; `docker volume ls` shows it.) A weekly
cron line for that command is enough.

To update to the latest fork code:

```
cd ~/terraforming-mars-custom
git pull
docker compose up -d --build
```

Games in progress survive an update; the server reloads them from the database.

## 7. Keeping the Pi awake and healthy

- Disable Wi-Fi power saving if the Pi is on Wi-Fi, or use Ethernet.
- `docker compose logs --since 1h` shows recent activity; `docker stats` shows memory.
- The server keeps finished games in memory for a while and sweeps them; a Pi with 4 GB has
  plenty of room for a friends' group.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build stops with `Killed` | Out of memory: enable the 2 GB swap (step 1) and retry. |
| `docker: permission denied` | Log out and in after `usermod -aG docker`, or prefix with `sudo`. |
| Site works on the Pi's IP but not on the Funnel address | `sudo tailscale funnel status` must list port 8080; Funnel must be enabled in the admin console for this machine. |
| Discord login redirect error | The redirect on the Discord OAuth2 page must be `URL_ROOT` + `/auth/discord/callback`, exactly. |
| `discord:check:built` says nothing is set inside the container | `.env` is read by Compose at start: edit it, then `docker compose up -d` again. |
| Friends see "server has restarted" | The container restarted (update or reboot); refreshing the page continues the game. |
