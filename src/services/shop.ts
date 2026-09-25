import { changePoints } from './economy.js';
import { addItem, removeItem } from './inventory.js';
import { getItemByName, type Item } from './items.js';
import { withLock } from './locks.js';

export const MAX_SELL_PRICE_PER_ITEM = 50;

export interface ShopResult {
  item: Item;
  quantity: number;
  pointsChanged: number;
  balance: number;
  unitPrice: number;
}

function validateQuantity(quantity: number): void {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('수량은 양수 정수여야 합니다.');
  }
}

function sellUnitPrice(item: Item): number {
  if (item.price <= 0) {
    return 0;
  }
  return Math.min(item.price, MAX_SELL_PRICE_PER_ITEM);
}

export async function buyItem(characterId: string, itemName: string, quantity: number): Promise<ShopResult> {
  validateQuantity(quantity);

  return withLock(`shop:${characterId}`, async () => {
    const item = await getItemByName(itemName);
    if (!item) {
      throw new Error('해당 이름의 아이템을 찾을 수 없습니다.');
    }
    if (!item.shopEnabled) {
      throw new Error('상점에서 구매할 수 없는 아이템입니다.');
    }
    if (item.price <= 0) {
      throw new Error('아이템 가격이 올바르지 않습니다.');
    }

    const totalPrice = item.price * quantity;
    const balance = await changePoints(characterId, -totalPrice);
    await addItem(characterId, item.itemId, quantity);
    return { item, quantity, pointsChanged: -totalPrice, balance, unitPrice: item.price };
  });
}

export async function sellItem(characterId: string, itemName: string, quantity: number): Promise<ShopResult> {
  validateQuantity(quantity);

  return withLock(`shop:${characterId}`, async () => {
    const item = await getItemByName(itemName);
    if (!item) {
      throw new Error('해당 이름의 아이템을 찾을 수 없습니다.');
    }
    if (item.bound) {
      throw new Error('귀속 아이템은 판매할 수 없습니다.');
    }
    if (!item.sellEnabled) {
      throw new Error('이 아이템은 되팔 수 없습니다.');
    }

    const unitPrice = sellUnitPrice(item);
    if (unitPrice <= 0) {
      throw new Error('판매 가격이 없는 아이템입니다.');
    }

    await removeItem(characterId, item.itemId, quantity);
    const earned = unitPrice * quantity;
    const balance = await changePoints(characterId, earned);
    return { item, quantity, pointsChanged: earned, balance, unitPrice };
  });
}
