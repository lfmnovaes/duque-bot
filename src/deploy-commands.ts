import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { env } from "./config/env.js";

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

const commandData = Array.from(commands.values()).map((cmd) =>
  cmd.data.toJSON(),
);

async function deployCommands(): Promise<void> {
  try {
    console.log(
      `🔄 Registering ${commandData.length} application command(s)...`,
    );

    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
      body: commandData,
    });

    console.log("✅ Successfully registered application commands:");
    commandData.forEach((cmd) => {
      console.log(`   /${cmd.name}`);
    });
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
    process.exit(1);
  }
}

deployCommands();
