import { ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, SlashCommandBuilder } from 'discord.js';
import { getArea, getChoices, resolveChoice } from '../services/investigation.js';
import { interactionDisplayName } from '../utils/names.js';
import { safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

function memberRoleIds(member: unknown): string[] {
  if (member instanceof GuildMember) {
    return [...member.roles.cache.keys()];
  }
  const roles = (member as { roles?: string[] | { cache?: Map<string, unknown> } } | null)?.roles;
  if (Array.isArray(roles)) {
    return roles;
  }
  return roles?.cache ? [...roles.cache.keys()] : [];
}

export const investigateCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('조사').setDescription('현재 채널의 조사 지점을 확인합니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const area = await getArea(interaction.channelId);
      if (!area) {
        await interaction.editReply('딱히 특별한 것은 없어 보인다.');
        return;
      }

      const choices = await getChoices(interaction.channelId, memberRoleIds(interaction.member));
      if (choices.length === 0) {
        await interaction.editReply('조사 선택지가 아직 설정되지 않았습니다.');
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        choices.slice(0, 5).map((choice) =>
          new ButtonBuilder().setCustomId(`ivg:${interaction.channelId}:${choice.choiceId}`).setLabel(choice.choiceLabel).setStyle(ButtonStyle.Secondary)
        )
      );
      await interaction.editReply({
        content: `**${area.title}**\n${area.description}\n\n어디를 조사할까?`,
        components: [row]
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '조사 확인에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('ivg:')) {
      return false;
    }

    const [, channelId, choiceId] = interaction.customId.split(':');
    await interaction.deferReply();
    try {
      const result = await resolveChoice(interaction.user.id, interactionDisplayName(interaction), channelId, choiceId, memberRoleIds(interaction.member));
      const rewards = result.rewards.length > 0 ? `획득: ${result.rewards.join(', ')}` : '획득한 것은 없습니다.';
      const limits = [`오늘 남은 전체 조사 횟수: ${result.remainingGlobal}회`];
      if (result.remainingChannel !== undefined) {
        limits.push(`이 장소 남은 조사 횟수: ${result.remainingChannel}회`);
      }
      await interaction.editReply(`**${result.choice.choiceLabel} - ${result.outcome.label}**\n${result.outcome.resultText}\n${rewards}\n${limits.join('\n')}`);
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '조사 처리에 실패했습니다.');
    }
    return true;
  }
};
