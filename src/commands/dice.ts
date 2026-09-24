import { SlashCommandBuilder } from 'discord.js';
import { rollDice } from '../games/dice.js';
import { baseStatBonus, getActiveCharacter, requireActiveCharacter, type StatKey } from '../services/characters.js';
import { statEffectBonus } from '../services/effects.js';
import { consumeSpecialEffects } from '../services/specialEffects.js';
import type { BotCommand } from './types.js';

export const diceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('r')
    .setDescription('주사위를 굴립니다. 예: 3d6+2')
    .addStringOption((option) => option.setName('식').setDescription('nDn 또는 nDn+숫자 형식').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('스탯')
        .setDescription('판정에 적용할 스탯')
        .setRequired(false)
        .addChoices(
          { name: '힘', value: 'strength' },
          { name: '민첩', value: 'agility' },
          { name: '손재주', value: 'dexterity' },
          { name: '행운', value: 'luck' },
          { name: '개인특기', value: 'personal_trait' }
        )
    ),
  async execute(interaction) {
    try {
      const roll = rollDice(interaction.options.getString('식', true));
      const op = roll.operator ? `${roll.operator}${roll.operand}` : '';
      const stat = interaction.options.getString('스탯') as StatKey | null;
      await interaction.deferReply();
      const selected = await getActiveCharacter(interaction.user.id);
      const special = selected ? await consumeSpecialEffects(selected.characterId, ['dice_bonus']) : new Map();
      const diceBonus = special.get('dice_bonus')?.value ?? 0;
      if (!stat) {
        await interaction.editReply(`🎲 **${roll.count}d${roll.sides}${op}**\n결과: ${roll.rolls.join(', ')}\n합계: ${roll.sum}${diceBonus ? `\n행운의 주사위: +${diceBonus}` : ''}\n최종: **${roll.final + diceBonus}**`);
        return;
      }
      const character = await requireActiveCharacter(interaction.user.id);
      const baseBonus = baseStatBonus(character, stat);
      const active = await statEffectBonus(character.characterId, stat);
      const label = stat === 'strength' ? '힘' : stat === 'agility' ? '민첩' : stat === 'dexterity' ? '손재주' : stat === 'luck' ? '행운' : character.personalTraitName;
      const lines = [
        `🎲 **${character.characterName}의 ${label} 판정**`,
        `주사위: ${roll.rolls.join(', ')} (계산 결과 ${roll.final})`,
        `기본 보정: ${baseBonus >= 0 ? '+' : ''}${baseBonus}`
      ];
      if (stat === 'personal_trait') lines.push(`개인특기: ${character.personalTraitText}`);
      if (active.effects.length) {
        lines.push(`효과 보정: ${active.total >= 0 ? '+' : ''}${active.total} (${active.effects.map((effect) => effect.effectName).join(', ')})`);
      }
      if (diceBonus) lines.push(`행운의 주사위: +${diceBonus}`);
      lines.push(`최종: **${roll.final + baseBonus + active.total + diceBonus}**`);
      await interaction.editReply(lines.join('\n'));
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: error instanceof Error ? error.message : '주사위 처리 중 오류가 났습니다.', ephemeral: true });
      } else {
        await interaction.reply({ content: error instanceof Error ? error.message : '주사위 처리 중 오류가 났습니다.', ephemeral: true });
      }
    }
  }
};
