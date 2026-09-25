import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { baseStatBonus, getActiveCharacter, getCharacter, requireActiveCharacter, setCharacterMemo, type Character } from '../services/characters.js';
import { getActiveEffects, getPossessionEffects, type EffectStat } from '../services/effects.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function statLabel(stat: EffectStat): string {
  return { strength: '힘', agility: '민첩', dexterity: '손재주', luck: '행운', all: '전체' }[stat];
}

function memoButtons(ownerUserId: string, characterId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`status:memo:${ownerUserId}:${characterId}`).setLabel('메모 적기').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`status:clear:${ownerUserId}:${characterId}`).setLabel('메모 삭제').setStyle(ButtonStyle.Danger)
  );
}

async function statusEmbed(character: Character): Promise<EmbedBuilder> {
  const [effects, possessionEffects] = await Promise.all([
    getActiveEffects(character.characterId),
    getPossessionEffects(character.characterId)
  ]);
  const now = Date.now();
  const effectText = effects.length
    ? effects
        .map((effect) => {
          const minutes = Math.max(1, Math.ceil((effect.expiresAt.getTime() - now) / 60_000));
          return `${effect.effectName} · ${statLabel(effect.stat)} ${signed(effect.modifier)} · ${minutes}분 남음`;
        })
        .join('\n')
    : '적용 중인 효과 없음';
  const possessionText = possessionEffects.length
    ? possessionEffects
        .map((effect) => `${effect.effectName} · ${statLabel(effect.stat)} ${signed(effect.modifier)}${effect.stacks > 1 ? ` · ${effect.stacks}중첩` : ''}`)
        .join('\n')
    : '소지 아이템 효과 없음';
  const embed = new EmbedBuilder()
    .setTitle(`${character.characterName}의 상태`)
    .addFields(
      {
        name: '스탯',
        value: [
          `힘 ${character.strength} (${signed(baseStatBonus(character, 'strength'))})`,
          `민첩 ${character.agility} (${signed(baseStatBonus(character, 'agility'))})`,
          `손재주 ${character.dexterity} (${signed(baseStatBonus(character, 'dexterity'))})`,
          `행운 ${character.luck} (${signed(baseStatBonus(character, 'luck'))})`
        ].join('\n'),
        inline: true
      },
      {
        name: `${character.personalTraitName} ${character.personalTraitValue}`,
        value: `${character.personalTraitText}\n보정 ${signed(baseStatBonus(character, 'personal_trait'))}`,
        inline: true
      },
      { name: '현재 효과', value: effectText },
      { name: '소지 아이템 효과', value: possessionText },
      { name: '메모', value: character.memo || '메모 없음' }
    );
  if (/^https?:\/\//i.test(character.sdImageUrl)) embed.setThumbnail(character.sdImageUrl);
  return embed;
}

export const statusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('상태')
    .setDescription('캐릭터의 스탯과 현재 효과를 확인합니다.')
    .addUserOption((option) => option.setName('대상').setDescription('확인할 캐릭터').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const target = interaction.options.getUser('대상') ?? interaction.user;
      const character = target.id === interaction.user.id ? await requireActiveCharacter(target.id) : await getActiveCharacter(target.id);
      if (!character) throw new Error('대상이 선택한 캐릭터가 없습니다.');
      await interaction.editReply({
        embeds: [await statusEmbed(character)],
        components: target.id === interaction.user.id ? [memoButtons(target.id, character.characterId)] : []
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '상태 확인에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('status:')) return false;
    const [, action, ownerUserId, characterId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerUserId) {
      await interaction.reply({ content: '본인의 메모만 수정할 수 있습니다.', flags: ephemeral });
      return true;
    }
    if (action === 'clear') {
      await interaction.deferUpdate();
      const character = await setCharacterMemo(characterId, ownerUserId, '');
      await interaction.editReply({ embeds: [await statusEmbed(character)], components: [memoButtons(ownerUserId, characterId)] });
      return true;
    }
    if (action === 'memo') {
      const character = await getCharacter(characterId);
      if (!character || character.ownerUserId !== ownerUserId) throw new Error('캐릭터를 찾을 수 없습니다.');
      const input = new TextInputBuilder()
        .setCustomId('memo')
        .setLabel('캐릭터 메모')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder('현재 상태나 기억할 내용을 적어주세요.');
      if (character.memo) input.setValue(character.memo.slice(0, 1000));
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`status:save:${ownerUserId}:${characterId}`)
          .setTitle('상태 메모')
          .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
      );
      return true;
    }
    return true;
  },
  async handleModal(interaction) {
    if (!interaction.customId.startsWith('status:save:')) return false;
    const [, , ownerUserId, characterId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerUserId) {
      await interaction.reply({ content: '본인의 메모만 수정할 수 있습니다.', flags: ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: ephemeral });
    try {
      const character = await setCharacterMemo(characterId, ownerUserId, interaction.fields.getTextInputValue('memo'));
      await interaction.editReply({ content: '메모를 저장했습니다.', embeds: [await statusEmbed(character)] });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '메모 저장에 실패했습니다.');
    }
    return true;
  }
};
