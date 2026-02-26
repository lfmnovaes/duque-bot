import type { Interaction } from "discord.js";
import { commands } from "../commands/index.js";

export async function handleInteractionCreate(
  interaction: Interaction,
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.warn(`[interaction] Unknown command: ${interaction.commandName}`);
    await interaction.reply({
      content: "❌ Unknown command.",
      flags: ["Ephemeral"],
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `[interaction] Error executing /${interaction.commandName}:`,
      error,
    );

    const reply = {
      content: "❌ An error occurred while executing this command.",
      flags: ["Ephemeral" as const],
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
