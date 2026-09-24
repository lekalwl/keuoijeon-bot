import { SlashCommandBuilder } from 'discord.js';
import { playPachinko } from '../games/pachinko.js';
import { changePointsAndRecordDailyGamblingLoss, getUser } from '../services/economy.js';
import { formatPoints } from '../utils/format.js';
import { interactionDisplayName } from '../utils/names.js';
import { safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

const SPIN_DELAY_MS = 700;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function spinningLine(symbols: string[], revealed: number): string {
  return symbols.map((symbol, index) => (index < revealed ? symbol : '❔')).join(' | ');
}

export const pachinkoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('빠칭코')
    .setDescription('포인트를 걸고 빠칭코를 돌립니다.')
    .addIntegerOption((option) => option.setName('베팅').setDescription('베팅할 포인트').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const bet = interaction.options.getInteger('베팅', true);
    await interaction.deferReply();
    try {
      const displayName = interactionDisplayName(interaction);
      const account = await getUser(interaction.user.id, displayName);
      if (account.points < bet) {
        throw new Error('포인트가 부족합니다.');
      }

      const result = playPachinko(bet);
      await interaction.editReply(`🎰 **${spinningLine(result.symbols, 0)}**\n철컥...`);
      await wait(SPIN_DELAY_MS);
      await interaction.editReply(`🎰 **${spinningLine(result.symbols, 1)}**\n첫 번째 칸이 멈췄습니다.`);
      await wait(SPIN_DELAY_MS);
      await interaction.editReply(`🎰 **${spinningLine(result.symbols, 2)}**\n두 번째 칸이 멈췄습니다.`);
      await wait(SPIN_DELAY_MS);
      await interaction.editReply(`🎰 **${spinningLine(result.symbols, 3)}**\n마지막 칸이 멈췄습니다.`);
      await wait(450);

      const { lostToday } = await changePointsAndRecordDailyGamblingLoss(
        interaction.user.id,
        displayName,
        result.net,
        result.net < 0 ? Math.abs(result.net) : 0
      );
      const delta = result.net >= 0 ? `+${formatPoints(result.net)}` : `-${formatPoints(Math.abs(result.net))}`;
      await interaction.editReply(
        `🎰 **${result.symbols.join(' | ')}**\n${result.label}\n포인트 변화: **${delta}**\n오늘 잃은 포인트: **${formatPoints(lostToday)}**`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '빠칭코 처리에 실패했습니다.');
    }
  }
};
