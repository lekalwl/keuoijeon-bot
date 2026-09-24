import { getRows, replaceRows, type SheetRow } from './services/sheets.js';

type Rarity = 'YELLOW' | 'GREEN' | 'RED';

interface ChuseokFishingItem {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  weight: number;
  minQty?: number;
  maxQty?: number;
}

const items: ChuseokFishingItem[] = [
  { id: 'chuseok_salmon', name: '가을 연어', description: '차가운 물살을 거슬러 온 은빛 연어. 붉은 살에 가을의 기운이 가득 올랐다.', rarity: 'YELLOW', price: 20, weight: 9 },
  { id: 'chuseok_moon_carp', name: '달무늬 잉어', description: '둥근 비늘 하나가 보름달처럼 빛나는 잉어. 달빛 아래에서 유난히 얌전해진다.', rarity: 'GREEN', price: 38, weight: 5 },
  { id: 'chuseok_rice_cake_fish', name: '송편붕어', description: '등이 송편처럼 봉긋하고 솔잎 향이 나는 붕어. 먹을 수는 있지만 조금 미안해진다.', rarity: 'GREEN', price: 32, weight: 6 },
  { id: 'chuseok_river_crab', name: '살 오른 참게', description: '가을을 맞아 속이 꽉 찬 참게. 집게발로 낚싯줄을 놓지 않고 버틴다.', rarity: 'YELLOW', price: 22, weight: 8 },
  { id: 'chuseok_golden_loach', name: '황금 미꾸라지', description: '논두렁의 햇빛을 품은 듯 금빛으로 반짝이는 미꾸라지. 손에서 무척 잘 빠져나간다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'chuseok_chestnut_bag', name: '알밤 주머니', description: '물에 젖지 않은 알밤이 한가득 든 작은 베주머니. 누가 정성껏 묶어 둔 듯하다.', rarity: 'YELLOW', price: 16, weight: 10, minQty: 1, maxQty: 2 },
  { id: 'chuseok_persimmon', name: '잘 익은 홍시', description: '물속에서 건졌는데도 터지지 않은 붉은 홍시. 손끝으로 누르면 말랑하게 들어간다.', rarity: 'YELLOW', price: 14, weight: 10 },
  { id: 'chuseok_rice_bundle', name: '햅쌀 한 줌', description: '갓 수확한 듯 윤기가 도는 햅쌀. 작은 복주머니 안에 정갈하게 담겨 있다.', rarity: 'YELLOW', price: 15, weight: 11, minQty: 1, maxQty: 2 },
  { id: 'chuseok_jade_norigae', name: '옥토끼 노리개', description: '달을 올려다보는 토끼가 새겨진 옥 노리개. 흔들 때마다 맑은 방울 소리가 난다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'chuseok_moon_jar_shard', name: '달항아리 조각', description: '부드러운 달빛을 머금은 백자 조각. 가까이 모으면 언젠가 온전한 항아리가 될지도 모른다.', rarity: 'GREEN', price: 35, weight: 4 },

  { id: 'chuseok_soggy_songpyeon', name: '물에 불은 송편', description: '누군가의 차례상에서 탈주한 듯한 송편. 속이 무엇인지는 이제 아무도 장담할 수 없다.', rarity: 'YELLOW', price: 8, weight: 13, minQty: 1, maxQty: 3 },
  { id: 'chuseok_moon_receipt', name: '보름달의 영수증', description: '품목에는 달빛 1개, 구름 2개가 찍혀 있다. 결제 수단은 토끼 외상이다.', rarity: 'GREEN', price: 28, weight: 5 },
  { id: 'chuseok_ancestor_router', name: '조상님 와이파이 공유기', description: '안테나 대신 향 세 대가 꽂혀 있다. 접속 가능한 네트워크 이름은 `본관_5G`다.', rarity: 'RED', price: 50, weight: 1 },
  { id: 'chuseok_escape_pancake', name: '탈주한 전', description: '한쪽 면만 완벽하게 익은 동그랑땡. 뒤집히기 싫어서 물속까지 도망친 모양이다.', rarity: 'YELLOW', price: 10, weight: 12, minQty: 1, maxQty: 2 },
  { id: 'chuseok_empty_gift_box', name: '과대포장 선물세트', description: '상자는 거대하고 화려하지만 안에는 김 한 장과 진심 어린 사과문만 들어 있다.', rarity: 'YELLOW', price: 9, weight: 11 },
  { id: 'chuseok_rabbit_hammer', name: '옥토끼의 예비 떡메', description: '토끼 발자국이 찍힌 작은 떡메. 휘두르면 어디선가 떡 찧는 박자가 들린다.', rarity: 'GREEN', price: 36, weight: 4 },
  { id: 'chuseok_family_question_card', name: '명절 잔소리 반사 카드', description: '취업, 결혼, 성적에 관한 질문을 한 번 튕겨낸다고 적혀 있다. 실전 성능은 미확인이다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'chuseok_fish_hanbok', name: '물고기용 한복', description: '지느러미 구멍까지 정교하게 뚫린 초소형 한복. 정작 입혀 줄 물고기는 도망갔다.', rarity: 'GREEN', price: 30, weight: 6 },
  { id: 'chuseok_broken_yut', name: '길 잃은 윷가락', description: '네 짝 중 혼자만 낚였다. 던지면 언제나 애매하게 모와 도 사이에 선다.', rarity: 'YELLOW', price: 11, weight: 12 },
  { id: 'chuseok_moon_rabbit_selfie', name: '옥토끼 셀카', description: '달 표면에서 떡메를 든 토끼가 찍힌 즉석사진. 사진 뒤에는 `지구 잘 보임`이라고 적혀 있다.', rarity: 'GREEN', price: 33, weight: 4 }
];

function itemRow(item: ChuseokFishingItem): SheetRow {
  return {
    item_id: item.id,
    item_name: item.name,
    usable: 'FALSE',
    use_text: '',
    consume_on_use: 'FALSE',
    description: item.description,
    shop_enabled: 'FALSE',
    price: String(item.price)
  };
}

function rewardRow(item: ChuseokFishingItem): SheetRow {
  return {
    rarity: item.rarity,
    item_id: item.id,
    weight: String(item.weight),
    min_qty: String(item.minQty ?? 1),
    max_qty: String(item.maxQty ?? item.minQty ?? 1)
  };
}

const existingItems = await getRows('Items');
const existingRewards = await getRows('FishingRewards');
const itemIds = new Set(existingItems.map((row) => row.item_id));
const itemNames = new Set(existingItems.map((row) => row.item_name));
const rewardKeys = new Set(existingRewards.map((row) => `${row.rarity}:${row.item_id}`));

const newItems = items.map(itemRow).filter((row) => !itemIds.has(row.item_id) && !itemNames.has(row.item_name));
const newRewards = items.map(rewardRow).filter((row) => !rewardKeys.has(`${row.rarity}:${row.item_id}`));

await replaceRows('Items', [...existingItems, ...newItems]);
await replaceRows('FishingRewards', [...existingRewards, ...newRewards]);

console.log(`Chuseok fishing content seeded: Items +${newItems.length}, FishingRewards +${newRewards.length}`);
