/**
 * D&D 5E mathematical calculations and dice evaluation
 * Pure decoupled functions, tested via node:test
 */

export function calculateModifier(score: number): number {
  if (isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

export interface AbilityBreakdown {
  baseScore: number;
  extraScore: number;
  itemScore: number;
  totalScore: number;
  modifier: number;
}

export function calculateTotalAbilityScore(
  ability?: {
    score?: number;
    baseScore?: number;
    extraScore?: number;
    itemScore?: number;
    customModifier?: number;
    modifierOverride?: number;
  } | number | null,
  itemBonus: number = 0
): AbilityBreakdown {
  if (ability === null || ability === undefined) {
    const total = 10 + itemBonus;
    return {
      baseScore: 10,
      extraScore: 0,
      itemScore: itemBonus,
      totalScore: total,
      modifier: calculateModifier(total),
    };
  }
  if (typeof ability === 'number') {
    const total = ability + itemBonus;
    return {
      baseScore: ability,
      extraScore: 0,
      itemScore: itemBonus,
      totalScore: total,
      modifier: calculateModifier(total),
    };
  }

  const baseScore = typeof ability.baseScore === 'number' ? ability.baseScore : (ability.score ?? 10);
  const extraScore =
    typeof ability.extraScore === 'number'
      ? ability.extraScore
      : typeof ability.customModifier === 'number'
      ? ability.customModifier
      : 0;
  const itemScore = itemBonus || (typeof ability.itemScore === 'number' ? ability.itemScore : 0);
  const totalScore = baseScore + extraScore + itemScore;

  const modifier =
    typeof ability.modifierOverride === 'number' && !isNaN(ability.modifierOverride)
      ? Math.round(ability.modifierOverride)
      : calculateModifier(totalScore);

  return {
    baseScore,
    extraScore,
    itemScore,
    totalScore,
    modifier,
  };
}

export function getEffectiveAbilityModifier(
  ability?: {
    score: number;
    baseScore?: number;
    extraScore?: number;
    itemScore?: number;
    customModifier?: number;
    modifierOverride?: number;
  } | number | null,
  itemBonus: number = 0
): number {
  if (ability === null || ability === undefined) return 0;
  if (typeof ability === 'number') {
    return calculateModifier(ability + itemBonus);
  }
  if (typeof ability.modifierOverride === 'number' && !isNaN(ability.modifierOverride)) {
    return Math.round(ability.modifierOverride);
  }

  // If baseScore or extraScore or explicit itemScore/itemBonus is provided, calculate 3-way sum
  if (
    typeof ability.baseScore === 'number' ||
    typeof ability.extraScore === 'number' ||
    typeof ability.itemScore === 'number' ||
    itemBonus !== 0
  ) {
    const breakdown = calculateTotalAbilityScore(ability, itemBonus);
    return breakdown.modifier;
  }

  // Legacy behavior: score modifier + customModifier
  const baseMod = calculateModifier(ability.score ?? 10);
  const bonus = typeof ability.customModifier === 'number' && !isNaN(ability.customModifier) ? Math.round(ability.customModifier) : 0;
  return baseMod + bonus;
}

export interface JournalIndexItem {
  sheetNumber: number;
  id: string;
  sessionNumber: number;
  title: string;
  dateInGame: string;
  pagesOccupied: number;
}

export function buildJournalIndexEntries(
  entries?: {
    id: string;
    sessionNumber: number;
    title: string;
    dateInGame?: string;
    date?: string;
  }[]
): { totalSheets: number; items: JournalIndexItem[] } {
  const safeList = Array.isArray(entries) ? entries : [];
  const items: JournalIndexItem[] = safeList.map((entry, idx) => ({
    sheetNumber: idx + 1,
    id: entry.id,
    sessionNumber: Number(entry.sessionNumber) || idx + 1,
    title: String(entry.title || `Entrada ${idx + 1}`).trim(),
    dateInGame: String(entry.dateInGame || entry.date || '').trim(),
    pagesOccupied: 1,
  }));
  return {
    totalSheets: items.length,
    items,
  };
}

export function formatModifier(mod: number): string {
  if (isNaN(mod)) return '+0';
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function calculateProficiencyBonus(level: number): number {
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return Math.floor((safeLevel - 1) / 4) + 2;
}

export function calculatePassivePerception(
  wisScore: number,
  proficiencyLevel: 'none' | 'proficient' | 'expertise',
  profBonus: number
): number {
  const wisMod = calculateModifier(wisScore);
  const bonus =
    proficiencyLevel === 'expertise'
      ? profBonus * 2
      : proficiencyLevel === 'proficient'
      ? profBonus
      : 0;
  return 10 + wisMod + bonus;
}

export function calculateSpellSaveDC(abilityScore: number, profBonus: number): number {
  return 8 + profBonus + calculateModifier(abilityScore);
}

export function calculateSpellAttackBonus(abilityScore: number, profBonus: number): number {
  return profBonus + calculateModifier(abilityScore);
}

export function calculateCarryCapacity(strScore: number): {
  maxCarry: number;
  pushDragLift: number;
} {
  const safeStr = Math.max(1, strScore || 10);
  return {
    maxCarry: safeStr * 15,
    pushDragLift: safeStr * 30,
  };
}

export function parseDiceExpression(expression: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const cleaned = expression.replace(/\s+/g, '').toLowerCase();
  const match = cleaned.match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!match) {
    // Check if it's just a number or simple dice
    return { count: 1, sides: 20, modifier: 0 };
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  return {
    count: Math.max(1, count),
    sides: Math.max(2, sides),
    modifier: isNaN(modifier) ? 0 : modifier,
  };
}

export interface EvaluatedD20 {
  rolls: number[];
  chosenRoll: number;
  modifier: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
}

export function evaluateD20Roll(
  modifier: number,
  mode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
  forcedRolls?: number[]
): EvaluatedD20 {
  let rolls: number[];

  if (forcedRolls && forcedRolls.length > 0) {
    rolls = [...forcedRolls];
  } else {
    if (mode === 'normal') {
      rolls = [Math.floor(Math.random() * 20) + 1];
    } else {
      rolls = [
        Math.floor(Math.random() * 20) + 1,
        Math.floor(Math.random() * 20) + 1,
      ];
    }
  }

  let chosenRoll = rolls[0];
  if (mode === 'advantage') {
    chosenRoll = Math.max(rolls[0], rolls[1] ?? rolls[0]);
  } else if (mode === 'disadvantage') {
    chosenRoll = Math.min(rolls[0], rolls[1] ?? rolls[0]);
  }

  const total = chosenRoll + modifier;
  const isCrit = chosenRoll === 20;
  const isFumble = chosenRoll === 1;

  return {
    rolls,
    chosenRoll,
    modifier,
    total,
    isCrit,
    isFumble,
  };
}

export function rollDiceExpression(expression: string): { rolls: number[]; total: number; formula: string } {
  const { count, sides, modifier } = parseDiceExpression(expression);
  const rolls: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  const total = Math.max(1, sum + modifier);
  return {
    rolls,
    total,
    formula: `${count}d${sides}${modifier > 0 ? '+' + modifier : modifier < 0 ? modifier : ''}`,
  };
}

export const ABILITY_SPANISH_LABELS: Record<
  'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',
  { nameEs: string; abbr: string; fullLabel: string }
> = {
  str: { nameEs: 'Fuerza', abbr: 'FUE', fullLabel: 'Fuerza (FUE)' },
  dex: { nameEs: 'Destreza', abbr: 'DES', fullLabel: 'Destreza (DES)' },
  con: { nameEs: 'Constitución', abbr: 'CON', fullLabel: 'Constitución (CON)' },
  int: { nameEs: 'Inteligencia', abbr: 'INT', fullLabel: 'Inteligencia (INT)' },
  wis: { nameEs: 'Sabiduría', abbr: 'SAB', fullLabel: 'Sabiduría (SAB)' },
  cha: { nameEs: 'Carisma', abbr: 'CAR', fullLabel: 'Carisma (CAR)' },
};

export function getSpanishAbilityLabel(ability: string): string {
  const key = (ability || 'str').toLowerCase() as keyof typeof ABILITY_SPANISH_LABELS;
  return ABILITY_SPANISH_LABELS[key]?.fullLabel || 'Fuerza (FUE)';
}

export type InventoryMainGroup = 'Armas' | 'Armaduras' | 'Objetos comunes';
export type PlayerSheetItemCategory = 'Arma' | 'Armadura' | 'Objeto Común';

export const PLAYER_SHEET_ITEM_CATEGORIES: readonly PlayerSheetItemCategory[] = [
  'Arma',
  'Armadura',
  'Objeto Común',
] as const;

function matchesWeaponKeywords(text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  return (
    norm === 'weapon' ||
    norm === 'arma' ||
    norm === 'armas' ||
    norm.startsWith('arma ') ||
    norm.startsWith('arma(') ||
    norm.includes('espada') ||
    norm.includes('arco') ||
    norm.includes('daga') ||
    norm.includes('hacha') ||
    norm.includes('maza') ||
    norm.includes('lanza') ||
    norm.includes('ballesta') ||
    norm.includes('martillo') ||
    norm.includes('bastón') ||
    norm.includes('mandoble') ||
    norm.includes('estoque')
  );
}

function matchesArmorKeywords(text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  return (
    norm === 'armor' ||
    norm === 'armadura' ||
    norm === 'armaduras' ||
    norm.startsWith('armadura') ||
    norm.includes('escudo') ||
    norm.includes('cota') ||
    norm.includes('cuero tachonado') ||
    norm.includes('placas')
  );
}

export function normalizePlayerSheetItemCategory(
  categoryOrItem?: string | { itemGroup?: string; category?: string; name?: string; weaponAttacks?: any } | null
): {
  category: PlayerSheetItemCategory;
  itemGroup: 'weapon' | 'armor' | 'common';
  mainGroup: InventoryMainGroup;
} {
  if (typeof categoryOrItem === 'object' && categoryOrItem !== null) {
    const rawCat = String(categoryOrItem.category || '').trim();
    const normCat = rawCat.toLowerCase();
    const grp = String(categoryOrItem.itemGroup || '').trim().toLowerCase();

    // If category was explicitly set to a custom/random value (e.g. "escamas de dragon") that is NOT a weapon or armor,
    // treat it as Objeto Común even if itemGroup defaulted to 'weapon' in the form!
    if (normCat) {
      if (matchesArmorKeywords(normCat)) {
        return { category: 'Armadura', itemGroup: 'armor', mainGroup: 'Armaduras' };
      }
      if (matchesWeaponKeywords(normCat)) {
        return { category: 'Arma', itemGroup: 'weapon', mainGroup: 'Armas' };
      }
      if (
        normCat === 'objeto común' ||
        normCat === 'objeto comun' ||
        normCat === 'objetos comunes' ||
        normCat === 'common' ||
        normCat === 'objeto'
      ) {
        return { category: 'Objeto Común', itemGroup: 'common', mainGroup: 'Objetos comunes' };
      }
      // Custom non-weapon, non-armor category (like "escamas de dragon", "tesoro", "poción") -> always Objeto Común
      if (!matchesWeaponKeywords(String(categoryOrItem.name || '')) && !matchesArmorKeywords(String(categoryOrItem.name || ''))) {
        return { category: 'Objeto Común', itemGroup: 'common', mainGroup: 'Objetos comunes' };
      }
    }

    if (grp === 'weapon' || grp === 'armas' || grp === 'arma') {
      return { category: 'Arma', itemGroup: 'weapon', mainGroup: 'Armas' };
    }
    if (grp === 'armor' || grp === 'armaduras' || grp === 'armadura') {
      return { category: 'Armadura', itemGroup: 'armor', mainGroup: 'Armaduras' };
    }
    if (grp === 'common' || grp === 'objetos comunes') {
      return { category: 'Objeto Común', itemGroup: 'common', mainGroup: 'Objetos comunes' };
    }

    const combined = `${categoryOrItem.category || ''} ${categoryOrItem.name || ''}`.trim().toLowerCase();
    if (matchesArmorKeywords(combined)) {
      return { category: 'Armadura', itemGroup: 'armor', mainGroup: 'Armaduras' };
    }
    if (matchesWeaponKeywords(combined)) {
      return { category: 'Arma', itemGroup: 'weapon', mainGroup: 'Armas' };
    }
    return { category: 'Objeto Común', itemGroup: 'common', mainGroup: 'Objetos comunes' };
  }

  const norm = String(categoryOrItem || '').trim().toLowerCase();
  if (matchesArmorKeywords(norm)) {
    return { category: 'Armadura', itemGroup: 'armor', mainGroup: 'Armaduras' };
  }
  if (matchesWeaponKeywords(norm)) {
    return { category: 'Arma', itemGroup: 'weapon', mainGroup: 'Armas' };
  }
  return { category: 'Objeto Común', itemGroup: 'common', mainGroup: 'Objetos comunes' };
}

export function classifyInventoryItemGroup(
  categoryOrItem?: string | { itemGroup?: string; category?: string; name?: string } | null
): InventoryMainGroup {
  return normalizePlayerSheetItemCategory(categoryOrItem).mainGroup;
}

export function classifyInventoryItemKey(
  categoryOrItem?: string | { itemGroup?: string; category?: string; name?: string } | null
): 'weapon' | 'armor' | 'common' {
  return normalizePlayerSheetItemCategory(categoryOrItem).itemGroup;
}


export function formatWeaponAttackFormula(dice: string, bonus: number): string {
  const cleanDice = String(dice || '1d6').trim().replace(/\s+/g, '');
  const numBonus = Number(bonus) || 0;
  if (numBonus > 0) return `${cleanDice}+${numBonus}`;
  if (numBonus < 0) return `${cleanDice}${numBonus}`;
  return cleanDice;
}

export interface DerivedEquippedAttack {
  id: string;
  weaponId: string;
  weaponName: string;
  name: string;
  attackName: string;
  description: string;
  dice: string;
  bonus: number;
  potenciador: number;
  formula: string;
  damageFormula: string;
  damageType: string;
  attackType: 'melee' | 'ranged' | 'spell';
  attackBonus: number;
  toHitBonus: number;
  range?: string;
  imageUrl?: string;
}

export function deriveEquippedWeaponAttacks(
  inventory: {
    id: string;
    name: string;
    itemGroup?: string;
    category?: string;
    equipped?: boolean;
    description?: string;
    imageUrl?: string;
    weaponAttacks?: {
      id: string;
      name: string;
      description: string;
      dice: string;
      bonus?: number;
      potenciador?: number;
      attackBonus?: number;
      damageType: string;
      attackType?: 'melee' | 'ranged' | 'spell';
      range?: string;
      imageUrl?: string;
    }[];
  }[],
  strScore: number = 10,
  dexScore: number = 10,
  profBonus: number = 2
): DerivedEquippedAttack[] {
  const strMod = calculateModifier(strScore);
  const dexMod = calculateModifier(dexScore);
  const result: DerivedEquippedAttack[] = [];
  const safeInventory = Array.isArray(inventory)
    ? inventory
    : Array.isArray((inventory as any)?.inventory)
    ? (inventory as any).inventory
    : [];

  for (const item of safeInventory) {
    if (!item.equipped) continue;
    const group = classifyInventoryItemGroup(item);
    if (group !== 'Armas') continue;

    if (Array.isArray(item.weaponAttacks) && item.weaponAttacks.length > 0) {
      item.weaponAttacks.forEach((atk, idx) => {
        const cleanDice = String(atk.dice || '1d6').trim();
        const pot = Number(atk.bonus ?? atk.potenciador) || 0;
        const aType = atk.attackType || 'melee';
        const statMod = aType === 'ranged' ? dexMod : strMod;
        const atkName = atk.name || `Ataque ${idx + 1}`;
        const dmgFormula = formatWeaponAttackFormula(cleanDice, pot);
        result.push({
          id: `${item.id}-atk-${atk.id || idx}`,
          weaponId: item.id,
          weaponName: item.name,
          name: atkName,
          attackName: atkName,
          description: atk.description || item.description || '',
          dice: cleanDice,
          bonus: pot,
          potenciador: pot,
          formula: dmgFormula,
          damageFormula: dmgFormula,
          damageType: atk.damageType || 'Cortante',
          attackType: aType,
          attackBonus: statMod + pot,
          toHitBonus: profBonus + statMod + pot,
          range: atk.range,
          imageUrl: atk.imageUrl || item.imageUrl,
        });
      });
    } else {
      // Fallback for legacy weapon without explicit weaponAttacks array
      const desc = item.description || '';
      const diceMatch = desc.match(/(\d+d\d+)([+-]\d+)?/i);
      const baseDice = diceMatch ? diceMatch[1] : '1d8';
      const parsedBonus = diceMatch && diceMatch[2] ? parseInt(diceMatch[2], 10) || 0 : 0;
      const isRanged = /distancia|arco|ballesta/i.test(desc) || /arco|ballesta/i.test(item.name);
      const aType = isRanged ? 'ranged' : 'melee';
      const statMod = isRanged ? dexMod : strMod;
      const dmgFormula = formatWeaponAttackFormula(baseDice, parsedBonus);

      result.push({
        id: `${item.id}-atk-default`,
        weaponId: item.id,
        weaponName: item.name,
        name: item.name,
        attackName: item.name,
        description: desc || 'Ataque principal con arma equipada',
        dice: baseDice,
        bonus: parsedBonus,
        potenciador: parsedBonus,
        formula: dmgFormula,
        damageFormula: dmgFormula,
        damageType: /perforante/i.test(desc)
          ? 'Perforante'
          : /contundente/i.test(desc)
          ? 'Contundente'
          : /fuego/i.test(desc)
          ? 'Fuego'
          : 'Cortante',
        attackType: aType,
        attackBonus: statMod + parsedBonus,
        toHitBonus: profBonus + statMod + parsedBonus,
        imageUrl: item.imageUrl,
      });
    }
  }

  return result;
}

export interface EquippedItemStatBonuses {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
  speed: number;
  maxHp: number;
  initiative: number;
  sources: Record<string, { itemName: string; value: number }[]>;
}

export function calculateEquippedItemStatBonuses(
  inventory?: {
    id: string;
    name: string;
    equipped?: boolean;
    statModifiers?: { id: string; stat: string; value: number; label?: string }[];
  }[]
): EquippedItemStatBonuses {
  const result: EquippedItemStatBonuses = {
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0,
    ac: 0,
    speed: 0,
    maxHp: 0,
    initiative: 0,
    sources: {
      str: [],
      dex: [],
      con: [],
      int: [],
      wis: [],
      cha: [],
      ac: [],
      speed: [],
      maxHp: [],
      initiative: [],
    },
  };

  const safeInv = Array.isArray(inventory) ? inventory : [];
  for (const item of safeInv) {
    if (!item.equipped) continue;
    if (Array.isArray(item.statModifiers)) {
      for (const mod of item.statModifiers) {
        const raw = (mod.stat || '').toLowerCase().trim();
        const statKey =
          raw === 'maxhp' || raw === 'hp'
            ? 'maxHp'
            : raw === 'ca' || raw === 'ac'
            ? 'ac'
            : raw === 'velocidad'
            ? 'speed'
            : raw === 'iniciativa'
            ? 'initiative'
            : raw;
        const val = Number(mod.value) || 0;
        if (statKey in result && typeof (result as any)[statKey] === 'number') {
          (result as any)[statKey] += val;
          if (result.sources[statKey]) {
            result.sources[statKey].push({
              itemName: item.name || 'Objeto equipado',
              value: val,
            });
          }
        }
      }
    }
  }

  return result;
}

export interface DerivedCharacterAction {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceKind: 'weapon' | 'armor' | 'item' | 'spell' | 'feature';
  name: string;
  actionName?: string;
  description: string;
  dice: string;
  bonus: number;
  potenciador: number;
  formula: string;
  damageFormula: string;
  damageDice?: string;
  damageType: string;
  actionType: 'melee' | 'ranged' | 'spell' | 'action' | 'bonus' | 'reaction' | 'special';
  attackBonus: number;
  toHitBonus: number;
  range?: string;
  usesMax?: number;
  usesLeft?: number;
  recharge?: string;
  isSpecialAction?: boolean;
  imageUrl?: string;
}

export function deriveAllCharacterActions(
  paramsOrInventory:
    | {
        inventory?: {
          id: string;
          name: string;
          itemGroup?: string;
          category?: string;
          equipped?: boolean;
          description?: string;
          imageUrl?: string;
          weaponAttacks?: {
            id: string;
            name: string;
            description: string;
            dice: string;
            bonus?: number;
            potenciador?: number;
            attackBonus?: number;
            damageType: string;
            attackType?: 'melee' | 'ranged' | 'spell';
            range?: string;
            imageUrl?: string;
          }[];
          itemActions?: {
            id: string;
            name: string;
            description: string;
            dice: string;
            bonus?: number;
            potenciador?: number;
            attackBonus?: number;
            damageType: string;
            actionType?: 'action' | 'bonus' | 'reaction' | 'melee' | 'ranged' | 'spell' | 'special';
            range?: string;
            usesMax?: number;
            usesLeft?: number;
            recharge?: string;
            imageUrl?: string;
          }[];
        }[];
        spells?: {
          id: string;
          name: string;
          description?: string;
          prepared?: boolean;
          imageUrl?: string;
          itemActions?: {
            id: string;
            name: string;
            description: string;
            dice: string;
            bonus?: number;
            potenciador?: number;
            damageType: string;
            range?: string;
            imageUrl?: string;
          }[];
        }[];
        features?: {
          id: string;
          name: string;
          description?: string;
          imageUrl?: string;
          itemActions?: {
            id: string;
            name: string;
            description: string;
            dice: string;
            bonus?: number;
            potenciador?: number;
            damageType: string;
            range?: string;
            imageUrl?: string;
          }[];
        }[];
        attacks?: {
          id: string;
          name: string;
          type?: 'melee' | 'ranged' | 'spell';
          attackBonus?: number;
          damageDice?: string;
          damageType?: string;
          notes?: string;
          description?: string;
          imageUrl?: string;
        }[];
        strScore?: number;
        dexScore?: number;
        profBonus?: number;
      }
    | any[],
  spellsArg?: any[],
  featuresArg?: any[],
  strScoreArg?: number,
  dexScoreArg?: number,
  profBonusArg?: number
): DerivedCharacterAction[] {
  let inventory: any[] = [];
  let spells: any[] = [];
  let features: any[] = [];
  let attacks: any[] = [];
  let strScore = 10;
  let dexScore = 10;
  let profBonus = 2;

  if (Array.isArray(paramsOrInventory)) {
    inventory = paramsOrInventory;
    spells = spellsArg || [];
    features = featuresArg || [];
    strScore = strScoreArg ?? 10;
    dexScore = dexScoreArg ?? 10;
    profBonus = profBonusArg ?? 2;
  } else if (paramsOrInventory && typeof paramsOrInventory === 'object') {
    inventory = paramsOrInventory.inventory || [];
    spells = paramsOrInventory.spells || [];
    features = paramsOrInventory.features || [];
    attacks = paramsOrInventory.attacks || [];
    strScore = paramsOrInventory.strScore ?? 10;
    dexScore = paramsOrInventory.dexScore ?? 10;
    profBonus = paramsOrInventory.profBonus ?? 2;
  }

  const result: DerivedCharacterAction[] = [];

  // 1. Equipped weapon attacks
  const weaponAttacks = deriveEquippedWeaponAttacks(inventory, strScore, dexScore, profBonus);
  for (const wa of weaponAttacks) {
    result.push({
      ...wa,
      sourceId: wa.weaponId,
      sourceName: wa.weaponName,
      sourceKind: 'weapon',
      actionName: wa.name,
      damageDice: wa.formula || wa.dice,
      actionType: wa.attackType,
      isSpecialAction: false,
      imageUrl: wa.imageUrl,
    });
  }

  // 2. Equipped items with special actions
  for (const item of inventory) {
    if (!item.equipped) continue;
    if (Array.isArray(item.itemActions) && item.itemActions.length > 0) {
      item.itemActions.forEach((act: any, idx: number) => {
        const cleanDice = String(act.dice || '1d6').trim();
        const pot = Number(act.bonus ?? act.potenciador) || 0;
        const dmgFormula = formatWeaponAttackFormula(cleanDice, pot);
        const aType = act.actionType || 'action';
        const actName = act.name || `Acción ${idx + 1}`;
        const sourceKind = item.itemGroup === 'weapon' ? 'weapon' : item.itemGroup === 'armor' ? 'armor' : 'item';

        result.push({
          id: `${item.id}-act-${act.id || idx}`,
          sourceId: item.id,
          sourceName: item.name,
          sourceKind,
          name: actName,
          actionName: actName,
          description: act.description || item.description || '',
          dice: cleanDice,
          bonus: pot,
          potenciador: pot,
          formula: dmgFormula,
          damageFormula: dmgFormula,
          damageDice: dmgFormula,
          damageType: act.damageType || 'Especial',
          actionType: aType,
          attackBonus: pot,
          toHitBonus: profBonus + pot,
          range: act.range || '5 pies',
          usesMax: act.usesMax,
          usesLeft: act.usesLeft,
          recharge: act.recharge,
          isSpecialAction: true,
          imageUrl: act.imageUrl || item.imageUrl,
        });
      });
    }
  }

  // 3. Spells with special actions
  for (const sp of spells) {
    if (sp.prepared === false) continue;
    if (Array.isArray(sp.itemActions) && sp.itemActions.length > 0) {
      sp.itemActions.forEach((act: any, idx: number) => {
        const cleanDice = String(act.dice || '1d8').trim();
        const pot = Number(act.bonus ?? act.potenciador) || 0;
        const dmgFormula = formatWeaponAttackFormula(cleanDice, pot);
        result.push({
          id: `${sp.id}-spact-${act.id || idx}`,
          sourceId: sp.id,
          sourceName: sp.name,
          sourceKind: 'spell',
          name: act.name || sp.name,
          actionName: act.name || sp.name,
          description: act.description || sp.description || '',
          dice: cleanDice,
          bonus: pot,
          potenciador: pot,
          formula: dmgFormula,
          damageFormula: dmgFormula,
          damageType: act.damageType || 'Radiante',
          actionType: 'spell',
          attackBonus: pot,
          toHitBonus: profBonus + pot,
          range: act.range || '60 pies',
          isSpecialAction: true,
          imageUrl: act.imageUrl || sp.imageUrl,
        });
      });
    }
  }

  // 4. Features with special actions
  for (const feat of features) {
    if (Array.isArray(feat.itemActions) && feat.itemActions.length > 0) {
      feat.itemActions.forEach((act: any, idx: number) => {
        const cleanDice = String(act.dice || '1d6').trim();
        const pot = Number(act.bonus ?? act.potenciador) || 0;
        const dmgFormula = formatWeaponAttackFormula(cleanDice, pot);
        result.push({
          id: `${feat.id}-featact-${act.id || idx}`,
          sourceId: feat.id,
          sourceName: feat.name,
          sourceKind: 'feature',
          name: act.name || feat.name,
          actionName: act.name || feat.name,
          description: act.description || feat.description || '',
          dice: cleanDice,
          bonus: pot,
          potenciador: pot,
          formula: dmgFormula,
          damageFormula: dmgFormula,
          damageType: act.damageType || 'Especial',
          actionType: 'action',
          attackBonus: pot,
          toHitBonus: profBonus + pot,
          range: act.range || 'Personal',
          isSpecialAction: true,
          imageUrl: act.imageUrl || feat.imageUrl,
        });
      });
    }
  }

  // 5. Custom Attacks added directly to character.attacks (not already covered by weaponAttacks)
  if (Array.isArray(attacks)) {
    const existingNames = new Set(result.map((r) => (r.name || '').trim().toLowerCase()));
    for (const atk of attacks) {
      if (!atk || !atk.name) continue;
      const normName = String(atk.name).trim().toLowerCase();
      if (existingNames.has(normName)) continue;
      const cleanDice = String(atk.damageDice || '1d6').trim();
      const hitBon = Number(atk.attackBonus) || 0;
      result.push({
        id: atk.id || `custom-atk-${normName}`,
        sourceId: atk.id || normName,
        sourceName: 'ATAQUE PERSONALIZADO',
        sourceKind: 'weapon',
        name: atk.name,
        actionName: atk.name,
        description: atk.notes || atk.description || '',
        dice: cleanDice,
        bonus: 0,
        potenciador: 0,
        formula: cleanDice,
        damageFormula: cleanDice,
        damageDice: cleanDice,
        damageType: atk.damageType || 'Cortante',
        actionType: atk.type || 'melee',
        attackBonus: hitBon,
        toHitBonus: hitBon,
        isSpecialAction: false,
        imageUrl: atk.imageUrl,
      });
    }
  }

  return result;
}

export function formatCompactRollDieBadge(
  roll?: {
    total?: number;
    chosenRoll?: number;
    diceType?: number;
    formula?: string;
    isCritSuccess?: boolean;
    isCritFail?: boolean;
  } | null
): {
  displayValue: number;
  diceLabel: string;
  sides: 4 | 6 | 8 | 10 | 12 | 20 | 100;
  isCritSuccess: boolean;
  isCritFail: boolean;
} | null {
  if (!roll) return null;
  const displayValue = Number(roll.total ?? roll.chosenRoll ?? 0);
  const rawFormula = String(roll.formula || '').trim();
  const diceMatch = rawFormula.match(/(\d+d\d+)/i);
  const fallbackSides = Number(roll.diceType) || 20;
  const diceLabel = diceMatch ? diceMatch[1].toLowerCase() : `1d${fallbackSides}`;
  const sidesMatch = diceLabel.match(/d(\d+)/i);
  const parsedSides = sidesMatch ? parseInt(sidesMatch[1], 10) : fallbackSides;
  const validSides: (4 | 6 | 8 | 10 | 12 | 20 | 100)[] = [4, 6, 8, 10, 12, 20, 100];
  const sides = (validSides.includes(parsedSides as any) ? parsedSides : 20) as 4 | 6 | 8 | 10 | 12 | 20 | 100;

  return {
    displayValue,
    diceLabel,
    sides,
    isCritSuccess: Boolean(roll.isCritSuccess),
    isCritFail: Boolean(roll.isCritFail),
  };
}

export function normalizeRoomIdentifier(raw?: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function validateUniqueRoomNameAndCode(params: {
  proposedRoomCode: string;
  proposedName?: string;
  excludeWorldId?: string;
  requesterEmail?: string;
  existingWorlds: { id: string; name?: string; roomCode?: string; ownerEmail?: string }[];
  activeRooms?: { roomCode: string; name?: string; dmEmail?: string; worldSheetId?: string }[];
}): { valid: boolean; error?: string } {
  const normCode = normalizeRoomIdentifier(params.proposedRoomCode);
  const normName = normalizeRoomIdentifier(params.proposedName || params.proposedRoomCode);

  if (!normCode) {
    return { valid: false, error: 'El nombre o código de la sala es obligatorio.' };
  }

  for (const w of params.existingWorlds || []) {
    if (params.excludeWorldId && w.id === params.excludeWorldId) continue;
    const wCode = normalizeRoomIdentifier(w.roomCode);
    const wName = normalizeRoomIdentifier(w.name);

    if (wCode && (wCode === normCode || (normName && wCode === normName))) {
      return {
        valid: false,
        error: `Ya existe una sala/mesa registrada con el código o nombre "${w.roomCode || w.name}". Elige un nombre único para evitar confusión entre salas.`,
      };
    }
    if (wName && normName && (wName === normName || wName === normCode)) {
      return {
        valid: false,
        error: `Ya existe una sala/mesa llamada "${w.name}". No pueden existir múltiples salas con el mismo nombre.`,
      };
    }
  }

  for (const r of params.activeRooms || []) {
    if (params.excludeWorldId && r.worldSheetId && r.worldSheetId === params.excludeWorldId) {
      continue;
    }
    const rCode = normalizeRoomIdentifier(r.roomCode);
    const rName = normalizeRoomIdentifier(r.name);
    const sameOwner =
      params.requesterEmail &&
      r.dmEmail &&
      r.dmEmail.trim().toLowerCase() === params.requesterEmail.trim().toLowerCase() &&
      !r.worldSheetId;

    if (!sameOwner) {
      if (rCode && (rCode === normCode || (normName && rCode === normName))) {
        return {
          valid: false,
          error: `La sala/mesa "${r.roomCode}" ya se encuentra activa o registrada por otro Dungeon Master.`,
        };
      }
      if (rName && normName && (rName === normName || rName === normCode)) {
        return {
          valid: false,
          error: `La sala/mesa "${r.name}" ya se encuentra activa o registrada por otro Dungeon Master.`,
        };
      }
    }
  }

  return { valid: true };
}

export function validateUniqueUserIdentity(params: {
  displayName?: string;
  userTagId?: string;
  excludeUserId?: string;
  existingUsers: { id: string; displayName: string; userTagId?: string }[];
}): { valid: boolean; error?: string } {
  const normName = String(params.displayName || '').trim().toLowerCase();
  const normTag = String(params.userTagId || '')
    .replace(/^@+/, '')
    .trim()
    .toLowerCase();

  for (const u of params.existingUsers || []) {
    if (params.excludeUserId && u.id === params.excludeUserId) continue;
    const uName = String(u.displayName || '').trim().toLowerCase();
    const uTag = String(u.userTagId || '')
      .replace(/^@+/, '')
      .trim()
      .toLowerCase();

    if (normName && uName === normName) {
      return {
        valid: false,
        error: `El nombre de usuario "${params.displayName?.trim()}" ya está en uso. El nombre de usuario debe ser único.`,
      };
    }
    if (normTag && uTag === normTag) {
      return {
        valid: false,
        error: `El ID "@${normTag}" ya está registrado por otro usuario (${u.displayName}@${u.userTagId}). El ID debe ser único en todos los usuarios.`,
      };
    }
  }

  return { valid: true };
}

export function deduplicateUsersIdentity<
  T extends { id: string; displayName: string; userTagId?: string; email?: string }
>(users: T[]): { users: T[]; changed: boolean } {
  const usedNames = new Set<string>();
  const usedTags = new Set<string>();
  let changed = false;

  const candidateChars = '123456789abcdefghjkmnpqrstuvwxyz';
  const pickUniqueTag = (base: string): string => {
    const cleanBase = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 3) || '123';
    if (!usedTags.has(cleanBase)) return cleanBase;
    for (let i = 1; i < 999; i++) {
      const candidate = String(i).padStart(3, '0').slice(0, 3);
      if (!usedTags.has(candidate)) return candidate;
    }
    for (let a = 0; a < candidateChars.length; a++) {
      for (let b = 0; b < candidateChars.length; b++) {
        const candidate = `u${candidateChars[a]}${candidateChars[b]}`;
        if (!usedTags.has(candidate)) return candidate;
      }
    }
    return '999';
  };

  const result = users.map((u, idx) => {
    const copy = { ...u };
    let rawName = String(copy.displayName || `Usuario${idx + 1}`).trim();
    if (!rawName) rawName = `Usuario${idx + 1}`;

    if (usedNames.has(rawName.toLowerCase())) {
      let suffix = 2;
      while (usedNames.has(`${rawName}_${suffix}`.toLowerCase())) {
        suffix++;
      }
      copy.displayName = `${rawName}_${suffix}`;
      changed = true;
    }
    usedNames.add(copy.displayName.trim().toLowerCase());

    const rawTag = String(copy.userTagId || '')
      .replace(/^@+/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 3);
    const uniqueTag = pickUniqueTag(rawTag || `u${idx + 1}`);
    if (uniqueTag !== copy.userTagId) {
      copy.userTagId = uniqueTag;
      changed = true;
    }
    usedTags.add(uniqueTag.toLowerCase());

    return copy;
  });

  return { users: result, changed };
}

export function buildPlayerMessageToDM(params: {
  id?: string;
  roomCode: string;
  characterId: string;
  characterName: string;
  playerName: string;
  playerTagId?: string;
  playerEmail?: string;
  title: string;
  description: string;
  createdAt?: number;
}) {
  const cleanTitle = String(params.title || '').trim();
  const cleanDesc = String(params.description || '').trim();
  if (!cleanTitle || !cleanDesc) {
    throw new Error('El título y la descripción del mensaje son obligatorios.');
  }
  const cleanTag =
    String(params.playerTagId || '')
      .replace(/^@+/, '')
      .trim() || '123';
  const cleanPlayer = String(params.playerName || 'Jugador').trim();

  return {
    id: params.id || `pmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roomCode: normalizeRoomIdentifier(params.roomCode) || 'MESA-PRINCIPAL',
    characterId: String(params.characterId || 'char-unknown'),
    characterName: String(params.characterName || 'Aventurero').trim(),
    playerName: cleanPlayer,
    playerTagId: cleanTag,
    playerFullTag: cleanPlayer.includes('@') ? cleanPlayer : `${cleanPlayer}@${cleanTag}`,
    playerEmail: params.playerEmail,
    title: cleanTitle,
    description: cleanDesc,
    createdAt: params.createdAt || Date.now(),
    read: false,
  };
}

export function stepInitiativeTurn(
  currentTurnIndex: number,
  round: number,
  combatantsCount: number,
  direction: 'next' | 'prev'
): { currentTurnIndex: number; round: number } {
  const safeRound = Math.max(1, Number(round) || 1);
  if (combatantsCount <= 0) {
    return { currentTurnIndex: 0, round: safeRound };
  }
  const safeIndex = Math.max(0, Math.min(combatantsCount - 1, Number(currentTurnIndex) || 0));

  if (direction === 'next') {
    const nextIdx = (safeIndex + 1) % combatantsCount;
    const nextRound = nextIdx === 0 ? safeRound + 1 : safeRound;
    return { currentTurnIndex: nextIdx, round: nextRound };
  } else {
    if (safeIndex > 0) {
      return { currentTurnIndex: safeIndex - 1, round: safeRound };
    }
    return {
      currentTurnIndex: combatantsCount - 1,
      round: Math.max(1, safeRound - 1),
    };
  }
}

export interface AtlasBreadcrumbSegment {
  label: string;
  folderPath: string;
  fullPath: string;
  depth: number;
}

export function buildAtlasBreadcrumbs(selectedFolder: string): AtlasBreadcrumbSegment[] {
  const crumbs: AtlasBreadcrumbSegment[] = [
    { label: 'Mundo', folderPath: 'all', fullPath: 'all', depth: 0 },
  ];

  const clean = String(selectedFolder || '').trim();
  if (!clean || clean === 'all') {
    return crumbs;
  }

  const parts = clean
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  let cumulative = '';
  parts.forEach((part, idx) => {
    cumulative = cumulative ? `${cumulative} / ${part}` : part;
    crumbs.push({
      label: part,
      folderPath: cumulative,
      fullPath: cumulative,
      depth: idx + 1,
    });
  });

  return crumbs;
}

export function getParentAtlasFolder(selectedFolder: string): string {
  const crumbs = buildAtlasBreadcrumbs(selectedFolder);
  if (crumbs.length <= 1) return 'all';
  return crumbs[crumbs.length - 2].folderPath || 'all';
}

export function getParentPlaceDisplayName(selectedFolder: string, worldName?: string): string {
  const crumbs = buildAtlasBreadcrumbs(selectedFolder);
  if (crumbs.length <= 1) {
    return worldName?.trim() || 'Mundo';
  }
  const parentCrumb = crumbs[crumbs.length - 2];
  if (!parentCrumb || parentCrumb.folderPath === 'all') {
    return worldName?.trim() || 'Mundo';
  }
  return parentCrumb.label || 'Mundo';
}

export function getReturnToParentButtonLabel(selectedFolder: string, worldName?: string): string {
  const parentName = getParentPlaceDisplayName(selectedFolder, worldName);
  return `Regresar a ${parentName}`;
}

export interface VisualQueueItemPure {
  queueId: string;
  id: string;
  sourceId?: string;
  kind: 'map' | 'album' | 'tactical';
  title: string;
  imageUrl: string;
  folder: string;
  addedAt: number;
}

export function enqueueVisualItem(
  queue: VisualQueueItemPure[] | undefined | null,
  item: {
    queueId?: string;
    id?: string;
    sourceId?: string;
    kind: 'map' | 'album' | 'tactical';
    title: string;
    imageUrl?: string;
    folder?: string;
    addedAt?: number;
  }
): VisualQueueItemPure[] {
  const safeQueue = Array.isArray(queue) ? [...queue] : [];
  const cleanId = String(item.id || item.sourceId || `vis-${Date.now()}`).trim();
  const cleanTitle = String(item.title || 'Visual').trim();
  const cleanFolder = String(item.folder || 'all').trim() || 'all';
  const cleanUrl = String(item.imageUrl || '').trim();

  // Avoid duplicate if exact same id + kind is already in the queue
  const existingIdx = safeQueue.findIndex(
    (q) => (q.id === cleanId || q.sourceId === cleanId) && q.kind === item.kind
  );
  if (existingIdx !== -1) {
    const updated = [...safeQueue];
    updated[existingIdx] = {
      ...updated[existingIdx],
      title: cleanTitle,
      imageUrl: cleanUrl,
      folder: cleanFolder,
    };
    return updated;
  }

  const nextItem: VisualQueueItemPure = {
    queueId: item.queueId || `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    id: cleanId,
    sourceId: cleanId,
    kind: item.kind,
    title: cleanTitle,
    imageUrl: cleanUrl,
    folder: cleanFolder,
    addedAt: item.addedAt || Date.now(),
  };

  return [...safeQueue, nextItem];
}

export function removeVisualFromQueue(
  queue: VisualQueueItemPure[] | undefined | null,
  queueIdOrItemId: string
): VisualQueueItemPure[] {
  const safeQueue = Array.isArray(queue) ? queue : [];
  const target = String(queueIdOrItemId || '').trim();
  if (!target) return safeQueue;
  return safeQueue.filter(
    (q) => q.queueId !== target && q.id !== target && q.sourceId !== target
  );
}

export interface TacticalTokenPure {
  id: string;
  label: string;
  kind: 'player' | 'monster' | 'npc' | 'enemy';
  x?: number;
  y?: number;
  col?: number;
  row?: number;
  color?: string;
  avatarUrl?: string;
  linkedId?: string;
}

export function moveTacticalTokenOnGrid(
  tokens: TacticalTokenPure[] | undefined | null,
  tokenId: string,
  targetX: number,
  targetY: number,
  gridCols: number = 10,
  gridRows: number = 8
): TacticalTokenPure[] {
  const safeTokens = Array.isArray(tokens) ? tokens : [];
  const safeCols = Math.max(2, Math.min(30, Number(gridCols) || 10));
  const safeRows = Math.max(2, Math.min(30, Number(gridRows) || 8));
  const clampedX = Math.max(0, Math.min(safeCols - 1, Math.round(Number(targetX) || 0)));
  const clampedY = Math.max(0, Math.min(safeRows - 1, Math.round(Number(targetY) || 0)));

  return safeTokens.map((t) =>
    t.id === tokenId
      ? {
          ...t,
          x: clampedX,
          y: clampedY,
          col: clampedX,
          row: clampedY,
        }
      : t
  );
}

export function ensureCompleteFolderHierarchy(rawFolders: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawFolders || []) {
    const parts = String(raw || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4); // Up to 4 hierarchical levels under Mundo

    let cumulative = '';
    for (const part of parts) {
      cumulative = cumulative ? `${cumulative} / ${part}` : part;
      if (!seen.has(cumulative)) {
        seen.add(cumulative);
        result.push(cumulative);
      }
    }
  }

  return result;
}

export function getChildFoldersForAtlas(allFolders: string[], selectedFolder: string): string[] {
  const cleanSelected = String(selectedFolder || 'all').trim();
  const list = ensureCompleteFolderHierarchy(Array.isArray(allFolders) ? allFolders : []);
  const depthOf = (path: string) =>
    String(path || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean).length;

  if (!cleanSelected || cleanSelected === 'all') {
    return list.filter((f) => depthOf(f) === 1);
  }

  const targetDepth = depthOf(cleanSelected) + 1;
  if (targetDepth > 4) return [];
  const prefix = `${cleanSelected} / `;
  return list.filter((f) => f.startsWith(prefix) && depthOf(f) === targetDepth);
}

export function getPinPositionForChildPlace(
  childFolderPath: string,
  index: number,
  total: number,
  customPositions?: Record<string, { x: number; y: number }>
): { x: number; y: number } {
  const custom = customPositions?.[childFolderPath];
  if (
    custom &&
    typeof custom.x === 'number' &&
    typeof custom.y === 'number' &&
    !isNaN(custom.x) &&
    !isNaN(custom.y)
  ) {
    return {
      x: Math.max(8, Math.min(92, Math.round(custom.x))),
      y: Math.max(10, Math.min(90, Math.round(custom.y))),
    };
  }

  // Deterministic well-distributed default positions on a square/rectangular map
  const safeTotal = Math.max(1, total);
  if (safeTotal === 1) {
    return { x: 50, y: 50 };
  }
  const presets = [
    { x: 26, y: 36 },
    { x: 68, y: 34 },
    { x: 46, y: 68 },
    { x: 24, y: 72 },
    { x: 74, y: 70 },
    { x: 50, y: 28 },
  ];
  if (index < presets.length) {
    return presets[index];
  }
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: Math.max(15, Math.min(85, 22 + col * 28)),
    y: Math.max(18, Math.min(84, 25 + (row % 3) * 26)),
  };
}

export function filterAlbumPhotosByPlace<T extends { folder?: string }>(
  photos: T[],
  selectedFolder: string
): T[] {
  const safePhotos = Array.isArray(photos) ? photos : [];
  const cleanSelected = String(selectedFolder || 'all').trim();
  if (!cleanSelected || cleanSelected === 'all') {
    return safePhotos;
  }
  return safePhotos.filter((p) => {
    const f = String(p.folder || '').trim();
    return f === cleanSelected || f.startsWith(`${cleanSelected} / `);
  });
}

export interface AlignmentDescriptor {
  ethics: 'chaotic' | 'neutral' | 'lawful';
  morality: 'good' | 'neutral' | 'evil';
  shape: 'spiral' | 'equilibrium' | 'scales';
  colorTone: 'green' | 'gray' | 'red';
  labelEs: string;
  descriptionEs: string;
}

export function parseAlignmentDescriptor(alignment?: string): AlignmentDescriptor {
  const raw = String(alignment || 'Neutral Bueno').trim().toLowerCase();

  let ethics: 'chaotic' | 'neutral' | 'lawful' = 'neutral';
  if (raw.includes('caótic') || raw.includes('caotic') || raw.includes('chaotic')) {
    ethics = 'chaotic';
  } else if (raw.includes('legal') || raw.includes('lawful')) {
    ethics = 'lawful';
  }

  let morality: 'good' | 'neutral' | 'evil' = 'neutral';
  if (raw.includes('buen') || raw.includes('good')) {
    morality = 'good';
  } else if (raw.includes('malvad') || raw.includes('malo') || raw.includes('mala') || raw.includes('evil')) {
    morality = 'evil';
  }

  const shape: 'spiral' | 'equilibrium' | 'scales' =
    ethics === 'chaotic' ? 'spiral' : ethics === 'lawful' ? 'scales' : 'equilibrium';

  const colorTone: 'green' | 'gray' | 'red' =
    morality === 'good' ? 'green' : morality === 'evil' ? 'red' : 'gray';

  const ethicsLabel =
    ethics === 'chaotic' ? 'Caótico' : ethics === 'lawful' ? 'Legal' : 'Neutral';
  const moralityLabel =
    morality === 'good' ? 'Bueno' : morality === 'evil' ? 'Malvado' : 'Neutral';

  const labelEs =
    ethics === 'neutral' && morality === 'neutral'
      ? 'Neutral Verdadero'
      : `${ethicsLabel} ${moralityLabel}`;

  const descriptionsMap: Record<string, string> = {
    'Legal Bueno': 'Sigue el honor, la justicia y la ley para proteger y ayudar a los demás.',
    'Neutral Bueno': 'Hace el bien y ayuda a los demás guiado por su corazón, sin atarse al orden ni al caos.',
    'Caótico Bueno': 'Actúa según su conciencia y libertad personal, buscando el bien por encima de reglas.',
    'Legal Neutral': 'Se rige por la ley, la tradición o un código personal estricto por encima del bien o el mal.',
    'Neutral Verdadero': 'Busca el equilibrio natural o actúa con pragmatismo sin tomar partido extremo.',
    'Caótico Neutral': 'Sigue sus propios impulsos y valora su libertad individual por encima de todo.',
    'Legal Malvado': 'Utiliza las leyes, jerarquías y el orden metódicamente para obtener poder propio.',
    'Neutral Malvado': 'Busca su propio beneficio sin escrúpulos, aliándose o traicionando según convenga.',
    'Caótico Malvado': 'Guiado por la destrucción, la codicia o la furia sin respeto por leyes ni vidas.',
  };

  return {
    ethics,
    morality,
    shape,
    colorTone,
    labelEs,
    descriptionEs: descriptionsMap[labelEs] || 'Orientación moral y ética del personaje.',
  };
}

export const MAX_ENCOUNTER_ENEMIES = 8;

export function canAddEnemyToEncounter(
  combatants?: { faction?: string; isPlayer?: boolean }[],
  maxEnemies: number = MAX_ENCOUNTER_ENEMIES
): { enemyCount: number; maxEnemies: number; canAdd: boolean } {
  const list = Array.isArray(combatants) ? combatants : [];
  const enemyCount = list.filter(
    (c) => (c.faction || (c.isPlayer ? 'ally' : 'enemy')) === 'enemy'
  ).length;
  return {
    enemyCount,
    maxEnemies,
    canAdd: enemyCount < maxEnemies,
  };
}

export interface LiveProjectionWorkspaceInput {
  activeAtlasFolder?: string;
  autoSyncLiveOnZoneChange?: boolean;
  atlasMaps?: Record<string, string>;
  tacticalTokensByMapId?: Record<string, TacticalTokenPure[]>;
    activeLiveVisual?: {
    kind: 'map' | 'album' | 'photo' | 'tactical';
    id: string;
    title: string;
    imageUrl?: string;
    folder?: string;
    tacticalConfig?: any;
  } | null;
  activeSessionVisual?: {
    kind?: 'map' | 'album' | 'photo' | 'tactical';
    id?: string;
    title?: string;
    imageUrl?: string;
    tacticalConfig?: any;
  } | null;
  locations?: {
    id?: string;
    name?: string;
    folder?: string;
    mapImageUrl?: string;
    gridCols?: number;
    gridRows?: number;
    tacticalTokens?: TacticalTokenPure[];
    tacticalConfig?: any;
  }[];
  placeAlbumPhotos?: {
    id: string;
    title: string;
    imageUrl: string;
    folder?: string;
    placePath?: string;
  }[];
}

export function buildLiveProjectionFromWorkspace(
  targetWs?: LiveProjectionWorkspaceInput | null,
  worldName?: string
): {
  locationName: string;
  locationFolder: string;
  visualId?: string;
  visualKind: 'map' | 'photo' | 'tactical';
  visualTitle: string;
  visualImageUrl: string;
  gridCols?: number;
  gridRows?: number;
  tacticalTokens?: TacticalTokenPure[];
  tacticalConfig?: any;
  galleryPhotos: { id: string; title: string; imageUrl: string; placePath?: string }[];
} {
  const preferLiveVisualFolder =
    !targetWs?.autoSyncLiveOnZoneChange && Boolean(targetWs?.activeLiveVisual?.folder);
  const rawFolder = String(
    (preferLiveVisualFolder
      ? targetWs?.activeLiveVisual?.folder
      : targetWs?.activeAtlasFolder || targetWs?.activeLiveVisual?.folder) || 'all'
  ).trim();
  const activeFolder = !rawFolder || rawFolder === 'Todos' ? 'all' : rawFolder;

  const matchingLoc = (targetWs?.locations || []).find(
    (l) => (l.folder || 'General') === activeFolder || l.name === activeFolder
  );

  const shortFolderName =
    activeFolder === 'all'
      ? worldName || matchingLoc?.name || targetWs?.locations?.[0]?.name || 'Mundo Completo'
      : activeFolder
          .split('/')
          .map((s) => s.trim())
          .filter(Boolean)
          .pop() || activeFolder;

  const locationName =
    activeFolder === 'all'
      ? worldName || matchingLoc?.name || targetWs?.locations?.[0]?.name || 'Mundo Completo'
      : shortFolderName;

  const galleryPhotos = filterAlbumPhotosByPlace(targetWs?.placeAlbumPhotos || [], activeFolder);

  const atlasMapUrl =
    targetWs?.atlasMaps?.[activeFolder] ||
    (activeFolder === 'all' ? '' : targetWs?.atlasMaps?.['all'] || '') ||
    matchingLoc?.mapImageUrl ||
    '';

  const activeVisual = targetWs?.activeLiveVisual || targetWs?.activeSessionVisual;

  const normalizedKind = (
    rawKind?: string
  ): 'map' | 'photo' | 'tactical' => {
    if (rawKind === 'album' || rawKind === 'photo') return 'photo';
    if (rawKind === 'tactical') return 'tactical';
    return 'map';
  };

  let visualKind: 'map' | 'photo' | 'tactical' = 'map';
  let visualTitle = locationName;
  let visualImageUrl = '';
  let visualId = activeVisual?.id || `map-${activeFolder}`;

  if (activeVisual && (activeVisual.kind === 'tactical' || activeVisual.tacticalConfig)) {
    visualKind = 'tactical';
    visualTitle = activeVisual.title || locationName;
    visualImageUrl = activeVisual.imageUrl || activeVisual.tacticalConfig?.layers?.[0]?.bgImageUrl || '';
  } else if (activeVisual && activeVisual.imageUrl) {
    visualKind = normalizedKind(activeVisual.kind);
    visualTitle = activeVisual.title || locationName;
    visualImageUrl = activeVisual.imageUrl;
  } else if (atlasMapUrl) {
    visualKind = 'map';
    visualTitle = `Mapa: ${locationName}`;
    visualImageUrl = atlasMapUrl;
  } else if (galleryPhotos[0]?.imageUrl) {
    visualKind = 'photo';
    visualTitle = galleryPhotos[0].title || locationName;
    visualImageUrl = galleryPhotos[0].imageUrl;
    visualId = galleryPhotos[0].id;
  } else if (activeVisual) {
    visualKind = normalizedKind(activeVisual.kind);
    visualTitle = activeVisual.title || locationName;
    visualImageUrl = '';
  }

  const matchedTacticalLoc = (targetWs?.locations || []).find(
    (l) =>
      l.id === visualId ||
      `tactical-${l.tacticalConfig?.id}` === visualId ||
      `loc-tactical-${l.tacticalConfig?.id}` === l.id ||
      l.name === visualTitle
  );
  const resolvedTacticalConfig =
    activeVisual?.tacticalConfig || matchedTacticalLoc?.tacticalConfig;
  const resolvedTokens =
    targetWs?.tacticalTokensByMapId?.[visualId] ||
    matchedTacticalLoc?.tacticalTokens ||
    [];

  return {
    locationName,
    locationFolder: activeFolder,
    visualId,
    visualKind,
    visualTitle,
    visualImageUrl,
    gridCols:
      resolvedTacticalConfig?.gridCols || matchedTacticalLoc?.gridCols || 10,
    gridRows:
      resolvedTacticalConfig?.gridRows || matchedTacticalLoc?.gridRows || 8,
    tacticalTokens: resolvedTokens,
    tacticalConfig: resolvedTacticalConfig,
    galleryPhotos: galleryPhotos.slice(0, 12).map((p) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      placePath: p.folder || p.placePath || activeFolder,
    })),
  };
}

