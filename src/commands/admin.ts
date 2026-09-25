import { SlashCommandBuilder } from 'discord.js';
import { changePoints } from '../services/economy.js';
import { requireActiveCharacter } from '../services/characters.js';
import { addItem, removeItem } from '../services/inventory.js';
import { getItemByName } from '../services/items.js';
import { displayNameForUser } from '../utils/names.js';
import { isAdmin } from '../utils/permissions.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import { grantAdminEffect, removeAdminEffects, type EffectStat } from '../services/effects.js';
import type { BotCommand } from './types.js';

export const adminCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('운영')
    .setDescription('운영자용 지급/회수 명령어입니다.')
    .addSubcommand((sub) =>
      sub
        .setName('지급')
        .setDescription('포인트 또는 아이템을 지급합니다.')
        .addUserOption((option) => option.setName('대상').setDescription('대상').setRequired(true))
        .addStringOption((option) =>
          option.setName('종류').setDescription('포인트 또는 아이템').setRequired(true).addChoices({ name: '포인트', value: '포인트' }, { name: '아이템', value: '아이템' })
        )
        .addStringOption((option) => option.setName('값').setDescription('포인트 금액 또는 아이템명').setRequired(true))
        .addIntegerOption((option) => option.setName('수량').setDescription('아이템 수량').setRequired(false).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('회수')
        .setDescription('포인트 또는 아이템을 회수합니다.')
        .addUserOption((option) => option.setName('대상').setDescription('대상').setRequired(true))
        .addStringOption((option) =>
          option.setName('종류').setDescription('포인트 또는 아이템').setRequired(true).addChoices({ name: '포인트', value: '포인트' }, { name: '아이템', value: '아이템' })
        )
        .addStringOption((option) => option.setName('값').setDescription('포인트 금액 또는 아이템명').setRequired(true))
        .addIntegerOption((option) => option.setName('수량').setDescription('아이템 수량').setRequired(false).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('효과지급')
        .setDescription('대상 캐릭터에게 기간제 버프 또는 디버프를 지급합니다.')
        .addUserOption((option) => option.setName('대상').setDescription('대상').setRequired(true))
        .addStringOption((option) => option.setName('효과명').setDescription('표시할 효과 이름').setRequired(true).setMaxLength(80))
        .addStringOption((option) =>
          option
            .setName('스탯')
            .setDescription('효과를 적용할 스탯')
            .setRequired(true)
            .addChoices(
              { name: '힘', value: 'strength' },
              { name: '민첩', value: 'agility' },
              { name: '손재주', value: 'dexterity' },
              { name: '행운', value: 'luck' },
              { name: '전체 일반 스탯', value: 'all' }
            )
        )
        .addIntegerOption((option) =>
          option.setName('수치').setDescription('양수는 버프, 음수는 디버프').setRequired(true).setMinValue(-100).setMaxValue(100)
        )
        .addIntegerOption((option) =>
          option.setName('지속시간').setDescription('지속시간(분), 최대 30일').setRequired(true).setMinValue(1).setMaxValue(43_200)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('효과회수')
        .setDescription('운영자가 지급한 효과를 회수합니다.')
        .addUserOption((option) => option.setName('대상').setDescription('대상').setRequired(true))
        .addStringOption((option) => option.setName('효과명').setDescription('비워두면 운영자 지급 효과 전체 회수').setRequired(false).setMaxLength(80))
    ),
  async execute(interaction) {
    if (!isAdmin(interaction)) {
      await interaction.reply({ content: '운영자 권한이 필요한 명령어입니다.', flags: ephemeral });
      return;
    }
    await interaction.deferReply({ flags: ephemeral });
    try {
      const mode = interaction.options.getSubcommand();
      const target = interaction.options.getUser('대상', true);
      const character = await requireActiveCharacter(target.id);

      if (mode === '효과지급') {
        const effectName = interaction.options.getString('효과명', true);
        const stat = interaction.options.getString('스탯', true) as EffectStat;
        const modifier = interaction.options.getInteger('수치', true);
        const duration = interaction.options.getInteger('지속시간', true);
        const effect = await grantAdminEffect(character.characterId, effectName, stat, modifier, duration);
        await interaction.editReply(
          `${character.characterName}님에게 **${effect.effectName}** 지급 완료: ${effect.stat} ${effect.modifier > 0 ? '+' : ''}${effect.modifier}, ${duration}분`
        );
        return;
      }

      if (mode === '효과회수') {
        const effectName = interaction.options.getString('효과명')?.trim();
        const removed = await removeAdminEffects(character.characterId, effectName);
        await interaction.editReply(
          removed > 0
            ? `${character.characterName}님의 ${effectName ? `**${effectName}**` : '운영자 지급 효과'} ${removed}개를 회수했습니다.`
            : '회수할 운영자 지급 효과가 없습니다.'
        );
        return;
      }

      const kind = interaction.options.getString('종류', true);
      const value = interaction.options.getString('값', true).trim();
      const sign = mode === '지급' ? 1 : -1;

      if (kind === '포인트') {
        const amount = Number.parseInt(value, 10);
        if (!Number.isInteger(amount) || amount <= 0) {
          throw new Error('포인트 값은 양수 정수여야 합니다.');
        }
        await changePoints(character.characterId, sign * amount);
        await interaction.editReply(`${character.characterName}님에게 포인트 ${mode} 완료: ${amount}P`);
        return;
      }

      const item = await getItemByName(value);
      if (!item) {
        throw new Error('해당 이름의 아이템을 찾을 수 없습니다.');
      }
      const quantity = interaction.options.getInteger('수량') ?? 1;
      if (mode === '지급') {
        await addItem(character.characterId, item.itemId, quantity);
      } else {
        await removeItem(character.characterId, item.itemId, quantity);
      }
      await interaction.editReply(`${character.characterName}님에게 ${item.itemName} x${quantity} ${mode} 완료`);
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '운영 명령어 처리에 실패했습니다.');
    }
  }
};
