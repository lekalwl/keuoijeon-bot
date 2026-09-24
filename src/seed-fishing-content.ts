import { getRows, replaceRows, type SheetRow } from './services/sheets.js';

type Rarity = 'YELLOW' | 'GREEN' | 'RED';

interface FishingItem {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  weight: number;
  minQty?: number;
  maxQty?: number;
}

const fishingItems: FishingItem[] = [
  { id: 'fish_gizzard_shad', name: '전어', description: '은빛 비늘과 고소한 냄새가 인상적인 바닷물고기. 가을이 아니어도 제법 통통하다.', rarity: 'YELLOW', price: 14, weight: 12, minQty: 1, maxQty: 2 },
  { id: 'fish_mackerel', name: '고등어', description: '등의 푸른 물결무늬가 선명하다. 손에 쥐면 힘차게 파닥거린다.', rarity: 'YELLOW', price: 15, weight: 12, minQty: 1, maxQty: 2 },
  { id: 'fish_saury', name: '꽁치', description: '길고 날렵한 몸에 달빛 같은 광택이 흐른다.', rarity: 'YELLOW', price: 12, weight: 11, minQty: 1, maxQty: 3 },
  { id: 'fish_sardine', name: '정어리', description: '작고 반짝이는 물고기. 혼자 잡혔는데도 떼를 지어 다니는 기세가 느껴진다.', rarity: 'YELLOW', price: 10, weight: 13, minQty: 1, maxQty: 3 },
  { id: 'fish_flounder', name: '가자미', description: '납작한 몸으로 바닥에 찰싹 붙어 있던 물고기. 눈이 한쪽으로 몰려 있다.', rarity: 'YELLOW', price: 18, weight: 9 },
  { id: 'fish_red_seabream', name: '참돔', description: '연분홍빛 비늘이 곱게 빛나는 바닷물고기. 잔칫상에 올려도 손색없다.', rarity: 'GREEN', price: 35, weight: 6 },
  { id: 'fish_seabass', name: '농어', description: '묵직하고 단단한 몸을 가진 사냥꾼. 낚싯줄을 꽤 오래 끌고 다녔다.', rarity: 'GREEN', price: 32, weight: 7 },
  { id: 'fish_puffer', name: '복어', description: '화가 잔뜩 나서 공처럼 부풀었다. 함부로 요리하면 큰일 난다.', rarity: 'GREEN', price: 30, weight: 6 },
  { id: 'sea_octopus', name: '문어', description: '팔 여덟 개로 양동이 가장자리를 붙잡는다. 탈출 계획을 세우는 눈빛이다.', rarity: 'GREEN', price: 34, weight: 6 },
  { id: 'sea_squid', name: '오징어', description: '반투명한 몸이 기분에 따라 희미하게 색을 바꾼다.', rarity: 'YELLOW', price: 17, weight: 9 },
  { id: 'sea_blue_crab', name: '꽃게', description: '화려한 등딱지와 집게발을 가진 게. 잡힌 뒤에도 당당하게 위협한다.', rarity: 'YELLOW', price: 18, weight: 9 },
  { id: 'sea_conch', name: '소라', description: '나선형 껍데기에 파도 소리가 갇혀 있다. 귀를 대면 먼 바다가 들린다.', rarity: 'YELLOW', price: 15, weight: 10 },
  { id: 'sea_seahorse', name: '해마', description: '체스말처럼 생긴 작은 생물. 꼬리로 해초 한 가닥을 꼭 붙들고 있다.', rarity: 'GREEN', price: 28, weight: 5 },
  { id: 'sea_jellyfish', name: '해파리', description: '유리 우산처럼 투명한 생물. 물 밖에서도 잠시 은은하게 빛난다.', rarity: 'GREEN', price: 25, weight: 6 },
  { id: 'river_trout', name: '송어', description: '차가운 물에서 올라온 무지갯빛 물고기. 몸에 작은 별무늬가 흩어져 있다.', rarity: 'YELLOW', price: 18, weight: 10 },
  { id: 'river_crucian_carp', name: '붕어', description: '둥글고 친숙한 민물고기. 어쩐지 붕어빵보다 억울한 표정이다.', rarity: 'YELLOW', price: 10, weight: 13, minQty: 1, maxQty: 2 },
  { id: 'river_carp', name: '잉어', description: '커다란 비늘이 가지런한 민물고기. 놓아주면 소원을 들어줄 것처럼 생겼다.', rarity: 'GREEN', price: 30, weight: 6 },
  { id: 'river_catfish', name: '메기', description: '긴 수염으로 주변을 더듬는 묵직한 물고기. 표정이 지나치게 침착하다.', rarity: 'YELLOW', price: 16, weight: 9 },
  { id: 'river_eel', name: '장어', description: '미끈하고 힘이 세다. 양손으로 잡아도 금세 빠져나갈 것 같다.', rarity: 'GREEN', price: 38, weight: 5 },
  { id: 'river_sweetfish', name: '은어', description: '맑은 물 냄새와 은은한 수박 향이 나는 작은 물고기.', rarity: 'YELLOW', price: 17, weight: 8 },
  { id: 'river_mandarin_fish', name: '쏘가리', description: '표범 같은 무늬를 가진 민물 포식자. 작은 체구에 비해 성질이 사납다.', rarity: 'GREEN', price: 36, weight: 5 },
  { id: 'river_crayfish', name: '가재', description: '붉은 집게를 치켜든 민물 갑각류. 잡힌 상황을 결투 신청으로 받아들였다.', rarity: 'YELLOW', price: 13, weight: 10, minQty: 1, maxQty: 2 },
  { id: 'river_shrimp', name: '민물새우', description: '손가락만 한 투명한 새우. 물속에서는 거의 보이지 않는다.', rarity: 'YELLOW', price: 9, weight: 13, minQty: 1, maxQty: 3 },
  { id: 'river_minnow', name: '피라미', description: '작지만 재빠른 민물고기. 낚였다는 사실을 아직 이해하지 못한 듯하다.', rarity: 'YELLOW', price: 8, weight: 14, minQty: 1, maxQty: 3 },
  { id: 'river_sturgeon', name: '철갑상어', description: '갑옷 같은 비늘을 두른 오래된 물고기. 강에 이런 크기의 녀석이 왜 있었을까.', rarity: 'RED', price: 50, weight: 3 },

  { id: 'odd_axolotl', name: '산책 나온 아홀로틀', description: '분홍빛 아가미를 흔들며 태연하게 헤엄친다. 이 물의 온도가 정말 괜찮은 걸까.', rarity: 'GREEN', price: 30, weight: 6 },
  { id: 'odd_capybara', name: '온천을 찾는 카피바라', description: '낚싯바늘 대신 미끼를 물고 올라왔다. 주변에 온천이 없다는 사실에 실망했다.', rarity: 'RED', price: 48, weight: 2 },
  { id: 'odd_penguin', name: '길 잃은 펭귄', description: '작은 얼음 조각 위에 꼿꼿이 서 있다. 누구도 이곳까지 온 경로를 설명하지 못한다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'odd_platypus', name: '수상한 오리너구리', description: '오리도 너구리도 아닌 얼굴로 이쪽을 빤히 본다. 모자만 씌우면 요원이 될 것 같다.', rarity: 'GREEN', price: 38, weight: 4 },
  { id: 'odd_beaver', name: '목재 감별사 비버', description: '떠내려온 나뭇조각을 품질별로 정리하고 있었다. 이빨 자국이 검수 도장처럼 남아 있다.', rarity: 'GREEN', price: 32, weight: 5 },
  { id: 'odd_sea_pig', name: '심해의 바다돼지', description: '말랑한 다리로 천천히 기어 다니는 심해 생물. 수심이 전혀 맞지 않는데 멀쩡하다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'odd_horseshoe_crab', name: '시간여행 투구게', description: '아주 오래전 시대에서 그대로 걸어 나온 듯한 생물. 등껍질에 희미한 날짜가 적혀 있다.', rarity: 'GREEN', price: 35, weight: 4 },
  { id: 'odd_blue_dragon', name: '푸른 용 갯민숭달팽이', description: '손바닥 위의 작은 용처럼 생겼다. 아름답지만 함부로 만지면 따끔하다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'odd_anglerfish', name: '휴대용 심해아귀', description: '머리의 작은 등불을 켜고 끌 수 있다. 주머니에 넣기엔 이빨이 너무 많다.', rarity: 'GREEN', price: 40, weight: 4 },
  { id: 'odd_manta', name: '접힌 대왕쥐가오리', description: '거대한 몸을 종이처럼 접고 작은 물웅덩이에 숨어 있었다. 펼치면 곤란해질 것 같다.', rarity: 'RED', price: 50, weight: 1 },
  { id: 'odd_kraken', name: '미니 크라켄', description: '찻잔에 들어갈 크기의 바다 괴물. 손가락을 배로 착각하고 공격한다.', rarity: 'RED', price: 50, weight: 1 },
  { id: 'odd_jelly_slime', name: '민물 젤리 슬라임', description: '물고기인지 몬스터인지 애매한 반투명 덩어리. 기분이 좋으면 동그랗게 부푼다.', rarity: 'GREEN', price: 28, weight: 6 },
  { id: 'odd_clockwork_turtle', name: '태엽 거북이', description: '등껍질 아래에서 작은 톱니가 돌아간다. 태엽이 풀리면 얌전히 잠든다.', rarity: 'GREEN', price: 36, weight: 4 },
  { id: 'odd_glass_frog', name: '유리 개구리', description: '속이 비쳐 보일 만큼 투명하다. 놀라면 몸 안에서 작은 별빛이 뛴다.', rarity: 'GREEN', price: 31, weight: 5 },
  { id: 'odd_space_goldfish', name: '우주복 입은 금붕어', description: '동그란 헬멧 안에 물을 채운 채 유영한다. 우주보다 이 연못이 더 위험해 보인다.', rarity: 'RED', price: 50, weight: 1 },

  { id: 'meme_wet_sock', name: '전설의 젖은 양말', description: '물속에서조차 유독 축축해 보이는 양말 한 짝. 반대쪽은 영원히 발견되지 않는다.', rarity: 'YELLOW', price: 5, weight: 14 },
  { id: 'meme_half_fish_bun', name: '반쪽짜리 붕어빵', description: '머리만 남은 붕어빵. 팥은 멀쩡하지만 어디까지가 물고기인지 혼란스럽다.', rarity: 'YELLOW', price: 8, weight: 12 },
  { id: 'meme_fish_usb', name: '물고기 모양 USB', description: '꼬리를 뽑으면 단자가 나온다. 안에는 `낚시_최종_진짜최종` 폴더가 하나 있다.', rarity: 'GREEN', price: 28, weight: 5 },
  { id: 'meme_bad_waterproof_pouch', name: '방수 안 되는 방수팩', description: '겉면에 방수라고 크게 적혀 있지만 안쪽까지 흠뻑 젖어 있다.', rarity: 'YELLOW', price: 6, weight: 13 },
  { id: 'meme_cringe_diary', name: '누군가의 흑역사 일기장', description: '잉크가 번졌는데도 부끄러운 문장만은 또렷하게 읽힌다.', rarity: 'GREEN', price: 25, weight: 6 },
  { id: 'meme_404_sign', name: '404 표지판', description: '`물고기를 찾을 수 없습니다`라고 적힌 작은 표지판. 지금 잡힌 것은 이쪽이다.', rarity: 'GREEN', price: 30, weight: 5 },
  { id: 'meme_soaked_keyboard', name: '물먹은 키보드', description: '스페이스바를 누르면 물방울이 나온다. 엔터키에는 작은 따개비가 붙었다.', rarity: 'YELLOW', price: 9, weight: 11 },
  { id: 'meme_rubber_duck_boss', name: '고무 오리 대장', description: '평범한 고무 오리보다 눈빛이 강하다. 주변의 오리 장난감들이 저절로 정렬한다.', rarity: 'GREEN', price: 32, weight: 4 },
  { id: 'meme_lukewarm_ice', name: '미지근한 얼음', description: '차갑지도 녹지도 않는 정체불명의 얼음. 손에 쥐면 애매한 기분만 남는다.', rarity: 'YELLOW', price: 7, weight: 12 },
  { id: 'meme_fisher_pride', name: '낚시꾼의 자존심', description: '형체도 무게도 없지만 분명 낚싯바늘에 걸렸다. 놓치면 두 번 다시 잡기 어렵다.', rarity: 'RED', price: 50, weight: 1 },

  { id: 'treasure_pearl_necklace', name: '진주 목걸이', description: '크기가 일정한 진주를 정교하게 엮은 목걸이. 바닷물 냄새 사이로 은은한 향기가 난다.', rarity: 'GREEN', price: 40, weight: 4 },
  { id: 'treasure_gold_coins', name: '금화 주머니', description: '오래된 문장이 찍힌 금화가 묵직하게 담겨 있다. 몇 닢은 이빨 자국이 나 있다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'treasure_silver_compass', name: '은제 나침반', description: '북쪽 대신 가장 가까운 보물을 가리킨다는 은빛 나침반. 지금은 주인을 향한다.', rarity: 'GREEN', price: 38, weight: 4 },
  { id: 'treasure_coral_crown', name: '산호 왕관', description: '붉은 산호와 작은 진주로 만든 왕관. 물속 왕국의 유실물처럼 보인다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'treasure_starlight_bottle', name: '유리병 속 별빛', description: '병 안에서 푸른 별빛이 천천히 소용돌이친다. 뚜껑을 열면 밤하늘 냄새가 난다.', rarity: 'RED', price: 50, weight: 1 },
  { id: 'treasure_wreck_key', name: '침몰선의 열쇠', description: '소금기와 녹이 밴 커다란 열쇠. 손잡이에 파도 모양 문장이 새겨져 있다.', rarity: 'GREEN', price: 35, weight: 4 },
  { id: 'treasure_bronze_mirror', name: '고대 청동거울', description: '표면은 흐리지만 비친 사람의 뒤편만큼은 이상하리만치 선명하다.', rarity: 'RED', price: 50, weight: 2 },
  { id: 'treasure_prismatic_box', name: '오색 보석함', description: '각도에 따라 다섯 가지 색으로 빛나는 작은 보석함. 자물쇠는 없는데 열리지 않는다.', rarity: 'RED', price: 50, weight: 1 },
  { id: 'treasure_dragon_scale', name: '푸른 용비늘', description: '물에 젖을수록 단단해지는 거대한 비늘. 평범한 물고기에게서 떨어진 물건은 아니다.', rarity: 'RED', price: 50, weight: 1 },
  { id: 'treasure_moon_pearl', name: '달빛 진주', description: '어두운 곳에서 보름달처럼 빛나는 진주. 귀에 대면 아주 먼 파도 소리가 들린다.', rarity: 'RED', price: 50, weight: 1 }
];

function itemRow(item: FishingItem): SheetRow {
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

function rewardRow(item: FishingItem): SheetRow {
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

const bait: SheetRow = {
  item_id: 'bait',
  item_name: '미끼',
  usable: 'FALSE',
  use_text: '',
  consume_on_use: 'TRUE',
  description: '낚싯바늘에 끼워 사용하는 평범한 미끼. 물고기뿐 아니라 이상한 것들도 관심을 보인다.',
  shop_enabled: 'TRUE',
  price: '10'
};

const newItems = [bait, ...fishingItems.map(itemRow)].filter(
  (row) => !itemIds.has(row.item_id) && !itemNames.has(row.item_name)
);
const newRewards = fishingItems.map(rewardRow).filter((row) => !rewardKeys.has(`${row.rarity}:${row.item_id}`));

await replaceRows('Items', [...existingItems, ...newItems]);
await replaceRows('FishingRewards', [...existingRewards, ...newRewards]);

console.log(`Fishing content seeded: Items +${newItems.length}, FishingRewards +${newRewards.length}`);
