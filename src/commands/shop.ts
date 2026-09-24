import { SlashCommandBuilder } from 'discord.js';
import { buyItem, MAX_SELL_PRICE_PER_ITEM, sellItem } from '../services/shop.js';
import { requireActiveCharacter } from '../services/characters.js';
import { formatPoints } from '../utils/format.js';
import { safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

export const buyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('구매')
    .setDescription('상점에 등록된 아이템을 구매합니다.')
    .addStringOption((option) => option.setName('아이템명').setDescription('구매할 아이템 이름').setRequired(true))
    .addIntegerOption((option) => option.setName('수량').setDescription('구매할 수량').setRequired(false).setMinValue(1)),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const itemName = interaction.options.getString('아이템명', true).trim();
      const quantity = interaction.options.getInteger('수량') ?? 1;
      const character = await requireActiveCharacter(interaction.user.id);
      const result = await buyItem(character.characterId, itemName, quantity);
      await interaction.editReply(
        `${character.characterName}님이 **${result.item.itemName} x${result.quantity}** 구매 완료!\n사용 포인트: **${formatPoints(Math.abs(result.pointsChanged))}**\n현재 포인트: **${formatPoints(result.balance)}**`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '구매 처리에 실패했습니다.');
    }
  }
};

export const sellCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('판매')
    .setDescription(`아이템을 최대 ${MAX_SELL_PRICE_PER_ITEM}P, 가격이 더 낮으면 해당 가격에 판매합니다.`)
    .addStringOption((option) => option.setName('아이템명').setDescription('판매할 아이템 이름').setRequired(true))
    .addIntegerOption((option) => option.setName('수량').setDescription('판매할 수량').setRequired(false).setMinValue(1)),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const itemName = interaction.options.getString('아이템명', true).trim();
      const quantity = interaction.options.getInteger('수량') ?? 1;
      const character = await requireActiveCharacter(interaction.user.id);
      const result = await sellItem(character.characterId, itemName, quantity);
      await interaction.editReply(
        `${character.characterName}님이 **${result.item.itemName} x${result.quantity}** 판매 완료!\n판매 단가: **${formatPoints(result.unitPrice)}**\n획득 포인트: **${formatPoints(result.pointsChanged)}**\n현재 포인트: **${formatPoints(result.balance)}**`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '판매 처리에 실패했습니다.');
    }
  }
};
