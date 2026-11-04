import {
  AppRole,
  TacticalFowConfig,
  TacticalGridType,
  TacticalLayerData,
  TacticalLayerId,
  TacticalMapConfig,
  TacticalMapToken,
  TacticalPropStamp,
  TacticalTokenSizeMode,
} from '../types/dnd';

export function canAccessTacticalMaps(appRole?: AppRole | string | null): boolean {
  return appRole === 'moderator' || appRole === 'creator' || appRole === 'admin';
}

export function cellKey(col: number, row: number): string {
  return `${Math.max(0, Math.floor(col))},${Math.max(0, Math.floor(row))}`;
}

export const makeCellKey = cellKey;

export function parseCellKey(key: string): { col: number; row: number } {
  const parts = String(key || '').split(',');
  if (parts.length !== 2) return { col: 0, row: 0 };
  const col = Number(parts[0]);
  const row = Number(parts[1]);
  if (!Number.isFinite(col) || !Number.isFinite(row)) return { col: 0, row: 0 };
  return { col: Math.floor(col), row: Math.floor(row) };
}

export function hasCellKey(
  collection: Record<string, boolean> | string[] | undefined | null,
  key: string
): boolean {
  if (!collection) return false;
  if (Array.isArray(collection)) return collection.includes(key);
  return Boolean(collection[key]);
}

export function listCellKeys(
  collection: Record<string, boolean> | string[] | undefined | null
): string[] {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  return Object.keys(collection).filter((k) => Boolean(collection[k]));
}

export function toCellRecord(
  collection: Record<string, boolean> | string[] | undefined | null
): Record<string, boolean> {
  if (!collection) return {};
  if (Array.isArray(collection)) {
    const out: Record<string, boolean> = {};
    for (const k of collection) {
      if (k) out[k] = true;
    }
    return out;
  }
  return { ...collection };
}

export function createDefaultLayerData(
  id: TacticalLayerId,
  bgImageUrl?: string
): TacticalLayerData {
  const layerMeta: Record<TacticalLayerId, { name: string; subtitle: string }> = {
    3: { name: 'Capa 3: Superior', subtitle: 'Techos, Copas' },
    2: { name: 'Capa 2: Central/Suelo', subtitle: 'Piso Principal' },
    1: { name: 'Capa 1: Subsuelo', subtitle: 'Túneles, Sótano' },
    0: { name: 'Capa 0: Fondo', subtitle: 'Mapa base' },
  };
  return {
    id,
    name: layerMeta[id].name,
    subtitle: layerMeta[id].subtitle,
    visible: true,
    locked: false,
    bgImageUrl: id === 0 ? bgImageUrl || '' : undefined,
    bgOpacity: 1,
    paintedCells: {},
    blockedCells: {},
    stairBridgeCells: {},
    voidCells: {},
    props: [],
  };
}

export function createDefaultFowConfig(): TacticalFowConfig {
  return {
    generalEnabled: false,
    blinded: false,
    explorationFogEnabled: true,
    playerVisionEnabled: true,
    playerVisionRangeCells: 8,
    defaultVisionCells: 8,
    ignoreWalls: false,
    revealedCells: {},
    modules: [
      {
        id: 'fow-area-1',
        name: 'Área 1: Cuarto Oscuro',
        color: '#38bdf8',
        cells: {},
        revealed: false,
      },
      {
        id: 'fow-area-2',
        name: 'Área 2: Pasillo Secreto',
        color: '#818cf8',
        cells: {},
        revealed: false,
      },
    ],
  };
}