export interface DeduplicatedSkillCard {
  id: string;
  srdKey?: string;
  name: string;
  ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  proficiency: 'none' | 'proficient' | 'expertise';
  totalBonus: number;
  description: string;
  imageUrl?: string;
  isCustom: boolean;
}

export function buildDeduplicatedPlayerSkillCards(
  character: {
    level?: number;
    abilities?: Record<string, any>;
    skills?: Record<string, 'none' | 'proficient' | 'expertise'>;
    customSkills?: Array<{
      id: string;
      srdKey?: string;
      skillKey?: string;
      name: string;
      ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
      proficiency: 'none' | 'proficient' | 'expertise';
      description?: string;
      imageUrl?: string;
    }>;
    skillDescriptions?: Record<string, string | undefined>;
    skillImages?: Record<string, string | undefined>;
  },
  srdCatalog: Array<{
    key: string;
    nameEs: string;
    ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
    description?: string;
  }>,
  effectiveAbilityModFn?: (abilityKey: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha') => number
): DeduplicatedSkillCard[] {
  const profBonus = calculateProficiencyBonus(character?.level || 1);
  const getMod = (ab: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha') => {
    if (effectiveAbilityModFn) return effectiveAbilityModFn(ab);
    return getEffectiveAbilityModifier(character?.abilities?.[ab]);
  };

  const normalizeName = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const srdByKey = new Map(srdCatalog.map((sk) => [sk.key, sk]));
  const srdByNormName = new Map(srdCatalog.map((sk) => [normalizeName(sk.nameEs), sk]));

  const seenSrdKeys = new Set<string>();
  const seenNormNames = new Set<string>();
  const result: DeduplicatedSkillCard[] = [];

  const customList = Array.isArray(character?.customSkills) ? character.customSkills : [];

  // Build lookup of custom overrides for SRD skills
  const customOverrideBySrdKey = new Map<
    string,
    {
      id?: string;
      proficiency?: 'none' | 'proficient' | 'expertise';
      description?: string;
      imageUrl?: string;
      ability?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
    }
  >();

  for (const c of customList) {
    if (!c) continue;
    const matchedSrd =
      (c.srdKey && srdByKey.get(c.srdKey)) ||
      (c.skillKey && srdByKey.get(c.skillKey)) ||
      srdByNormName.get(normalizeName(c.name));
    if (matchedSrd) {
      const prev = customOverrideBySrdKey.get(matchedSrd.key);
      customOverrideBySrdKey.set(matchedSrd.key, {
        id: prev?.id || c.id,
        proficiency:
          prev?.proficiency && prev.proficiency !== 'none'
            ? prev.proficiency
            : c.proficiency && c.proficiency !== 'none'
            ? c.proficiency
            : prev?.proficiency || c.proficiency,
        description: prev?.description || c.description?.trim(),
        imageUrl: prev?.imageUrl || c.imageUrl?.trim(),
        ability: prev?.ability || c.ability,
      });
    }
  }

  // 1. Add possessed SRD skills (from character.skills OR customOverrideBySrdKey) without duplicates
  for (const sk of srdCatalog) {
    const rawProf = character?.skills?.[sk.key] || 'none';
    const override = customOverrideBySrdKey.get(sk.key);
    const effectiveProf =
      rawProf !== 'none'
        ? rawProf
        : override?.proficiency && override.proficiency !== 'none'
        ? override.proficiency
        : customOverrideBySrdKey.has(sk.key)
        ? override?.proficiency || 'proficient'
        : 'none';

    if (effectiveProf === 'none' && !customOverrideBySrdKey.has(sk.key)) {
      continue;
    }

    const ability = override?.ability || sk.ability;
    const mod = getMod(ability);
    const pBonus =
      effectiveProf === 'expertise'
        ? profBonus * 2
        : effectiveProf === 'proficient'
        ? profBonus
        : 0;

    const customDesc =
      override?.description ||
      character?.skillDescriptions?.[sk.key]?.trim() ||
      sk.description ||
      `Prueba de ${sk.nameEs}`;
    const customImg =
      override?.imageUrl || character?.skillImages?.[sk.key]?.trim() || undefined;

    seenSrdKeys.add(sk.key);
    seenNormNames.add(normalizeName(sk.nameEs));

    result.push({
      id: override?.id || `srd-skill-${sk.key}`,
      srdKey: sk.key,
      name: sk.nameEs,
      ability,
      proficiency: effectiveProf,
      totalBonus: mod + pBonus,
      description: customDesc,
      imageUrl: customImg,
      isCustom: false,
    });
  }

  // 2. Add purely custom skills that do NOT duplicate any SRD skill or prior custom skill
  for (const c of customList) {
    if (!c || !c.name) continue;
    const matchedSrd =
      (c.srdKey && srdByKey.get(c.srdKey)) ||
      (c.skillKey && srdByKey.get(c.skillKey)) ||
      srdByNormName.get(normalizeName(c.name));
    if (matchedSrd && seenSrdKeys.has(matchedSrd.key)) {
      continue;
    }
    const norm = normalizeName(c.name);
    if (!norm || seenNormNames.has(norm)) {
      continue;
    }
    seenNormNames.add(norm);

    const ability = c.ability || 'int';
    const mod = getMod(ability);
    const prof = c.proficiency || 'proficient';
    const pBonus =
      prof === 'expertise' ? profBonus * 2 : prof === 'proficient' ? profBonus : 0;

    result.push({
      id: c.id || `custom-skill-${norm}`,
      srdKey: c.srdKey || c.skillKey,
      name: c.name.trim(),
      ability,
      proficiency: prof,
      totalBonus: mod + pBonus,
      description: c.description?.trim() || 'Habilidad personalizada del personaje.',
      imageUrl: c.imageUrl?.trim() || undefined,
      isCustom: true,
    });
  }

  return result;
}

export function canAccessArcaneOracle(
  appRole?: string | null,
  legacyRole?: string | null
): boolean {
  const r1 = String(appRole || '').trim().toLowerCase();
  const r2 = String(legacyRole || '').trim().toLowerCase();
  const allowed = new Set(['moderator', 'creator', 'content_creator', 'admin']);
  return allowed.has(r1) || allowed.has(r2);
}

export function getHeaderRoleButtonsVisibility(
  appRole?: string | null,
  legacyRole?: string | null
): {
  resolvedAppRole: 'client' | 'moderator' | 'creator' | 'admin';
  showAdminPanel: boolean;
  showCreatorPanel: boolean;
  showModerationPanel: boolean;
  showClientFeedbackOnly: boolean;
  showAdminButton: boolean;
  showCreatorButton: boolean;
  showModerationButton: boolean;
  showFeedbackButton: boolean;
} {
  const r1 = String(appRole || '').trim().toLowerCase();
  const r2 = String(legacyRole || '').trim().toLowerCase();

  let resolvedAppRole: 'client' | 'moderator' | 'creator' | 'admin' = 'client';
  if (r1 === 'admin' || r2 === 'admin') {
    resolvedAppRole = 'admin';
  } else if (r1 === 'creator' || r1 === 'content_creator' || r2 === 'creator') {
    resolvedAppRole = 'creator';
  } else if (r1 === 'moderator' || r2 === 'moderator') {
    resolvedAppRole = 'moderator';
  }

  const showAdmin = resolvedAppRole === 'admin';
  const showCreator = resolvedAppRole === 'admin' || resolvedAppRole === 'creator';
  const showModeration =
    resolvedAppRole === 'admin' ||
    resolvedAppRole === 'creator' ||
    resolvedAppRole === 'moderator';
  const showFeedback = resolvedAppRole === 'client';

  return {
    resolvedAppRole,
    showAdminPanel: showAdmin,
    showCreatorPanel: showCreator,
    showModerationPanel: showModeration,
    showClientFeedbackOnly: showFeedback,
    showAdminButton: showAdmin,
    showCreatorButton: showCreator,
    showModerationButton: showModeration,
    showFeedbackButton: showFeedback,
  };
}

export function resolveMaxPortraitGalleryCount(
  skinTokensOrCount?: { maxPortraitGalleryCount?: number } | number | null
): number {
  const raw =
    typeof skinTokensOrCount === 'number'
      ? skinTokensOrCount
      : Number(skinTokensOrCount?.maxPortraitGalleryCount);
  if (!Number.isFinite(raw) || raw < 1) return 4;
  return Math.max(1, Math.min(24, Math.floor(raw)));
}

export function clampPortraitGallery(
  portraits: string[] | undefined | null,
  maxSlots: number = 4
): string[] {
  if (!Array.isArray(portraits)) return [];
  const safeMax = Math.max(1, Math.min(24, Math.floor(Number(maxSlots) || 4)));
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of portraits) {
    const trimmed = String(raw || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
    if (cleaned.length >= safeMax) break;
  }
  return cleaned;
}

export function getGeometricClipPath(shape?: string): string | undefined {
  switch ((shape || '').toLowerCase()) {
    case 'hexagon':
      return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
    case 'triangle':
      return 'polygon(50% 0%, 0% 100%, 100% 100%)';
    case 'pentagon':
      return 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
    case 'octagon':
      return 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)';
    case 'diamond':
      return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    default:
      return undefined;
  }
}

