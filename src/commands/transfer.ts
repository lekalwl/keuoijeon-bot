import { SlashCommandBuilder } from 'discord.js';
import { transferPoints } from '../services/economy.js';
import { requireActiveCharacter } from '../services/characters.js';
import { transferItem } from '../services/inventory.js';
import { formatPoints } from '../utils/format.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

export const transferCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('송금')
    .setDescription('포인트를 송금하거나 아이템을 전달합니다.')
    .addSubcommand((sub) =>
      sub
        .setName('포인트')
        .setDescription('포인트를 송금합니다.')
        .addUserOption((option) => option.setName('대상').setDescription('받는 사람').setRequired(true))
        .addIntegerOption((option) => option.setName('금액').setDescription('보낼 포인트').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('아이템')
        .setDescription('아이템을 전달합니다.')
        .addUserOption((option) => option.setName('대상').setDescription('받는 사람').setRequired(true))
        .addStringOption((option) => option.setName('아이템명').setDescription('전달할 아이템 이름').setRequired(true))
        .addIntegerOption((option) => option.setName('수량').setDescription('전달할 수량').setRequired(true).setMinValue(1))
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('대상', true);
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: '자기 자신에게는 보낼 수 없습니다.', flags: ephemeral });
      return;
    }
    await interaction.deferReply();
    try {
      const from = await requireActiveCharacter(interaction.user.id);
      const to = await requireActiveCharacter(target.id);
      if (sub === '포인트') {
        const amount = interaction.options.getInteger('금액', true);
        await transferPoints(from, to, amount);
        await interaction.editReply(`${from.characterName} → ${to.characterName}: **${formatPoints(amount)}** 송금 완료`);
        return;
      }
      const itemName = interaction.options.getString('아이템명', true);
      const quantity = interaction.options.getInteger('수량', true);
      const item = await transferItem(from.characterId, to.characterId, itemName, quantity);
      await interaction.editReply(`${from.characterName} → ${to.characterName}: **${item.itemName} x${quantity}** 전달 완료`);
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '전달 처리에 실패했습니다.');
    }
  }
};
