# Feature 6: Discord turn notifications

## Feature description

Games between friends stall because nobody notices it is their turn. Today the site only
notifies inside an open browser tab (title animation, sound, browser notification in
`WaitingFor.vue`). This feature sends a Discord message when a player has a required decision
to make: the start of their action turn, the research phase, drafting, and any deferred
question aimed at them. It is opt-in per player: a player enters their Discord user id (or it
is prefilled from the existing Discord login) and chooses a direct message or a mention in the
group's channel. The message contains the game, the generation, what is being waited on, and a
link straight to their player page.

## Requirements and user stories

- **D-1** As a player, from my player page I can opt in to Discord notifications for this game
  by giving my Discord user id and choosing DM or channel mention; I can opt out again.
- **D-2** As a player who logged in with Discord, my user id is prefilled.
- **D-3** As a player, I get one message when it becomes my turn, not one per click while I am
  already playing my turn.
- **D-4** As a player, I also get a message during the research phase and drafts, since those
  wait on me too.
- **D-5** As a player, the message links to my player page and names the game and generation.
- **D-6** As a player, if my action queue (feature 3) stops, I get a message saying why.
- **D-7** As an admin, I configure a bot token (for DMs) and/or a channel webhook (for
  mentions) with environment variables; if neither is set, the opt-in UI says notifications are
  unavailable on this server.
- **D-8** Sending never blocks or breaks the game: Discord errors are logged and the game goes
  on. Sends are rate-limited to at most one per player per 30 seconds.
- **D-9** Opt-ins survive server restarts (stored in the custom store) and a game reload does
  not re-send old notifications for a decision the player already saw.

Acceptance criteria:
- With a fake Discord client, starting a 2-player game and finishing player 1's turn sends
  exactly one message to player 2, and none to player 1 while they take two actions in a row.
- A follow-up question inside a player's own turn (e.g. choose a tile space) sends nothing.
- Research phase start sends one message to every opted-in player.
- Reloading the game from the database with player 2 still waiting sends nothing new.

## Proposed design

**Data.** `DiscordOptIn = {enabled, discordUserId, delivery: 'dm' | 'channel'}` stored in the
custom store namespace `discord` keyed by `PlayerId` (opt-in is per game because player ids are
per game; the form remembers the last-used id in `localStorage` so re-opting is one click).

**Server.** `src/server/custom/discord/`:
- `DiscordClient.ts`: `sendDirectMessage(userId, text)` (bot token: `POST /users/@me/channels`
  then `POST /channels/{id}/messages`) and `sendChannelMessage(text, mentionUserId)` (webhook
  with `allowed_mentions`). Uses global `fetch`; configured by `DISCORD_BOT_TOKEN` and
  `DISCORD_WEBHOOK_URL` in `.env`. An interface `IDiscordClient` allows a fake in tests.
- `TurnNotifier.ts`: singleton with an in-memory map of opt-ins (loaded from the store at
  startup, updated by the API). Method `onWaitingFor(player, input)` implements the dedupe:
  skip if `input.optional`, skip if `game.phase === END`, skip if the player submitted an input
  in the last 30 s (`lastInputAt`, recorded by `Player.process`), skip if the same
  `(gameId, playerId, game.inputsThisRound, phase, generation)` key was already notified.
  Otherwise format and send asynchronously; errors are logged.
- `ApiDiscordOptIn.ts`: `GET api/custom/discord?id=<playerId>` returns
  `DiscordNotificationStatus` (availability flags, current opt-in, session Discord id);
  `POST` saves or clears. The route verifies the player id belongs to a loaded game.

Hooks: `Player.setWaitingFor` calls `TurnNotifier.onWaitingFor(this, input)` at its end;
`Player.process` calls `TurnNotifier.onInput(this)`. Both are one line. Reload safety (D-9):
`Game.deserialize` re-enters `takeAction` for the active player; the dedupe key above includes
`inputsThisRound`, which is restored from the save, so the reload produces the same key and is
skipped. Server restart loses the in-memory key set, so a restart can re-send once; documented.

**Message format.**
`**Terraforming Mars** — it's your turn in game <name> (gen 5): Take your first action → <URL_ROOT>/player?id=…`.
`URL_ROOT` is already an env var used by the Discord login.

**Client.** `src/client/components/custom/DiscordOptInPanel.vue` inside the shared
`CustomPlayerPanel.vue` on the player page (collapsed by default, below the Actions block):
availability message, user id input with a link to Discord's "how to find your id" help, DM /
channel radio, Enable/Disable buttons, status text. Prefills from the session id in the status
response, then from `localStorage`.

**Upstream hooks.** `Player.ts` (2 lines), `paths.ts`, `requestProcessor.ts` via
`customHandlers`, `PlayerHome.vue` (panel), `server.ts` (load opt-ins), `.env.sample`
(documented variables).

## Deviations found while building

- The reload/undo dedupe uses a prompt fingerprint (phase, generation, input type and title)
  rather than `inputsThisRound`, because a reload re-increments that counter. A re-issued
  prompt with the same fingerprint is silent; a new prompt is not.
- The route reads the request body before resolving the player, so malformed bodies are
  rejected first.
- A "Send test" button was added so a player can confirm delivery right after opting in.

## Execution tasks

Build:
1. `IDiscordClient`/`DiscordClient` with both delivery modes; env parsing; `.env.sample` docs.
2. `TurnNotifier` with dedupe, rate limit, message formatting, store-backed opt-ins.
3. `ApiDiscordOptIn` route; register path.
4. Hooks in `Player.setWaitingFor` / `Player.process`; startup load in `server.ts`.
5. `DiscordOptInPanel.vue` + `CustomPlayerPanel.vue`; embed in `PlayerHome.vue`.
6. Queue-stopped notification (shared with feature 3).

Test:
- Unit (server): `tests/custom/discord/TurnNotifier.spec.ts` with a fake client and
  `FakeClock`: turn start notifies once; own-turn follow-up input does not; research phase
  notifies all opted-in; rate limit; optional inputs ignored; disabled opt-in ignored; reload
  (`Game.deserialize(game.serialize())`) sends nothing new.
- Unit (server): `DiscordClient.spec.ts` with a stubbed `fetch`: correct endpoints, headers,
  payloads, `allowed_mentions`, error handling returns without throwing.
- Route: `ApiDiscordOptIn.spec.ts` — get/post/clear, invalid user id rejected, unknown player
  404, availability flags reflect env.
- Unit (client): `DiscordOptInPanel.spec.ts` — unavailable state, prefill, enable posts body,
  disable posts clear.
- Integration: `tests/custom/integration/discordTurnFlow.spec.ts` — 3-player game through
  initial research, prelude phase and two action rounds with the fake client; assert the exact
  sequence of recipients.
- Manual: set `DISCORD_WEBHOOK_URL` to a test channel; play a 2-browser game; confirm one
  mention per turn change and none mid-turn.
