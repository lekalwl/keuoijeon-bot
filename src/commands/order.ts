import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { orderLabel, placeOrder, type OrderChoice } from '../services/orders.js';
import { interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

const choices: Array<{ id: OrderChoice; emoji: string; style: ButtonStyle }> = [
  { id: 'grace', emoji: '🍞', style: ButtonStyle.Secondary },
  { id: 'mercy', emoji: '🍷', style: ButtonStyle.Danger },
  { id: 'flattery', emoji: '🥟', style: ButtonStyle.Primary },
  { id: 'fiction', emoji: '🌺', style: ButtonStyle.Success },
  { id: 'usual', emoji: '✨', style: ButtonStyle.Secondary }
];

function orderButtons(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    choices.map((choice) =>
      new ButtonBuilder()
        .setCustomId(`order:${userId}:${choice.id}`)
        .setLabel(orderLabel(choice.id))
        .setEmoji(choice.emoji)
        .setStyle(choice.style)
    )
  );
}

function isOrderChoice(value: string | undefined): value is OrderChoice {
  return choices.some((choice) => choice.id === value);
}

export const orderCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('주문').setDescription('가이드의 메뉴에서 원하는 것을 주문합니다. 하루 4회 제한.'),
  async execute(interaction) {
    await interaction.deferReply({ flags: ephemeral });
    try {
      await interaction.editReply({
        content:
          '🍽️ **가이드의 메뉴**\n가이드는 당신의 앞에 메뉴를 가져다주며, 당신이 원하는 것을 말할 때까지 기다리고 있다.\n참고로, 이 곳에서 탐욕은 금물이다.',
        components: [orderButtons(interaction.user.id)]
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '주문 확인에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('order:')) {
      return false;
    }

    const [, userId, choice] = interaction.customId.split(':');
    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '남의 주문 메뉴는 고를 수 없습니다.', flags: ephemeral });
      return true;
    }
    if (!isOrderChoice(choice)) {
      await interaction.reply({ content: '알 수 없는 주문입니다.', flags: ephemeral });
      return true;
    }

    await interaction.deferReply();
    try {
      const result = await placeOrder(interaction.user.id, interactionDisplayName(interaction), choice);
      await interaction.editReply(
        `🍽️ **${orderLabel(choice)}**\n${result.text}\n\n획득: **${result.itemName} x1**\n오늘 남은 주문 횟수: **${result.remaining}회**`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '주문 처리에 실패했습니다.');
    }
    return true;
  }
};
