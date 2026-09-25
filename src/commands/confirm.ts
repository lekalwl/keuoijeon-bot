import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getInventory, useItem } from '../services/inventory.js';
import { applyItemEffects } from '../services/effects.js';
import { getCharacter, requireActiveCharacter } from '../services/characters.js';
import { getItemByName } from '../services/items.js';
import { activateSpecialItemEffects } from '../services/specialEffects.js';
import { formatPoints } from '../utils/format.js';
import { interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

function useButton(ownerUserId: string, characterId: string, itemId: string, consumeOnUse: boolean): ActionRowBuilder<ButtonBuilder> {
  const consumeFlag = consumeOnUse ? 'consume' : 'keep';
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`confirm:use:${ownerUserId}:${characterId}:${itemId}:${consumeFlag}`).setLabel('사용').setStyle(ButtonStyle.Primary)
  );
}

function quantityModal(ownerUserId: string, characterId: string, itemId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`confirm:qty:${ownerUserId}:${characterId}:${itemId}`)
    .setTitle('아이템 사용')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('사용할 수량')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('1')
          .setPlaceholder('예: 1')
      )
    );
}

function parseQuantity(value: string): number {
  const quantity = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('수량은 양수 정수로 입력해주세요.');
  }
  return quantity;
}

function effectText(effects: Awaited<ReturnType<typeof applyItemEffects>>): string {
  if (effects.length === 0) return '';
  return `\n적용 효과: ${effects.map((effect) => `${effect.effectName} (${effect.stat} ${effect.modifier >= 0 ? '+' : ''}${effect.modifier})`).join(', ')}`;
}

function specialText(messages: string[]): string {
  return messages.length ? `\n특수 효과: ${messages.join(', ')}` : '';
}

export const confirmCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('확인')
    .setDescription('보유 중인 아이템의 설명을 확인합니다.')
    .addStringOption((option) => option.setName('아이템명').setDescription('확인할 아이템 이름').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: ephemeral });
    try {
      const itemName = interaction.options.getString('아이템명', true).trim();
      const character = await requireActiveCharacter(interaction.user.id);
      const item = await getItemByName(itemName);
      if (!item) {
        throw new Error('해당 이름의 아이템을 찾을 수 없습니다.');
      }

      const inventory = await getInventory(character.characterId);
      const entry = inventory.find((candidate) => candidate.item.itemId === item.itemId);
      if (!entry) {
        throw new Error('보유하지 않은 아이템입니다.');
      }

      const lines = [
        `**${item.itemName}**`,
        item.description || '별다른 설명은 없습니다.',
        '',
        `가격: ${item.price > 0 ? formatPoints(item.price) : '미설정'}`,
        `보유 수량: ${entry.quantity}`,
        `귀속 여부: ${item.bound ? '귀속됨 (판매·전달·돛거 불가)' : '귀속되지 않음'}`,
        `사용 가능: ${item.usable ? '가능' : '불가'}`
      ];

      await interaction.editReply({
        content: lines.join('\n'),
        components: item.usable ? [useButton(interaction.user.id, character.characterId, item.itemId, item.consumeOnUse)] : []
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '아이템 확인에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('confirm:use:')) {
      return false;
    }
    const [, , ownerUserId, characterId, itemId, consumeFlag] = interaction.customId.split(':');
    if (interaction.user.id !== ownerUserId) {
      await interaction.reply({ content: '남의 아이템은 사용할 수 없습니다.', flags: ephemeral });
      return true;
    }

    try {
      if (consumeFlag !== 'consume') {
        await interaction.deferReply();
        const used = await useItem(characterId, itemId, 1);
        const effects = await applyItemEffects(characterId, itemId, 1);
        const special = await activateSpecialItemEffects(characterId, itemId, 1);
        const character = await getCharacter(characterId);
        if (!character || character.ownerUserId !== ownerUserId) throw new Error('캐릭터를 찾을 수 없습니다.');
        await interaction.editReply(
          `${character.characterName}님이 **${used.item.itemName}**을 사용했습니다.\n${used.useText || '특별한 일이 일어나지는 않았습니다.'}${effectText(effects)}${specialText(special)}`
        );
        return true;
      }
      await interaction.showModal(quantityModal(ownerUserId, characterId, itemId));
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '아이템 사용에 실패했습니다.');
    }
    return true;
  },
  async handleModal(interaction) {
    if (!interaction.customId.startsWith('confirm:qty:')) {
      return false;
    }
    const [, , ownerUserId, characterId, itemId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerUserId) {
      await interaction.reply({ content: '남의 아이템은 사용할 수 없습니다.', flags: ephemeral });
      return true;
    }

    await interaction.deferReply();
    try {
      const quantity = parseQuantity(interaction.fields.getTextInputValue('quantity'));
      const used = await useItem(characterId, itemId, quantity);
      const effects = await applyItemEffects(characterId, itemId, quantity);
      const special = await activateSpecialItemEffects(characterId, itemId, quantity);
      const character = await getCharacter(characterId);
      if (!character || character.ownerUserId !== ownerUserId) throw new Error('캐릭터를 찾을 수 없습니다.');
      const quantityText = used.quantity > 1 ? ` ${used.quantity}개` : '';
      await interaction.editReply(
        `${character.characterName}님이 **${used.item.itemName}**${quantityText}를 사용했습니다.\n${used.useText || '특별한 일이 일어나지는 않았습니다.'}${effectText(effects)}${specialText(special)}`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '아이템 사용에 실패했습니다.');
    }
    return true;
  }
};
