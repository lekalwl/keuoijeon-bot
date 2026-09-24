import { getCachedRows } from './staticSheetCache.js';

export interface Item {
  itemId: string;
  itemName: string;
  description: string;
  usable: boolean;
  useText: string;
  consumeOnUse: boolean;
  shopEnabled: boolean;
  sellEnabled: boolean;
  price: number;
}

function toBool(value: string): boolean {
  return value.trim().toUpperCase() === 'TRUE';
}

export async function getItems(): Promise<Item[]> {
  const rows = await getCachedRows('Items');
  return rows
    .filter((row) => row.item_id && row.item_name)
    .map((row) => ({
      itemId: row.item_id.trim(),
      itemName: row.item_name.trim(),
      description: row.description ?? '',
      usable: toBool(row.usable ?? ''),
      useText: row.use_text ?? '',
      consumeOnUse: toBool(row.consume_on_use ?? ''),
      shopEnabled: toBool(row.shop_enabled ?? ''),
      sellEnabled: row.sell_enabled === undefined || row.sell_enabled.trim() === '' ? true : toBool(row.sell_enabled),
      price: Math.max(0, Number.parseInt(row.price ?? '0', 10) || 0)
    }));
}

export async function getItemById(itemId: string): Promise<Item | undefined> {
  const needle = itemId.trim();
  return (await getItems()).find((item) => item.itemId === needle);
}

export async function getItemByName(itemName: string): Promise<Item | undefined> {
  const needle = itemName.trim();
  return (await getItems()).find((item) => item.itemName === needle);
}