export function createDefaultTacticalMapConfig(
  paramsOrName?:
    | string
    | {
        id?: string;
        name?: string;
        gridCols?: number;
        gridRows?: number;
        gridType?: TacticalGridType;
        bgImageUrl?: string;
        legacyBlockedCells?: string[];
      }
): TacticalMapConfig {
  const params =
    typeof paramsOrName === 'string' ? { name: paramsOrName } : paramsOrName || {};

  const gridCols = Math.max(4, Math.min(120, Math.round(params.gridCols || 25)));
  const gridRows = Math.max(4, Math.min(120, Math.round(params.gridRows || 25)));
  const gridType: TacticalGridType = params.gridType === 'hex' ? 'hex' : 'square';

  const layer0 = createDefaultLayerData(0, params.bgImageUrl);
  const layer1 = createDefaultLayerData(1);
  const layer2 = createDefaultLayerData(2);
  const layer3 = createDefaultLayerData(3);

  if (Array.isArray(params.legacyBlockedCells) && params.legacyBlockedCells.length > 0) {
    layer2.blockedCells = toCellRecord(params.legacyBlockedCells);
  }

  return {
    id: params.id || `tactical-${Date.now()}`,
    name: params.name || 'Mapa Táctico - Taberna en Duelo',
    gridType,
    gridCols,
    gridRows,
    tokenSizeMode: 'normal_1x1',
    activeLayerId: 2,
    layers: {
      0: layer0,
      1: layer1,
      2: layer2,
      3: layer3,
    },
    fow: createDefaultFowConfig(),
    tokens: [],
    updatedAt: Date.now(),
  };
}

export function resizeTacticalMapGrid(
  config: TacticalMapConfig,
  newCols: number,
  newRows: number
): TacticalMapConfig {
  const gridCols = Math.max(4, Math.min(120, Math.round(newCols || 25)));
  const gridRows = Math.max(4, Math.min(120, Math.round(newRows || 25)));
  const nextTokens = (config.tokens || []).map((t) => {
    const c = Math.max(0, Math.min(gridCols - 1, t.col ?? t.x ?? 0));
    const r = Math.max(0, Math.min(gridRows - 1, t.row ?? t.y ?? 0));
    return {
      ...t,
      col: c,
      row: r,
      x: c,
      y: r,
    };
  });

  return {
    ...config,
    gridCols,
    gridRows,
    tokens: nextTokens,
    updatedAt: Date.now(),
  };
}

