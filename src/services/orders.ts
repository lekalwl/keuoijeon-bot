import { todayKey } from '../utils/format.js';
import { pickOne } from '../utils/random.js';
import { addItem } from './inventory.js';
import { getItemByName } from './items.js';
import { withLock } from './locks.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';

const DAILY_ORDER_LIMIT = 4;

export type OrderChoice = 'grace' | 'mercy' | 'flattery' | 'fiction' | 'usual';

interface OrderDefinition {
  label: string;
  itemNames: string[];
  text: string;
}

const orderDefinitions: Record<OrderChoice, OrderDefinition> = {
  grace: {
    label: '은혜',
    itemNames: ['제병'],
    text: '가이드는 가볍게 고갤 끄덕이고, 허공에서 제병을 가져다준다.'
  },
  mercy: {
    label: '자애로움',
    itemNames: ['피의 맹세'],
    text: '가이드는 가볍게 고갤 끄덕이고, 와인잔으로 분수대에서 액체를 퍼낸다.'
  },
  flattery: {
    label: '아첨',
    itemNames: ['감언이설'],
    text: '가이드는 가볍게 고갤 끄덕이고, 손틈사이로 속삭임을 불어넣는다.'
  },
  fiction: {
    label: '허구',
    itemNames: ['강한 신념'],
    text: '가이드는 가볍게 고갤 끄덕이고, 당신의 이상을 나무에서 따온다.'
  },
  usual: {
    label: '항상 먹던 걸로',
    itemNames: ['제병', '피의 맹세', '감언이설', '강한 신념', '구버거', '구버 쿠키'],
    text: '.... 가이드는 잠시 당신을 지그시 보다, 이내 당신에게 환상을 내민다.'
  }
};

function positiveInt(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function orderLabel(choice: OrderChoice): string {
  return orderDefinitions[choice].label;
}

export async function placeOrder(userId: string, displayName: string, choice: OrderChoice): Promise<{ text: string; itemName: string; remaining: number }> {
  return withLock(`order:${userId}`, async () => {
    const definition = orderDefinitions[choice];
    if (!definition) {
      throw new Error('알 수 없는 주문입니다.');
    }

    const users = await getRows('Users');
    let user = users.find((row) => row.user_id === userId);
    if (!user) {
      user = { user_id: userId, display_name: displayName, points: '0' };
      users.push(user);
    }

    const date = todayKey();
    if (user.order_date !== date) {
      user.order_date = date;
      user.order_count = '0';
    }

    const used = positiveInt(user.order_count);
    if (used >= DAILY_ORDER_LIMIT) {
      throw new Error('오늘은 더 주문할 수 없습니다.');
    }

    const itemName = pickOne(definition.itemNames);
    const item = await getItemByName(itemName);
    if (!item) {
      throw new Error(`Items 시트에 "${itemName}" 아이템이 필요합니다.`);
    }

    await addItem(userId, item.itemId, 1);
    user.display_name = displayName;
    user.order_count = String(used + 1);
    await replaceRows('Users', users as SheetRow[]);

    return {
      text: definition.text,
      itemName,
      remaining: Math.max(0, DAILY_ORDER_LIMIT - used - 1)
    };
  });
}