export function getGeometricPolygonPoints(
  shape?: string,
  insetPct: number = 1.5
): string | undefined {
  const pad = Math.max(0, Math.min(15, Number(insetPct) || 0));
  const mapCoord = (val: number): number => {
    const ratio = (100 - pad * 2) / 100;
    return Number((pad + val * ratio).toFixed(2));
  };
  const buildPts = (pairs: Array<[number, number]>): string =>
    pairs.map(([x, y]) => `${mapCoord(x)},${mapCoord(y)}`).join(' ');

  switch ((shape || '').toLowerCase()) {
    case 'hexagon':
      return buildPts([
        [25, 0],
        [75, 0],
        [100, 50],
        [75, 100],
        [25, 100],
        [0, 50],
      ]);
    case 'triangle':
      return buildPts([
        [50, 0],
        [100, 100],
        [0, 100],
      ]);
    case 'pentagon':
      return buildPts([
        [50, 0],
        [100, 38],
        [82, 100],
        [18, 100],
        [0, 38],
      ]);
    case 'octagon':
      return buildPts([
        [30, 0],
        [70, 0],
        [100, 30],
        [100, 70],
        [70, 100],
        [30, 100],
        [0, 70],
        [0, 30],
      ]);
    case 'diamond':
      return buildPts([
        [50, 0],
        [100, 50],
        [50, 100],
        [0, 50],
      ]);
    default:
      return undefined;
  }
}