export function normalizeTacticalMapConfig(
  raw?: Partial<TacticalMapConfig> | null,
  fallback?: {
    name?: string;
    gridCols?: number;
    gridRows?: number;
    gridType?: string;
    bgImageUrl?: string;
    legacyBlockedCells?: string[];
  }
): TacticalMapConfig {
  const base = createDefaultTacticalMapConfig({
    name: raw?.name || fallback?.name,
    gridCols: raw?.gridCols ?? fallback?.gridCols ?? 25,
    gridRows: raw?.gridRows ?? fallback?.gridRows ?? 25,
    gridType: raw?.gridType === 'hex' || fallback?.gridType === 'hex' ? 'hex' : 'square',
    bgImageUrl: fallback?.bgImageUrl,
    legacyBlockedCells: fallback?.legacyBlockedCells,
  });

  if (!raw) return base;

  const layers: Record<TacticalLayerId, TacticalLayerData> = {
    0: {
      ...base.layers[0],
      ...(raw.layers?.[0] || {}),
      id: 0,
      bgImageUrl: raw.layers?.[0]?.bgImageUrl ?? base.layers[0].bgImageUrl,
      paintedCells: { ...(raw.layers?.[0]?.paintedCells || {}) },
      blockedCells: {},
      stairBridgeCells: {},
      voidCells: toCellRecord(raw.layers?.[0]?.voidCells),
      props: [],
    },
    1: {
      ...base.layers[1],
      ...(raw.layers?.[1] || {}),
      id: 1,
      paintedCells: { ...(raw.layers?.[1]?.paintedCells || {}) },
      blockedCells: toCellRecord(raw.layers?.[1]?.blockedCells),
      stairBridgeCells: toCellRecord(raw.layers?.[1]?.stairBridgeCells),
      voidCells: toCellRecord(raw.layers?.[1]?.voidCells),
      props: Array.isArray(raw.layers?.[1]?.props) ? [...raw.layers[1].props] : [],
    },
    2: {
      ...base.layers[2],
      ...(raw.layers?.[2] || {}),
      id: 2,
      paintedCells: { ...(raw.layers?.[2]?.paintedCells || {}) },
      blockedCells: raw.layers?.[2]?.blockedCells
        ? toCellRecord(raw.layers[2].blockedCells)
        : base.layers[2].blockedCells,
      stairBridgeCells: toCellRecord(raw.layers?.[2]?.stairBridgeCells),
      voidCells: toCellRecord(raw.layers?.[2]?.voidCells),
      props: Array.isArray(raw.layers?.[2]?.props) ? [...raw.layers[2].props] : [],
    },
    3: {
      ...base.layers[3],
      ...(raw.layers?.[3] || {}),
      id: 3,
      paintedCells: { ...(raw.layers?.[3]?.paintedCells || {}) },
      blockedCells: toCellRecord(raw.layers?.[3]?.blockedCells),
      stairBridgeCells: toCellRecord(raw.layers?.[3]?.stairBridgeCells),
      voidCells: toCellRecord(raw.layers?.[3]?.voidCells),
      props: Array.isArray(raw.layers?.[3]?.props) ? [...raw.layers[3].props] : [],
    },
  };

  const activeLayerId: TacticalLayerId =
    raw.activeLayerId === 0 ||
    raw.activeLayerId === 1 ||
    raw.activeLayerId === 2 ||
    raw.activeLayerId === 3
      ? raw.activeLayerId
      : 2;

  const isLargeToken =
    raw.tokenSizeMode === 'large' || raw.tokenSizeMode === 'super_2x2';

  return {
    id: raw.id || base.id,
    name: raw.name || base.name,
    gridType: raw.gridType === 'hex' ? 'hex' : 'square',
    gridCols: Math.max(4, Math.min(120, Math.round(raw.gridCols || base.gridCols))),
    gridRows: Math.max(4, Math.min(120, Math.round(raw.gridRows || base.gridRows))),
    tokenSizeMode: isLargeToken ? 'super_2x2' : 'normal_1x1',
    activeLayerId,
    layers,
    fow: {
      ...base.fow,
      ...(raw.fow || {}),
      playerVisionRangeCells:
        raw.fow?.playerVisionRangeCells ?? raw.fow?.defaultVisionCells ?? 8,
      defaultVisionCells:
        raw.fow?.defaultVisionCells ?? raw.fow?.playerVisionRangeCells ?? 8,
      revealedCells: toCellRecord(raw.fow?.revealedCells),
      modules: Array.isArray(raw.fow?.modules)
        ? raw.fow.modules.map((m) => ({
            id: m.id,
            name: m.name,
            color: m.color || '#38bdf8',
            cells: toCellRecord(m.cells),
            revealed: Boolean(m.revealed),
          }))
        : base.fow.modules,
    },
    tokens: Array.isArray(raw.tokens)
      ? raw.tokens.map((t) => ({
          ...t,
          col: t.col ?? t.x ?? 0,
          row: t.row ?? t.y ?? 0,
          x: t.x ?? t.col ?? 0,
          y: t.y ?? t.row ?? 0,
          layerId: t.layerId ?? 2,
          tokenType: t.tokenType || (t.kind === 'player' ? 'player' : 'enemy'),
          kind: t.kind || (t.tokenType === 'player' ? 'player' : 'enemy'),
          name: t.name || t.label || 'Ficha',
          label: t.label || t.name || 'Ficha',
        }))
      : [],
    updatedAt: raw.updatedAt || Date.now(),
  };
}

export function isLargeTokenMode(mode?: TacticalTokenSizeMode | null): boolean {
  return mode === 'large' || mode === 'super_2x2';
}

export function resolveTokenFootprintCells(
  col: number,
  row: number,
  sizeMode: TacticalTokenSizeMode,
  gridCols: number,
  gridRows: number
): string[] {
  const c0 = Math.max(0, Math.min(gridCols - 1, Math.floor(col)));
  const r0 = Math.max(0, Math.min(gridRows - 1, Math.floor(row)));
  if (!isLargeTokenMode(sizeMode)) {
    return [cellKey(c0, r0)];
  }
  const cells: string[] = [];
  for (let dc = 0; dc < 2; dc++) {
    for (let dr = 0; dr < 2; dr++) {
      const c = c0 + dc;
      const r = r0 + dr;
      if (c < gridCols && r < gridRows) {
        cells.push(cellKey(c, r));
      }
    }
  }
  return cells;
}

