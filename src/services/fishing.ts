import { getCachedRows } from './staticSheetCache.js';
import { addItem, removeItem } from './inventory.js';
import { getItemById, getItemByName, type Item } from './items.js';
import { randomInt } from '../utils/random.js';

export type FishingRarity = 'YELLOW' | 'GREEN' | 'RED';

export interface FishingReward {
  rarity: FishingRarity;
  item: Item;
  quantity: number;
}

interface RewardDefinition {
  rarity: FishingRarity;
  itemId: string;
  weight: number;
  minQty: number;
  maxQty: number;
}

function rarity(value: string): value is FishingRarity {
  return ['YELLOW', 'GREEN', 'RED'].includes(value);
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function definitions(): Promise<RewardDefinition[]> {
  const rows = await getCachedRows('FishingRewards');
  return rows
    .filter((row) => rarity((row.rarity ?? '').trim().toUpperCase()) && row.item_id)
    .map((row) => {
      const minQty = positive(row.min_qty, 1);
      return {
        rarity: row.rarity.trim().toUpperCase() as FishingRarity,
        itemId: row.item_id.trim(),
        weight: positive(row.weight, 1),
        minQty,
        maxQty: Math.max(minQty, positive(row.max_qty, minQty))
      };
    });
}

export async function ensureFishingReady(): Promise<void> {
  const rewards = await definitions();
  for (const color of ['YELLOW', 'GREEN', 'RED'] as FishingRarity[]) {
    if (!rewards.some((reward) => reward.rarity === color)) {
      throw new Error(`FishingRewards 시트에 ${color} 보상을 하나 이상 등록해주세요.`);
    }
  }
  if (!(await getItemByName('미끼'))) {
    throw new Error('Items 시트에 이름이 "미끼"인 아이템을 등록해주세요.');
  }
  for (const reward of rewards) {
    if (!(await getItemById(reward.itemId))) {
      throw new Error(`FishingRewards의 아이템 ID "${reward.itemId}"를 Items 시트에서 찾을 수 없습니다.`);
    }
  }
}

export async function consumeBait(characterId: string): Promise<void> {
  const bait = await getItemByName('미끼');
  if (!bait) throw new Error('미끼 아이템 설정을 찾을 수 없습니다.');
  await removeItem(characterId, bait.itemId, 1);
}

export async function grantFishingReward(characterId: string, color: FishingRarity, quantityMultiplier = 1): Promise<FishingReward> {
  const candidates = (await definitions()).filter((reward) => reward.rarity === color);
  const total = candidates.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = randomInt(1, total);
  let selected = candidates[0];
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      selected = candidate;
      break;
    }
  }
  const item = await getItemById(selected.itemId);
  if (!item) throw new Error(`FishingRewards의 아이템 ID "${selected.itemId}"를 Items 시트에서 찾을 수 없습니다.`);
  const quantity = randomInt(selected.minQty, selected.maxQty) * Math.max(1, Math.floor(quantityMultiplier));
  await addItem(characterId, item.itemId, quantity);
  return { rarity: color, item, quantity };
}
