import type { CSSProperties } from 'react';
import type {
  AppSkinThemeTokens,
  DeckCardGraphicTemplate,
  GeometricShapeType,
  PlayerMapBlockId,
  PlayerMapSpatialLayoutConfig,
  PlayerSheetBlockId,
  PlayerSheetSpatialLayoutConfig,
  SkinModalPopupOverride,
  SkinModalTargetId,
  SpatialBlockConfig,
  SpatialInnerElementConfig,
  StatBoxGraphicConfig,
  TarotCardExclusiveStudioConfig,
  TarotCardModuleItem,
  TarotCardModuleKind,
} from '../types/dnd';
import { applyColorWithOpacity } from './lobbyPageLayout';
import {
  getEdgeFadeMaskCss,
  getGeometricClipPath,
  getGeometricPolygonPoints,
  getAspectRatioCssValue,
} from './dnd-math';

export {
  getEdgeFadeMaskCss,
  getGeometricClipPath,
  getGeometricPolygonPoints,
  getAspectRatioCssValue,
};

export const ALL_PLAYER_SHEET_BLOCK_IDS: PlayerSheetBlockId[] = [
  'session_top_bar',
  'live_table_combatants_bar',
  'identity_header',
  'combat_stats_bar',
  'hp_and_rests_bar',
  'ability_scores_grid',
  'game_decks_panel',
  'adventurer_corner_panel',
  'sheet_tarot_dock',
];

export const ALL_PLAYER_MAP_BLOCK_IDS: PlayerMapBlockId[] = [
  'map_top_bar',
  'map_canvas_area',
  'map_decks_overlay',
  'map_notebook_overlay',
  'map_enemies_panel',
  'map_roll_history_panel',
  'map_dice_box_panel',
  'map_mini_tarot_dock',
];

export const ALL_9_ALIGNMENTS_5E: readonly string[] = [
  'Legal Bueno',
  'Neutral Bueno',
  'Caótico Bueno',
  'Legal Neutral',
  'Neutral Verdadero',
  'Caótico Neutral',
  'Legal Malvado',
  'Neutral Malvado',
  'Caótico Malvado',
] as const;

export interface SampleRoomPlayer5e {
  id: string;
  name: string;
  role: string;
  raceClass: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
  initiative: number;
  speed: string;
  passivePerception: number;
  alignment: string;
  color: string;
  avatarIcon: string;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
}

export const SAMPLE_ROOM_PLAYERS_5E: SampleRoomPlayer5e[] = [
  {
    id: 'p1_valeros',
    name: 'Valeros del Alba',
    role: 'Guerrero (Tú)',
    raceClass: 'Humano • Guerrero (Campeón)',
    level: 3,
    hp: 44,
    maxHp: 44,
    ac: 18,
    initiative: 1,
    speed: '30 ft',
    passivePerception: 13,
    alignment: 'Legal Bueno',
    color: '#f59e0b',
    avatarIcon: 'warrior',
    stats: { str: 18, dex: 12, con: 16, int: 10, wis: 13, cha: 11 },
  },
  {
    id: 'p2_lyra',
    name: 'Lyra Tejeestrellas',
    role: 'Maga',
    raceClass: 'Elfa • Maga (Evocación)',
    level: 3,
    hp: 24,
    maxHp: 24,
    ac: 14,
    initiative: 3,
    speed: '30 ft',
    passivePerception: 14,
    alignment: 'Caótico Bueno',
    color: '#8b5cf6',
    avatarIcon: 'wizard',
    stats: { str: 8, dex: 16, con: 12, int: 18, wis: 14, cha: 10 },
  },
  {
    id: 'p3_boros',
    name: 'Boros Rompemuros',
    role: 'Bárbaro',
    raceClass: 'Semiorco • Bárbaro (Totémico)',
    level: 3,
    hp: 52,
    maxHp: 52,
    ac: 16,
    initiative: 2,
    speed: '40 ft',
    passivePerception: 12,
    alignment: 'Neutral Bueno',
    color: '#ef4444',
    avatarIcon: 'barbarian',
    stats: { str: 18, dex: 14, con: 18, int: 8, wis: 12, cha: 8 },
  },
  {
    id: 'p4_elora',
    name: 'Elora Brisa',
    role: 'Pícara',
    raceClass: 'Mediana • Pícara (Ladrón)',
    level: 3,
    hp: 31,
    maxHp: 31,
    ac: 15,
    initiative: 4,
    speed: '25 ft',
    passivePerception: 16,
    alignment: 'Caótico Neutral',
    color: '#10b981',
    avatarIcon: 'rogue',
    stats: { str: 10, dex: 18, con: 14, int: 12, wis: 13, cha: 14 },
  },
  {
    id: 'p5_thorgar',
    name: 'Thorgar Martillo',
    role: 'Clérigo',
    raceClass: 'Enano • Clérigo (Vida)',
    level: 3,
    hp: 38,
    maxHp: 38,
    ac: 19,
    initiative: -1,
    speed: '25 ft',
    passivePerception: 15,
    alignment: 'Legal Bueno',
    color: '#06b6d4',
    avatarIcon: 'cleric',
    stats: { str: 16, dex: 8, con: 16, int: 10, wis: 17, cha: 12 },
  },
  {
    id: 'p6_zephyr',
    name: 'Zephyr Silente',
    role: 'Monje',
    raceClass: 'Aasimar • Monje (Sombra)',
    level: 3,
    hp: 32,
    maxHp: 32,
    ac: 16,
    initiative: 3,
    speed: '40 ft',
    passivePerception: 14,
    alignment: 'Legal Neutral',
    color: '#6366f1',
    avatarIcon: 'monk',
    stats: { str: 12, dex: 16, con: 14, int: 10, wis: 16, cha: 12 },
  },
  {
    id: 'p7_sylas',
    name: 'Sylas Sombragrís',
    role: 'Brujo',
    raceClass: 'Tiflin • Brujo (Infernal)',
    level: 3,
    hp: 28,
    maxHp: 28,
    ac: 14,
    initiative: 2,
    speed: '30 ft',
    passivePerception: 11,
    alignment: 'Caótico Neutral',
    color: '#ec4899',
    avatarIcon: 'warlock',
    stats: { str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 18 },
  },
  {
    id: 'p8_kaelen',
    name: 'Kaelen Hojadorada',
    role: 'Paladín',
    raceClass: 'Semielfo • Paladín (Devoción)',
    level: 3,
    hp: 40,
    maxHp: 40,
    ac: 18,
    initiative: 0,
    speed: '30 ft',
    passivePerception: 12,
    alignment: 'Legal Bueno',
    color: '#eab308',
    avatarIcon: 'paladin',
    stats: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 16 },
  },
];

export function makeInnerEl(
  id: string,
  label: string,
  overrides: Partial<SpatialInnerElementConfig> = {}
): SpatialInnerElementConfig {
  return {
    id,
    label,
    exampleValue: overrides.exampleValue ?? '',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    widthPx: 0,
    heightPx: 0,
    paddingXPx: 10,
    paddingYPx: 6,
    fontSizePx: 12,
    iconSizePx: 14,
    borderRadiusPx: 10,
    borderWidthPx: 1,
    hideBorder: false,
    shape: 'rounded',
    edgeFadePercent: 0,
    bgColor: '#1e2230',
    bgOpacity: 0.9,
    textColor: '#f5e4be',
    borderColor: '#c8a45c',
    fontFamily: "'Cinzel', serif",
    bgImageUrl: '',
    customIconUrl: '',
    ...overrides,
  };
}

function buildInnerMap(
  items: SpatialInnerElementConfig[]
): {
  innerButtonsOrder: string[];
  innerButtonsConfig: Record<string, SpatialInnerElementConfig>;
  innerElementsOrder: string[];
  innerElementsConfig: Record<string, SpatialInnerElementConfig>;
} {
  const order: string[] = [];
  const map: Record<string, SpatialInnerElementConfig> = {};
  for (const item of items) {
    order.push(item.id);
    map[item.id] = item;
  }
  return {
    innerButtonsOrder: order,
    innerButtonsConfig: map,
    innerElementsOrder: order,
    innerElementsConfig: map,
  };
}

function normalizeSpatialBlock<TId extends string>(
  base: SpatialBlockConfig<TId>,
  patch?: Partial<SpatialBlockConfig<TId>> | null
): SpatialBlockConfig<TId> {
  const merged = {
    ...base,
    ...(patch || {}),
    id: base.id,
  };

  const xVal =
    patch?.offsetX !== undefined
      ? Number(patch.offsetX) || 0
      : patch?.x !== undefined
      ? Number(patch.x) || 0
      : Number(merged.offsetX ?? merged.x) || 0;
  const yVal =
    patch?.offsetY !== undefined
      ? Number(patch.offsetY) || 0
      : patch?.y !== undefined
      ? Number(patch.y) || 0
      : Number(merged.offsetY ?? merged.y) || 0;

  let isVisible = merged.visible !== false;
  if (patch?.hidden !== undefined) {
    isVisible = !patch.hidden;
  } else if (patch?.visible !== undefined) {
    isVisible = Boolean(patch.visible);
  } else if (merged.hidden !== undefined) {
    isVisible = !merged.hidden;
  }

  const labelVal = merged.label || merged.name || base.label || base.name;
  const customTitleVal = merged.customTitle ?? merged.titleText;

  // Merge innerButtonsConfig & innerButtonsOrder safely
  const baseButtons = base.innerButtonsConfig || {};
  const incomingButtons = patch?.innerButtonsConfig || merged.innerButtonsConfig || {};
  const mergedButtonsConfig: Record<string, SpatialInnerElementConfig> = { ...baseButtons };
  for (const [btnId, btnPatch] of Object.entries(incomingButtons)) {
    if (btnPatch && typeof btnPatch === 'object') {
      mergedButtonsConfig[btnId] = {
        ...(baseButtons[btnId] || makeInnerEl(btnId, btnPatch.label || btnId)),
        ...btnPatch,
        id: btnId,
      };
    }
  }

  const rawOrder =
    patch?.innerButtonsOrder || merged.innerButtonsOrder || base.innerButtonsOrder || [];
  const cleanOrder: string[] = [];
  for (const bId of rawOrder) {
    if (mergedButtonsConfig[bId] && !cleanOrder.includes(bId)) {
      cleanOrder.push(bId);
    }
  }
  for (const bId of Object.keys(mergedButtonsConfig)) {
    if (!cleanOrder.includes(bId)) {
      cleanOrder.push(bId);
    }
  }

  return {
    ...merged,
    name: labelVal,
    label: labelVal,
    customTitle: customTitleVal,
    titleText: customTitleVal || merged.titleText,
    visible: isVisible,
    hidden: !isVisible,
    x: xVal,
    y: yVal,
    offsetX: xVal,
    offsetY: yVal,
    shape: merged.shape || base.shape || 'rounded',
    edgeFadePercent: merged.edgeFadePercent ?? base.edgeFadePercent ?? 0,
    innerButtonsOrder: cleanOrder,
    innerButtonsConfig: mergedButtonsConfig,
  };
}

