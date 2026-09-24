import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { duelGames, duelLabel, duelRoundWinner, type DuelChoice, type DuelGame } from '../games/duel.js';
import { transferPoints } from '../services/economy.js';
import { getCharacter, requireActiveCharacter } from '../services/characters.js';
import { hpBar } from '../utils/format.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import { consumeSpecialEffects } from '../services/specialEffects.js';
import { changePoints } from '../services/economy.js';
import type { BotCommand } from './types.js';

function duelButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`duel:pick:${id}:attack`).setLabel('공격').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`duel:pick:${id}:defense`).setLabel('방어').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel:pick:${id}:dodge`).setLabel('회피').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`duel:pick:${id}:ambush`).setLabel('기습').setStyle(ButtonStyle.Success)
  );
}

function status(game: DuelGame): string {
  return `${game.challengerName}: ${hpBar(game.hp.get(game.challengerId) ?? 100)}\n${game.opponentName}: ${hpBar(game.hp.get(game.opponentId) ?? 100)}`;
}

export const duelCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('결투')
    .setDescription('공격/방어/회피/기습 상성 결투를 시작합니다.')
    .addUserOption((option) => option.setName('상대').setDescription('상대').setRequired(true))
    .addIntegerOption((option) => option.setName('베팅').setDescription('베팅 포인트').setRequired(false).setMinValue(1)),
  async execute(interaction) {
    const opponent = interaction.options.getUser('상대', true);
    const bet = interaction.options.getInteger('베팅') ?? 0;
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.reply({ content: '이 상대와는 결투할 수 없습니다.', flags: ephemeral });
      return;
    }
    await interaction.deferReply();
    try {
      const challenger = await requireActiveCharacter(interaction.user.id);
      const target = await requireActiveCharacter(opponent.id);
      const challengerName = challenger.characterName;
      const opponentName = target.characterName;
      if (bet > 0) {
        if (challenger.points < bet || target.points < bet) {
          await interaction.editReply('둘 중 한 명의 포인트가 부족합니다.');
          return;
        }
      }
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const timeout = setTimeout(() => duelGames.delete(id), 300_000);
      const game: DuelGame = {
        id,
        challengerId: interaction.user.id,
        challengerName,
        challengerCharacterId: challenger.characterId,
        opponentId: opponent.id,
        opponentName,
        opponentCharacterId: target.characterId,
        bet,
        hp: new Map([
          [interaction.user.id, 100],
          [opponent.id, 100]
        ]),
        choices: new Map(),
        accepted: false,
        timeout
      };
      duelGames.set(id, game);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`duel:accept:${id}`).setLabel('수락').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duel:decline:${id}`).setLabel('거절').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ content: `${opponent}님, ${challengerName}님이 결투를 신청했습니다.${bet ? ` 베팅: ${bet}P` : ''}`, components: [row] });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '결투 처리에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('duel:')) return false;
    const [, action, id, choice] = interaction.customId.split(':');
    const game = duelGames.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 만료된 결투입니다.', flags: ephemeral });
      return true;
    }
    if (action === 'decline') {
      if (interaction.user.id !== game.opponentId) {
        await interaction.reply({ content: '도전받은 사람만 거절할 수 있습니다.', flags: ephemeral });
        return true;
      }
      clearTimeout(game.timeout);
      duelGames.delete(id);
      await interaction.reply('결투가 취소되었습니다.');
      return true;
    }
    if (action === 'accept') {
      if (interaction.user.id !== game.opponentId) {
        await interaction.reply({ content: '도전받은 사람만 수락할 수 있습니다.', flags: ephemeral });
        return true;
      }
      game.accepted = true;
      await interaction.reply({ content: `결투 시작!\n${status(game)}\n\n둘 다 행동을 선택해주세요.`, components: [duelButtons(id)] });
      return true;
    }
    if (action === 'pick') {
      if (![game.challengerId, game.opponentId].includes(interaction.user.id)) {
        await interaction.reply({ content: '참가자만 선택할 수 있습니다.', flags: ephemeral });
        return true;
      }
      game.choices.set(interaction.user.id, choice as DuelChoice);
      await interaction.reply({ content: '행동 선택 완료.', flags: ephemeral });
      if (game.choices.size === 2) {
        const a = game.choices.get(game.challengerId)!;
        const b = game.choices.get(game.opponentId)!;
        const winner = duelRoundWinner(a, b);
        let text = `**결투 라운드**\n${game.challengerName}: ${duelLabel(a)}\n${game.opponentName}: ${duelLabel(b)}\n`;
        if (winner === 0) {
          text += '무승부! 체력 변화 없음.\n';
        } else {
          const loserId = winner === 1 ? game.opponentId : game.challengerId;
          game.hp.set(loserId, Math.max(0, (game.hp.get(loserId) ?? 100) - 25));
          text += `${winner === 1 ? game.challengerName : game.opponentName} 승리! 상대 체력 -25%.\n`;
        }
        game.choices.clear();
        text += `\n${status(game)}`;
        const challengerHp = game.hp.get(game.challengerId) ?? 100;
        const opponentHp = game.hp.get(game.opponentId) ?? 100;
        if (challengerHp <= 0 || opponentHp <= 0) {
          const winnerUser = challengerHp > 0 ? { id: game.challengerId, name: game.challengerName } : { id: game.opponentId, name: game.opponentName };
          const loserUser = challengerHp > 0 ? { id: game.opponentId, name: game.opponentName } : { id: game.challengerId, name: game.challengerName };
          if (game.bet > 0) {
            const loserCharacter = await getCharacter(loserUser.id === game.challengerId ? game.challengerCharacterId : game.opponentCharacterId);
            const winnerCharacter = await getCharacter(winnerUser.id === game.challengerId ? game.challengerCharacterId : game.opponentCharacterId);
            if (!loserCharacter || !winnerCharacter) throw new Error('결투 캐릭터 정보를 찾을 수 없습니다.');
            await transferPoints(loserCharacter, winnerCharacter, game.bet);
          }
          const winnerCharacterId = winnerUser.id === game.challengerId ? game.challengerCharacterId : game.opponentCharacterId;
          const victoryEffect = await consumeSpecialEffects(winnerCharacterId, ['victory_bonus']);
          const victoryBonus = victoryEffect.get('victory_bonus')?.value ?? 0;
          if (victoryBonus > 0) await changePoints(winnerCharacterId, victoryBonus);
          text += `\n\n최종 승자: **${winnerUser.name}**${game.bet ? ` (+${game.bet}P)` : ''}${victoryBonus ? `\n승부 부적 보너스: +${victoryBonus}P` : ''}`;
          clearTimeout(game.timeout);
          duelGames.delete(id);
          await interaction.followUp(text);
        } else {
          await interaction.followUp({ content: `${text}\n\n다음 라운드 행동을 선택해주세요.`, components: [duelButtons(id)] });
        }
      }
      return true;
    }
    return true;
  }
};
