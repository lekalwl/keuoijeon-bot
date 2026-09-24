import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, type Message } from 'discord.js';
import { consumeBait, ensureFishingReady, grantFishingReward, type FishingRarity } from '../services/fishing.js';
import { requireActiveCharacter } from '../services/characters.js';
import { randomInt } from '../utils/random.js';
import { ephemeral, safeErrorReply } from '../utils/reply.js';
import { consumeSpecialEffects } from '../services/specialEffects.js';
import type { BotCommand } from './types.js';

interface FishingGame {
  id: string;
  userId: string;
  characterId: string;
  characterName: string;
  active: boolean;
  targets: Map<number, FishingRarity>;
  message: Message;
  rewardMultiplier: number;
  upgradeChance: number;
  timeout?: NodeJS.Timeout;
}

const games = new Map<string, FishingGame>();
const LABELS: Record<FishingRarity, string> = { YELLOW: '🟨', GREEN: '🟩', RED: '🟥' };

function drawColor(): FishingRarity {
  const roll = randomInt(1, 100);
  if (roll <= 10) return 'RED';
  if (roll <= 40) return 'GREEN';
  return 'YELLOW';
}

function board(id: string, targets = new Map<number, FishingRarity>(), disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  return Array.from({ length: 5 }, (_, rowIndex) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let column = 0; column < 5; column += 1) {
      const index = rowIndex * 5 + column;
      const color = targets.get(index);
      const button = new ButtonBuilder().setCustomId(`fishing:pick:${id}:${index}`).setDisabled(disabled);
      if (color === 'RED') button.setStyle(ButtonStyle.Danger).setLabel(LABELS.RED);
      else if (color === 'GREEN') button.setStyle(ButtonStyle.Success).setLabel(LABELS.GREEN);
      else if (color === 'YELLOW') button.setStyle(ButtonStyle.Secondary).setLabel(LABELS.YELLOW);
      else button.setStyle(ButtonStyle.Primary).setLabel('•');
      row.addComponents(button);
    }
    return row;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const fishingCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('낚시').setDescription('미끼 1개를 사용해 타이밍 낚시를 시작합니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      await ensureFishingReady();
      const character = await requireActiveCharacter(interaction.user.id);
      await consumeBait(character.characterId);
      const special = await consumeSpecialEffects(character.characterId, [
        'fishing_upgrade',
        'fishing_time',
        'fishing_double',
        'fishing_extra_target'
      ]);
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const message = await interaction.editReply({
        content: '**낚시 중...**\n물고기가 나타날 때까지 기다리세요! 미끼 1개를 사용했습니다.',
        components: board(id)
      });
      const game: FishingGame = {
        id,
        userId: interaction.user.id,
        characterId: character.characterId,
        characterName: character.characterName,
        active: false,
        targets: new Map(),
        message
        ,rewardMultiplier: Math.max(1, special.get('fishing_double')?.value ?? 1)
        ,upgradeChance: special.get('fishing_upgrade')?.chance ?? 0
      };
      games.set(id, game);
      await delay(randomInt(1_000, 5_000));
      if (!games.has(id)) return;
      const targetCount = special.has('fishing_extra_target') ? 3 : 2;
      while (game.targets.size < targetCount) game.targets.set(randomInt(0, 24), drawColor());
      game.active = true;
      await message.edit({ content: '**입질이다!**\n색이 나타난 칸을 재빨리 누르세요!', components: board(id, game.targets) });
      game.timeout = setTimeout(() => {
        if (!games.delete(id)) return;
        message
          .edit({ content: '**첨벙!**\n고기는 수면 아래로 사라졌다.', components: board(id, game.targets, true) })
          .catch((error) => console.error('Failed to close fishing game:', error));
      }, 2_000 + Math.max(0, special.get('fishing_time')?.value ?? 0) * 1_000);
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '낚시에 실패했습니다.');
    }
  },
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('fishing:pick:')) return false;
    const [, , id, rawIndex] = interaction.customId.split(':');
    const game = games.get(id);
    if (!game) {
      await interaction.reply({ content: '이미 끝난 낚시입니다.', flags: ephemeral });
      return true;
    }
    if (interaction.user.id !== game.userId) {
      await interaction.reply({ content: '낚시를 시작한 사람만 누를 수 있습니다.', flags: ephemeral });
      return true;
    }
    if (!game.active) {
      await interaction.reply({ content: '아직 입질이 오지 않았습니다!', flags: ephemeral });
      return true;
    }
    if (game.timeout) clearTimeout(game.timeout);
    games.delete(id);
    let color = game.targets.get(Number.parseInt(rawIndex, 10));
    if (!color) {
      await interaction.update({ content: '**낚시 실패!**\n파란 칸을 건드리는 사이 물고기가 도망갔습니다.', components: board(id, game.targets, true) });
      return true;
    }
    try {
      await interaction.deferUpdate();
      const upgraded = color === 'YELLOW' && game.upgradeChance > 0 && randomInt(1, 100) <= game.upgradeChance;
      if (upgraded) color = 'GREEN';
      const reward = await grantFishingReward(game.characterId, color, game.rewardMultiplier);
      await interaction.editReply({
        content: `${LABELS[color]} **${game.characterName}의 낚시 성공!**${upgraded ? '\n고급 미끼의 효과로 보상이 초록 등급으로 올랐습니다!' : ''}\n**${reward.item.itemName} x${reward.quantity}**을 획득했습니다.`,
        components: board(id, game.targets, true)
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '낚시 보상 지급에 실패했습니다.');
    }
    return true;
  }
};
