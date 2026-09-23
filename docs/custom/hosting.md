# Hosting this fork

This is the setup for a private server for your group. It covers the game server, its data,
and the Discord integration (login prefill and turn notifications) as one procedure. Do the
steps in order; the Discord check at the end tells you whether the integration works.

Hosting on a Raspberry Pi at home? Read [hosting-raspberry-pi.md](hosting-raspberry-pi.md)
alongside this page; it covers the Pi's build memory and publishing the site without port
forwarding.

## 1. Prerequisites

- A machine reachable by your friends over HTTPS (a small VPS is enough), with Docker and
  Docker Compose installed, or Node 22 if you run without Docker.
- A domain or public address for it. Write it down: it becomes `URL_ROOT`, and Discord needs
  it for the login redirect.
- A Discord server your group uses, where you can manage integrations.

## 2. Get the code

```
git clone https://github.com/An4zz/terraforming-mars-custom.git
cd terraforming-mars-custom
cp .env.sample .env
```

`.env` holds every setting. It is ignored by git. Docker Compose reads it too
(`docker-compose.yml` has `env_file: .env`).

Set at least:

```
URL_ROOT=https://mars.example.com     # no trailing slash; http://localhost:8080 for local play
PORT=8080
```

## 3. Database

The default is SQLite in `db/game.db`; presets, workshop cards and Discord opt-ins are JSON
files under `db/custom/`. With Docker Compose the `db` folder is the `tm-db` volume, so back up
that volume. For PostgreSQL, set `POSTGRES_HOST` to the connection string; the fork then also
uses a `custom_kv` table in the same database.

## 4. Discord: create the application and bot

Do this once, as the server owner.

1. Open https://discord.com/developers/applications and click **New Application**. Name it
   after your server (for example "Mars Bot").
2. **OAuth2 → General**: copy the **Client ID** and **Client Secret** into `.env`:
   ```
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   ```
   Under **Redirects** add `URL_ROOT` + `/auth/discord/callback`, for example
   `https://mars.example.com/auth/discord/callback`. This enables the site's Discord login,
   which prefills a player's Discord id on the notification form.
3. **Bot**: click **Reset Token**, copy the token into `.env`:
   ```
   DISCORD_BOT_TOKEN=...
   ```
   No privileged intents are needed. Under **Authorization Flow** leave "Public Bot" on or
   off as you like; it only affects who can invite the bot.
4. Invite the bot to your Discord server. `npm run discord:check` prints the exact invite link;
   it is `https://discord.com/oauth2/authorize?client_id=<Client ID>&scope=bot&permissions=2048`
   (2048 is "Send Messages"). Open it, pick your server, confirm.

Direct messages reach a player only if they share a server with the bot and allow direct
messages from server members (Discord: User Settings → Privacy & Safety). Tell your group.

## 5. Discord: create the channel webhook

For "it's your turn" mentions in one channel (players can choose this instead of, or as well as
the bot; the bot is not required for it):

1. In your Discord server, open the channel's settings → **Integrations** → **Webhooks** →
   **New Webhook**. Name it (for example "Terraforming Mars").
2. **Copy Webhook URL** into `.env`:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
   ```

Treat the webhook URL and the bot token as passwords: anyone with them can post as the bot.

## 6. Optional: admins

Players who log in with Discord and whose ids are listed here can open the admin pages
without the server id:

```
DISCORD_ADMIN_USER_IDS=123456789012345678;234567890123456789
```

To find a Discord user id: Discord → User Settings → Advanced → Developer Mode on, then
right-click a user → Copy User ID.

## 7. Check the Discord setup

```
npm ci
npm run discord:check
npm run discord:check -- --send <your discord user id>
```

The first command validates the token and webhook against Discord and prints the invite link.
(From a built tree or inside the Docker image, use `npm run discord:check:built` instead.)
The second also sends a test direct message and a test channel mention to you. Every line is
`OK`, `WARN` or `FAIL` with what to do. Run it again after any change to `.env`.

## 8. Run the server

With Docker Compose (recommended):

```
docker compose up -d --build
docker compose logs -f
```

Without Docker:

```
npm ci
npm run build
npm start
```

At startup the log says `Discord notifier: N opt-ins, DM on/off, channel on/off`. If both are
off it prints a reminder pointing back here.

Put a TLS reverse proxy (Caddy, nginx, or your host's load balancer) in front of port 8080 so
`URL_ROOT` is `https://…`; Discord login only redirects to HTTPS or localhost.

## 9. Tell your group how to opt in

Each player, on their player page: **Custom features** → Discord turn notifications → enter
their Discord user id (prefilled after a Discord login) → choose direct message or channel
mention → **Turn on** → **Send test**.

## 10. Updates

```
scripts/sync-upstream.sh     # merge upstream terraforming-mars main into your branch
docker compose up -d --build # rebuild and restart
```

The weekly GitHub Actions workflow opens the same merge as a pull request.

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| `FAIL DISCORD_BOT_TOKEN was rejected (401)` | Wrong or reset token. Bot page → Reset Token, paste the new one, restart. |
| `WARN The bot is not in any server yet` | Open the invite link from the check and add it to your server. |
| Test DM fails with 403 | The player does not share a server with the bot, or blocks DMs from server members. |
| `FAIL DISCORD_WEBHOOK_URL was rejected (404)` | The webhook was deleted. Create a new one and copy its URL. |
| Login button does nothing / redirect error | The redirect on the OAuth2 page must equal `URL_ROOT` + `/auth/discord/callback` exactly. |
| Player never gets messages | On their player page, check the panel says **On** and use **Send test**. Messages are skipped while a player is actively clicking (within 30 s of their own input). |