export function getTokenOccupiedCells(
  token: TacticalMapToken,
  globalTokenSizeMode?: TacticalTokenSizeMode
): Array<{ col: number; row: number }> {
  const c0 = token.col ?? token.x ?? 0;
  const r0 = token.row ?? token.y ?? 0;
  const isPlayer = token.tokenType === 'player' || token.kind === 'player';
  const effectiveMode = isPlayer
    ? token.sizeMode || globalTokenSizeMode || 'normal_1x1'
    : 'normal_1x1';

  if (!isLargeTokenMode(effectiveMode)) {
    return [{ col: c0, row: r0 }];
  }
  return [
    { col: c0, row: r0 },
    { col: c0 + 1, row: r0 },
    { col: c0, row: r0 + 1 },
    { col: c0 + 1, row: r0 + 1 },
  ];
}

export function isCellVoidOnAnyLayer(config: TacticalMapConfig, key: string): boolean {
  return (
    hasCellKey(config.layers[0]?.voidCells, key) ||
    hasCellKey(config.layers[1]?.voidCells, key) ||
    hasCellKey(config.layers[2]?.voidCells, key) ||
    hasCellKey(config.layers[3]?.voidCells, key)
  );
}

export function isCellBlockedOnLayer(
  config: TacticalMapConfig,
  layerId: 1 | 2 | 3,
  key: string
): boolean {
  if (isCellVoidOnAnyLayer(config, key)) return true;
  const layer = config.layers[layerId];
  return hasCellKey(layer?.blockedCells, key);
}

export function isCellStairBridge(config: TacticalMapConfig, key: string): boolean {
  return (
    hasCellKey(config.layers[1]?.stairBridgeCells, key) ||
    hasCellKey(config.layers[2]?.stairBridgeCells, key) ||
    hasCellKey(config.layers[3]?.stairBridgeCells, key)
  );
}

export function getAccessibleLayersAtCell(
  config: TacticalMapConfig,
  key: string
): Array<1 | 2 | 3> {
  if (isCellVoidOnAnyLayer(config, key)) return [];
  const playableLayers: Array<1 | 2 | 3> = [1, 2, 3];
  return playableLayers.filter((lid) => {
    const layer = config.layers[lid];
    if (!layer || !layer.visible) return false;
    const isLayerConfigured =
      listCellKeys(layer.blockedCells).length > 0 ||
      listCellKeys(layer.stairBridgeCells).length > 0 ||
      (layer.props || []).length > 0 ||
      Object.keys(layer.paintedCells || {}).length > 0;
    if (!isLayerConfigured && lid !== config.activeLayerId) return false;
    return !hasCellKey(layer.blockedCells, key);
  });
}

export interface TacticalMoveEvaluation {
  allowed: boolean;
  reason?: string;
  nextCol: number;
  nextRow: number;
  nextLayerId: 1 | 2 | 3;
  newLayerId: 1 | 2 | 3;
  inStairBridge: boolean;
  transitionedLayer: boolean;
  updatedTokens: TacticalMapToken[];
}