export function getEdgeFadeMaskCss(fadePercent?: number): string | undefined {
  const pct = Number(fadePercent) || 0;
  if (pct <= 0) return undefined;
  const clamped = Math.max(0, Math.min(100, pct));
  const innerStop = Math.max(10, Math.round(100 - clamped * 0.85));
  return `radial-gradient(circle, rgba(0,0,0,1) ${innerStop}%, rgba(0,0,0,0) 100%)`;
}

export function resolvePortraitAspectRatioCss(
  preset?: string,
  customW?: number,
  customH?: number
): string {
  switch (preset) {
    case '3:4':
      return '3 / 4';
    case '9:16':
      return '9 / 16';
    case '4:3':
      return '4 / 3';
    case '16:9':
      return '16 / 9';
    case 'custom': {
      const w = Math.max(1, Math.min(32, Number(customW) || 1));
      const h = Math.max(1, Math.min(32, Number(customH) || 1));
      return `${w} / ${h}`;
    }
    case '1:1':
    default:
      return '1 / 1';
  }
}

export const getAspectRatioCssValue = resolvePortraitAspectRatioCss;

export function isTarotElementVisibleOnSide(
  placementOrKey: string | undefined,
  side: 'front' | 'back',
  defaultPlacementOrSidesMap:
    | 'front'
    | 'back'
    | 'both'
    | 'hidden'
    | Record<string, 'front' | 'back' | 'both' | 'hidden' | undefined> = 'front'
): boolean {
  let eff: string | undefined;
  const isPlacementLiteral =
    placementOrKey === 'front' ||
    placementOrKey === 'back' ||
    placementOrKey === 'both' ||
    placementOrKey === 'hidden';

  if (
    defaultPlacementOrSidesMap &&
    typeof defaultPlacementOrSidesMap === 'object' &&
    placementOrKey
  ) {
    const defaultForKey =
      placementOrKey === 'identity'
        ? 'both'
        : placementOrKey === 'loreQuote'
        ? 'back'
        : 'front';
    eff = defaultPlacementOrSidesMap[placementOrKey] || (isPlacementLiteral ? placementOrKey : defaultForKey);
  } else if (isPlacementLiteral) {
    eff = placementOrKey;
  } else {
    eff = typeof defaultPlacementOrSidesMap === 'string' ? defaultPlacementOrSidesMap : 'front';
  }

  if (eff === 'hidden') return false;
  if (eff === 'both') return true;
  return eff === side;
}