function buildHybridLayout<TId extends string>(
  allIds: readonly TId[],
  blocksOrder: TId[],
  blocksMap: Record<TId, SpatialBlockConfig<TId>>
): Array<SpatialBlockConfig<TId>> & {
  version: number;
  blocksOrder: TId[];
  blocks: Record<TId, SpatialBlockConfig<TId>>;
} {
  const cleanOrder: TId[] = [];
  for (const id of blocksOrder) {
    if (allIds.includes(id) && !cleanOrder.includes(id)) {
      cleanOrder.push(id);
    }
  }
  for (const id of allIds) {
    if (!cleanOrder.includes(id)) {
      cleanOrder.push(id);
    }
  }

  const orderedList: SpatialBlockConfig<TId>[] = cleanOrder.map((id, idx) => {
    const normalized = normalizeSpatialBlock(blocksMap[id], { order: idx });
    blocksMap[id] = normalized;
    return normalized;
  });

  return Object.assign(orderedList, {
    version: 1,
    blocksOrder: cleanOrder,
    blocks: blocksMap,
  });
}

function makeRawBlock<TId extends string>(
  params: Omit<SpatialBlockConfig<TId>, 'label' | 'hidden' | 'offsetX' | 'offsetY'>
): SpatialBlockConfig<TId> {
  return {
    ...params,
    label: params.name,
    hidden: !params.visible,
    offsetX: params.x,
    offsetY: params.y,
    shape: params.shape || 'rounded',
    edgeFadePercent: params.edgeFadePercent ?? 0,
  };
}

export function updateSpatialBlockInnerButton<TId extends string>(
  block: SpatialBlockConfig<TId>,
  buttonId: string,
  patch: Partial<SpatialInnerElementConfig>
): SpatialBlockConfig<TId> {
  const currentButtons = block.innerButtonsConfig || {};
  const existing = currentButtons[buttonId] || makeInnerEl(buttonId, patch.label || buttonId);
  const nextButtons = {
    ...currentButtons,
    [buttonId]: {
      ...existing,
      ...patch,
      id: buttonId,
    },
  };
  return normalizeSpatialBlock(block, {
    innerButtonsConfig: nextButtons,
  });
}

export function moveSpatialBlockInnerButtonOrder<TId extends string>(
  block: SpatialBlockConfig<TId>,
  buttonId: string,
  direction: 'up' | 'down'
): SpatialBlockConfig<TId> {
  const list = [...(block.innerButtonsOrder || Object.keys(block.innerButtonsConfig || {}))];
  const idx = list.indexOf(buttonId);
  if (idx === -1) return block;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= list.length) return block;
  const temp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = temp;
  return normalizeSpatialBlock(block, {
    innerButtonsOrder: list,
  });
}

