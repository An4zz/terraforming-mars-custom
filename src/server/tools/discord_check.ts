// Checks the Discord notification setup from the environment and prints what to fix.
//
//   npm run discord:check                                 -- from a checkout (uses tsx)
//   npm run discord:check:built                           -- from a built tree or the Docker image
//   ... -- --send <discord user id>                       -- also send test messages to that user
import '@/server/init';
import {checkDiscordSetup} from '../custom/discord/discordSetupCheck';

async function main() {
  const args = process.argv.slice(2);
  const sendIndex = args.indexOf('--send');
  const sendTo = sendIndex === -1 ? undefined : args[sendIndex + 1];
  if (sendIndex !== -1 && (sendTo === undefined || !/^\d{5,25}$/.test(sendTo))) {
    console.error('Usage: npm run discord:check -- --send <discord user id>');
    process.exit(2);
  }
  const result = await checkDiscordSetup({
    botToken: process.env.DISCORD_BOT_TOKEN?.trim() || undefined,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL?.trim() || undefined,
  }, fetch, sendTo);
  for (const line of result.lines) {
    console.log(line);
  }
  console.log(result.ok ? '\nDiscord notifications are ready.' : '\nFix the failures above, then run this check again.');
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
