import { getRandomUseText } from './itemUseTexts.js';
import { getItemById, getItemByName, getItems, type Item } from './items.js';
import { withLock } from './locks.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';

export interface InventoryEntry {
  item: Item;
  quantity: number;
}

export interface UsedItem {
  item: Item;
  useText: string;
  quantity: number;
}

function parseQty(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function getInventory(characterId: string): Promise<InventoryEntry[]> {
  const rows = await getRows('Inventory');
  const itemMap = new Map((await getItems()).map((item) => [item.itemId, item]));
  const entries: InventoryEntry[] = [];
  for (const row of rows.filter((candidate) => candidate.character_id === characterId && parseQty(candidate.quantity) > 0)) {
    const item = itemMap.get(row.item_id);
    if (item) {
      entries.push({ item, quantity: parseQty(row.quantity) });
    }
  }
  return entries;
}

export async function addItem(characterId: string, itemId: string, quantity: number): Promise<void> {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('수량은 양수 정수여야 합니다.');
  }
  await withLock('inventory', async () => {
    const rows = await getRows('Inventory');
    const row = rows.find((candidate) => candidate.character_id === characterId && candidate.item_id === itemId);
    if (row) {
      row.quantity = String(parseQty(row.quantity) + quantity);
    } else {
      rows.push({ character_id: characterId, item_id: itemId, quantity: String(quantity) });
    }
    await replaceRows('Inventory', rows.filter((candidate) => parseQty(candidate.quantity) > 0));
  });
}

export async function removeItem(characterId: string, itemId: string, quantity: number): Promise<void> {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('수량은 양수 정수여야 합니다.');
  }
  await withLock('inventory', async () => {
    const rows = await getRows('Inventory');
    const row = rows.find((candidate) => candidate.character_id === characterId && candidate.item_id === itemId);
    if (!row || parseQty(row.quantity) < quantity) {
      throw new Error('아이템 수량이 부족합니다.');
    }
    row.quantity = String(parseQty(row.quantity) - quantity);
    await replaceRows('Inventory', rows.filter((candidate) => parseQty(candidate.quantity) > 0));
  });
}

export async function transferItem(fromCharacterId: string, toCharacterId: string, itemName: string, quantity: number): Promise<Item> {
  const item = await getItemByName(itemName);
  if (!item) {
    throw new Error('해당 이름의 아이템을 찾을 수 없습니다.');
  }
  await withLock('inventory', async () => {
    const rows = await getRows('Inventory');
    const fromRow = rows.find((row) => row.character_id === fromCharacterId && row.item_id === item.itemId);
    if (!fromRow || parseQty(fromRow.quantity) < quantity) {
      throw new Error('아이템 수량이 부족합니다.');
    }
    fromRow.quantity = String(parseQty(fromRow.quantity) - quantity);
    const toRow = rows.find((row) => row.character_id === toCharacterId && row.item_id === item.itemId);
    if (toRow) {
      toRow.quantity = String(parseQty(toRow.quantity) + quantity);
    } else {
      rows.push({ character_id: toCharacterId, item_id: item.itemId, quantity: String(quantity) });
    }
    await replaceRows('Inventory', rows.filter((row: SheetRow) => parseQty(row.quantity) > 0));
  });
  return item;
}

export async function useItem(characterId: string, itemId: string, quantity = 1): Promise<UsedItem> {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('수량은 양수 정수여야 합니다.');
  }
  const item = await getItemById(itemId);
  if (!item || !item.usable) {
    throw new Error('사용할 수 없는 아이템입니다.');
  }
  const inventory = await getInventory(characterId);
  const entry = inventory.find((candidate) => candidate.item.itemId === itemId);
  if (!entry || entry.quantity < quantity) {
    throw new Error('아이템 수량이 충분하지 않습니다.');
  }
  const useText = (await getRandomUseText(itemId)) ?? item.useText ?? '';
  if (item.consumeOnUse) {
    await removeItem(characterId, itemId, quantity);
  }
  return { item, useText, quantity };
}
