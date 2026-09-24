import { ensureSheet, getRows, replaceRows, type SheetRow } from './services/sheets.js';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  usable?: boolean;
  useText?: string;
  consume?: boolean;
  sellable?: boolean;
}

const ordinary: ShopItem[] = [
  { id: 'shop_handkerchief', name: '손수건', description: '작고 부드러운 무명 손수건. 모서리에 작은 꽃이 수놓아져 있다.', price: 80 },
  { id: 'shop_glass_marble', name: '유리구슬', description: '빛을 받으면 여러 색으로 반짝이는 둥근 유리구슬.', price: 100 },
  { id: 'shop_hair_tie', name: '머리끈', description: '어디에나 무난하게 어울리는 검은색 머리끈.', price: 50 },
  { id: 'shop_small_comb', name: '작은 빗', description: '주머니에 들어가는 나무 빗. 은은한 향이 난다.', price: 120 },
  { id: 'shop_letter_set', name: '편지지 세트', description: '봉투와 편지지가 다섯 장씩 들어 있는 단정한 세트.', price: 150 },
  { id: 'shop_flower_teacup', name: '꽃무늬 찻잔', description: '잔 가장자리에 작은 들꽃이 그려진 도자기 찻잔.', price: 180 },
  { id: 'shop_scented_candle', name: '향초', description: '불을 붙이면 달콤하고 포근한 향기가 퍼지는 작은 초.', price: 120 },
  { id: 'shop_blanket', name: '담요', description: '어깨에 두르기 좋은 크기의 부드러운 담요.', price: 250 },
  { id: 'shop_water_bottle', name: '휴대용 물병', description: '튼튼하고 가벼운 금속 물병. 차가운 음료를 담기 좋다.', price: 200 },
  { id: 'shop_rabbit_plush', name: '토끼 봉제인형', description: '손바닥 두 개 정도 크기의 폭신한 토끼 인형.', price: 300 }
];

const goblinRp: ShopItem[] = [
  { id: 'goblin_blue_lantern', name: '도깨비불 초롱', description: '푸른 불꽃이 담긴 작은 초롱. 거짓말을 들으면 불꽃이 흔들린다는 소문이 있다.', price: 300 },
  { id: 'goblin_horn_mask', name: '뿔 달린 탈', description: '쓰면 목소리가 낮고 위엄 있게 울린다. 벗고 나면 코끝에 숯검정이 묻는다.', price: 280 },
  { id: 'goblin_broken_club', name: '깨진 요술 방망이', description: '금이 가 금은보화는 만들지 못한다. 바닥을 두드리면 콩 한 알이 나온다.', price: 350 },
  { id: 'goblin_cloud_fan', name: '구름무늬 부채', description: '펼칠 때마다 서늘한 산바람이 분다. 가끔 낙엽과 도토리도 날아온다.', price: 260 },
  { id: 'goblin_shadow_pouch', name: '그림자 복주머니', description: '안쪽을 아무리 살펴도 바닥이 보이지 않는 수상한 복주머니.', price: 320 },
  { id: 'goblin_rain_straw_shoes', name: '비 오는 날의 짚신', description: '신으면 발밑에만 가느다란 빗줄기가 따라다닌다.', price: 220 },
  { id: 'goblin_moon_coin', name: '달빛 엽전', description: '달빛을 받으면 은색으로 변하는 낡은 엽전. 새벽이면 원래 모습으로 돌아온다.', price: 240 },
  { id: 'goblin_foxrain_hairpin', name: '여우비 비녀', description: '꽂으면 머리카락 끝에 작은 물방울이 맺힌다.', price: 300 },
  { id: 'goblin_nameless_scroll', name: '이름 없는 족자', description: '펼친 사람의 이름이 붓글씨로 나타난다. 글씨체는 매번 달라진다.', price: 400 },
  { id: 'goblin_laughter_bell', name: '웃음 담긴 방울', description: '흔들면 소유자의 웃음소리와 닮은 맑은 소리가 난다.', price: 250 }
];

