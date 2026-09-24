import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, type User } from 'discord.js';
import { addItem, removeItem } from '../services/inventory.js';
import { getItemByName } from '../services/items.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

type PokerAction = 'bet' | 'call' | 'fold';

interface PlayerState {
  id: string;
  name: string;
  user: User;
  cards: string[];
}

interface IndianPokerGame {
  id: string;
  medalItemId: string;
  pot: number;
  challenger: PlayerState;
  opponent: PlayerState;
  accepted: boolean;
  actions: Map<string, PokerAction>;
  timeout: NodeJS.Timeout;
}

const games = new Map<string, IndianPokerGame>();

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♠', '♥', '♣', '♦'];

function makeDeck(): string[] {
  return suits.flatMap((suit) => ranks.map((rank) => `${suit}${rank}`)).sort(() => Math.random() - 0.5);
}

function cardValue(card: string): number {
  const rank = card.slice(1);
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return Number.parseInt(rank, 10);
}

function handValue(cards: string[]): number {
  return cards.reduce((total, card) => total + cardValue(card), 0);
}

function actionButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ipoker:action:${id}:bet`).setLabel('메달 1개 더 걸기').setEmoji('🏅').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ipoker:action:${id}:call`).setLabel('콜 / 오픈').setEmoji('🃏').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ipoker:action:${id}:fold`).setLabel('폴드').setEmoji('🏳').setStyle(ButtonStyle.Secondary)
  );
}

function playerLine(player: PlayerState): string {
  return `${player.name}: ${player.cards.join(', ')} (${handValue(player.cards)})`;
}

async function sendDm(game: IndianPokerGame, player: PlayerState): Promise<void> {
  await player.user.send({
    content: `🃏 **인디언 포커**\n내 패: **${player.cards.join('  ')}**\n현재 판돈: **메달 ${game.pot}개**\n\n행동을 선택해주세요.`,
    components: [actionButtons(game.id)]
  });
}

async function finishByFold(game: IndianPokerGame, folderId: string): Promise<string> {
  const winner = folderId === game.challenger.id ? game.opponent : game.challenger;
  await addItem(winner.id, game.medalItemId, game.pot);
  clearTimeout(game.timeout);
  games.delete(game.id);
  return `🃏 **인디언 포커 종료**\n${folderId === game.challenger.id ? game.challenger.name : game.opponent.name}님이 폴드했습니다.\n승자: **${winner.name}**\n획득: **메달 ${game.pot}개**`;
}

async function finishByShowdown(game: IndianPokerGame): Promise<string> {
  const challengerValue = handValue(game.challenger.cards);
  const opponentValue = handValue(game.opponent.cards);
  clearTimeout(game.timeout);
  games.delete(game.id);

  if (challengerValue === opponentValue) {
    const half = Math.floor(game.pot / 2);
    await addItem(game.challenger.id, game.medalItemId, half);
    await addItem(game.opponent.id, game.medalItemId, game.pot - half);
    return `🃏 **인디언 포커 오픈**\n${playerLine(game.challenger)}\n${playerLine(game.opponent)}\n무승부! 메달을 나눠 가졌습니다.`;
  }

  const winner = challengerValue > opponentValue ? game.challenger : game.opponent;
  await addItem(winner.id, game.medalItemId, game.pot);
  return `🃏 **인디언 포커 오픈**\n${playerLine(game.challenger)}\n${playerLine(game.opponent)}\n승자: **${winner.name}**\n획득: **메달 ${game.pot}개**`;
}

export const indianPokerCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('인디언포커')
    .setDescription('메달을 걸고 DM으로 패를 받은 뒤 베팅/콜/폴드를 선택합니다.')
    .addUserOption((option) => option.setName('상대').setDescription('상대').setRequired(true))
    .addIntegerOption((option) => option.setName('메달').setDescription('처음 걸 메달 수').setRequired(false).setMinValue(1).setMaxValue(10)),
  async execute(interaction) {
    const opponent = interaction.options.getUser('상대', true);
    const medalBet = interaction.options.getInteger('메달') ?? 1;
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.reply({ content: '이 상대와는 인디언 포커를 할 수 없습니다.', flags: ephemeral });
      return;
    }

    await interaction.deferReply();
    try {
      const medal = await getItemByName('메달');
      if (!medal) {
        throw new Error('Items 시트에 이름이 정확히 "메달"인 아이템이 필요합니다.');
      }
      const challengerName = interactionDisplayName(interaction);
      const opponentName = await displayNameForUser(interaction, opponent);
      const deck = makeDeck();
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const timeout = setTimeout(() => games.delete(id), 300_000);
      games.set(id, {
        id,
        medalItemId: medal.itemId,
        pot: medalBet * 2,
        challenger: { id: interaction.user.id, name: challengerName, user: interaction.user, cards: [deck.pop()!, deck.pop()!] },
        opponent: { id: opponent.id, name: opponentName, user: opponent, cards: [deck.pop()!, deck.pop()!] },
        accepted: false,
        actions: new Map(),
        timeout
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ipoker:accept:${id}`).setLabel('참가').setEmoji('🃏').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ipoker:decline:${id}`).setLabel('거절').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({
        content: `🃏 **인디언 포커 신청**\n${opponent}님, ${challengerName}님이 인디언 포커를 신청했습니다.\n참가비: 각자 **메달 ${medalBet}개**`,
        components: [row]
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '인디언 포커 처리에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('ipoker:')) return false;
    const [, action, id, choice] = interaction.customId.split(':');
    const game = games.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 만료된 인디언 포커입니다.', flags: ephemeral });
      return true;
    }

    if (action === 'decline') {
      if (interaction.user.id !== game.opponent.id) {
        await interaction.reply({ content: '초대받은 사람만 거절할 수 있습니다.', flags: ephemeral });
        return true;
      }
      clearTimeout(game.timeout);
      games.delete(id);
      await interaction.reply('인디언 포커가 취소되었습니다.');
      return true;
    }

    if (action === 'accept') {
      if (interaction.user.id !== game.opponent.id) {
        await interaction.reply({ content: '초대받은 사람만 참가할 수 있습니다.', flags: ephemeral });
        return true;
      }
      let removedChallenger = false;
      let removedOpponent = false;
      try {
        const entryBet = game.pot / 2;
        await removeItem(game.challenger.id, game.medalItemId, entryBet);
        removedChallenger = true;
        await removeItem(game.opponent.id, game.medalItemId, entryBet);
        removedOpponent = true;
        game.accepted = true;
        await sendDm(game, game.challenger);
        await sendDm(game, game.opponent);
        await interaction.update({ content: `🃏 **인디언 포커 시작!**\n두 참가자에게 DM으로 패와 행동 버튼을 보냈습니다.\n현재 판돈: **메달 ${game.pot}개**`, components: [] });
      } catch (error) {
        const entryBet = game.pot / 2;
        if (removedChallenger) {
          await addItem(game.challenger.id, game.medalItemId, entryBet).catch((refundError) => console.error('Failed to refund challenger medals:', refundError));
        }
        if (removedOpponent) {
          await addItem(game.opponent.id, game.medalItemId, entryBet).catch((refundError) => console.error('Failed to refund opponent medals:', refundError));
        }
        clearTimeout(game.timeout);
        games.delete(id);
        await safeErrorReply(interaction, error instanceof Error ? error.message : '메달이 부족하거나 DM을 보낼 수 없습니다.');
      }
      return true;
    }

    if (action === 'action') {
      if (!game.accepted || ![game.challenger.id, game.opponent.id].includes(interaction.user.id)) {
        await interaction.reply({ content: '인디언 포커 참가자만 선택할 수 있습니다.', flags: ephemeral });
        return true;
      }
      try {
        if (choice === 'fold') {
          await interaction.reply(await finishByFold(game, interaction.user.id));
          return true;
        }
        if (choice === 'bet') {
          await removeItem(interaction.user.id, game.medalItemId, 1);
          game.pot += 1;
        }
        game.actions.set(interaction.user.id, choice as PokerAction);
        await interaction.reply({ content: `선택 완료: ${choice === 'bet' ? '메달 1개 추가 베팅' : '콜 / 오픈'}`, flags: ephemeral });

        if (game.actions.size === 2) {
          await interaction.followUp(await finishByShowdown(game));
        }
      } catch (error) {
        await safeErrorReply(interaction, error instanceof Error ? error.message : '인디언 포커 처리에 실패했습니다.');
      }
      return true;
    }

    return true;
  }
};
