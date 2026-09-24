import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { interactionDisplayName } from '../utils/names.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

interface ShootingGame {
  userId: string;
  userName: string;
  score: number;
  endAt: number;
}

const games = new Map<string, ShootingGame>();

function randomTargets(): { green: number; reds: Set<number> } {
  const green = Math.floor(Math.random() * 25);
  const reds = new Set<number>();
  while (reds.size < 4) {
    const value = Math.floor(Math.random() * 25);
    if (value !== green) reds.add(value);
  }
  return { green, reds };
}

function grid(id: string): ActionRowBuilder<ButtonBuilder>[] {
  const { green, reds } = randomTargets();
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let y = 0; y < 5; y += 1) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let x = 0; x < 5; x += 1) {
      const index = y * 5 + x;
      const type = index === green ? 'g' : reds.has(index) ? 'r' : 'b';
      const label = index === green ? '🟩' : reds.has(index) ? '🟥' : '⬛';
      const style = index === green ? ButtonStyle.Success : reds.has(index) ? ButtonStyle.Danger : ButtonStyle.Secondary;
      row.addComponents(new ButtonBuilder().setCustomId(`shoot:${id}:${index}:${type}`).setLabel(label).setStyle(style));
    }
    rows.push(row);
  }
  return rows;
}

function content(game: ShootingGame): string {
  const remaining = Math.max(0, Math.ceil((game.endAt - Date.now()) / 1000));
  return `🎯 **사격장**\n${game.userName}님 점수: **${game.score}점**\n남은 시간: **${remaining}초**\n🟩 +1점 / 🟥 -1점`;
}

export const shootingGalleryCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('사격장').setDescription('30초 동안 초록색 표적을 누르는 축제 사격 게임입니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const game: ShootingGame = {
        userId: interaction.user.id,
        userName: interactionDisplayName(interaction),
        score: 0,
        endAt: Date.now() + 30_000
      };
      games.set(id, game);
      setTimeout(() => games.delete(id), 35_000);
      await interaction.editReply({ content: content(game), components: grid(id) });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '사격장 처리에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('shoot:')) return false;
    const [, id, , type] = interaction.customId.split(':');
    const game = games.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 끝난 사격장입니다.', flags: ephemeral });
      return true;
    }
    if (interaction.user.id !== game.userId) {
      await interaction.reply({ content: '사격장을 시작한 사람만 누를 수 있습니다.', flags: ephemeral });
      return true;
    }

    if (Date.now() >= game.endAt) {
      games.delete(id);
      await interaction.update({ content: `🎯 **사격 종료!**\n${game.userName}님 최종 점수: **${game.score}점**`, components: [] });
      return true;
    }

    if (type === 'g') game.score += 1;
    if (type === 'r') game.score -= 1;
    await interaction.update({ content: content(game), components: grid(id) });
    return true;
  }
};