const functional: ShopItem[] = [
  { id: 'special_premium_bait', name: '고급 미끼', description: '사용 후 다음 낚시에서 노란 보상을 30% 확률로 초록 보상으로 승급시킨다.', price: 80, usable: true, consume: true, sellable: false, useText: '다음 낚시를 위해 향이 진한 고급 미끼를 준비했다.' },
  { id: 'special_lucky_hook', name: '행운의 낚싯바늘', description: '사용 후 다음 낚시의 색 버튼 입력 시간을 1초 연장한다.', price: 120, usable: true, consume: true, sellable: false, useText: '반짝이는 낚싯바늘을 낚싯대에 단단히 묶었다.' },
  { id: 'special_golden_net', name: '황금 뜰채', description: '사용 후 다음 낚시에 성공하면 획득 수량이 2배가 된다.', price: 180, usable: true, consume: true, sellable: false, useText: '황금빛 뜰채를 펼쳐 다음 낚시를 준비했다.' },
  { id: 'special_glitter_float', name: '반짝이는 찌', description: '사용 후 다음 낚시에서 색 버튼이 하나 더 나타난다.', price: 140, usable: true, consume: true, sellable: false, useText: '물고기가 놓치기 힘든 반짝이는 찌를 달았다.' },
  { id: 'special_magic_pouch', name: '요술 주머니', description: '사용 즉시 노란색 등급 낚시 보상 하나를 무작위로 획득한다.', price: 150, usable: true, consume: true, sellable: false, useText: '주머니 안에서 무언가가 손끝에 걸렸다.' },
  { id: 'special_theft_insurance', name: '도깨비 보험증', description: '사용 후 다음 돛거 성공으로 잃을 포인트나 아이템을 1회 보호한다.', price: 500, usable: true, consume: true, sellable: false, useText: '도깨비 보험 약관에 도장을 찍었다. 작은 글씨는 읽지 않았다.' },
  { id: 'special_thief_gloves', name: '도깨비 장갑', description: '사용 후 다음 돛거 공격 판정에 +10을 더한다.', price: 250, usable: true, consume: true, sellable: false, useText: '손끝이 그림자처럼 가벼워지는 장갑을 꼈다.' },
  { id: 'special_alarm_bell', name: '방울 경보기', description: '사용 후 다음 돛거 방어 판정에 +10을 더한다.', price: 250, usable: true, consume: true, sellable: false, useText: '작은 방울을 소지품에 달았다. 수상한 손길에 반응할 것이다.' },
  { id: 'special_victory_charm', name: '승부 부적', description: '사용 후 가위바위보 또는 결투에서 다음으로 승리할 때 50P를 추가로 받는다.', price: 200, usable: true, consume: true, sellable: false, useText: '다음 승부의 승리를 바라며 부적을 품에 넣었다.' },
  { id: 'special_lucky_die', name: '행운의 주사위', description: '사용 후 다음 /r 결과에 +10을 더한다.', price: 180, usable: true, consume: true, sellable: false, useText: '주사위의 점이 잠시 금빛으로 반짝였다.' }
];

const foodBuffs: ShopItem[] = [
  { id: 'buff_meat_gukbap', name: '산더미 고기국밥', description: '고기가 산처럼 쌓인 뜨끈한 국밥. 60분 동안 힘 판정에 +10.', price: 300, usable: true, consume: true, sellable: false, useText: '든든하게 국밥 한 그릇을 비웠다. 온몸에 힘이 솟는다!' },
  { id: 'buff_wind_ricecake', name: '바람떡', description: '한입 베어 물면 산들바람이 스치는 떡. 60분 동안 민첩 판정에 +10.', price: 300, usable: true, consume: true, sellable: false, useText: '말랑한 떡을 삼키자 몸이 깃털처럼 가벼워졌다.' },
  { id: 'buff_honey_candy', name: '꿀타래 과자', description: '가느다란 꿀실이 겹겹이 얽힌 과자. 60분 동안 손재주 판정에 +10.', price: 300, usable: true, consume: true, sellable: false, useText: '섬세하게 풀리는 꿀타래를 먹자 손끝의 감각이 또렷해졌다.' },
  { id: 'buff_clover_cracker', name: '네잎클로버 전병', description: '네잎클로버 무늬가 찍힌 바삭한 전병. 60분 동안 행운 판정에 +10.', price: 300, usable: true, consume: true, sellable: false, useText: '바삭한 전병을 먹었다. 오늘은 왠지 운이 좋을 것 같다.' },
  { id: 'buff_goblin_feast', name: '도깨비 잔칫상', description: '혼자 먹기 벅찰 만큼 푸짐한 한 상. 60분 동안 모든 일반 스탯 판정에 +5.', price: 600, usable: true, consume: true, sellable: false, useText: '도깨비 잔칫상을 깨끗하게 비웠다. 배도 마음도 든든하다!' }
];

function row(item: ShopItem): SheetRow {
  return {
    item_id: item.id,
    item_name: item.name,
    usable: item.usable ? 'TRUE' : 'FALSE',
    use_text: item.useText ?? '',
    consume_on_use: item.consume ? 'TRUE' : 'FALSE',
    description: item.description,
    shop_enabled: 'TRUE',
    sell_enabled: item.sellable === false ? 'FALSE' : 'TRUE',
    price: String(item.price)
  };
}