export function createDefaultPlayerSheetLayout(): PlayerSheetSpatialLayoutConfig {
  const blocks: Record<PlayerSheetBlockId, SpatialBlockConfig<PlayerSheetBlockId>> = {
    session_top_bar: makeRawBlock({
      id: 'session_top_bar',
      name: 'Barra Superior de Sala en Vivo, Estandarte DM y Navegación',
      visible: true,
      order: 0,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.95,
      hideBorder: false,
      bgColor: '#121521',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 14,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Sala en Vivo: MESA-01',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#a855f7',
      iconSizePx: 15,
      ...buildInnerMap([
        makeInnerEl('room_badge', 'Sala: MESA-01', {
          exampleValue: 'En Línea (4)',
          bgColor: '#1e1b4b',
          borderColor: '#818cf8',
        }),
        makeInnerEl('dm_hood_banner', 'DM: El Cronista', {
          exampleValue: '«Las antorchas parpadean en el corredor...»',
          bgColor: '#241434',
          borderColor: '#c084fc',
        }),
        makeInnerEl('btn_whisper_dm', 'Susurrar al DM', {
          bgColor: '#3b0764',
          borderColor: '#a855f7',
          textColor: '#f3e8ff',
        }),
        makeInnerEl('btn_switch_map', 'Modo Mapa', {
          bgColor: '#064e3b',
          borderColor: '#10b981',
          textColor: '#d1fae5',
        }),
        makeInnerEl('btn_save_sheet', 'Guardar Hoja', {
          bgColor: '#78350f',
          borderColor: '#f59e0b',
          textColor: '#fef3c7',
        }),
        makeInnerEl('btn_return_lobby', 'Salir al Lobby', {
          bgColor: '#1c1917',
          borderColor: '#78716c',
          textColor: '#e7e5e4',
        }),
      ]),
    }),
    live_table_combatants_bar: makeRawBlock({
      id: 'live_table_combatants_bar',
      name: 'Barra de Aliados y Enemigos en Mesa (Sala Activa)',
      visible: true,
      order: 1,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.92,
      hideBorder: false,
      bgColor: '#141824',
      borderColor: '#b45309',
      borderWidthPx: 2,
      borderRadiusPx: 14,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Combatientes en la Mesa',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 12,
      bodyFontSizePx: 11,
      titleColor: '#fde68a',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 14,
      ...buildInnerMap([
        makeInnerEl('ally_chip_1', 'Valeros del Alba', {
          exampleValue: '44/44 PG • CA 18',
          bgColor: '#064e3b',
          borderColor: '#10b981',
          textColor: '#ecfdf5',
        }),
        makeInnerEl('ally_chip_2', 'Lyra Tejeestrellas', {
          exampleValue: '31/31 PG • CA 15',
          bgColor: '#064e3b',
          borderColor: '#10b981',
          textColor: '#ecfdf5',
        }),
        makeInnerEl('enemy_chip_1', 'Capitán Orco', {
          exampleValue: '32/45 PG • CA 16',
          bgColor: '#450a0a',
          borderColor: '#ef4444',
          textColor: '#fee2e2',
        }),
        makeInnerEl('enemy_chip_2', 'Chamán Goblinoide', {
          exampleValue: '18/22 PG • CA 13',
          bgColor: '#450a0a',
          borderColor: '#ef4444',
          textColor: '#fee2e2',
        }),
      ]),
    }),
    identity_header: makeRawBlock({
      id: 'identity_header',
      name: 'Cabecera de Identidad, Retrato y Nivel',
      visible: true,
      order: 2,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 14,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#171a26',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Identidad del Héroe',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 20,
      bodyFontSizePx: 12,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('portrait_box', 'Retrato del Héroe', {
          exampleValue: 'Galería 1-24 PNGs',
          widthPx: 92,
          heightPx: 92,
          shape: 'rounded',
          bgColor: '#0f131d',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('char_name_box', 'Valeros del Alba', {
          exampleValue: 'Humano • Guerrero (Campeón)',
          fontSizePx: 18,
          bgColor: '#1c2030',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('level_xp_box', 'Nivel 5', {
          exampleValue: '6,500 / 14,000 XP',
          bgColor: '#271e12',
          borderColor: '#f59e0b',
          textColor: '#fde68a',
        }),
        makeInnerEl('alignment_box', 'Legal Bueno', {
          exampleValue: 'Soldado',
          bgColor: '#1a202c',
          borderColor: '#94a3b8',
        }),
        makeInnerEl('btn_avatar_gallery', 'Galería PNG', {
          bgColor: '#292524',
          borderColor: '#d97706',
        }),
        makeInnerEl('btn_level_up', 'Subir Nivel', {
          bgColor: '#78350f',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
        }),
      ]),
    }),
    combat_stats_bar: makeRawBlock({
      id: 'combat_stats_bar',
      name: 'Barra de Combate (CA, Iniciativa, Velocidad, Bono, Inspiración)',
      visible: true,
      order: 3,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.92,
      hideBorder: false,
      bgColor: '#151822',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Estadísticas de Combate',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 14,
      bodyFontSizePx: 12,
      titleColor: '#e2c275',
      textColor: '#ffffff',
      accentColor: '#f59e0b',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('box_ac', 'Clase de Armadura', {
          exampleValue: '18',
          fontSizePx: 16,
          bgColor: '#181c29',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('box_init', 'Iniciativa', {
          exampleValue: '+2',
          fontSizePx: 16,
          bgColor: '#181c29',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('box_speed', 'Velocidad', {
          exampleValue: '30 ft',
          fontSizePx: 16,
          bgColor: '#181c29',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('box_prof', 'Bono Competencia', {
          exampleValue: '+3',
          fontSizePx: 16,
          bgColor: '#181c29',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('box_inspiration', 'Inspiración', {
          exampleValue: 'Activa ★',
          fontSizePx: 14,
          bgColor: '#451a03',
          borderColor: '#f59e0b',
          textColor: '#fde68a',
        }),
      ]),
    }),
    hp_and_rests_bar: makeRawBlock({
      id: 'hp_and_rests_bar',
      name: 'Núcleo de Puntos de Golpe (PG) y Descansos',
      visible: true,
      order: 4,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 12,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#1a1418',
      borderColor: '#dc2626',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Puntos de Golpe',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 14,
      bodyFontSizePx: 12,
      titleColor: '#fca5a5',
      textColor: '#ffffff',
      accentColor: '#ef4444',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('hp_main_counter', 'PG Actuales / Máx', {
          exampleValue: '44 / 44 PG',
          fontSizePx: 16,
          bgColor: '#2a1218',
          borderColor: '#ef4444',
          textColor: '#fecaca',
        }),
        makeInnerEl('hp_progress_bar', 'Barra de Vida', {
          exampleValue: '100% Vitalidad',
          bgColor: '#064e3b',
          borderColor: '#10b981',
          textColor: '#d1fae5',
        }),
        makeInnerEl('btn_damage', '- Daño', {
          bgColor: '#7f1d1d',
          borderColor: '#ef4444',
          textColor: '#fee2e2',
        }),
        makeInnerEl('btn_heal', '+ Curar', {
          bgColor: '#065f46',
          borderColor: '#10b981',
          textColor: '#d1fae5',
        }),
        makeInnerEl('btn_short_rest', 'Descanso Corto', {
          bgColor: '#78350f',
          borderColor: '#f59e0b',
          textColor: '#fef3c7',
        }),
        makeInnerEl('btn_long_rest', 'Descanso Largo', {
          bgColor: '#1e1b4b',
          borderColor: '#818cf8',
          textColor: '#e0e7ff',
        }),
      ]),
    }),
    ability_scores_grid: makeRawBlock({
      id: 'ability_scores_grid',
      name: 'Cuadrícula de 6 Estadísticas (FUE, DES, CON, INT, SAB, CAR)',
      visible: true,
      order: 5,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.9,
      hideBorder: false,
      bgColor: '#151824',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Puntuaciones de Característica',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 12,
      titleColor: '#f5e4be',
      textColor: '#ffffff',
      accentColor: '#f59e0b',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('stat_str', 'FUE', {
          exampleValue: '+4 • Total 18',
          bgColor: '#181b26',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('stat_dex', 'DES', {
          exampleValue: '+2 • Total 14',
          bgColor: '#181b26',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('stat_con', 'CON', {
          exampleValue: '+3 • Total 16',
          bgColor: '#181b26',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('stat_int', 'INT', {
          exampleValue: '+0 • Total 10',
          bgColor: '#181b26',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('stat_wis', 'SAB', {
          exampleValue: '+1 • Total 12',
          bgColor: '#181b26',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('stat_cha', 'CAR', {
          exampleValue: '+0 • Total 11',
          bgColor: '#181b26',
          borderColor: '#c8a45c',
        }),
      ]),
    }),
    game_decks_panel: makeRawBlock({
      id: 'game_decks_panel',
      name: 'Mazo de Juego (Combate y Acciones, Habilidades, Lanzar Conjuros)',
      visible: true,
      order: 6,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 14,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#161924',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 18,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Mazo de Juego',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 16,
      bodyFontSizePx: 12,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#d97706',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('tab_deck_combat', 'Combates y Acciones', {
          bgColor: '#451a03',
          borderColor: '#f59e0b',
          textColor: '#fde68a',
        }),
        makeInnerEl('tab_deck_skills', 'Habilidades', {
          bgColor: '#083344',
          borderColor: '#22d3ee',
          textColor: '#a5f3fc',
        }),
        makeInnerEl('tab_deck_spells', 'Lanzar Conjuros', {
          bgColor: '#3b0764',
          borderColor: '#c084fc',
          textColor: '#f3e8ff',
        }),
        makeInnerEl('btn_deck_prev', '◀ Anterior', {
          bgColor: '#1c1917',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('btn_deck_next', 'Siguiente ▶', {
          bgColor: '#1c1917',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('card_slot_1', 'Espada Larga +1', {
          exampleValue: '+8 Ataque • 1d8+5 Cortante • Hoja forjada en plata élfica.',
          bgColor: '#231914',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('card_slot_2', 'Arco Largo', {
          exampleValue: '+5 Ataque • 1d8+2 Perforante • Alcance 150/600 ft.',
          bgColor: '#231914',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('card_slot_3', 'Tomar Aliento', {
          exampleValue: '1d10+5 PG • Acción Adicional • Recupera el aliento en combate.',
          bgColor: '#231914',
          borderColor: '#c8a45c',
        }),
      ]),
    }),
    adventurer_corner_panel: makeRawBlock({
      id: 'adventurer_corner_panel',
      name: 'El Rincón del Aventurero (Mochila, Diario, Rasgos e Historia)',
      visible: true,
      order: 7,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 14,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#141722',
      borderColor: '#b45309',
      borderWidthPx: 2,
      borderRadiusPx: 18,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'El Rincón del Aventurero',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 16,
      bodyFontSizePx: 12,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('btn_open_inventory', 'Equipo e Inventario', {
          exampleValue: '39 / 270 lb • 125 PO',
          bgColor: '#271c15',
          borderColor: '#d97706',
        }),
        makeInnerEl('btn_open_journal', 'Diario de Sesiones', {
          exampleValue: '4 Hojas Escritas',
          bgColor: '#172530',
          borderColor: '#06b6d4',
        }),
        makeInnerEl('btn_open_traits', 'Rasgos y Trasfondo', {
          exampleValue: 'Campeón • Soldado',
          bgColor: '#261730',
          borderColor: '#a855f7',
        }),
        makeInnerEl('btn_open_settings', 'Ajustes del Héroe', {
          exampleValue: 'Apariencia y Exportar',
          bgColor: '#1c1917',
          borderColor: '#78716c',
        }),
      ]),
    }),
    sheet_tarot_dock: makeRawBlock({
      id: 'sheet_tarot_dock',
      name: 'Carta del Personaje en Mesa (Muelle / Posicionamiento)',
      visible: true,
      order: 8,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 12,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#151926',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 18,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Carta de Jugador en Mesa',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 15,
      bodyFontSizePx: 12,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('card_dock_preview', 'Carta Tarot Diseñada (Apartado 4)', {
          exampleValue: 'Previsualización Anverso / Dorso con tus Módulos',
          bgColor: '#10141f',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('btn_flip_dock_card', 'Voltear Carta 3D', {
          exampleValue: 'Girar Anverso / Dorso',
          bgColor: '#451a03',
          borderColor: '#f59e0b',
          textColor: '#fde68a',
        }),
        makeInnerEl('table_players_indicator', 'Jugadores en Mesa', {
          exampleValue: '1 a 8 Héroes en Vivo',
          bgColor: '#064e3b',
          borderColor: '#10b981',
          textColor: '#d1fae5',
        }),
      ]),
    }),
  };

  return buildHybridLayout(
    ALL_PLAYER_SHEET_BLOCK_IDS,
    [...ALL_PLAYER_SHEET_BLOCK_IDS],
    blocks
  );
}

export function resolvePlayerSheetLayout(
  tokensOrLayout?: AppSkinThemeTokens | PlayerSheetSpatialLayoutConfig | any | null
): PlayerSheetSpatialLayoutConfig {
  const defaults = createDefaultPlayerSheetLayout();
  const raw =
    tokensOrLayout &&
    typeof tokensOrLayout === 'object' &&
    ('playerSheetLayout' in tokensOrLayout ||
      'blocksOrder' in tokensOrLayout ||
      Array.isArray(tokensOrLayout))
      ? 'playerSheetLayout' in tokensOrLayout
        ? tokensOrLayout.playerSheetLayout
        : tokensOrLayout
      : null;

  if (!raw || typeof raw !== 'object') return defaults;

  const mergedBlocks = { ...defaults.blocks };
  let order: PlayerSheetBlockId[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && ALL_PLAYER_SHEET_BLOCK_IDS.includes(item.id)) {
        const id = item.id as PlayerSheetBlockId;
        order.push(id);
        mergedBlocks[id] = normalizeSpatialBlock(defaults.blocks[id], item);
      }
    }
    if (Array.isArray((raw as any).blocksOrder) && order.length === 0) {
      order = (raw as any).blocksOrder;
    }
  } else {
    if (Array.isArray(raw.blocksOrder)) {
      order = raw.blocksOrder.filter((id: any): id is PlayerSheetBlockId =>
        ALL_PLAYER_SHEET_BLOCK_IDS.includes(id)
      );
    }
    for (const id of ALL_PLAYER_SHEET_BLOCK_IDS) {
      const incoming = raw.blocks?.[id];
      if (incoming && typeof incoming === 'object') {
        mergedBlocks[id] = normalizeSpatialBlock(defaults.blocks[id], incoming);
      }
    }
  }

  return buildHybridLayout(ALL_PLAYER_SHEET_BLOCK_IDS, order, mergedBlocks);
}

export function updatePlayerSheetBlock(
  layoutInput: PlayerSheetSpatialLayoutConfig | any,
  blockId: PlayerSheetBlockId,
  patch: Partial<SpatialBlockConfig<PlayerSheetBlockId>>
): PlayerSheetSpatialLayoutConfig {
  const resolved = resolvePlayerSheetLayout(layoutInput);
  const current = resolved.blocks[blockId];
  if (!current) return resolved;

  const nextBlocks = {
    ...resolved.blocks,
    [blockId]: normalizeSpatialBlock(current, patch),
  };

  return buildHybridLayout(ALL_PLAYER_SHEET_BLOCK_IDS, resolved.blocksOrder, nextBlocks);
}

export function movePlayerSheetBlockOrder(
  layoutInput: PlayerSheetSpatialLayoutConfig | any,
  blockId: PlayerSheetBlockId,
  direction: 'up' | 'down'
): PlayerSheetSpatialLayoutConfig {
  const resolved = resolvePlayerSheetLayout(layoutInput);
  const list = [...resolved.blocksOrder];
  const idx = list.indexOf(blockId);
  if (idx === -1) return resolved;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= list.length) return resolved;
  const temp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = temp;
  return buildHybridLayout(ALL_PLAYER_SHEET_BLOCK_IDS, list, { ...resolved.blocks });
}

export function createDefaultPlayerMapLayout(): PlayerMapSpatialLayoutConfig {
  const blocks: Record<PlayerMapBlockId, SpatialBlockConfig<PlayerMapBlockId>> = {
    map_top_bar: makeRawBlock({
      id: 'map_top_bar',
      name: 'Barra Superior de Sala, Estandarte DM y Navegación',
      visible: true,
      order: 0,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#12141e',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 14,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Estandarte del Dungeon Master',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 14,
      bodyFontSizePx: 11,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#a855f7',
      iconSizePx: 15,
      ...buildInnerMap([
        makeInnerEl('map_location_badge', 'Ubicación: Fortaleza Cragmaw', {
          bgColor: '#1c1917',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('map_dm_banner', 'DM: «Iniciativa Activa • Ronda 2»', {
          bgColor: '#241434',
          borderColor: '#c084fc',
        }),
        makeInnerEl('map_btn_whisper', 'Susurrar al DM', {
          bgColor: '#3b0764',
          borderColor: '#a855f7',
        }),
        makeInnerEl('map_btn_sheet', 'Volver a Hoja', {
          bgColor: '#064e3b',
          borderColor: '#10b981',
        }),
        makeInnerEl('map_btn_save', 'Guardar', {
          bgColor: '#78350f',
          borderColor: '#f59e0b',
        }),
      ]),
    }),
    map_canvas_area: makeRawBlock({
      id: 'map_canvas_area',
      name: 'Lienzo Central del Mapa y Escena Proyectada',
      visible: true,
      order: 1,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 8,
      opacity: 1,
      boxBgOpacity: 0.96,
      hideBorder: false,
      bgColor: '#0d0f17',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 18,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Mapa Táctico Activo',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 15,
      bodyFontSizePx: 12,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#10b981',
      iconSizePx: 16,
      ...buildInnerMap([
        makeInnerEl('map_zoom_in', 'Zoom +', { bgColor: '#1e2230', borderColor: '#c8a45c' }),
        makeInnerEl('map_zoom_out', 'Zoom -', { bgColor: '#1e2230', borderColor: '#c8a45c' }),
        makeInnerEl('map_zoom_reset', 'Centrar 1:1', { bgColor: '#1e2230', borderColor: '#c8a45c' }),
        makeInnerEl('map_grid_badge', 'Cuadrícula 20x20', {
          bgColor: '#064e3b',
          borderColor: '#10b981',
        }),
      ]),
    }),
    map_decks_overlay: makeRawBlock({
      id: 'map_decks_overlay',
      name: 'Ventana Plegable: Mazos del Viajero (Ataques, Habilidades, Conjuros)',
      visible: true,
      order: 2,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.95,
      hideBorder: false,
      bgColor: '#12141d',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Mazos del Viajero',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 14,
      ...buildInnerMap([
        makeInnerEl('map_deck_tab_combat', 'Ataques', {
          bgColor: '#451a03',
          borderColor: '#f59e0b',
        }),
        makeInnerEl('map_deck_tab_skills', 'Habilidades', {
          bgColor: '#083344',
          borderColor: '#22d3ee',
        }),
        makeInnerEl('map_deck_tab_spells', 'Conjuros', {
          bgColor: '#3b0764',
          borderColor: '#c084fc',
        }),
        makeInnerEl('map_deck_card_1', 'Espada Larga +1 (+8 • 1d8+5)', {
          bgColor: '#231914',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('map_deck_card_2', 'Atletismo (+7)', {
          bgColor: '#101d24',
          borderColor: '#22d3ee',
        }),
      ]),
    }),
    map_notebook_overlay: makeRawBlock({
      id: 'map_notebook_overlay',
      name: 'Ventana Plegable: Libreta del Viajero (Notas Rápidas)',
      visible: true,
      order: 3,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.95,
      hideBorder: false,
      bgColor: '#12141d',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Libreta del Viajero',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#06b6d4',
      iconSizePx: 14,
      ...buildInnerMap([
        makeInnerEl('notebook_header', 'Apuntes de Exploración', {
          bgColor: '#162730',
          borderColor: '#06b6d4',
        }),
        makeInnerEl('notebook_textarea', 'El altar del norte oculta una runa dorada...', {
          bgColor: '#0f141c',
          borderColor: '#334155',
        }),
        makeInnerEl('notebook_btn_save', 'Guardar Nota', {
          bgColor: '#083344',
          borderColor: '#22d3ee',
        }),
      ]),
    }),
    map_enemies_panel: makeRawBlock({
      id: 'map_enemies_panel',
      name: 'Panel de Enemigos en Combate',
      visible: true,
      order: 4,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#241216',
      borderColor: '#dc2626',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Enemigos en Mesa',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#fca5a5',
      textColor: '#fee2e2',
      accentColor: '#ef4444',
      iconSizePx: 14,
      ...buildInnerMap([
        makeInnerEl('enemy_card_1', 'Capitán Orco (32/45 PG • CA 16)', {
          bgColor: '#450a0a',
          borderColor: '#ef4444',
        }),
        makeInnerEl('enemy_card_2', 'Chamán Goblinoide (18/22 PG • CA 13)', {
          bgColor: '#450a0a',
          borderColor: '#ef4444',
        }),
      ]),
    }),
    map_roll_history_panel: makeRawBlock({
      id: 'map_roll_history_panel',
      name: 'Historial de Tiradas y Último Dado Tirado',
      visible: true,
      order: 5,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#131622',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Historial de Dados',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 14,
      ...buildInnerMap([
        makeInnerEl('latest_roll_banner', 'Último: Valeros • 20 Natural (Total 28)', {
          bgColor: '#451a03',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
        }),
        makeInnerEl('roll_history_item_1', 'Lyra • Sigilo: 19 (1d20+6)', {
          bgColor: '#1c1f2e',
          borderColor: '#475569',
        }),
        makeInnerEl('roll_history_item_2', 'DM • Ataque Orco: 14 (1d20+5)', {
          bgColor: '#1c1f2e',
          borderColor: '#475569',
        }),
      ]),
    }),
    map_dice_box_panel: makeRawBlock({
      id: 'map_dice_box_panel',
      name: 'Caja de Dados Poliédricos (1 a 6 Dados)',
      visible: true,
      order: 6,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.94,
      hideBorder: false,
      bgColor: '#151824',
      borderColor: '#d97706',
      borderWidthPx: 2,
      borderRadiusPx: 16,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Caja de Dados',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#fde68a',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 15,
      ...buildInnerMap([
        makeInnerEl('die_d4', 'd4', { shape: 'triangle', bgColor: '#271e12', borderColor: '#f59e0b' }),
        makeInnerEl('die_d6', 'd6', { shape: 'square', bgColor: '#271e12', borderColor: '#f59e0b' }),
        makeInnerEl('die_d8', 'd8', { shape: 'diamond', bgColor: '#271e12', borderColor: '#f59e0b' }),
        makeInnerEl('die_d10', 'd10', { shape: 'pentagon', bgColor: '#271e12', borderColor: '#f59e0b' }),
        makeInnerEl('die_d12', 'd12', { shape: 'hexagon', bgColor: '#271e12', borderColor: '#f59e0b' }),
        makeInnerEl('die_d20', 'd20', { shape: 'octagon', bgColor: '#451a03', borderColor: '#fbbf24' }),
        makeInnerEl('btn_roll_dice', '¡Tirar Dados!', {
          bgColor: '#78350f',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
        }),
      ]),
    }),
    map_mini_tarot_dock: makeRawBlock({
      id: 'map_mini_tarot_dock',
      name: 'Barra Inferior de Cartas Tarot Miniatura del Grupo',
      visible: true,
      order: 7,
      x: 0,
      y: 0,
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      paddingPx: 10,
      opacity: 1,
      boxBgOpacity: 0.92,
      hideBorder: false,
      bgColor: '#11141d',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 18,
      bgImageUrl: '',
      bgImageFit: 'cover',
      titleText: 'Grupo Conectado en Mesa',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 13,
      bodyFontSizePx: 11,
      titleColor: '#f5e4be',
      textColor: '#e7e5e4',
      accentColor: '#f59e0b',
      iconSizePx: 14,
      ...buildInnerMap([
        makeInnerEl('mini_tarot_1', 'Valeros (FUE 18 • 44/44 PG)', {
          bgColor: '#1a1f2c',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('mini_tarot_2', 'Lyra (DES 18 • 31/31 PG)', {
          bgColor: '#1a1f2c',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('mini_tarot_3', 'Thorgar (CON 16 • 52/52 PG)', {
          bgColor: '#1a1f2c',
          borderColor: '#c8a45c',
        }),
      ]),
    }),
  };

  return buildHybridLayout(
    ALL_PLAYER_MAP_BLOCK_IDS,
    [...ALL_PLAYER_MAP_BLOCK_IDS],
    blocks
  );
}

export function resolvePlayerMapLayout(
  tokensOrLayout?: AppSkinThemeTokens | PlayerMapSpatialLayoutConfig | any | null
): PlayerMapSpatialLayoutConfig {
  const defaults = createDefaultPlayerMapLayout();
  const raw =
    tokensOrLayout &&
    typeof tokensOrLayout === 'object' &&
    ('playerMapLayout' in tokensOrLayout ||
      'blocksOrder' in tokensOrLayout ||
      Array.isArray(tokensOrLayout))
      ? 'playerMapLayout' in tokensOrLayout
        ? tokensOrLayout.playerMapLayout
        : tokensOrLayout
      : null;

  if (!raw || typeof raw !== 'object') return defaults;

  const mergedBlocks = { ...defaults.blocks };
  let order: PlayerMapBlockId[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && ALL_PLAYER_MAP_BLOCK_IDS.includes(item.id)) {
        const id = item.id as PlayerMapBlockId;
        order.push(id);
        mergedBlocks[id] = normalizeSpatialBlock(defaults.blocks[id], item);
      }
    }
    if (Array.isArray((raw as any).blocksOrder) && order.length === 0) {
      order = (raw as any).blocksOrder;
    }
  } else {
    if (Array.isArray(raw.blocksOrder)) {
      order = raw.blocksOrder.filter((id: any): id is PlayerMapBlockId =>
        ALL_PLAYER_MAP_BLOCK_IDS.includes(id)
      );
    }
    for (const id of ALL_PLAYER_MAP_BLOCK_IDS) {
      const incoming = raw.blocks?.[id];
      if (incoming && typeof incoming === 'object') {
        mergedBlocks[id] = normalizeSpatialBlock(defaults.blocks[id], incoming);
      }
    }
  }

  return buildHybridLayout(ALL_PLAYER_MAP_BLOCK_IDS, order, mergedBlocks);
}

export function updatePlayerMapBlock(
  layoutInput: PlayerMapSpatialLayoutConfig | any,
  blockId: PlayerMapBlockId,
  patch: Partial<SpatialBlockConfig<PlayerMapBlockId>>
): PlayerMapSpatialLayoutConfig {
  const resolved = resolvePlayerMapLayout(layoutInput);
  const current = resolved.blocks[blockId];
  if (!current) return resolved;

  const nextBlocks = {
    ...resolved.blocks,
    [blockId]: normalizeSpatialBlock(current, patch),
  };

  return buildHybridLayout(ALL_PLAYER_MAP_BLOCK_IDS, resolved.blocksOrder, nextBlocks);
}

export function createDefaultDeckCardTemplate(
  deckKind: 'combat' | 'skills' | 'spells'
): DeckCardGraphicTemplate {
  const commonInner = buildInnerMap([
    makeInnerEl('card_header_title', deckKind === 'combat' ? 'Espada Larga +1' : deckKind === 'skills' ? 'Atletismo' : 'Bola de Fuego', {
      exampleValue: deckKind === 'combat' ? 'Arma Cuerpo a Cuerpo' : deckKind === 'skills' ? 'Fuerza (Competente)' : 'Evocación Nivel 3',
      bgColor: '#1c1917',
      borderColor: '#c8a45c',
    }),
    makeInnerEl('card_bonus_badge', deckKind === 'combat' ? '+8 ATAQUE' : deckKind === 'skills' ? '+7 BONO' : 'CD 15 • 8d6', {
      bgColor: '#451a03',
      borderColor: '#f59e0b',
      textColor: '#fde68a',
    }),
    makeInnerEl('card_illustration_box', 'Ilustración de la Carta', {
      widthPx: 180,
      heightPx: 88,
      bgColor: '#0f131d',
      borderColor: '#c8a45c',
    }),
    makeInnerEl('card_description_box', 'Descripción de la Carta', {
      exampleValue:
        deckKind === 'combat'
          ? 'Hoja forjada en plata élfica. Otorga +1 a las tiradas de ataque y daño.'
          : deckKind === 'skills'
          ? 'Pruebas de escalar, saltar o nadar en condiciones extremas.'
          : 'Una chispa brillante estalla en una esfera de llamas de 20 pies de radio.',
      bgColor: '#141722',
      borderColor: '#475569',
    }),
    makeInnerEl('card_roll_button', 'Tirar d20', {
      bgColor: '#78350f',
      borderColor: '#fbbf24',
      textColor: '#fef3c7',
    }),
  ]);

  if (deckKind === 'combat') {
    return {
      deckKind: 'combat',
      label: 'Combates y Acciones',
      cardShape: 'rounded',
      edgeFadePercent: 0,
      illustrationShape: 'rounded',
      illustrationHideBorder: false,
      illustrationEdgeFadePercent: 0,
      bgColor: '#1b1410',
      bgGradient: 'linear-gradient(180deg, #271b14 0%, #19120e 55%, #110c09 100%)',
      borderColor: '#c8a45c',
      borderWidthPx: 2,
      borderRadiusPx: 14,
      hideBorder: false,
      boxBgOpacity: 0.96,
      opacity: 0.96,
      customFramePngUrl: '',
      customBgPngUrl: '',
      headerBgColor: '#251a12',
      titleColor: '#f5e4be',
      subtitleColor: '#fbbf24',
      descriptionColor: '#d6d3d1',
      descColor: '#d6d3d1',
      badgeBgColor: '#451a03',
      badgeTextColor: '#fde68a',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 12,
      descriptionFontSizePx: 10,
      artworkShape: 'rounded',
      artworkEdgeFadePercent: 0,
      artworkHideBorder: false,
      ...commonInner,
    };
  }
  if (deckKind === 'skills') {
    return {
      deckKind: 'skills',
      label: 'Habilidades',
      cardShape: 'rounded',
      edgeFadePercent: 0,
      illustrationShape: 'rounded',
      illustrationHideBorder: false,
      illustrationEdgeFadePercent: 0,
      bgColor: '#101d24',
      bgGradient: 'linear-gradient(180deg, #162730 0%, #121f26 55%, #0d151a 100%)',
      borderColor: '#22d3ee',
      borderWidthPx: 2,
      borderRadiusPx: 14,
      hideBorder: false,
      boxBgOpacity: 0.96,
      opacity: 0.96,
      customFramePngUrl: '',
      customBgPngUrl: '',
      headerBgColor: '#0e242d',
      titleColor: '#f5e4be',
      subtitleColor: '#67e8f9',
      descriptionColor: '#cffafe',
      descColor: '#cffafe',
      badgeBgColor: '#083344',
      badgeTextColor: '#a5f3fc',
      fontFamily: "'Cinzel', serif",
      titleFontSizePx: 12,
      descriptionFontSizePx: 10,
      artworkShape: 'rounded',
      artworkEdgeFadePercent: 0,
      artworkHideBorder: false,
      ...commonInner,
    };
  }
  return {
    deckKind: 'spells',
    label: 'Lanzar Conjuros',
    cardShape: 'rounded',
    edgeFadePercent: 0,
    illustrationShape: 'rounded',
    illustrationHideBorder: false,
    illustrationEdgeFadePercent: 0,
    bgColor: '#1c1128',
    bgGradient: 'linear-gradient(180deg, #261736 0%, #1c1128 55%, #120b1a 100%)',
    borderColor: '#c084fc',
    borderWidthPx: 2,
    borderRadiusPx: 14,
    hideBorder: false,
    boxBgOpacity: 0.96,
    opacity: 0.96,
    customFramePngUrl: '',
    customBgPngUrl: '',
    headerBgColor: '#241434',
    titleColor: '#f5e4be',
    subtitleColor: '#d8b4fe',
    descriptionColor: '#e9d5ff',
    descColor: '#e9d5ff',
    badgeBgColor: '#3b0764',
    badgeTextColor: '#f3e8ff',
    fontFamily: "'Cinzel', serif",
    titleFontSizePx: 12,
    descriptionFontSizePx: 10,
    artworkShape: 'rounded',
    artworkEdgeFadePercent: 0,
    artworkHideBorder: false,
    ...commonInner,
  };
}

export function resolveDeckCardTemplate(
  tokens: AppSkinThemeTokens | null | undefined,
  deckKind: 'combat' | 'skills' | 'spells'
): DeckCardGraphicTemplate {
  const defaults = createDefaultDeckCardTemplate(deckKind);
  const raw: Partial<DeckCardGraphicTemplate> =
    (deckKind === 'combat'
      ? tokens?.combatCardTemplate
      : deckKind === 'skills'
      ? tokens?.skillsCardTemplate
      : tokens?.spellsCardTemplate) || {};

  const edgeFade = raw.edgeFadePercent ?? raw.artworkEdgeFadePercent ?? defaults.edgeFadePercent;
  const illustShape = raw.illustrationShape || raw.artworkShape || defaults.illustrationShape;
  const illustHideBorder =
    raw.illustrationHideBorder ?? raw.artworkHideBorder ?? defaults.illustrationHideBorder;
  const illustFade =
    raw.illustrationEdgeFadePercent ??
    raw.artworkEdgeFadePercent ??
    defaults.illustrationEdgeFadePercent;
  const descCol = raw.descColor || raw.descriptionColor || defaults.descColor;
  const bgPng = raw.customBgPngUrl || raw.customFramePngUrl || '';
  const op = raw.opacity ?? raw.boxBgOpacity ?? defaults.opacity;

  const mergedButtons: Record<string, SpatialInnerElementConfig> = {
    ...(defaults.innerButtonsConfig || {}),
  };
  for (const [k, v] of Object.entries(raw.innerButtonsConfig || {})) {
    if (v && typeof v === 'object') {
      mergedButtons[k] = {
        ...(mergedButtons[k] || makeInnerEl(k, v.label || k)),
        ...v,
        id: k,
      };
    }
  }

  return {
    ...defaults,
    ...raw,
    deckKind,
    label: raw.label || defaults.label,
    edgeFadePercent: edgeFade,
    artworkEdgeFadePercent: edgeFade,
    illustrationShape: illustShape,
    artworkShape: illustShape,
    illustrationHideBorder: illustHideBorder,
    artworkHideBorder: illustHideBorder,
    illustrationEdgeFadePercent: illustFade,
    descColor: descCol,
    descriptionColor: descCol,
    customBgPngUrl: bgPng,
    customFramePngUrl: bgPng,
    opacity: op,
    boxBgOpacity: op,
    innerButtonsOrder: raw.innerButtonsOrder || defaults.innerButtonsOrder,
    innerButtonsConfig: mergedButtons,
  };
}

export function createDefaultStatBoxGraphicConfig(): StatBoxGraphicConfig {
  return {
    shape: 'rounded',
    hideBorder: false,
    edgeFadePercent: 0,
    boxBgOpacity: 0.94,
    opacity: 0.94,
    bgColor: '#181b26',
    borderColor: '#c8a45c',
    borderWidthPx: 2,
    borderRadiusPx: 14,
    customFramePngUrl: '',
    customPngUrl: '',
    fontFamily: "'Cinzel', serif",
    labelFontSizePx: 10,
    valueFontSizePx: 16,
    modifierFontSizePx: 11,
    labelColor: '#d8ba73',
    valueColor: '#ffffff',
    modifierColor: '#fde68a',
    ...buildInnerMap([
      makeInnerEl('part_label', 'FUE', {
        exampleValue: 'Fuerza',
        fontSizePx: 11,
        bgColor: '#11141d',
        borderColor: '#c8a45c',
        textColor: '#d8ba73',
      }),
      makeInnerEl('part_mod', '+4', {
        exampleValue: 'Modificador',
        fontSizePx: 18,
        bgColor: '#271e12',
        borderColor: '#f59e0b',
        textColor: '#fde68a',
      }),
      makeInnerEl('part_total', 'TOTAL: 18', {
        exampleValue: 'Puntaje Total',
        fontSizePx: 12,
        bgColor: '#181b26',
        borderColor: '#c8a45c',
        textColor: '#ffffff',
      }),
      makeInnerEl('part_base', 'Base: 14', {
        fontSizePx: 10,
        bgColor: '#12151f',
        borderColor: '#475569',
        textColor: '#cbd5e1',
      }),
      makeInnerEl('part_extra', 'Extra: +0', {
        fontSizePx: 10,
        bgColor: '#12151f',
        borderColor: '#475569',
        textColor: '#cbd5e1',
      }),
      makeInnerEl('part_items', 'Obj: +4', {
        fontSizePx: 10,
        bgColor: '#064e3b',
        borderColor: '#10b981',
        textColor: '#a7f3d0',
      }),
      makeInnerEl('part_save', 'Salvación: +7', {
        fontSizePx: 10,
        bgColor: '#3b0764',
        borderColor: '#a855f7',
        textColor: '#e9d5ff',
      }),
    ]),
  };
}

export function resolveStatBoxGraphicConfig(
  tokens?: AppSkinThemeTokens | null
): StatBoxGraphicConfig {
  const defaults = createDefaultStatBoxGraphicConfig();
  const raw = tokens?.statBoxGraphicConfig;
  const resolvedPng =
    raw?.customPngUrl ||
    raw?.customFramePngUrl ||
    tokens?.sheetStatBoxCustomPngUrl ||
    defaults.customPngUrl;
  const resolvedOpacity =
    raw?.opacity ?? raw?.boxBgOpacity ?? tokens?.sheetStatBoxOpacity ?? defaults.opacity;

  const mergedButtons: Record<string, SpatialInnerElementConfig> = {
    ...(defaults.innerButtonsConfig || {}),
  };
  for (const [k, v] of Object.entries(raw?.innerButtonsConfig || {})) {
    if (v && typeof v === 'object') {
      mergedButtons[k] = {
        ...(mergedButtons[k] || makeInnerEl(k, v.label || k)),
        ...v,
        id: k,
      };
    }
  }

  return {
    ...defaults,
    ...(raw || {}),
    bgColor: raw?.bgColor || tokens?.sheetStatBoxBg || defaults.bgColor,
    borderColor: raw?.borderColor || tokens?.sheetStatBoxBorder || defaults.borderColor,
    customFramePngUrl: resolvedPng,
    customPngUrl: resolvedPng,
    opacity: resolvedOpacity,
    boxBgOpacity: resolvedOpacity,
    innerButtonsOrder: raw?.innerButtonsOrder || defaults.innerButtonsOrder,
    innerButtonsConfig: mergedButtons,
  };
}

export function createDefaultTarotModules(): TarotCardModuleItem[] {
  const mod = (
    id: string,
    kind: TarotCardModuleKind,
    name: string,
    side: 'front' | 'back' | 'token',
    x: number,
    y: number,
    widthPx: number,
    heightPx: number,
    label: string,
    exampleValue: string,
    extra: Partial<TarotCardModuleItem> = {}
  ): TarotCardModuleItem => ({
    id,
    kind,
    name,
    side,
    visible: true,
    x,
    y,
    widthPx,
    heightPx,
    zIndex: 10,
    opacity: 1,
    boxBgOpacity: 0.92,
    shape: 'rounded',
    edgeFadePercent: 0,
    hideBorder: false,
    bgColor: '#11141d',
    borderColor: '#c8a45c',
    borderWidthPx: 1,
    borderRadiusPx: 8,
    bgImageUrl: '',
    customIconUrl: '',
    label,
    exampleValue,
    fontFamily: "'Cinzel', serif",
    fontSizePx: 12,
    labelFontSizePx: 9,
    textColor: '#ffffff',
    labelColor: '#e5c478',
    ...extra,
  });

  return [
    mod('mod_online_badge', 'online_badge', 'Estado En Línea', 'front', 12, 10, 86, 22, '', 'En Línea', {
      bgColor: '#0d261f',
      borderColor: '#10b981',
      textColor: '#34d399',
      fontSizePx: 9,
      borderRadiusPx: 99,
    }),
    mod('mod_level_xp', 'level_xp_badge', 'Nivel y XP', 'front', 166, 10, 112, 22, 'NVL 5', '6,500 XP', {
      bgColor: '#271e12',
      borderColor: '#c8a45c',
      textColor: '#fde68a',
      fontSizePx: 9,
      borderRadiusPx: 99,
    }),
    mod('mod_portrait', 'portrait', 'Retrato / Portada del Héroe', 'front', 75, 38, 140, 140, '', 'Retrato', {
      shape: 'circle',
      bgColor: '#0e1118',
      borderColor: '#c8a45c',
      borderWidthPx: 3,
      borderRadiusPx: 999,
      zIndex: 15,
    }),
    mod('mod_char_name', 'character_name', 'Nombre del Personaje', 'front', 16, 184, 258, 28, '', 'Valeros del Alba', {
      boxBgOpacity: 0,
      hideBorder: true,
      textColor: '#f5e4be',
      fontSizePx: 17,
    }),
    mod('mod_alignment', 'alignment_badge', 'Alineamiento', 'front', 80, 214, 130, 22, '', 'Legal Bueno', {
      bgColor: '#151924',
      borderColor: '#c8a45c',
      textColor: '#e5c478',
      fontSizePx: 9,
      borderRadiusPx: 99,
    }),
    mod('mod_race_class', 'race_class', 'Raza y Clase', 'front', 25, 238, 240, 20, '', 'Humano • Guerrero', {
      boxBgOpacity: 0,
      hideBorder: true,
      textColor: '#9aa3b5',
      fontSizePx: 10,
    }),
    mod('mod_stat_ca', 'stat_ca', 'Defensa (CA)', 'front', 12, 262, 62, 38, 'CA', '18', {
      fontSizePx: 13,
    }),
    mod('mod_stat_init', 'stat_init', 'Iniciativa', 'front', 79, 262, 62, 38, 'INIC', '+2', {
      fontSizePx: 13,
      textColor: '#f59e0b',
    }),
    mod('mod_stat_speed', 'stat_speed', 'Velocidad', 'front', 146, 262, 62, 38, 'VEL', '30ft', {
      fontSizePx: 12,
      textColor: '#38bdf8',
    }),
    mod('mod_stat_pp', 'stat_pp', 'Percepción Pasiva', 'front', 213, 262, 65, 38, 'PP', '13', {
      fontSizePx: 13,
      textColor: '#c084fc',
    }),
    mod('mod_hp_bar', 'hp_bar', 'Barra de Vida (PG)', 'front', 12, 306, 266, 28, 'PG', '44 / 44', {
      bgColor: '#0e1118',
      borderColor: '#22b573',
      fillDirection: 'left_to_right',
      fillColor: '#22b573',
      emptyBgColor: '#0e1118',
      fillTexturePngUrl: '',
      frameOverlayPngUrl: '',
      showNumericText: true,
      fontSizePx: 11,
    }),
    mod('mod_ability_str', 'ability_str', 'Estadística: FUE', 'front', 12, 340, 41, 44, 'FUE', '18', {
      fontSizePx: 13,
    }),
    mod('mod_ability_dex', 'ability_dex', 'Estadística: DES', 'front', 57, 340, 41, 44, 'DES', '14', {
      fontSizePx: 13,
    }),
    mod('mod_ability_con', 'ability_con', 'Estadística: CON', 'front', 102, 340, 41, 44, 'CON', '16', {
      fontSizePx: 13,
    }),
    mod('mod_ability_int', 'ability_int', 'Estadística: INT', 'front', 147, 340, 41, 44, 'INT', '10', {
      fontSizePx: 13,
    }),
    mod('mod_ability_wis', 'ability_wis', 'Estadística: SAB', 'front', 192, 340, 41, 44, 'SAB', '12', {
      fontSizePx: 13,
    }),
    mod('mod_ability_cha', 'ability_cha', 'Estadística: CAR', 'front', 237, 340, 41, 44, 'CAR', '11', {
      fontSizePx: 13,
    }),
    mod('mod_coin_gp', 'coin_gp', 'Monedas: Oro (PO)', 'front', 12, 392, 62, 32, 'PO', '125', {
      textColor: '#fbbf24',
      fontSizePx: 11,
    }),
    mod('mod_coin_sp', 'coin_sp', 'Monedas: Plata (PP)', 'front', 79, 392, 62, 32, 'PP', '40', {
      textColor: '#cbd5e1',
      fontSizePx: 11,
    }),
    mod('mod_coin_cp', 'coin_cp', 'Monedas: Cobre (PC)', 'front', 146, 392, 62, 32, 'PC', '15', {
      textColor: '#fb923c',
      fontSizePx: 11,
    }),
    mod('mod_coin_pp', 'coin_pp', 'Monedas: Platino (PL)', 'front', 213, 392, 65, 32, 'PL', '5', {
      textColor: '#a5f3fc',
      fontSizePx: 11,
    }),
    mod(
      'mod_lore_quote',
      'lore_quote',
      'Cita / Historia del Reverso',
      'back',
      20,
      140,
      250,
      160,
      'Crónica del Héroe',
      '«Las crónicas del destino se escriben con acero, magia y voluntad.»',
      {
        bgColor: '#120e1c',
        borderColor: '#c8a45c',
        textColor: '#f5e4be',
        fontSizePx: 12,
      }
    ),
    // Base default module for the Ficha de Jugador ('token'): literally just the circular character image!
    mod(
      'mod_token_portrait',
      'portrait',
      'Imagen de Ficha del Personaje',
      'token',
      10,
      10,
      156,
      156,
      '',
      'Valeros del Alba',
      {
        shape: 'circle',
        bgColor: '#0e1118',
        borderColor: '#c8a45c',
        borderWidthPx: 2,
        borderRadiusPx: 999,
        boxBgOpacity: 0.95,
        zIndex: 10,
      }
    ),
  ];
}

export function createDefaultTarotStudioConfig(): TarotCardExclusiveStudioConfig {
  return {
    cardWidthPx: 290,
    cardHeightPx: 450,
    outerBleedPercent: 20,
    cardShape: 'rounded',
    borderWidthPx: 2,
    // Default Ficha de Jugador (Tactical Token inside Square Grid Cell)
    tokenSquareSizePx: 180,
    tokenInnerRatioPercent: 80,
    tokenShape: 'circle',
    tokenBgColor: '#131722',
    tokenBorderColor: '#c8a45c',
    tokenBorderWidthPx: 3,
    tokenHideBorder: false,
    tokenBoxBgOpacity: 0.96,
    tokenEdgeFadePercent: 0,
    tokenCustomFramePngUrl: '',
    tokenAnimatedBorderGifUrl: '',
    modules: createDefaultTarotModules(),
    animatedBorderGifUrl: '',
    borderEffectPreset: 'none',
    frontBgColor: '#1a1f2c',
    frontBgGradient: 'linear-gradient(180deg, #1f2533 0%, #1a1f2c 55%, #141822 100%)',
    frontCustomPngUrl: '',
    frontCustomFramePngUrl: '',
    frontBgImageUrl: '',
    frontBoxBgOpacity: 0.96,
    backBgColor: '#120e1c',
    backBgGradient: 'linear-gradient(180deg, #1a1326 0%, #120e1c 55%, #0b0912 100%)',
    backCustomPngUrl: '',
    backBgImageUrl: '',
    backAnimatedGifUrl: '',
    backBoxBgOpacity: 0.96,
    borderColor: '#c8a45c',
    glowColor: 'rgba(200, 164, 92, 0.35)',
    borderRadiusPx: 18,
    hideBorder: false,
    artworkShape: 'circle',
    artworkHideBorder: false,
    artworkEdgeFadePercent: 0,
    artworkPopoutScale: 1,
    artworkOverflowCinema: false,
    artworkOffsetX: 0,
    artworkOffsetY: 0,
    hpPlacement: 'front',
    frontHpStyle: 'classic_bar',
    backHpStyle: 'alchemical_potion',
    hpPrimaryColor: '#22b573',
    hpSecondaryColor: '#0e1118',
    hpCustomPngUrl: '',
    frontHpCustomPngUrl: '',
    backHpCustomPngUrl: '',
    statsPlacement: 'front_grid',
    statsShape: 'rounded',
    statsScale: 'md',
    statsBgColor: '#11141d',
    statsBorderColor: '#c8a45c',
    statsTextColor: '#ffffff',
    elementSides: {
      identity: 'both',
      alignment: 'front',
      combatStats: 'front',
      hpBar: 'front',
      abilityStats: 'front',
      coins: 'front',
      loreQuote: 'back',
    },
    backLoreQuoteText: '«Las crónicas del destino se escriben con acero, magia y voluntad.»',
    fontFamily: "'Cinzel', serif",
    titleColor: '#e5c478',
    subtitleColor: '#9aa3b5',
    customStickers: [],
  };
}

export function resolveTarotStudioConfig(
  tokens?: AppSkinThemeTokens | null
): TarotCardExclusiveStudioConfig {
  const defaults = createDefaultTarotStudioConfig();
  const raw = tokens?.tarotStudioConfig;
  const frontImg =
    raw?.frontBgImageUrl ||
    raw?.frontCustomPngUrl ||
    tokens?.tarotCardCustomFramePngUrl ||
    defaults.frontBgImageUrl;
  const backImg =
    raw?.backBgImageUrl ||
    raw?.backCustomPngUrl ||
    tokens?.tarotCardBackCustomPngUrl ||
    defaults.backBgImageUrl;

  const defaultModules = defaults.modules!;
  let resolvedModules: TarotCardModuleItem[] =
    Array.isArray(raw?.modules) && raw!.modules.length > 0
      ? raw!.modules.map((m) => ({
          ...defaultModules[0],
          ...m,
        }))
      : [...defaultModules];

  // Ensure at least the default token portrait exists if an older config had no token modules
  if (!resolvedModules.some((m) => m.side === 'token')) {
    const defaultTokenMod = defaultModules.find((m) => m.id === 'mod_token_portrait');
    if (defaultTokenMod) {
      resolvedModules = [...resolvedModules, { ...defaultTokenMod }];
    }
  }

  return {
    ...defaults,
    ...(raw || {}),
    cardWidthPx: Math.max(200, Math.min(520, Number(raw?.cardWidthPx) || defaults.cardWidthPx!)),
    cardHeightPx: Math.max(260, Math.min(720, Number(raw?.cardHeightPx) || defaults.cardHeightPx!)),
    outerBleedPercent:
      raw?.outerBleedPercent !== undefined ? Number(raw.outerBleedPercent) : 20,
    cardShape: raw?.cardShape || defaults.cardShape,
    borderWidthPx: raw?.borderWidthPx ?? defaults.borderWidthPx,
    tokenSquareSizePx: Math.max(
      120,
      Math.min(360, Number(raw?.tokenSquareSizePx) || defaults.tokenSquareSizePx!)
    ),
    tokenInnerRatioPercent: Math.max(
      50,
      Math.min(100, Number(raw?.tokenInnerRatioPercent) || defaults.tokenInnerRatioPercent!)
    ),
    tokenShape: raw?.tokenShape || defaults.tokenShape,
    tokenBgColor: raw?.tokenBgColor || defaults.tokenBgColor,
    tokenBorderColor: raw?.tokenBorderColor || defaults.tokenBorderColor,
    tokenBorderWidthPx: raw?.tokenBorderWidthPx ?? defaults.tokenBorderWidthPx,
    tokenHideBorder: raw?.tokenHideBorder ?? defaults.tokenHideBorder,
    tokenBoxBgOpacity: raw?.tokenBoxBgOpacity ?? defaults.tokenBoxBgOpacity,
    tokenEdgeFadePercent: raw?.tokenEdgeFadePercent ?? defaults.tokenEdgeFadePercent,
    tokenCustomFramePngUrl: raw?.tokenCustomFramePngUrl || defaults.tokenCustomFramePngUrl,
    tokenAnimatedBorderGifUrl:
      raw?.tokenAnimatedBorderGifUrl || defaults.tokenAnimatedBorderGifUrl,
    modules: resolvedModules,
    borderColor: raw?.borderColor || tokens?.tarotBorderColor || defaults.borderColor,
    glowColor: raw?.glowColor || tokens?.tarotGlowColor || defaults.glowColor,
    frontCustomPngUrl: frontImg,
    frontBgImageUrl: frontImg,
    backCustomPngUrl: backImg,
    backBgImageUrl: backImg,
    elementSides: {
      ...defaults.elementSides,
      ...(raw?.elementSides || {}),
    },
    customStickers: Array.isArray(raw?.customStickers) ? raw!.customStickers : [],
  };
}

export function updateTarotModule(
  configInput: TarotCardExclusiveStudioConfig | undefined | null,
  moduleId: string,
  patch: Partial<TarotCardModuleItem>
): TarotCardExclusiveStudioConfig {
  const resolved = resolveTarotStudioConfig({ tarotStudioConfig: configInput || undefined });
  const nextModules = (resolved.modules || []).map((m) =>
    m.id === moduleId ? { ...m, ...patch, id: m.id } : m
  );
  return {
    ...resolved,
    modules: nextModules,
  };
}

export function duplicateTarotModule(
  configInput: TarotCardExclusiveStudioConfig | undefined | null,
  moduleId: string,
  targetSide?: 'front' | 'back' | 'token'
): { config: TarotCardExclusiveStudioConfig; createdModuleId: string } {
  const resolved = resolveTarotStudioConfig({ tarotStudioConfig: configInput || undefined });
  const mods = [...(resolved.modules || [])];
  const source = mods.find((m) => m.id === moduleId) || mods[0];
  const destSide = targetSide || source.side;
  const createdModuleId = `${source.kind}_copy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // When copying a module from the card onto the Ficha ('token'), scale and center it inside the token square
  const isMovingToToken = destSide === 'token' && source.side !== 'token';
  const clone: TarotCardModuleItem = {
    ...source,
    id: createdModuleId,
    name:
      destSide === 'token'
        ? `${source.name} (En Ficha)`
        : `${source.name} (Copia)`,
    side: destSide,
    x: isMovingToToken
      ? 24
      : targetSide && targetSide !== source.side
      ? source.x
      : source.x + 14,
    y: isMovingToToken
      ? 132
      : targetSide && targetSide !== source.side
      ? source.y
      : source.y + 14,
    widthPx: isMovingToToken ? Math.min(source.widthPx || 120, 128) : source.widthPx,
    heightPx: isMovingToToken ? Math.min(source.heightPx || 26, 28) : source.heightPx,
    zIndex: (source.zIndex || 10) + 5,
  };
  mods.push(clone);
  return {
    config: {
      ...resolved,
      modules: mods,
    },
    createdModuleId,
  };
}

export function addCustomTarotModule(
  configInput: TarotCardExclusiveStudioConfig | undefined | null,
  side: 'front' | 'back' | 'token',
  kind: TarotCardModuleKind = 'custom_layer'
): { config: TarotCardExclusiveStudioConfig; createdModuleId: string } {
  const resolved = resolveTarotStudioConfig({ tarotStudioConfig: configInput || undefined });
  const mods = [...(resolved.modules || [])];
  const createdModuleId = `mod_${kind}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newMod: TarotCardModuleItem = {
    id: createdModuleId,
    kind,
    name:
      kind === 'hp_bar'
        ? 'Barra de Vida (Extra)'
        : kind === 'portrait'
        ? 'Retrato / Marco PNG'
        : 'Capa Libre PNG / GIF',
    side,
    visible: true,
    x: 24,
    y: 24,
    widthPx: kind === 'hp_bar' ? (side === 'token' ? 128 : 240) : 120,
    heightPx: kind === 'hp_bar' ? 28 : 120,
    zIndex: 25,
    opacity: 1,
    boxBgOpacity: kind === 'custom_layer' ? 0 : 0.9,
    shape: 'rounded',
    edgeFadePercent: 0,
    hideBorder: kind === 'custom_layer',
    bgColor: '#151924',
    borderColor: '#c8a45c',
    borderWidthPx: 2,
    borderRadiusPx: 12,
    bgImageUrl: '',
    customIconUrl: '',
    label: kind === 'hp_bar' ? 'PG' : '',
    exampleValue: kind === 'hp_bar' ? '44 / 44' : 'Capa Libre',
    fontFamily: "'Cinzel', serif",
    fontSizePx: 12,
    textColor: '#f5e4be',
    fillDirection: 'left_to_right',
    fillColor: '#22b573',
    emptyBgColor: '#0e1118',
    showNumericText: true,
  };
  mods.push(newMod);
  return {
    config: {
      ...resolved,
      modules: mods,
    },
    createdModuleId,
  };
}

export function removeTarotModule(
  configInput: TarotCardExclusiveStudioConfig | undefined | null,
  moduleId: string
): TarotCardExclusiveStudioConfig {
  const resolved = resolveTarotStudioConfig({ tarotStudioConfig: configInput || undefined });
  return {
    ...resolved,
    modules: (resolved.modules || []).filter((m) => m.id !== moduleId),
  };
}

export function createDefaultModalPopupConfig(
  modalId: SkinModalTargetId
): SkinModalPopupOverride {
  const base: SkinModalPopupOverride = {
    bgColor: '#141722',
    borderColor: '#c8a45c',
    headerBgColor: '#1a1f2e',
    textColor: '#e7e5e4',
    accentColor: '#f59e0b',
    overlayBackdropOpacity: 0.75,
    borderRadiusPx: 18,
    customBgPngUrl: '',
    shape: 'rounded',
    edgeFadePercent: 0,
    hideBorder: false,
    borderWidthPx: 2,
    widthPx: 0,
    heightPx: 0,
    boxBgOpacity: 0.96,
    opacity: 1,
    fontFamily: "'Cinzel', serif",
  };

  if (modalId === 'modal_friend_chat') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('chat_header', 'Usuario Dos (Aragorn#7721)', {
          exampleValue: 'En Línea • Chat Directo con Usuario Uno',
          bgColor: '#181c2b',
          borderColor: '#c8a45c',
          textColor: '#f5e4be',
          fontSizePx: 14,
        }),
        makeInnerEl('msg_received_1', 'Usuario Dos', {
          exampleValue: '¡Hola Usuario Uno! ¿Ya tienes lista tu hoja para la sesión de hoy?',
          bgColor: '#1e2436',
          borderColor: '#475569',
          textColor: '#e2e8f0',
          borderRadiusPx: 14,
        }),
        makeInnerEl('msg_sent_1', 'Usuario Uno (Tú)', {
          exampleValue: '¡Lista! Acabo de equipar la Espada Larga +1 y preparar mis conjuros.',
          bgColor: '#451a03',
          borderColor: '#f59e0b',
          textColor: '#fef3c7',
          borderRadiusPx: 14,
        }),
        makeInnerEl('msg_received_2', 'Usuario Dos', {
          exampleValue: '¡Genial! El DM ya abrió la sala MESA-01, entremos juntos.',
          bgColor: '#1e2436',
          borderColor: '#475569',
          textColor: '#e2e8f0',
          borderRadiusPx: 14,
        }),
        makeInnerEl('msg_sent_2', 'Usuario Uno (Tú)', {
          exampleValue: '¡Voy entrando ahora mismo! Nos vemos en el mapa táctico.',
          bgColor: '#451a03',
          borderColor: '#f59e0b',
          textColor: '#fef3c7',
          borderRadiusPx: 14,
        }),
        makeInnerEl('chat_input_box', 'Escribe un mensaje a Usuario Dos...', {
          exampleValue: 'Campo de texto del mensaje',
          bgColor: '#0f131d',
          borderColor: '#64748b',
          textColor: '#cbd5e1',
          borderRadiusPx: 12,
        }),
        makeInnerEl('chat_send_btn', 'Enviar Mensaje', {
          exampleValue: 'Botón Enviar',
          bgColor: '#78350f',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
          borderRadiusPx: 12,
        }),
      ]),
    };
  }

  if (modalId === 'modal_inventory') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('inv_header', 'Equipo e Inventario de Valeros del Alba', {
          exampleValue: 'Mochila del Aventurero',
          bgColor: '#1a1f2e',
          borderColor: '#c8a45c',
          fontSizePx: 15,
        }),
        makeInnerEl('inv_carry_bar', 'Capacidad de Carga: 39 / 270 lb', {
          exampleValue: '14% • Sin Penalización de Velocidad',
          bgColor: '#064e3b',
          borderColor: '#10b981',
          textColor: '#d1fae5',
        }),
        makeInnerEl('inv_coins_bar', 'Bolsa de Monedas', {
          exampleValue: '125 PO • 40 PP • 15 PC • 5 PL • 0 PE',
          bgColor: '#271e12',
          borderColor: '#f59e0b',
          textColor: '#fde68a',
        }),
        makeInnerEl('tab_weapons', '⚔️ Armas (3)', {
          bgColor: '#451a03',
          borderColor: '#f59e0b',
          textColor: '#fde68a',
        }),
        makeInnerEl('tab_armors', '🛡️ Armaduras (2)', {
          bgColor: '#1e293b',
          borderColor: '#64748b',
          textColor: '#e2e8f0',
        }),
        makeInnerEl('tab_objects', '🎒 Objetos (8)', {
          bgColor: '#1e293b',
          borderColor: '#64748b',
          textColor: '#e2e8f0',
        }),
        makeInnerEl('tab_spells', '✨ Conjuros (4)', {
          bgColor: '#3b0764',
          borderColor: '#c084fc',
          textColor: '#f3e8ff',
        }),
        makeInnerEl('btn_add_item', '+ Añadir al Inventario', {
          bgColor: '#065f46',
          borderColor: '#10b981',
          textColor: '#ecfdf5',
        }),
        makeInnerEl('item_card_1', 'Espada Larga +1 (Equipada)', {
          exampleValue: '+8 Ataque • 1d8+5 Cortante • 3 lb • Hoja élfica reluciente.',
          bgColor: '#1c1917',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('item_card_2', 'Cota de Mallas Real (Equipada)', {
          exampleValue: 'CA 16 • Armadura Pesada • 55 lb',
          bgColor: '#1c1917',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('item_card_3', 'Poción de Curación Mayor (x2)', {
          exampleValue: 'Consumible • Recupera 4d4+4 PG al beberla.',
          bgColor: '#1c1917',
          borderColor: '#10b981',
        }),
      ]),
    };
  }

  if (modalId === 'modal_journal') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('journal_header', 'Diario de Viaje y Crónicas de Campaña', {
          bgColor: '#1a1f2e',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('journal_index_sidebar', 'Índice de Hojas (Sesiones 1 - 4)', {
          exampleValue: 'Hoja 1: El Comienzo • Hoja 2: Las Minas...',
          bgColor: '#121622',
          borderColor: '#475569',
        }),
        makeInnerEl('btn_new_entry', '+ Nueva Hoja de Diario', {
          bgColor: '#083344',
          borderColor: '#22d3ee',
          textColor: '#cffafe',
        }),
        makeInnerEl('journal_page_editor', 'Sesión 4: El Asedio de la Fortaleza Gris', {
          exampleValue: 'Al cruzar el puente de piedra, el grupo descubrió el sello real...',
          bgColor: '#181411',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('btn_save_journal', 'Guardar Crónica', {
          bgColor: '#78350f',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
        }),
      ]),
    };
  }

  if (modalId === 'modal_traits') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('traits_header', 'Rasgos, Dotes y Trasfondo del Héroe', {
          bgColor: '#1a1f2e',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('tab_class_features', 'Rasgos de Clase (Acción Súbita, Tomar Aliento)', {
          bgColor: '#3b0764',
          borderColor: '#c084fc',
        }),
        makeInnerEl('tab_background', 'Trasfondo: Soldado • Rango Militar', {
          bgColor: '#271e12',
          borderColor: '#f59e0b',
        }),
        makeInnerEl('tab_biography', 'Biografía, Ideales, Vínculos y Defectos', {
          bgColor: '#16202a',
          borderColor: '#38bdf8',
        }),
        makeInnerEl('btn_add_trait', '+ Añadir Rasgo o Dote', {
          bgColor: '#065f46',
          borderColor: '#10b981',
        }),
      ]),
    };
  }

  if (modalId === 'modal_character_settings') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('settings_header', 'Ajustes del Héroe y Apariencia', {
          bgColor: '#1a1f2e',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('settings_skin_selector', 'Skin de Hoja Equipada', {
          exampleValue: 'Personalizada del Creador',
          bgColor: '#271e12',
          borderColor: '#f59e0b',
        }),
        makeInnerEl('settings_audio_profile', 'Efectos de Audio de Dados y Combate', {
          exampleValue: 'Dados de Madera Clásica',
          bgColor: '#16202a',
          borderColor: '#38bdf8',
        }),
        makeInnerEl('btn_export_json', 'Exportar Personaje (.JSON)', {
          bgColor: '#1e293b',
          borderColor: '#94a3b8',
        }),
        makeInnerEl('btn_save_settings', 'Guardar Ajustes', {
          bgColor: '#78350f',
          borderColor: '#fbbf24',
        }),
      ]),
    };
  }

  if (modalId === 'modal_forum_create') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('forum_modal_header', 'Publicar Nuevo Hilo en el Foro', {
          bgColor: '#1a1f2e',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('forum_cat_tabs', 'Categorías: General • Guías • Actualizaciones • Rol', {
          bgColor: '#271e12',
          borderColor: '#f59e0b',
        }),
        makeInnerEl('forum_title_input', 'Título de la publicación...', {
          bgColor: '#0f131d',
          borderColor: '#475569',
        }),
        makeInnerEl('forum_body_input', 'Escribe el contenido de tu crónica o consulta...', {
          bgColor: '#0f131d',
          borderColor: '#475569',
        }),
        makeInnerEl('forum_submit_btn', 'Publicar Hilo', {
          bgColor: '#78350f',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
        }),
      ]),
    };
  }

  if (modalId === 'modal_account_settings') {
    return {
      ...base,
      ...buildInnerMap([
        makeInnerEl('acc_header', 'Configuración de Cuenta • Usuario Uno#1024', {
          bgColor: '#1a1f2e',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('acc_avatar_box', 'Avatar de Cuenta y Estandarte Público', {
          bgColor: '#181c29',
          borderColor: '#c8a45c',
        }),
        makeInnerEl('acc_name_input', 'Nombre Visible: Usuario Uno', {
          bgColor: '#0f131d',
          borderColor: '#475569',
        }),
        makeInnerEl('acc_security_box', 'Correo Electrónico y Contraseña', {
          bgColor: '#0f131d',
          borderColor: '#475569',
        }),
        makeInnerEl('acc_save_btn', 'Guardar Cambios de Cuenta', {
          bgColor: '#78350f',
          borderColor: '#fbbf24',
          textColor: '#fef3c7',
        }),
      ]),
    };
  }

  // modal_join_room
  return {
    ...base,
    ...buildInnerMap([
      makeInnerEl('join_header', 'Unirse a Sala Multijugador en Vivo', {
        bgColor: '#1a1f2e',
        borderColor: '#c8a45c',
      }),
      makeInnerEl('join_code_input', 'Código de Sala: MESA-01', {
        bgColor: '#0f131d',
        borderColor: '#f59e0b',
        textColor: '#fde68a',
      }),
      makeInnerEl('join_char_select', 'Héroe Seleccionado: Valeros del Alba (Nvl 5)', {
        bgColor: '#181c29',
        borderColor: '#c8a45c',
      }),
      makeInnerEl('join_connect_btn', 'Conectar a la Mesa', {
        bgColor: '#065f46',
        borderColor: '#10b981',
        textColor: '#ecfdf5',
      }),
    ]),
  };
}

export function resolveModalPopupConfig(
  tokens: AppSkinThemeTokens | null | undefined,
  modalId: SkinModalTargetId
): SkinModalPopupOverride {
  const defaults = createDefaultModalPopupConfig(modalId);
  const raw =
    tokens?.modalPopupOverrides?.[modalId] ||
    tokens?.modalPopupConfigs?.[modalId] ||
    {};

  const mergedButtons: Record<string, SpatialInnerElementConfig> = {
    ...(defaults.innerElementsConfig || defaults.innerButtonsConfig || {}),
  };
  const incomingMap = {
    ...(raw.innerButtonsConfig || {}),
    ...(raw.innerElementsConfig || {}),
  };
  for (const [k, v] of Object.entries(incomingMap)) {
    if (v && typeof v === 'object') {
      mergedButtons[k] = {
        ...(mergedButtons[k] || makeInnerEl(k, (v as any).label || k)),
        ...v,
        id: k,
      };
    }
  }

  const resolvedOrder =
    raw.innerElementsOrder ||
    raw.innerButtonsOrder ||
    defaults.innerElementsOrder ||
    defaults.innerButtonsOrder ||
    Object.keys(mergedButtons);

  return {
    ...defaults,
    ...raw,
    bgColor: raw.bgColor || tokens?.modalPopupBg || defaults.bgColor,
    borderColor: raw.borderColor || tokens?.modalPopupBorder || defaults.borderColor,
    overlayBackdropOpacity:
      raw.overlayBackdropOpacity ??
      tokens?.modalPopupOverlayOpacity ??
      defaults.overlayBackdropOpacity,
    innerButtonsOrder: resolvedOrder,
    innerButtonsConfig: mergedButtons,
    innerElementsOrder: resolvedOrder,
    innerElementsConfig: mergedButtons,
  };
}

export function buildSpatialBlockInlineStyle(
  block?: SpatialBlockConfig<any> | null,
  ignoreTransform = false
): CSSProperties {
  if (!block) return {};
  if (block.hidden || block.visible === false || block.opacity <= 0.005) {
    return { display: 'none' };
  }
  const transforms: string[] = [];
  if (!ignoreTransform) {
    const x = block.offsetX ?? block.x ?? 0;
    const y = block.offsetY ?? block.y ?? 0;
    if (x !== 0 || y !== 0) {
      transforms.push(`translate(${x}px, ${y}px)`);
    }
    if (block.scale && Math.abs(block.scale - 1) > 0.01) {
      transforms.push(`scale(${block.scale})`);
    }
  }

  const clipPath = getGeometricClipPath(block.shape);
  const maskImage = getEdgeFadeMaskCss(block.edgeFadePercent);
  const isPolygon = Boolean(clipPath);

  return {
    order: block.order,
    position: 'relative',
    opacity: block.opacity,
    clipPath,
    WebkitClipPath: clipPath,
    maskImage,
    WebkitMaskImage: maskImage,
    backgroundColor: applyColorWithOpacity(block.bgColor, block.boxBgOpacity),
    color: block.textColor || undefined,
    borderColor:
      isPolygon || block.hideBorder || block.borderWidthPx <= 0
        ? 'transparent'
        : applyColorWithOpacity(block.borderColor, Math.max(0.25, block.boxBgOpacity)),
    borderWidth: isPolygon || block.hideBorder ? 0 : `${block.borderWidthPx ?? 2}px`,
    borderStyle: isPolygon || block.hideBorder ? 'none' : 'solid',
    borderRadius: isPolygon
      ? 0
      : block.shape === 'circle'
      ? '9999px'
      : block.shape === 'square'
      ? '0px'
      : `${block.borderRadiusPx ?? 16}px`,
    padding: block.paddingPx !== undefined ? `${block.paddingPx}px` : undefined,
    width: block.widthPx > 0 ? `${block.widthPx}px` : undefined,
    minHeight: block.heightPx > 0 ? `${block.heightPx}px` : undefined,
    backgroundImage: block.bgImageUrl ? `url(${block.bgImageUrl})` : undefined,
    backgroundSize:
      block.bgImageFit === 'stretch'
        ? '100% 100%'
        : block.bgImageFit === 'contain'
        ? 'contain'
        : 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transform: transforms.length > 0 ? transforms.join(' ') : undefined,
    transformOrigin: 'top left',
    fontFamily: block.fontFamily || undefined,
  };
}

export function buildInnerButtonInlineStyle(
  block?: SpatialBlockConfig<any> | null,
  buttonId?: string
): CSSProperties {
  if (!block || !buttonId) return {};
  const rawButtons = block.innerButtonsConfig as any;
  const btn: SpatialInnerElementConfig | undefined = Array.isArray(rawButtons)
    ? rawButtons.find((b: any) => b?.id === buttonId)
    : rawButtons?.[buttonId];
  if (!btn) return {};
  if (btn.visible === false || (btn.opacity !== undefined && btn.opacity <= 0.005)) {
    return { display: 'none' };
  }
  const clipPath = getGeometricClipPath(btn.shape);
  const maskImage = getEdgeFadeMaskCss(btn.edgeFadePercent);
  const isPolygon = Boolean(clipPath);
  const isCircle = btn.shape === 'circle';
  const isSquare = btn.shape === 'square';
  const dx = btn.x ?? 0;
  const dy = btn.y ?? 0;

  return {
    position: 'relative',
    opacity: btn.opacity !== undefined ? btn.opacity : undefined,
    clipPath,
    WebkitClipPath: clipPath,
    maskImage,
    WebkitMaskImage: maskImage,
    backgroundColor: btn.bgColor ? applyColorWithOpacity(btn.bgColor, btn.bgOpacity ?? 1) : undefined,
    color: btn.textColor || undefined,
    borderColor: isPolygon || btn.hideBorder ? 'transparent' : btn.borderColor || undefined,
    borderWidth:
      isPolygon || btn.hideBorder
        ? 0
        : btn.borderWidthPx !== undefined
        ? `${btn.borderWidthPx}px`
        : undefined,
    borderStyle: isPolygon || btn.hideBorder ? 'none' : btn.borderWidthPx !== undefined ? 'solid' : undefined,
    borderRadius: isPolygon
      ? 0
      : isCircle
      ? '9999px'
      : isSquare
      ? '0px'
      : btn.borderRadiusPx !== undefined
      ? `${btn.borderRadiusPx}px`
      : undefined,
    width: btn.widthPx && btn.widthPx > 0 ? `${btn.widthPx}px` : undefined,
    minHeight: btn.heightPx && btn.heightPx > 0 ? `${btn.heightPx}px` : undefined,
    backgroundImage: (btn as any).customPngUrl ? `url(${(btn as any).customPngUrl})` : undefined,
    backgroundSize:
      (btn as any).customPngFit === 'stretch'
        ? '100% 100%'
        : (btn as any).customPngFit === 'contain'
        ? 'contain'
        : (btn as any).customPngUrl
        ? 'cover'
        : undefined,
    backgroundPosition: (btn as any).customPngUrl ? 'center' : undefined,
    backgroundRepeat: (btn as any).customPngUrl ? 'no-repeat' : undefined,
    transform: dx !== 0 || dy !== 0 ? `translate(${dx}px, ${dy}px)` : undefined,
    fontFamily: btn.fontFamily || block.fontFamily || undefined,
    fontSize: btn.fontSizePx ? `${btn.fontSizePx}px` : undefined,
    fontWeight: (btn as any).fontWeight || undefined,
  };
}

export function getInnerButtonLabel(
  block: SpatialBlockConfig<any> | null | undefined,
  buttonId: string,
  fallbackLabel: string
): string {
  const rawButtons = block?.innerButtonsConfig as any;
  const btn: SpatialInnerElementConfig | undefined = Array.isArray(rawButtons)
    ? rawButtons.find((b: any) => b?.id === buttonId)
    : rawButtons?.[buttonId];
  return btn?.label?.trim() ? btn.label : fallbackLabel;
}

export function buildGeometricElementStyle(params: {
  shape?: string;
  edgeFadePercent?: number;
  hideBorder?: boolean;
  borderRadiusPx?: number;
  bgColor?: string;
  borderColor?: string;
  borderWidthPx?: number;
  customPngUrl?: string;
  opacity?: number;
}): CSSProperties {
  const clipPath = getGeometricClipPath(params.shape);
  const maskImage = getEdgeFadeMaskCss(params.edgeFadePercent);
  const isPolygon = Boolean(clipPath);
  const isCircle = params.shape === 'circle';
  const isSquare = params.shape === 'square';

  return {
    clipPath,
    WebkitClipPath: clipPath,
    maskImage,
    WebkitMaskImage: maskImage,
    borderRadius: isPolygon
      ? 0
      : isCircle
      ? '9999px'
      : isSquare
      ? '0px'
      : `${params.borderRadiusPx ?? 14}px`,
    backgroundColor: params.bgColor || undefined,
    // For polygon shapes, suppress CSS rectangular border so GeometricSvgBorder draws the unbroken polygon stroke
    borderColor:
      isPolygon || params.hideBorder ? 'transparent' : params.borderColor || undefined,
    borderWidth:
      isPolygon || params.hideBorder
        ? 0
        : params.borderWidthPx !== undefined
        ? `${params.borderWidthPx}px`
        : undefined,
    borderStyle: isPolygon || params.hideBorder ? 'none' : 'solid',
    backgroundImage: params.customPngUrl ? `url(${params.customPngUrl})` : undefined,
    backgroundSize: params.customPngUrl ? 'cover' : undefined,
    backgroundPosition: params.customPngUrl ? 'center' : undefined,
    opacity: params.opacity !== undefined ? params.opacity : undefined,
  };
}