export function evaluateTacticalTokenMove(params: {
  config: TacticalMapConfig;
  tokens?: TacticalMapToken[];
  token?: TacticalMapToken;
  tokenId?: string;
  targetCol: number;
  targetRow: number;
  actorMode?: 'dm' | 'player';
  actorRole?: 'dm' | 'player';
  actorCharacterId?: string;
}): TacticalMoveEvaluation {
  const { config, targetCol, targetRow, actorCharacterId } = params;
  const allTokens = params.tokens || config.tokens || [];
  const actorMode = params.actorMode || params.actorRole || 'dm';
  const token =
    params.token || allTokens.find((t) => t.id === params.tokenId) || null;

  if (!token) {
    return {
      allowed: false,
      reason: 'Ficha no encontrada en el mapa táctico.',
      nextCol: 0,
      nextRow: 0,
      nextLayerId: 2,
      newLayerId: 2,
      inStairBridge: false,
      transitionedLayer: false,
      updatedTokens: allTokens,
    };
  }

  const tokenId = token.id;
  const currentCol = token.col ?? token.x ?? 0;
  const currentRow = token.row ?? token.y ?? 0;
  const currentLayerId: 1 | 2 | 3 =
    token.layerId === 1 || token.layerId === 2 || token.layerId === 3
      ? token.layerId
      : 2;
  const clampedCol = Math.max(0, Math.min(config.gridCols - 1, Math.floor(targetCol)));
  const clampedRow = Math.max(0, Math.min(config.gridRows - 1, Math.floor(targetRow)));

  const isPlayerToken = token.kind === 'player' || token.tokenType === 'player';
  const effectiveSizeMode: TacticalTokenSizeMode = isPlayerToken
    ? token.sizeMode || config.tokenSizeMode || 'normal_1x1'
    : 'normal_1x1';

  if (
    isLargeTokenMode(effectiveSizeMode) &&
    (clampedCol + 1 >= config.gridCols || clampedRow + 1 >= config.gridRows) &&
    actorMode === 'player'
  ) {
    return {
      allowed: false,
      reason: 'La Superficha (2x2) rebasa el borde de la cuadrícula.',
      nextCol: currentCol,
      nextRow: currentRow,
      nextLayerId: currentLayerId,
      newLayerId: currentLayerId,
      inStairBridge: Boolean(token.inStairBridge),
      transitionedLayer: false,
      updatedTokens: allTokens,
    };
  }

  const targetFootprint = resolveTokenFootprintCells(
    clampedCol,
    clampedRow,
    effectiveSizeMode,
    config.gridCols,
    config.gridRows
  );
  const targetPrimaryKey = cellKey(clampedCol, clampedRow);
  const originPrimaryKey = cellKey(currentCol, currentRow);

  // DM Override: Dungeon Master can move any token anywhere without restrictions
  if (actorMode === 'dm') {
    let dmNextLayer: 1 | 2 | 3 = currentLayerId;
    if (isCellBlockedOnLayer(config, currentLayerId, targetPrimaryKey)) {
      const accessibleAtTarget = getAccessibleLayersAtCell(config, targetPrimaryKey);
      if (accessibleAtTarget.length > 0) {
        dmNextLayer = accessibleAtTarget[0];
      } else if (
        config.activeLayerId === 1 ||
        config.activeLayerId === 2 ||
        config.activeLayerId === 3
      ) {
        dmNextLayer = config.activeLayerId;
      }
    }
    const nextInBridge = isCellStairBridge(config, targetPrimaryKey);
    const updatedTokens = allTokens.map((t) =>
      t.id === tokenId
        ? {
            ...t,
            x: clampedCol,
            y: clampedRow,
            col: clampedCol,
            row: clampedRow,
            layerId: dmNextLayer,
            inStairBridge: nextInBridge,
          }
        : t
    );
    return {
      allowed: true,
      nextCol: clampedCol,
      nextRow: clampedRow,
      nextLayerId: dmNextLayer,
      newLayerId: dmNextLayer,
      inStairBridge: nextInBridge,
      transitionedLayer: dmNextLayer !== currentLayerId,
      updatedTokens,
    };
  }

  // Player Mode Validation:
  // 1. Player can strictly only move their own character token
  const isOwnPlayerToken = isTokenOwnedByPlayer(token, actorCharacterId);

  if (!isOwnPlayerToken) {
    return {
      allowed: false,
      reason: 'Solo puedes mover tu propia ficha de personaje.',
      nextCol: currentCol,
      nextRow: currentRow,
      nextLayerId: currentLayerId,
      newLayerId: currentLayerId,
      inStairBridge: Boolean(token.inStairBridge),
      transitionedLayer: false,
      updatedTokens: allTokens,
    };
  }

  // 2. Void / Black invisible silhouette check
  if (targetFootprint.some((k) => isCellVoidOnAnyLayer(config, k))) {
    return {
      allowed: false,
      reason: 'Esa zona está fuera del perímetro accesible del mapa.',
      nextCol: currentCol,
      nextRow: currentRow,
      nextLayerId: currentLayerId,
      newLayerId: currentLayerId,
      inStairBridge: Boolean(token.inStairBridge),
      transitionedLayer: false,
      updatedTokens: allTokens,
    };
  }

  // 3. Player-to-Player collision check (cannot occupy same cell as another player token)
  const otherPlayerCells = new Set<string>();
  for (const other of allTokens) {
    const otherIsPlayer = other.kind === 'player' || other.tokenType === 'player';
    if (other.id === token.id || !otherIsPlayer) continue;
    const oc = other.col ?? other.x ?? 0;
    const or = other.row ?? other.y ?? 0;
    const oSize: TacticalTokenSizeMode =
      other.sizeMode || config.tokenSizeMode || 'normal_1x1';
    for (const cKey of resolveTokenFootprintCells(
      oc,
      or,
      oSize,
      config.gridCols,
      config.gridRows
    )) {
      otherPlayerCells.add(cKey);
    }
  }

  if (targetFootprint.some((k) => otherPlayerCells.has(k))) {
    return {
      allowed: false,
      reason: 'No puedes colocar tu ficha sobre la cuadrícula de otro jugador.',
      nextCol: currentCol,
      nextRow: currentRow,
      nextLayerId: currentLayerId,
      newLayerId: currentLayerId,
      inStairBridge: Boolean(token.inStairBridge),
      transitionedLayer: false,
      updatedTokens: allTokens,
    };
  }

  // 4. Multi-Layer Walkability & Stair/Bridge Transition Logic
  const originIsBridge =
    Boolean(token.inStairBridge) || isCellStairBridge(config, originPrimaryKey);
  const targetIsBridge = isCellStairBridge(config, targetPrimaryKey);

  const accessibleOnCurrentLayer = targetFootprint.every(
    (k) => !isCellBlockedOnLayer(config, currentLayerId, k)
  );

  let resolvedLayerId: 1 | 2 | 3 | null = accessibleOnCurrentLayer
    ? currentLayerId
    : null;

  if (!resolvedLayerId || originIsBridge || targetIsBridge) {
    const candidateLayers: Array<1 | 2 | 3> = [1, 2, 3];
    for (const candidateLayer of candidateLayers) {
      if (candidateLayer === currentLayerId) continue;
      const candLayerData = config.layers[candidateLayer];
      if (!candLayerData?.visible) continue;
      const isCandidateConfigured =
        listCellKeys(candLayerData.blockedCells).length > 0 ||
        listCellKeys(candLayerData.stairBridgeCells).length > 0 ||
        (candLayerData.props || []).length > 0 ||
        Object.keys(candLayerData.paintedCells || {}).length > 0;
      if (!isCandidateConfigured && !originIsBridge && !targetIsBridge) continue;

      const targetWalkableOnCandidate = targetFootprint.every(
        (k) => !isCellBlockedOnLayer(config, candidateLayer, k)
      );
      if (!targetWalkableOnCandidate) continue;

      const originAlsoAccessibleOnCandidate = !isCellBlockedOnLayer(
        config,
        candidateLayer,
        originPrimaryKey
      );

      if (originIsBridge || targetIsBridge || originAlsoAccessibleOnCandidate) {
        if (!accessibleOnCurrentLayer) {
          resolvedLayerId = candidateLayer;
          break;
        }
      }
    }
  }

  if (!resolvedLayerId) {
    return {
      allowed: false,
      reason: `Zona inaccesible en ${
        config.layers[currentLayerId]?.name || `Capa ${currentLayerId}`
      }. Usa una escalera o acceso válido.`,
      nextCol: currentCol,
      nextRow: currentRow,
      nextLayerId: currentLayerId,
      newLayerId: currentLayerId,
      inStairBridge: Boolean(token.inStairBridge),
      transitionedLayer: false,
      updatedTokens: allTokens,
    };
  }

  const nextInStairBridge =
    targetIsBridge ||
    getAccessibleLayersAtCell(config, targetPrimaryKey).length > 1;

  const updatedTokens = allTokens.map((t) =>
    t.id === tokenId
      ? {
          ...t,
          x: clampedCol,
          y: clampedRow,
          col: clampedCol,
          row: clampedRow,
          layerId: resolvedLayerId!,
          inStairBridge: nextInStairBridge,
        }
      : t
  );

  return {
    allowed: true,
    nextCol: clampedCol,
    nextRow: clampedRow,
    nextLayerId: resolvedLayerId,
    newLayerId: resolvedLayerId,
    inStairBridge: nextInStairBridge,
    transitionedLayer: resolvedLayerId !== currentLayerId,
    updatedTokens,
  };
}

