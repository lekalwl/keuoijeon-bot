import { Client, Events, GatewayIntentBits } from 'discord.js';
import { commandMap, commands } from './commands/index.js';
import { config } from './config.js';
import { isCommandAllowedInChannel, refreshCommandChannelRules } from './services/commandChannels.js';
import { ephemeral, safeErrorReply } from './utils/reply.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

try {
  await refreshCommandChannelRules();
  console.log('Loaded command channel rules.');
} catch (error) {
  console.error('Failed to load command channel rules. Commands will run without channel restrictions until refresh succeeds.', error);
}

setInterval(() => {
  refreshCommandChannelRules().catch((error) => {
    console.error('Failed to refresh command channel rules:', error);
  });
}, 60_000);

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ content: '알 수 없는 명령어입니다.', flags: ephemeral });
        return;
      }
      if (!isCommandAllowedInChannel(interaction.commandName, interaction.channelId)) {
        await interaction.reply({ content: '이 명령어는 이 채널에서 사용할 수 없습니다.', flags: ephemeral });
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      for (const command of commands) {
        if (command.handleButton && (await command.handleButton(interaction))) {
          return;
        }
      }
    }

    if (interaction.isModalSubmit()) {
      for (const command of commands) {
        if (command.handleModal && (await command.handleModal(interaction))) {
          return;
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      for (const command of commands) {
        if (command.handleSelect && (await command.handleSelect(interaction))) {
          return;
        }
      }
    }
  } catch (error) {
    console.error('Interaction handling failed:', error);
    const content = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
    if (interaction.isRepliable()) {
      await safeErrorReply(interaction, content);
    }
  }
});

await client.login(config.discordToken);
