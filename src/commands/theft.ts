import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, type User } from 'discord.js';
import { baseStatBonus, getCharacter, requireActiveCharacter } from '../services/characters.js';
import { statEffectBonus } from '../services/effects.js';
import { transferPoints } from '../services/economy.js';
import { transferItem } from '../services/inventory.js';
import { appendRow } from '../services/sheets.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { randomInt } from '../utils/random.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import { consumeSpecialEffects } from '../services/specialEffects.js';
import type { BotCommand } from './types.js';

type TheftKind = 'points' | 'item';

interface TheftGame {
  id: string;
  thief: User;
  thiefName: string;
  thiefCharacterId: string;
  target: User;
  targetName: string;
  targetCharacterId: string;
  kind: TheftKind;
  asset: string;
  quantity: number;
  accepted: boolean;
  rolls: Map<string, number>;
  timeout: NodeJS.Timeout;
}

const games = new Map<string, TheftGame>();

function consentButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`theft:accept:${id}`).setLabel('동의').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`theft:decline:${id}`).setLabel('거절').setStyle(ButtonStyle.Danger)
  );
}

function rollButton(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`theft:roll:${id}`).setLabel('다이스 굴리기').setStyle(ButtonStyle.Primary)
  );
}

async function opposedRoll(game: TheftGame, userId: string): Promise<number> {
  const isThief = userId === game.thief.id;
  const name = isThief ? game.thiefName : game.targetName;
  const stat = isThief ? 'dexterity' : 'agility';
  const characterId = isThief ? game.thiefCharacterId : game.targetCharacterId;
  const character = await getCharacter(characterId);
  if (!character) throw new Error('캐릭터 정보를 찾을 수 없습니다.');
  const effects = await statEffectBonus(characterId, stat);
  const key = isThief ? 'theft_attack_bonus' : 'theft_defense_bonus';
  const special = await consumeSpecialEffects(characterId, [key]);
  return randomInt(1, 100) + baseStatBonus(character, stat) + effects.total + (special.get(key)?.value ?? 0);
}

async function logTheft(game: TheftGame, result: string): Promise<void> {
  await appendRow('TheftLogs', {
    created_at: new Date().toISOString(),
    thief_character_id: game.thiefCharacterId,
    target_character_id: game.targetCharacterId,
    kind: game.kind,
    asset: game.asset,
    quantity: String(game.quantity),
    thief_roll: String(game.rolls.get(game.thief.id) ?? ''),
    target_roll: String(game.rolls.get(game.target.id) ?? ''),
    result
  });
}

