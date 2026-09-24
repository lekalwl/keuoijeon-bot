import {
  ActionRowBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  getActiveCharacter,
  getCharactersByOwner,
  registerCharacter,
  selectCharacter
} from '../services/characters.js';
import { formatPoints } from '../utils/format.js';
import { interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

export const characterCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('캐릭터')
    .setDescription('캐릭터를 등록하거나 사용할 캐릭터를 선택합니다.')
    .addSubcommand((sub) =>
      sub
        .setName('등록')
        .setDescription('새 캐릭터를 등록합니다.')
        .addStringOption((option) => option.setName('이름').setDescription('캐릭터 이름').setRequired(true).setMaxLength(40))
        .addIntegerOption((option) => option.setName('힘').setDescription('힘 스탯 1~5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption((option) => option.setName('민첩').setDescription('민첩 스탯 1~5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption((option) => option.setName('손재주').setDescription('손재주 스탯 1~5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption((option) => option.setName('행운').setDescription('행운 스탯 1~5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption((option) =>
          option.setName('개인특기이름').setDescription('캐릭터의 고유한 개인특기 이름').setRequired(true).setMaxLength(60)
        )
        .addIntegerOption((option) =>
          option.setName('개인특기수치').setDescription('개인특기 능력치 1~5').setRequired(true).setMinValue(1).setMaxValue(5)
        )
    )
    .addSubcommand((sub) => sub.setName('선택').setDescription('앞으로 사용할 캐릭터를 선택합니다.'))
    .addSubcommand((sub) => sub.setName('목록').setDescription('등록한 캐릭터 목록을 확인합니다.')),
  async execute(interaction) {
    await interaction.deferReply({ flags: ephemeral });
    try {
      const sub = interaction.options.getSubcommand();
      if (sub === '등록') {
        const character = await registerCharacter(
          interaction.user.id,
          interactionDisplayName(interaction),
          interaction.options.getString('이름', true),
          interaction.options.getInteger('힘', true),
          interaction.options.getInteger('민첩', true),
          interaction.options.getInteger('손재주', true),
          interaction.options.getInteger('행운', true),
          interaction.options.getString('개인특기이름', true),
          interaction.options.getInteger('개인특기수치', true)
        );
        await interaction.editReply(
          `**${character.characterName}** 캐릭터를 등록했습니다.\n기본 포인트: **${formatPoints(character.points)}**\n힘 ${character.strength} · 민첩 ${character.agility} · 손재주 ${character.dexterity} · 행운 ${character.luck}\n개인특기: **${character.personalTraitName} ${character.personalTraitValue}**`
        );
        return;
      }

      const characters = await getCharactersByOwner(interaction.user.id);
      if (characters.length === 0) throw new Error('등록된 캐릭터가 없습니다. 먼저 `/캐릭터 등록`을 이용해주세요.');
      const active = await getActiveCharacter(interaction.user.id);
      if (sub === '목록') {
        const embed = new EmbedBuilder()
          .setTitle(`${interactionDisplayName(interaction)}님의 캐릭터`)
          .setDescription(
            characters
              .map((character) => `${character.characterId === active?.characterId ? '▶' : '•'} **${character.characterName}** · ${formatPoints(character.points)}`)
              .join('\n')
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`character:select:${interaction.user.id}`)
        .setPlaceholder('사용할 캐릭터를 선택하세요')
        .addOptions(
          characters.slice(0, 25).map((character) => ({
            label: character.characterName.slice(0, 100),
            description: `${formatPoints(character.points)}${character.characterId === active?.characterId ? ' · 현재 선택됨' : ''}`,
            value: character.characterId,
            default: character.characterId === active?.characterId
          }))
        );
      await interaction.editReply({ components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '캐릭터 처리에 실패했습니다.');
    }
  },
  async handleSelect(interaction) {
    if (!interaction.customId.startsWith('character:select:')) return false;
    const ownerUserId = interaction.customId.split(':')[2];
    if (interaction.user.id !== ownerUserId) {
      await interaction.reply({ content: '본인의 캐릭터만 선택할 수 있습니다.', flags: ephemeral });
      return true;
    }
    try {
      const character = await selectCharacter(ownerUserId, interactionDisplayName(interaction), interaction.values[0]);
      await interaction.update({ content: `활성 캐릭터를 **${character.characterName}**으로 변경했습니다.`, components: [] });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '캐릭터 선택에 실패했습니다.');
    }
    return true;
  }
};