export type CellFogState = 'visible' | 'explored' | 'explored_fog' | 'hidden';

export function computeCellVisibilityForPlayers(
  config: TacticalMapConfig,
  tokensParam?: TacticalMapToken[]
): Record<string, CellFogState> {
  const result: Record<string, CellFogState> = {};
  const tokens = tokensParam || config.tokens || [];

  // Pre-index modular FOW areas
  const moduleCellState = new Map<string, boolean>();
  for (const mod of config.fow.modules || []) {
    for (const cKey of listCellKeys(mod.cells)) {
      const prev = moduleCellState.get(cKey);
      moduleCellState.set(cKey, prev === true ? true : Boolean(mod.revealed));
    }
  }

  const playerTokens = tokens.filter(
    (t) => t.kind === 'player' || t.tokenType === 'player'
  );
  const revealedSet = new Set(listCellKeys(config.fow.revealedCells));
  const baseVision =
    config.fow.playerVisionRangeCells ?? config.fow.defaultVisionCells ?? 8;

  for (let col = 0; col < config.gridCols; col++) {
    for (let row = 0; row < config.gridRows; row++) {
      const k = cellKey(col, row);

      // 1. Check Modular FOW first
      if (moduleCellState.has(k)) {
        result[k] = moduleCellState.get(k) ? 'visible' : 'hidden';
        continue;
      }

      // 2. Check General FOW
      if (!config.fow.generalEnabled) {
        result[k] = 'visible';
        continue;
      }

      if (config.fow.blinded) {
        result[k] = 'hidden';
        continue;
      }

      let inPlayerVision = false;
      if (config.fow.playerVisionEnabled !== false) {
        for (const pt of playerTokens) {
          const pc = pt.col ?? pt.x ?? 0;
          const pr = pt.row ?? pt.y ?? 0;
          const range = Math.max(1, baseVision + (pt.visionBonusCells || 0));
          const dist = Math.hypot(col - pc, row - pr);
          if (dist <= range + 0.35) {
            inPlayerVision = true;
            break;
          }
        }
      }

      if (inPlayerVision) {
        result[k] = 'visible';
      } else if (config.fow.explorationFogEnabled && revealedSet.has(k)) {
        result[k] = 'explored';
      } else {
        result[k] = 'hidden';
      }
    }
  }

  return result;
}