export function resolveTarotCardAbilityScores(
  character?: {
    abilities?: Record<string, any>;
    inventory?: any[];
  } | null,
  member?: {
    abilities?: Record<string, number>;
  } | null
): {
  str: AbilityBreakdown;
  dex: AbilityBreakdown;
  con: AbilityBreakdown;
  int: AbilityBreakdown;
  wis: AbilityBreakdown;
  cha: AbilityBreakdown;
} {
  const equippedBonuses =
    character?.inventory && Array.isArray(character.inventory)
      ? calculateEquippedItemStatBonuses(character.inventory)
      : null;

  const resolveKey = (key: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): AbilityBreakdown => {
    if (character?.abilities?.[key] !== undefined) {
      return calculateTotalAbilityScore(
        character.abilities[key],
        equippedBonuses?.[key] ?? 0
      );
    }
    const memberVal = member?.abilities?.[key] ?? 10;
    return calculateTotalAbilityScore(memberVal, 0);
  };

  return {
    str: resolveKey('str'),
    dex: resolveKey('dex'),
    con: resolveKey('con'),
    int: resolveKey('int'),
    wis: resolveKey('wis'),
    cha: resolveKey('cha'),
  };
}

export function pickMostRecentRoll<
  T extends { id?: string; timestamp?: number; total?: number }