export const theftCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('돛거')
    .setDescription('상대의 동의를 받고 포인트나 아이템을 훔치는 대항 판정을 합니다.')
    .addUserOption((option) => option.setName('대상').setDescription('대상 캐릭터').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('훔칠 대상')
        .setRequired(true)
        .addChoices({ name: '포인트', value: 'points' }, { name: '아이템', value: 'item' })
    )
    .addIntegerOption((option) => option.setName('수량').setDescription('포인트 금액 또는 아이템 수량').setRequired(true).setMinValue(1))
    .addStringOption((option) => option.setName('아이템명').setDescription('아이템을 훔칠 때만 입력').setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getUser('대상', true);
    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: '이 대상에게는 돛거를 시도할 수 없습니다.', flags: ephemeral });
      return;
    }
    const kind = interaction.options.getString('종류', true) as TheftKind;
    const quantity = interaction.options.getInteger('수량', true);
    const itemName = interaction.options.getString('아이템명')?.trim() ?? '';
    if (kind === 'item' && !itemName) {
      await interaction.reply({ content: '아이템을 훔치려면 아이템명을 입력해주세요.', flags: ephemeral });
      return;
    }
    await interaction.deferReply();
    try {
      const thiefCharacter = await requireActiveCharacter(interaction.user.id);
      const targetCharacter = await requireActiveCharacter(target.id);
      const thiefName = thiefCharacter.characterName;
      const targetName = targetCharacter.characterName;
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const game: TheftGame = {
        id,
        thief: interaction.user,
        thiefName,
        thiefCharacterId: thiefCharacter.characterId,
        target,
        targetName,
        targetCharacterId: targetCharacter.characterId,
        kind,
        asset: kind === 'points' ? '포인트' : itemName,
        quantity,
        accepted: false,
        rolls: new Map(),
        timeout: setTimeout(() => games.delete(id), 180_000)
      };
      games.set(id, game);
      const assetText = kind === 'points' ? `${quantity}P` : `${itemName} x${quantity}`;
      await interaction.editReply({
        content: `${target}님, ${thiefName}님이 **${assetText}** 돛거 판정을 신청했습니다. 진행에 동의하나요?`,
        components: [consentButtons(id)]
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '돛거 신청에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('theft:')) return false;
    const [, action, id] = interaction.customId.split(':');
    const game = games.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 만료된 돛거 판정입니다.', flags: ephemeral });
      return true;
    }
    if (action === 'decline') {
      if (interaction.user.id !== game.target.id) {
        await interaction.reply({ content: '대상 오너만 거절할 수 있습니다.', flags: ephemeral });
        return true;
      }
      clearTimeout(game.timeout);
      games.delete(id);
      await logTheft(game, 'DECLINED');
      await interaction.update({ content: '돛거 신청이 거절되었습니다.', components: [] });
      return true;
    }
    if (action === 'accept') {
      if (interaction.user.id !== game.target.id) {
        await interaction.reply({ content: '대상 오너만 동의할 수 있습니다.', flags: ephemeral });
        return true;
      }
      game.accepted = true;
      await interaction.update({
        content: `돛거 대항 판정 시작!\n${game.thiefName}님은 손재주, ${game.targetName}님은 민첩으로 판정합니다.`,
        components: [rollButton(id)]
      });
      return true;
    }
    if (action !== 'roll') return true;
    if (!game.accepted || ![game.thief.id, game.target.id].includes(interaction.user.id)) {
      await interaction.reply({ content: '이 판정의 참가자만 굴릴 수 있습니다.', flags: ephemeral });
      return true;
    }
    if (game.rolls.has(interaction.user.id)) {
      await interaction.reply({ content: '이미 다이스를 굴렸습니다.', flags: ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: ephemeral });
    try {
      game.rolls.set(interaction.user.id, await opposedRoll(game, interaction.user.id));
      await interaction.editReply('판정값을 제출했습니다.');
      if (game.rolls.size < 2) return true;

      const thiefRoll = game.rolls.get(game.thief.id)!;
      const targetRoll = game.rolls.get(game.target.id)!;
      const success = thiefRoll >= 60 && thiefRoll > targetRoll;
      let result: string;
      if (success) {
        const insurance = await consumeSpecialEffects(game.targetCharacterId, ['theft_insurance']);
        if (insurance.has('theft_insurance')) {
          result = `**돛거 방어!**\n${game.targetName}님의 도깨비 보험증이 발동해 **${game.asset}${game.kind === 'points' ? ` ${game.quantity}P` : ` x${game.quantity}`}**을 지켰습니다.`;
          await logTheft(game, 'BLOCKED_BY_INSURANCE');
        } else {
          if (game.kind === 'points') {
            const from = await getCharacter(game.targetCharacterId);
            const to = await getCharacter(game.thiefCharacterId);
            if (!from || !to) throw new Error('캐릭터 정보를 찾을 수 없습니다.');
            await transferPoints(from, to, game.quantity);
            result = `**돛거 성공!**\n${game.thiefName}님이 ${game.targetName}님에게서 **${game.quantity}P**를 훔쳤습니다.`;
          } else {
            await transferItem(game.targetCharacterId, game.thiefCharacterId, game.asset, game.quantity);
            result = `**돛거 성공!**\n${game.thiefName}님이 ${game.targetName}님에게서 **${game.asset} x${game.quantity}**을 훔쳤습니다.`;
          }
          await logTheft(game, 'SUCCESS');
        }
      } else {
        result = `**돛거 실패!**\n${game.thiefName}님이 ${game.targetName}님의 물건을 훔치려고 들었다!! 모두가 이 사실을 눈치챈다!`;
        await logTheft(game, 'FAILED');
      }
      result += `\n\n${game.thiefName}: ${thiefRoll}\n${game.targetName}: ${targetRoll}`;
      clearTimeout(game.timeout);
      games.delete(id);
      await interaction.message.edit({ content: result, components: [] });
    } catch (error) {
      clearTimeout(game.timeout);
      games.delete(id);
      await safeErrorReply(interaction, error instanceof Error ? error.message : '돛거 처리에 실패했습니다.');
    }
    return true;
  }
};