export function isTokenOwnedByPlayer(
  token: TacticalMapToken | null | undefined,
  characterId?: string | null
): boolean {
  if (!token || !characterId) return false;
  const isPlayer = token.kind === 'player' || token.tokenType === 'player';
  if (!isPlayer) return false;
  return (
    token.characterId === characterId ||
    token.linkedId === characterId ||
    token.id === characterId ||
    token.id === `token-player-${characterId}` ||
    token.id === `tok-player-${characterId}`
  );
}

export function modifyTacticalTokenLive(params: {
  config: TacticalMapConfig;
  tokenId: string;
  patch: Partial<TacticalMapToken>;
  actorMode: 'dm' | 'player';
  actorCharacterId?: string;
}): {
  allowed: boolean;
  reason?: string;
  config: TacticalMapConfig;
  updatedConfig: TacticalMapConfig;
  updatedToken: TacticalMapToken | null;
} {
  const { config, tokenId, patch, actorMode } = params;
  if (actorMode !== 'dm') {
    return {
      allowed: false,
      reason:
        'Solo el Dungeon Master puede modificar la ficha de un jugador o monstruo. Como jugador solo puedes mover tu propia ficha.',
      config,
      updatedConfig: config,
      updatedToken: null,
    };
  }

  const existing = (config.tokens || []).find((t) => t.id === tokenId);
  if (!existing) {
    return {
      allowed: false,
      reason: 'Ficha no encontrada en el mapa.',
      config,
      updatedConfig: config,
      updatedToken: null,
    };
  }

  const nextCol =
    patch.col !== undefined
      ? Math.max(0, Math.min(config.gridCols - 1, Math.round(patch.col)))
      : existing.col ?? existing.x ?? 0;
  const nextRow =
    patch.row !== undefined
      ? Math.max(0, Math.min(config.gridRows - 1, Math.round(patch.row)))
      : existing.row ?? existing.y ?? 0;

  const nextName =
    patch.name !== undefined
      ? patch.name
      : patch.label !== undefined
      ? patch.label
      : existing.name || existing.label || 'Ficha';

  const nextHpCurrent =
    patch.hpCurrent !== undefined
      ? Math.max(0, Math.round(patch.hpCurrent))
      : patch.hp !== undefined
      ? Math.max(0, Math.round(patch.hp))
      : existing.hpCurrent ?? existing.hp;

  const nextHpMax =
    patch.hpMax !== undefined
      ? Math.max(1, Math.round(patch.hpMax))
      : patch.maxHp !== undefined
      ? Math.max(1, Math.round(patch.maxHp))
      : existing.hpMax ?? existing.maxHp;

  const updatedToken: TacticalMapToken = {
    ...existing,
    ...patch,
    name: nextName,
    label: nextName,
    col: nextCol,
    row: nextRow,
    x: nextCol,
    y: nextRow,
    hpCurrent: nextHpCurrent,
    hp: nextHpCurrent,
    hpMax: nextHpMax,
    maxHp: nextHpMax,
  };

  const updatedConfig: TacticalMapConfig = {
    ...config,
    tokens: (config.tokens || []).map((t) => (t.id === tokenId ? updatedToken : t)),
    updatedAt: Date.now(),
  };

  return {
    allowed: true,
    config: updatedConfig,
    updatedConfig,
    updatedToken,
  };
}