>(...sources: Array<T | T[] | null | undefined>): T | null {
  const flat: T[] = [];
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) {
      for (const item of src) {
        if (item && typeof item === 'object') flat.push(item);
      }
    } else if (typeof src === 'object') {
      flat.push(src);
    }
  }
  if (flat.length === 0) return null;

  let best = flat[0];
  let bestTs = Number(best?.timestamp) || 0;

  for (let i = 1; i < flat.length; i++) {
    const candidate = flat[i];
    const ts = Number(candidate?.timestamp) || 0;
    // Prefer strictly newer timestamp, or if timestamps are equal/missing, prefer later item in the list
    if (ts >= bestTs) {
      best = candidate;
      bestTs = ts;
    }
  }
  return best;
}

export function pickMostRecentRollForRoller<
  T extends { id?: string; timestamp?: number; rollerName?: string; total?: number }
>(params: {
  characterName?: string;
  playerName?: string;
  rollFeed?: T[];
  localBoxRoll?: T | null;
  fallbackRoll?: T | null;
}): T | undefined {
  const charNorm = String(params.characterName || '').trim().toLowerCase();
  const playerNorm = String(params.playerName || '').trim().toLowerCase();

  const matchesRoller = (r?: T | null): boolean => {
    if (!r) return false;
    const rNorm = String(r.rollerName || '').trim().toLowerCase();
    if (!rNorm) return true;
    return (
      (Boolean(charNorm) && rNorm === charNorm) ||
      (Boolean(playerNorm) && rNorm === playerNorm)
    );
  };

  const matchingFromFeed = (params.rollFeed || []).filter((r) => matchesRoller(r));
  const candidates: Array<T | null | undefined> = [...matchingFromFeed];

  if (params.fallbackRoll) {
    candidates.push(params.fallbackRoll);
  }
  if (params.localBoxRoll && matchesRoller(params.localBoxRoll)) {
    candidates.push(params.localBoxRoll);
  }

  return pickMostRecentRoll(...candidates) || undefined;
}

