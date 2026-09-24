import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

interface GoldfishGame {
  userId: string;
  userName: string;
  readyAt: number;
  timeout: NodeJS.Timeout;
}

const games = new Map<string, GoldfishGame>();

function catchButton(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`fish:catch:${id}`).setLabel('금붕어 뜨기!').setEmoji('🥢').setStyle(ButtonStyle.Success)
  );
}

function resultByMs(ms: number): { label: string; score: number; text: string } {
  if (ms <= 650) return { label: '금색 금붕어', score: 3, text: '황금빛 꼬리가 종이뜰채 위에서 번쩍였습니다!' };
  if (ms <= 1200) return { label: '일반 금붕어', score: 2, text: '물살을 가르며 금붕어 한 마리를 깔끔하게 건졌습니다.' };
  if (ms <= 1900) return { label: '종이 금붕어', score: 1, text: '진짜인 줄 알았는데 젖은 종이 금붕어였습니다. 그래도 점수는 점수!' };
  return { label: '놓침', score: 0, text: '뜰채가 물에 닿았을 때는 이미 물결만 남아 있었습니다.' };
}

export const goldfishCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('금붕어낚기').setDescription('타이밍에 맞춰 버튼을 눌러 금붕어를 건집니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const delay = 1200 + Math.floor(Math.random() * 2400);
      await interaction.editReply('🏮 **금붕어 낚기**\n물 위가 조용합니다...\n버튼이 뜨면 빠르게 눌러주세요.');

      setTimeout(() => {
        const readyAt = Date.now();
        const timeout = setTimeout(() => games.delete(id), 12_000);
        games.set(id, {
          userId: interaction.user.id,
          userName: interactionDisplayName(interaction),
          readyAt,
          timeout
        });
        interaction
          .editReply({ content: '🏮 **금붕어 낚기**\n✨ 지금! 물 위에 금붕어가 떠올랐습니다!', components: [catchButton(id)] })
          .catch((error) => console.error('Failed to show goldfish button:', error));
      }, delay);
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '금붕어 낚기에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('fish:')) return false;
    const [, , id] = interaction.customId.split(':');
    const game = games.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 지나간 금붕어입니다.', flags: ephemeral });
      return true;
    }
    if (interaction.user.id !== game.userId) {
      await interaction.reply({ content: '낚시를 시작한 사람만 누를 수 있습니다.', flags: ephemeral });
      return true;
    }

    clearTimeout(game.timeout);
    games.delete(id);
    const reactionMs = Date.now() - game.readyAt;
    const result = resultByMs(reactionMs);
    await interaction.update({
      content: `🏮 **금붕어 낚기 결과**\n${game.userName}님: **${result.label}** (${result.score}점)\n반응 속도: ${(reactionMs / 1000).toFixed(2)}초\n${result.text}`,
      components: []
    });
    return true;
  }
};
