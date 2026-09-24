import { SlashCommandBuilder } from 'discord.js';
import { removeItem } from '../services/inventory.js';
import { getItemByName } from '../services/items.js';
import { pickOne } from '../utils/random.js';
import { interactionDisplayName } from '../utils/names.js';
import { safeErrorReply } from '../utils/reply.js';
import type { BotCommand } from './types.js';

interface Fortune {
  name: string;
  icon: string;
  weight: number;
  advice: string[];
}

const fortunes: Fortune[] = [
  {
    name: '대길',
    icon: '🌸',
    weight: 8,
    advice: ['오늘은 먼저 말을 걸면 좋은 일이 생길지도.', '기다리던 답이 예상보다 부드럽게 돌아옵니다.', '반짝이는 쪽을 따라가보세요.']
  },
  {
    name: '중길',
    icon: '✨',
    weight: 18,
    advice: ['무난하지만 든든한 날입니다. 작은 약속을 지켜보세요.', '익숙한 장소에서 의외의 단서를 볼 수 있습니다.', '급하게 움직이기보다 한 박자 늦게 보는 쪽이 좋습니다.']
  },
  {
    name: '소길',
    icon: '🍀',
    weight: 24,
    advice: ['작은 이득이 쌓이는 날입니다.', '가벼운 장난이나 농담이 분위기를 풀어줄 수 있습니다.', '잃어버린 줄 알았던 것을 다시 확인해보세요.']
  },
  {
    name: '길',
    icon: '🏮',
    weight: 22,
    advice: ['평범한 선택이 제일 안정적입니다.', '사람이 많은 곳에서 흐름을 타면 좋습니다.', '오늘은 너무 큰 승부보다 소소한 재미가 어울립니다.']
  },
  {
    name: '말길',
    icon: '🪭',
    weight: 14,
    advice: ['좋은 일과 귀찮은 일이 같이 옵니다.', '농담처럼 넘긴 말에 뜻밖의 힌트가 있을 수 있습니다.', '확신이 안 서면 한 번 더 물어보세요.']
  },
  {
    name: '흉',
    icon: '🌧',
    weight: 9,
    advice: ['오늘은 무리하지 않는 게 이득입니다.', '반짝이는 물건이라고 다 좋은 것은 아닙니다.', '큰 베팅은 내일의 자신에게 미뤄도 됩니다.']
  },
  {
    name: '대흉',
    icon: '🕯',
    weight: 5,
    advice: ['조심하세요. 자동문도 가끔은 사람을 놀립니다.', '수상한 버튼은 누르기 전에 한 번 더 생각하세요.', '오늘의 불운은 이야기거리가 될지도 모릅니다.']
  }
];

function drawFortune(): Fortune {
  const totalWeight = fortunes.reduce((total, fortune) => total + fortune.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const fortune of fortunes) {
    roll -= fortune.weight;
    if (roll <= 0) {
      return fortune;
    }
  }
  return fortunes[fortunes.length - 1];
}

export const omikujiCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('오미쿠지').setDescription('메달 1개를 소모해 오늘의 운세를 뽑습니다.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const medal = await getItemByName('메달');
      if (!medal) {
        throw new Error('Items 시트에 이름이 정확히 "메달"인 아이템이 필요합니다.');
      }

      await removeItem(interaction.user.id, medal.itemId, 1);
      const fortune = drawFortune();
      const advice = pickOne(fortune.advice);
      const displayName = interactionDisplayName(interaction);

      await interaction.editReply(
        `⛩️ **오미쿠지**\n${displayName}님이 메달 1개를 넣고 운세 종이를 뽑았습니다.\n\n${fortune.icon} 결과: **${fortune.name}**\n💬 조언: ${advice}`
      );
    } catch (error) {
      await safeErrorReply(interaction, error instanceof Error ? error.message : '오미쿠지 처리에 실패했습니다.');
    }
  }
};
