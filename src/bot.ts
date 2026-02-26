import { Client, GatewayIntentBits, Partials } from "discord.js";
import { env } from "./config/env.js";

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
];

if (env.ENABLE_MESSAGE_CONTENT_INTENT) {
  intents.push(GatewayIntentBits.MessageContent);
}

export const client = new Client({
  intents,
  partials: [
    Partials.Channel, // Required to receive DMs
  ],
});
