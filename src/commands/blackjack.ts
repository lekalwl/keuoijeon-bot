import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import {
  blackjackGames,
  createBlackjackGame,
  dealerPlay,
  draw,
  formatCards,
  handValue,
  isNaturalBlackjack,
  type BlackjackGame
} from '../games/blackjack.js';
import { changePointsAndRecordDailyGamblingLoss, getUser } from '../services/economy.js';
import { formatPoints } from '../utils/format.js';
import { interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

function controls(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`bj:hit:${id}`).setLabel('히트').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj:stand:${id}`).setLabel('스탠드').setStyle(ButtonStyle.Secondary)
  );
}

function view(game: BlackjackGame, revealDealer = false): string {
  const dealerValue = revealDealer ? handValue(game.dealer) : '?';
  return `**블랙잭 ${formatPoints(game.bet)}**\n플레이어: ${formatCards(game.player)} (${handValue(game.player)})\n딜러: ${formatCards(game.dealer, !revealDealer)} (${dealerValue})`;
}

async function finish(game: BlackjackGame, reason?: string): Promise<string> {
  game.finished = true;
  dealerPlay(game);
  const player = handValue(game.player);
  const dealer = handValue(game.dealer);
  let net = 0;
  let label = reason ?? '';
  if (!label) {
    if (player > 21) label = '버스트! 패배입니다.';
    else if (dealer > 21 || player > dealer) label = '승리!';
    else if (player < dealer) label = '패배입니다.';
    else label = '무승부입니다.';
  }
  if (label.includes('승리')) {
    net = isNaturalBlackjack(game.player) ? Math.floor(game.bet * 1.5) : game.bet;
  } else if (label.includes('패배') || label.includes('버스트')) {
    net = -game.bet;
  }
  const { lostToday } = await changePointsAndRecordDailyGamblingLoss(game.userId, game.userName, net, net < 0 ? Math.abs(net) : 0);
  blackjackGames.delete(game.id);
  const delta = net === 0 ? '0P' : net > 0 ? `+${formatPoints(net)}` : `-${formatPoints(Math.abs(net))}`;
  return `${view(game, true)}\n${label}\n포인트 변화: **${delta}**\n오늘 잃은 포인트: **${formatPoints(lostToday)}**`;
}

export const blackjackCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('블랙잭')
    .setDescription('포인트를 걸고 블랙잭을 합니다.')
    .addIntegerOption((option) => option.setName('베팅').setDescription('베팅 포인트').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const bet = interaction.options.getInteger('베팅', true);
    await interaction.deferReply();
    try {
      const displayName = interactionDisplayName(interaction);
      const account = await getUser(interaction.user.id, displayName);
      if (account.points < bet) {
        throw new Error('포인트가 부족합니다.');
      }
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const game = createBlackjackGame(id, interaction.user.id, displayName, bet);
      if (isNaturalBlackjack(game.player)) {
        await interaction.editReply(await finish(game, '자연 블랙잭 승리!'));
        return;
      }
      setTimeout(() => {
        blackjackGames.delete(id);
      }, 180_000);
      await interaction.editReply({ content: view(game), components: [controls(id)] });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '블랙잭 처리에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('bj:')) return false;
    const [, action, id] = interaction.customId.split(':');
    const game = blackjackGames.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 만료된 게임입니다.', flags: ephemeral });
      return true;
    }
    if (interaction.user.id !== game.userId) {
      await interaction.reply({ content: '게임을 시작한 사람만 조작할 수 있습니다.', flags: ephemeral });
      return true;
    }
    await interaction.deferReply();
    try {
      if (action === 'hit') {
        game.player.push(draw(game));
        if (handValue(game.player) > 21) {
          await interaction.editReply(await finish(game, '버스트! 패배입니다.'));
        } else {
          await interaction.editReply({ content: view(game), components: [controls(id)] });
        }
        return true;
      }
      if (action === 'stand') {
        await interaction.editReply(await finish(game));
        return true;
      }
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '블랙잭 처리에 실패했습니다.');
    }
    return true;
  }
};