const statEffects: SheetRow[] = [
  { item_id: 'buff_meat_gukbap', effect_name: '힘이 불끈', stat: 'strength', modifier: '10', duration_minutes: '60', stackable: 'FALSE' },
  { item_id: 'buff_wind_ricecake', effect_name: '발걸음이 가뿐', stat: 'agility', modifier: '10', duration_minutes: '60', stackable: 'FALSE' },
  { item_id: 'buff_honey_candy', effect_name: '손끝이 섬세', stat: 'dexterity', modifier: '10', duration_minutes: '60', stackable: 'FALSE' },
  { item_id: 'buff_clover_cracker', effect_name: '운수 좋은 날', stat: 'luck', modifier: '10', duration_minutes: '60', stackable: 'FALSE' },
  { item_id: 'buff_goblin_feast', effect_name: '배부른 축복', stat: 'all', modifier: '5', duration_minutes: '60', stackable: 'FALSE' }
];

const specialEffects: SheetRow[] = [
  { item_id: 'special_premium_bait', effect_key: 'fishing_upgrade', value: '0', chance: '30' },
  { item_id: 'special_lucky_hook', effect_key: 'fishing_time', value: '1', chance: '100' },
  { item_id: 'special_golden_net', effect_key: 'fishing_double', value: '2', chance: '100' },
  { item_id: 'special_glitter_float', effect_key: 'fishing_extra_target', value: '1', chance: '100' },
  { item_id: 'special_magic_pouch', effect_key: 'yellow_reward', value: '1', chance: '100' },
  { item_id: 'special_theft_insurance', effect_key: 'theft_insurance', value: '1', chance: '100' },
  { item_id: 'special_thief_gloves', effect_key: 'theft_attack_bonus', value: '10', chance: '100' },
  { item_id: 'special_alarm_bell', effect_key: 'theft_defense_bonus', value: '10', chance: '100' },
  { item_id: 'special_victory_charm', effect_key: 'victory_bonus', value: '50', chance: '100' },
  { item_id: 'special_lucky_die', effect_key: 'dice_bonus', value: '10', chance: '100' }
];

for (const sheet of ['Items', 'StatItemEffects', 'SpecialItemEffects', 'ActiveSpecialEffects'] as const) await ensureSheet(sheet);

const allItems = [...ordinary, ...goblinRp, ...functional, ...foodBuffs].map(row);
const existingItems = await getRows('Items');
for (const item of allItems) {
  const index = existingItems.findIndex((candidate) => candidate.item_id === item.item_id || candidate.item_name === item.item_name);
  if (index >= 0) existingItems[index] = { ...existingItems[index], ...item };
  else existingItems.push(item);
}
const bait = existingItems.find((item) => item.item_id === 'bait' || item.item_name === '미끼');
if (bait) Object.assign(bait, { shop_enabled: 'TRUE', sell_enabled: 'TRUE', price: '10' });
await replaceRows('Items', existingItems);

const existingStats = await getRows('StatItemEffects');
for (const effect of statEffects) {
  const index = existingStats.findIndex((row) => row.item_id === effect.item_id && row.stat === effect.stat);
  if (index >= 0) existingStats[index] = effect;
  else existingStats.push(effect);
}
await replaceRows('StatItemEffects', existingStats);

const existingSpecial = await getRows('SpecialItemEffects');
for (const effect of specialEffects) {
  const index = existingSpecial.findIndex((row) => row.item_id === effect.item_id && row.effect_key === effect.effect_key);
  if (index >= 0) existingSpecial[index] = effect;
  else existingSpecial.push(effect);
}
await replaceRows('SpecialItemEffects', existingSpecial);

const [verifiedItems, verifiedStats, verifiedSpecial] = await Promise.all([
  getRows('Items'),
  getRows('StatItemEffects'),
  getRows('SpecialItemEffects')
]);
const missingItems = allItems.filter((item) => !verifiedItems.some((row) => row.item_id === item.item_id));
const missingStats = statEffects.filter(
  (effect) => !verifiedStats.some((row) => row.item_id === effect.item_id && row.stat === effect.stat)
);
const missingSpecial = specialEffects.filter(
  (effect) => !verifiedSpecial.some((row) => row.item_id === effect.item_id && row.effect_key === effect.effect_key)
);
if (missingItems.length || missingStats.length || missingSpecial.length) {
  throw new Error(`Seed verification failed: items ${missingItems.length}, stats ${missingStats.length}, special ${missingSpecial.length}`);
}

console.log(`Goblin shop verified: Items ${allItems.length}, stat effects ${statEffects.length}, special effects ${specialEffects.length}, bait ${bait ? 'updated' : 'not found'}`);
