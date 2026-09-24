import { SlashCommandBuilder } from 'discord.js';
import { requireActiveCharacter } from '../services/characters.js';
import { getInventory } from '../services/inventory.js';
import { formatPoints } from '../utils/format.js';
import { safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

export const inventoryCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('인벤토리')
    .setDescription('현재 캐릭터의 포인트와 아이템을 확인합니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const character = await requireActiveCharacter(interaction.user.id);
      const entries = await getInventory(character.characterId);
      const lines = entries.length === 0 ? ['- 보유 아이템 없음'] : entries.map((entry) => `- ${entry.item.itemName} x${entry.quantity}`);
      await interaction.editReply({
        content: `**${character.characterName} 인벤토리**\n보유 포인트: **${formatPoints(character.points)}**\n\n아이템\n${lines.join('\n')}`
      });
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '인벤토리 확인에 실패했습니다.');
    }
  }
};