export function addPropStampToLayer(
  config: TacticalMapConfig,
  layerId: 1 | 2 | 3,
  stamp: Omit<TacticalPropStamp, 'id' | 'layerId'> & { id?: string }
): TacticalMapConfig {
  const layer = config.layers[layerId];
  if (!layer || layer.locked) return config;

  const newProp: TacticalPropStamp = {
    id: stamp.id || `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: stamp.name || stamp.label || 'Prop',
    label: stamp.label || stamp.name || 'Prop',
    imageUrl: stamp.imageUrl,
    layerId,
    col: Math.max(0, Math.min(config.gridCols - 1, Math.floor(stamp.col))),
    row: Math.max(0, Math.min(config.gridRows - 1, Math.floor(stamp.row))),
    spanCols: Math.max(1, Math.min(20, Math.round(stamp.spanCols || 1))),
    spanRows: Math.max(1, Math.min(20, Math.round(stamp.spanRows || 1))),
    rotationDeg: stamp.rotationDeg ?? stamp.rotation ?? 0,
    rotation: stamp.rotation ?? stamp.rotationDeg ?? 0,
    opacity: stamp.opacity ?? 1,
    intangible: stamp.intangible ?? false,
  };

  return {
    ...config,
    layers: {
      ...config.layers,
      [layerId]: {
        ...layer,
        props: [...layer.props, newProp],
      },
    },
  };
}

