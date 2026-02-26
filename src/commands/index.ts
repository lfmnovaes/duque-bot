import type { SlashCommand } from "../types/index.js";
import { commandCommand } from "./command.js";
import { commandsCommand } from "./commands.js";
import { rolesCommand } from "./roles.js";
import { triggerCommand } from "./trigger.js";

const commands = new Map<string, SlashCommand>();

commands.set(commandCommand.data.name, commandCommand);
commands.set(commandsCommand.data.name, commandsCommand);
commands.set(rolesCommand.data.name, rolesCommand);
commands.set(triggerCommand.data.name, triggerCommand);

export { commands };
