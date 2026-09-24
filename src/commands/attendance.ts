import { SlashCommandBuilder } from 'discord.js';
import { checkAttendance } from '../services/attendance.js';
import { formatPoints } from '../utils/format.js';
import { interactionDisplayName } from '../utils/names.js';
import { safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

export const attendanceCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('출석').setDescription('하루 한 번 출석하고 100P를 받습니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const displayName = interactionDisplayName(interaction);
      const result = await checkAttendance(interaction.user.id, displayName);
      if (result.alreadyChecked) {
        await interaction.editReply(`오늘은 이미 출석했습니다. (${result.date})\n현재 포인트: **${formatPoints(result.balance ?? 0)}**`);
        return;
      }

      await interaction.editReply(
        `${displayName}님 출석 완료!\n획득: **${formatPoints(result.awarded)}**\n현재 포인트: **${formatPoints(result.balance ?? 0)}**`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '출석 처리에 실패했습니다.');
    }
  }
};
