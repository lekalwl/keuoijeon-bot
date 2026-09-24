import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { displayNameForUser, interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

type SuitChoice = 'spade' | 'heart' | 'club' | 'diamond';

interface SuitDuelGame {
  id: string;
  challengerId: string;
  challengerName: string;
  opponentId: string;
  opponentName: string;
  hp: Map<string, number>;
  choices: Map<string, SuitChoice>;
  accepted: boolean;
  timeout: NodeJS.Timeout;
}

const games = new Map<string, SuitDuelGame>();

const suitLabels: Record<SuitChoice, string> = {
  spade: '♠ 스페이드',
  heart: '♥ 하트',
  club: '♣ 클로버',
  diamond: '♦ 다이아몬드'
};

function hpBar(hp: number): string {
  const filled = Math.max(0, Math.min(4, Math.ceil(hp / 25)));
  return `${'◆'.repeat(filled)}${'◇'.repeat(4 - filled)} ${hp}%`;
}

function buttons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suit:pick:${id}:spade`).setLabel('♠ 스페이드').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`suit:pick:${id}:heart`).setLabel('♥ 하트').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`suit:pick:${id}:club`).setLabel('♣ 클로버').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`suit:pick:${id}:diamond`).setLabel('♦ 다이아').setStyle(ButtonStyle.Primary)
  );
}

function status(game: SuitDuelGame): string {
  return `${game.challengerName}: ${hpBar(game.hp.get(game.challengerId) ?? 100)}\n${game.opponentName}: ${hpBar(game.hp.get(game.opponentId) ?? 100)}`;
}

function roundWinner(a: SuitChoice, b: SuitChoice): 0 | 1 | 2 {
  if (a === b) return 0;
  if (
    (a === 'spade' && b === 'heart') ||
    (a === 'heart' && b === 'club') ||
    (a === 'club' && b === 'diamond') ||
    (a === 'diamond' && b === 'spade')
  ) {
    return 1;
  }
  return 2;
}

export const suitDuelCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('문양대결')
    .setDescription('스페이드/하트/클로버/다이아몬드 상성으로 축제 대결을 합니다.')
    .addUserOption((option) => option.setName('상대').setDescription('상대').setRequired(true)),
  async execute(interaction) {
    const opponent = interaction.options.getUser('상대', true);
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.reply({ content: '이 상대와는 문양대결을 할 수 없습니다.', flags: ephemeral });
      return;
    }

    await interaction.deferReply();
    try {
      const challengerName = interactionDisplayName(interaction);
      const opponentName = await displayNameForUser(interaction, opponent);
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const timeout = setTimeout(() => games.delete(id), 300_000);
      games.set(id, {
        id,
        challengerId: interaction.user.id,
        challengerName,
        opponentId: opponent.id,
        opponentName,
        hp: new Map([
          [interaction.user.id, 100],
          [opponent.id, 100]
        ]),
        choices: new Map(),
        accepted: false,
        timeout
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`suit:accept:${id}`).setLabel('참가').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`suit:decline:${id}`).setLabel('거절').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({
        content: `🎪 **문양대결 신청**\n${opponent}님, ${challengerName}님이 문양대결을 신청했습니다.\n♠ > ♥ > ♣ > ♦ > ♠`,
        components: [row]
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '문양대결 처리에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('suit:')) return false;
    const [, action, id, choice] = interaction.customId.split(':');
    const game = games.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 만료된 문양대결입니다.', flags: ephemeral });
      return true;
    }

    if (action === 'decline') {
      if (interaction.user.id !== game.opponentId) {
        await interaction.reply({ content: '초대받은 사람만 거절할 수 있습니다.', flags: ephemeral });
        return true;
      }
      clearTimeout(game.timeout);
      games.delete(id);
      await interaction.reply('문양대결이 취소되었습니다.');
      return true;
    }

    if (action === 'accept') {
      if (interaction.user.id !== game.opponentId) {
        await interaction.reply({ content: '초대받은 사람만 참가할 수 있습니다.', flags: ephemeral });
        return true;
      }
      game.accepted = true;
      await interaction.reply({ content: `🎴 **문양대결 시작!**\n${status(game)}\n\n둘 다 문양을 선택해주세요.`, components: [buttons(id)] });
      return true;
    }

    if (action === 'pick') {
      if (!game.accepted || ![game.challengerId, game.opponentId].includes(interaction.user.id)) {
        await interaction.reply({ content: '문양대결 참가자만 선택할 수 있습니다.', flags: ephemeral });
        return true;
      }
      game.choices.set(interaction.user.id, choice as SuitChoice);
      await interaction.reply({ content: '문양 선택 완료.', flags: ephemeral });

      if (game.choices.size === 2) {
        const a = game.choices.get(game.challengerId)!;
        const b = game.choices.get(game.opponentId)!;
        const winner = roundWinner(a, b);
        let text = `🎴 **문양대결 라운드**\n${game.challengerName}: ${suitLabels[a]}\n${game.opponentName}: ${suitLabels[b]}\n`;
        if (winner === 0) {
          text += '같은 문양입니다. 체력 변화 없음.\n';
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
          const winnerName = challengerHp > 0 ? game.challengerName : game.opponentName;
          text += `\n\n🏆 최종 승자: **${winnerName}**`;
          clearTimeout(game.timeout);
          games.delete(id);
          await interaction.followUp(text);
        } else {
          await interaction.followUp({ content: `${text}\n\n다음 문양을 선택해주세요.`, components: [buttons(id)] });
        }
      }
      return true;
    }

    return true;
  }
};
