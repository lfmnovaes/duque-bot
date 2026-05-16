import { Client, GatewayIntentBits, Partials } from "discord.js";

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
];

export const client = new Client({
  intents,
  partials: [
    Partials.Channel, // Required to receive DMs
  ],
});
