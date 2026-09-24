import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { config } from './config.js';

const rest = new REST({ version: '10' }).setToken(config.discordToken);
const body = commands.map((command) => command.data.toJSON());

if (config.discordGuildId) {
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body });
  console.log(`Registered ${body.length} guild commands.`);
} else {
  await rest.put(Routes.applicationCommands(config.discordClientId), { body });
  console.log(`Registered ${body.length} global commands.`);
}