export function resolveAuthoritativePlayerHp(params: {
  localCurrentHp: number;
  localHpUpdatedAt?: number;
  serverCurrentHp?: number;
  serverHpUpdatedAt?: number;
  serverDmModifiedAt?: number;
  lastSeenDmModifiedAt?: number;
}): {
  currentHp: number;
  shouldApplyServerToLocal: boolean;
  nextLastSeenDmModifiedAt: number;
  effectiveHpUpdatedAt: number;
} {
  const localHp = Number(params.localCurrentHp) || 0;
  const localTs = Number(params.localHpUpdatedAt) || 0;
  const serverHp =
    typeof params.serverCurrentHp === 'number' ? params.serverCurrentHp : localHp;
  const serverHpTs = Number(params.serverHpUpdatedAt) || 0;
  const dmTs = Number(params.serverDmModifiedAt) || 0;
  const seenDmTs = Number(params.lastSeenDmModifiedAt) || 0;

  // 1. If the DM adjusted this player's HP more recently than both our lastSeenDmModifiedAt and our localHpUpdatedAt
  if (dmTs > seenDmTs && dmTs > localTs) {
    return {
      currentHp: serverHp,
      shouldApplyServerToLocal: true,
      nextLastSeenDmModifiedAt: dmTs,
      effectiveHpUpdatedAt: Math.max(dmTs, serverHpTs),
    };
  }

  // 2. If the player has mutated HP locally at or after the server's recorded timestamp, keep local HP strictly
  if (localTs > 0 && localTs >= Math.max(serverHpTs, dmTs)) {
    return {
      currentHp: localHp,
      shouldApplyServerToLocal: false,
      nextLastSeenDmModifiedAt: Math.max(seenDmTs, dmTs),
      effectiveHpUpdatedAt: localTs,
    };
  }

  // 3. If the server has a strictly newer player HP timestamp (e.g. from another tab of the same player)
  if (serverHpTs > localTs) {
    return {
      currentHp: serverHp,
      shouldApplyServerToLocal: serverHp !== localHp,
      nextLastSeenDmModifiedAt: Math.max(seenDmTs, dmTs),
      effectiveHpUpdatedAt: serverHpTs,
    };
  }

  return {
    currentHp: localHp,
    shouldApplyServerToLocal: false,
    nextLastSeenDmModifiedAt: Math.max(seenDmTs, dmTs),
    effectiveHpUpdatedAt: Math.max(localTs, serverHpTs, dmTs),
  };
}
