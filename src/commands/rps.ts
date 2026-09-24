import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { rpsGames, rpsLabel, rpsWinner, type RpsChoice, type RpsGame } from '../games/rps.js';
import { transferPoints } from '../services/economy.js';
import { getCharacter, requireActiveCharacter } from '../services/characters.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import { consumeSpecialEffects } from '../services/specialEffects.js';
import { changePoints } from '../services/economy.js';
import type { BotCommand } from './types.js';

function choiceButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rps:pick:${id}:scissors`).setLabel('가위').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps:pick:${id}:rock`).setLabel('바위').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps:pick:${id}:paper`).setLabel('보').setStyle(ButtonStyle.Primary)
  );
}

export const rpsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('가위바위보')
    .setDescription('상대와 가위바위보를 합니다.')
    .addUserOption((option) => option.setName('상대').setDescription('상대').setRequired(true))
    .addIntegerOption((option) => option.setName('베팅').setDescription('베팅 포인트').setRequired(false).setMinValue(1)),
  async execute(interaction) {
    const opponent = interaction.options.getUser('상대', true);
    const bet = interaction.options.getInteger('베팅') ?? 0;
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.reply({ content: '이 상대와는 진행할 수 없습니다.', flags: ephemeral });
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
      const timeout = setTimeout(() => rpsGames.delete(id), 120_000);
      const game: RpsGame = {
        id,
        challengerId: interaction.user.id,
        challengerName,
        challengerCharacterId: challenger.characterId,
        opponentId: opponent.id,
        opponentName,
        opponentCharacterId: target.characterId,
        bet,
        choices: new Map(),
        accepted: false,
        timeout
      };
      rpsGames.set(id, game);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`rps:accept:${id}`).setLabel('수락').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rps:decline:${id}`).setLabel('거절').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({
        content: `${opponent}님, ${challengerName}님이 가위바위보를 신청했습니다.${bet ? ` 베팅: ${bet}P` : ''}`,
        components: [row]
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '가위바위보 처리에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('rps:')) return false;
    const [, action, id, choice] = interaction.customId.split(':');
    const game = rpsGames.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 만료된 게임입니다.', flags: ephemeral });
      return true;
    }
    if (action === 'decline') {
      if (interaction.user.id !== game.opponentId) {
        await interaction.reply({ content: '도전받은 사람만 거절할 수 있습니다.', flags: ephemeral });
        return true;
      }
      clearTimeout(game.timeout);
      rpsGames.delete(id);
      await interaction.reply('가위바위보가 취소되었습니다.');
      return true;
    }
    if (action === 'accept') {
      if (interaction.user.id !== game.opponentId) {
        await interaction.reply({ content: '도전받은 사람만 수락할 수 있습니다.', flags: ephemeral });
        return true;
      }
      game.accepted = true;
      await interaction.reply({ content: '가위바위보 시작! 두 사람 모두 선택해주세요.', components: [choiceButtons(id)] });
      return true;
    }
    if (action === 'pick') {
      if (![game.challengerId, game.opponentId].includes(interaction.user.id)) {
        await interaction.reply({ content: '참가자만 선택할 수 있습니다.', flags: ephemeral });
        return true;
      }
      if (!game.accepted) {
        await interaction.reply({ content: '아직 수락되지 않은 게임입니다.', flags: ephemeral });
        return true;
      }
      game.choices.set(interaction.user.id, choice as RpsChoice);
      await interaction.reply({ content: '선택 완료.', flags: ephemeral });
      if (game.choices.size === 2) {
        const a = game.choices.get(game.challengerId)!;
        const b = game.choices.get(game.opponentId)!;
        const winner = rpsWinner(a, b);
        let result = `**가위바위보 결과**\n${game.challengerName}: ${rpsLabel(a)}\n${game.opponentName}: ${rpsLabel(b)}\n`;
        if (winner === 0) {
          result += '무승부!';
        } else {
          const winnerUser = winner === 1 ? { id: game.challengerId, name: game.challengerName } : { id: game.opponentId, name: game.opponentName };
          const loserUser = winner === 1 ? { id: game.opponentId, name: game.opponentName } : { id: game.challengerId, name: game.challengerName };
          if (game.bet > 0) {
            const loserCharacter = await getCharacter(winner === 1 ? game.opponentCharacterId : game.challengerCharacterId);
            const winnerCharacter = await getCharacter(winner === 1 ? game.challengerCharacterId : game.opponentCharacterId);
            if (!loserCharacter || !winnerCharacter) throw new Error('결투 캐릭터 정보를 찾을 수 없습니다.');
            await transferPoints(loserCharacter, winnerCharacter, game.bet);
          }
          const winnerCharacterId = winner === 1 ? game.challengerCharacterId : game.opponentCharacterId;
          const victoryEffect = await consumeSpecialEffects(winnerCharacterId, ['victory_bonus']);
          const victoryBonus = victoryEffect.get('victory_bonus')?.value ?? 0;
          if (victoryBonus > 0) await changePoints(winnerCharacterId, victoryBonus);
          result += `승자: **${winnerUser.name}**${game.bet ? ` (+${game.bet}P)` : ''}${victoryBonus ? `\n승부 부적 보너스: +${victoryBonus}P` : ''}`;
        }
        clearTimeout(game.timeout);
        rpsGames.delete(id);
        await interaction.followUp(result);
      }
      return true;
    }
    return true;
  }
};
