import React, { useState } from 'react';
import {
  TacticalMapConfig,
  TacticalLayerId,
  TacticalMapToken,
  Character5e,
  MonsterRecord,
  LocationRecord,
} from '../../types/dnd';
import {
  createDefaultTacticalMapConfig,
  normalizeTacticalMapConfig,
  toCellRecord,
  makeCellKey,
  parseCellKey,
  resizeTacticalMapGrid,
} from '../../utils/tacticalMapEngine';
import { TacticalMapCanvas, TacticalStudioTool } from './TacticalMapCanvas';
import {
  Save,
  Download,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Grid,
  Hexagon,
  Paintbrush,
  PaintBucket,
  Eraser,
  ShieldAlert,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Radio,
  Users,
  Skull,
  Hand,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Footprints,
} from 'lucide-react';

interface PresetPropItem {
  id: string;
  label: string;
  category: 'tavern' | 'dungeon' | 'nature';
  defaultSpanCols: number;
  defaultSpanRows: number;
  imageUrl: string;
}

const makeSvgDataUri = (svgContent: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;

const PRESET_TACTICAL_PROPS: PresetPropItem[] = [
  {
    id: 'prop-wooden-table',
    label: 'Mesa de Taberna',
    category: 'tavern',
    defaultSpanCols: 2,
    defaultSpanRows: 1,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect x="6" y="8" width="108" height="44" rx="6" fill="#78350f" stroke="#451a03" stroke-width="4"/><line x1="12" y1="22" x2="108" y2="22" stroke="#92400e" stroke-width="2"/><line x1="12" y1="38" x2="108" y2="38" stroke="#92400e" stroke-width="2"/></svg>`
    ),
  },
  {
    id: 'prop-round-table',
    label: 'Mesa Redonda',
    category: 'tavern',
    defaultSpanCols: 2,
    defaultSpanRows: 2,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="12" r="8" fill="#57534e"/><circle cx="50" cy="88" r="8" fill="#57534e"/><circle cx="12" cy="50" r="8" fill="#57534e"/><circle cx="88" cy="50" r="8" fill="#57534e"/><circle cx="50" cy="50" r="34" fill="#92400e" stroke="#451a03" stroke-width="5"/><circle cx="50" cy="50" r="22" fill="none" stroke="#b45309" stroke-width="2"/></svg>`
    ),
  },
  {
    id: 'prop-stairs-wood',
    label: 'Escalera de Piso',
    category: 'dungeon',
    defaultSpanCols: 2,
    defaultSpanRows: 2,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="8" width="80" height="84" rx="4" fill="#57534e" stroke="#1c1917" stroke-width="4"/><line x1="14" y1="24" x2="86" y2="24" stroke="#a8a29e" stroke-width="4"/><line x1="14" y1="40" x2="86" y2="40" stroke="#a8a29e" stroke-width="4"/><line x1="14" y1="56" x2="86" y2="56" stroke="#a8a29e" stroke-width="4"/><line x1="14" y1="72" x2="86" y2="72" stroke="#a8a29e" stroke-width="4"/></svg>`
    ),
  },
  {
    id: 'prop-barrels',
    label: 'Barriles y Cajas',
    category: 'tavern',
    defaultSpanCols: 1,
    defaultSpanRows: 1,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="30" cy="32" r="20" fill="#713f12" stroke="#3f2305" stroke-width="4"/><circle cx="54" cy="52" r="18" fill="#854d0e" stroke="#3f2305" stroke-width="4"/></svg>`
    ),
  },
  {
    id: 'prop-chest-gold',
    label: 'Cofre del Tesoro',
    category: 'dungeon',
    defaultSpanCols: 1,
    defaultSpanRows: 1,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="14" y="22" width="52" height="36" rx="4" fill="#854d0e" stroke="#fef08a" stroke-width="4"/><rect x="34" y="34" width="12" height="12" rx="2" fill="#facc15"/></svg>`
    ),
  },
  {
    id: 'prop-tree-oak',
    label: 'Árbol Frondoso',
    category: 'nature',
    defaultSpanCols: 2,
    defaultSpanRows: 2,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="#166534" stroke="#052e16" stroke-width="4"/><circle cx="38" cy="40" r="22" fill="#15803d"/><circle cx="62" cy="44" r="20" fill="#15803d"/><circle cx="48" cy="62" r="22" fill="#14532d"/></svg>`
    ),
  },
  {
    id: 'prop-pine-tree',
    label: 'Pino de Bosque',
    category: 'nature',
    defaultSpanCols: 1,
    defaultSpanRows: 1,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><polygon points="40,8 70,66 10,66" fill="#065f46" stroke="#022c22" stroke-width="4"/><polygon points="40,18 62,56 18,56" fill="#047857"/></svg>`
    ),
  },
  {
    id: 'prop-boulder',
    label: 'Roca / Peñasco',
    category: 'nature',
    defaultSpanCols: 1,
    defaultSpanRows: 1,
    imageUrl: makeSvgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><polygon points="20,16 58,12 70,44 54,68 16,62 10,36" fill="#57534e" stroke="#292524" stroke-width="4"/><polygon points="26,22 52,20 60,42 46,56 22,52" fill="#78716c"/></svg>`
    ),
  },
];

const TERRAIN_COLOR_SWATCHES = [
  { label: 'Pasto Claro', color: '#3f6212' },
  { label: 'Bosque Oscuro', color: '#14532d' },
  { label: 'Camino Tierra', color: '#78350f' },
  { label: 'Madera Piso', color: '#9a3412' },
  { label: 'Piedra Mazmorra', color: '#44403c' },
  { label: 'Losa Gris', color: '#52525b' },
  { label: 'Agua Profunda', color: '#1d4ed8' },
  { label: 'Lava / Fuego', color: '#dc2626' },
  { label: 'Arena Desierto', color: '#ca8a04' },
];

export interface TacticalMapStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: TacticalMapConfig | null;
  savedTacticalLocations: LocationRecord[];
  partyCharacters: Character5e[];
  monsters: MonsterRecord[];
  onSaveTacticalMap: (config: TacticalMapConfig, existingLocationId?: string) => void;
  onProjectLiveToPlayers: (config: TacticalMapConfig) => void;
}

export const TacticalMapStudioModal: React.FC<TacticalMapStudioModalProps> = ({
  isOpen,
  onClose,
  initialConfig,
  savedTacticalLocations,
  partyCharacters,
  monsters,
  onSaveTacticalMap,
  onProjectLiveToPlayers,
}) => {
  const [config, setConfig] = useState<TacticalMapConfig>(() =>
    initialConfig ? normalizeTacticalMapConfig(initialConfig) : createDefaultTacticalMapConfig()
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [historyPast, setHistoryPast] = useState<TacticalMapConfig[]>([]);
  const [historyFuture, setHistoryFuture] = useState<TacticalMapConfig[]>([]);

  const [activeLayerId, setActiveLayerId] = useState<TacticalLayerId>(2);
  const [studioTool, setStudioTool] = useState<TacticalStudioTool>('select');
  const [activeBrushColor, setActiveBrushColor] = useState<string>('#3f6212');
  const [customColsInput, setCustomColsInput] = useState<number>(config.gridCols);
  const [customRowsInput, setCustomRowsInput] = useState<number>(config.gridRows);

  // Prop placement state
  const [customProps, setCustomProps] = useState<PresetPropItem[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>(PRESET_TACTICAL_PROPS[0].id);
  const [propSpanCols, setPropSpanCols] = useState<number>(2);
  const [propSpanRows, setPropSpanRows] = useState<number>(1);

  // FOW Modular state
  const [activeFowModuleId, setActiveFowModuleId] = useState<string | null>(
    config.fow.modules[0]?.id || null
  );
  const [newFowAreaName, setNewFowAreaName] = useState<string>('');

  // Collapsible floating drawers state
  const [isFloatingLayersOpen, setIsFloatingLayersOpen] = useState<boolean>(true);
  const [isPropsDrawerOpen, setIsPropsDrawerOpen] = useState<boolean>(true);
  const [isColorDrawerOpen, setIsColorDrawerOpen] = useState<boolean>(true);
  const [isWalkabilityDrawerOpen, setIsWalkabilityDrawerOpen] = useState<boolean>(true);
  const [isFowGeneralOpen, setIsFowGeneralOpen] = useState<boolean>(true);
  const [isFowModularOpen, setIsFowModularOpen] = useState<boolean>(true);
  const [isTokenStagingOpen, setIsTokenStagingOpen] = useState<boolean>(true);

  // Preview mode (simulates player vision & walkability before projecting live)
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const pushConfigUpdate = (updater: (prev: TacticalMapConfig) => TacticalMapConfig) => {
    setConfig((prev) => {
      const next = updater(structuredClone(prev));
      setHistoryPast((h) => [...h.slice(-15), prev]);
      setHistoryFuture([]);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((h) => h.slice(0, -1));
    setHistoryFuture((f) => [config, ...f]);
    setConfig(previous);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((f) => f.slice(1));
    setHistoryPast((h) => [...h, config]);
    setConfig(next);
  };

  const allProps = [...PRESET_TACTICAL_PROPS, ...customProps];
  const currentSelectedProp = allProps.find((p) => p.id === selectedPropId) || allProps[0];

  // Flood fill helper for paint bucket tool
  const floodFillLayerColor = (
    layerId: TacticalLayerId,
    startCol: number,
    startRow: number,
    fillColor: string
  ) => {
    pushConfigUpdate((draft) => {
      const layer = draft.layers[layerId];
      if (!layer || layer.locked) return draft;
      const startKey = makeCellKey(startCol, startRow);
      const targetColor = layer.paintedCells[startKey] || '';
      if (targetColor === fillColor) return draft;

      const queue: Array<{ col: number; row: number }> = [{ col: startCol, row: startRow }];
      const visited = new Set<string>();
      let steps = 0;
      const maxSteps = 2500;

      while (queue.length > 0 && steps < maxSteps) {
        steps++;
        const curr = queue.shift()!;
        const key = makeCellKey(curr.col, curr.row);
        if (visited.has(key)) continue;
        visited.add(key);

        if (
          curr.col < 0 ||
          curr.col >= draft.gridCols ||
          curr.row < 0 ||
          curr.row >= draft.gridRows
        ) {
          continue;
        }
        const currColor = layer.paintedCells[key] || '';
        if (currColor !== targetColor) continue;

        layer.paintedCells[key] = fillColor;
        queue.push(
          { col: curr.col + 1, row: curr.row },
          { col: curr.col - 1, row: curr.row },
          { col: curr.col, row: curr.row + 1 },
          { col: curr.col, row: curr.row - 1 }
        );
      }
      return draft;
    });
  };

  const handleCellStudioAction = (col: number, row: number, isDrag?: boolean) => {
    const cellKey = makeCellKey(col, row);

    // FOW Modular painting works regardless of active layer
    if (studioTool === 'paint_fow_module' || studioTool === 'erase_fow_module') {
      if (!activeFowModuleId) {
        setStatusBanner('Selecciona o crea un Área de FOW Modular primero.');
        return;
      }
      pushConfigUpdate((draft) => {
        const mod = draft.fow.modules.find((m) => m.id === activeFowModuleId);
        if (!mod) return draft;
        const cellsRec = toCellRecord(mod.cells);
        if (studioTool === 'paint_fow_module') {
          cellsRec[cellKey] = true;
        } else {
          delete cellsRec[cellKey];
        }
        mod.cells = cellsRec;
        return draft;
      });
      return;
    }

    // Layer 0 only allows background image, not props or walkability
    if (activeLayerId === 0) {
      setStatusBanner(
        'La Capa 0 es exclusiva para la imagen de fondo base. Selecciona Capa 1, 2 o 3 para colocar props, pintar o definir bloqueos.'
      );
      return;
    }

    const activeLayer = config.layers[activeLayerId];
    if (activeLayer?.locked) {
      setStatusBanner(`La Capa ${activeLayerId} está bloqueada (candado activo).`);
      return;
    }

    if (studioTool === 'fill_color' && !isDrag) {
      floodFillLayerColor(activeLayerId, col, row, activeBrushColor);
      return;
    }

    pushConfigUpdate((draft) => {
      const layer = draft.layers[activeLayerId];
      if (!layer) return draft;
      const blockedRec = toCellRecord(layer.blockedCells);
      const stairsRec = toCellRecord(layer.stairBridgeCells);
      const voidRec = toCellRecord(layer.voidCells);

      switch (studioTool) {
        case 'paint_color':
          layer.paintedCells[cellKey] = activeBrushColor;
          break;
        case 'erase_color':
          delete layer.paintedCells[cellKey];
          break;
        case 'paint_blocked':
          blockedRec[cellKey] = true;
          delete stairsRec[cellKey];
          break;
        case 'paint_stairs':
          stairsRec[cellKey] = true;
          delete blockedRec[cellKey];
          break;
        case 'paint_void':
          voidRec[cellKey] = true;
          break;
        case 'erase_blocked':
          delete blockedRec[cellKey];
          delete stairsRec[cellKey];
          delete voidRec[cellKey];
          break;
        case 'place_prop':
          if (!isDrag && currentSelectedProp) {
            layer.props = layer.props.filter((p) => !(p.col === col && p.row === row));
            layer.props.push({
              id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: currentSelectedProp.label,
              label: currentSelectedProp.label,
              imageUrl: currentSelectedProp.imageUrl,
              col,
              row,
              spanCols: Math.max(1, propSpanCols),
              spanRows: Math.max(1, propSpanRows),
              opacity: 1,
            });
          }
          break;
        case 'erase_prop':
          layer.props = layer.props.filter(
            (p) =>
              !(
                col >= p.col &&
                col < p.col + p.spanCols &&
                row >= p.row &&
                row < p.row + p.spanRows
              )
          );
          break;
        default:
          break;
      }
      layer.blockedCells = blockedRec;
      layer.stairBridgeCells = stairsRec;
      layer.voidCells = voidRec;
      return draft;
    });
  };

  const handleLayer0BgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      pushConfigUpdate((draft) => {
        draft.layers[0].bgImageUrl = dataUrl;
        return draft;
      });
      setStatusBanner('Imagen de fondo cargada en Capa 0: Fondo.');
    };
    reader.readAsDataURL(file);
  };

  const handleCustomPropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const newProp: PresetPropItem = {
        id: `custom-prop-${Date.now()}`,
        label: file.name.replace(/\.[^.]+$/, '') || 'Prop PNG',
        category: 'tavern',
        defaultSpanCols: propSpanCols,
        defaultSpanRows: propSpanRows,
        imageUrl: dataUrl,
      };
      setCustomProps((prev) => [newProp, ...prev]);
      setSelectedPropId(newProp.id);
      setStudioTool('place_prop');
      setStatusBanner(`PNG "${newProp.label}" listo para colocar (${propSpanCols}x${propSpanRows}).`);
    };
    reader.readAsDataURL(file);
  };

  const handleGridSizePreset = (cols: number, rows: number) => {
    setCustomColsInput(cols);
    setCustomRowsInput(rows);
    pushConfigUpdate((draft) => resizeTacticalMapGrid(draft, cols, rows));
    setStatusBanner(`Cuadrícula ajustada a ${cols}x${rows}.`);
  };

  const handleAddPlayerTokenToMap = (char: Character5e) => {
    pushConfigUpdate((draft) => {
      const existing = draft.tokens.find((t) => t.characterId === char.id);
      if (existing) return draft;
      // Place in first free cell near (1, 1)
      const offset = draft.tokens.length;
      draft.tokens.push({
        id: `tok-player-${char.id}`,
        name: char.name,
        tokenType: 'player',
        characterId: char.id,
        playerSkinId: char.playerSkinId,
        imageUrl: char.avatarUrl,
        col: Math.min(draft.gridCols - 2, 1 + (offset % 5) * 2),
        row: Math.min(draft.gridRows - 2, 1 + Math.floor(offset / 5) * 2),
        layerId: activeLayerId === 0 ? 2 : activeLayerId,
        hpCurrent: char.hpCurrent,
        hpMax: char.hpMax,
        ac: char.ac,
      });
      return draft;
    });
    setStatusBanner(`Ficha de ${char.name} colocada en el mapa.`);
  };

  const handleAddEnemyTokenToMap = (monster: MonsterRecord) => {
    pushConfigUpdate((draft) => {
      const offset = draft.tokens.length;
      draft.tokens.push({
        id: `tok-enemy-${monster.id}-${Date.now().toString().slice(-4)}`,
        name: monster.name,
        tokenType: 'enemy',
        monsterId: monster.id,
        imageUrl: monster.imageUrl,
        col: Math.min(draft.gridCols - 1, Math.floor(draft.gridCols / 2) + (offset % 4)),
        row: Math.min(draft.gridRows - 1, Math.floor(draft.gridRows / 2) + Math.floor(offset / 4)),
        layerId: activeLayerId === 0 ? 2 : activeLayerId,
        hpCurrent: monster.hpMax,
        hpMax: monster.hpMax,
        ac: monster.ac,
      });
      return draft;
    });
    setStatusBanner(`Ficha de enemigo "${monster.name}" añadida al mapa.`);
  };

  const handleCreateFowModule = () => {
    const label =
      newFowAreaName.trim() || `Área ${config.fow.modules.length + 1}: Cuarto Secreto`;
    const newId = `fow-area-${Date.now()}`;
    pushConfigUpdate((draft) => {
      draft.fow.modules.push({
        id: newId,
        name: label,
        revealed: false,
        color: '#38bdf8',
        cells: {},
      });
      return draft;
    });
    setActiveFowModuleId(newId);
    setStudioTool('paint_fow_module');
    setNewFowAreaName('');
    setStatusBanner(`Creada "${label}". Haz clic en las cuadrículas para asignarle celdas.`);
  };

  const handleLoadSavedLocation = (locId: string) => {
    setSelectedLocationId(locId);
    const found = savedTacticalLocations.find((l) => l.id === locId);
    if (found?.tacticalConfig) {
      setConfig(structuredClone(found.tacticalConfig));
      setCustomColsInput(found.tacticalConfig.gridCols);
      setCustomRowsInput(found.tacticalConfig.gridRows);
      setStatusBanner(`Mapa táctico "${found.title}" cargado.`);
    }
  };

  const charactersById = React.useMemo(() => {
    const map: Record<string, Character5e> = {};
    for (const c of partyCharacters) {
      map[c.id] = c;
    }
    return map;
  }, [partyCharacters]);

  const layerOrder: TacticalLayerId[] = [3, 2, 1, 0];

  return (
    <div
      data-testid="tactical-map-studio-modal"
      className="fixed inset-0 z-50 bg-[#0a0c10] text-zinc-100 flex flex-col overflow-hidden select-none"
    >
      {/* TOP BAR (Matches Reference Mockup) */}
      <header className="h-14 px-4 bg-[#11141c] border-b border-zinc-800/90 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-black text-sm">
            M
          </div>
          <input
            type="text"
            data-testid="tactical-map-name-input"
            value={config.name}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, name: e.target.value }))
            }
            className="bg-zinc-900/90 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-sky-500 min-w-[240px]"
            placeholder="Nombre del Mapa Táctico..."
          />

          {savedTacticalLocations.length > 0 && (
            <select
              data-testid="tactical-map-load-select"
              value={selectedLocationId}
              onChange={(e) => handleLoadSavedLocation(e.target.value)}
              className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300"
            >
              <option value="">Cargar mapa guardado...</option>
              {savedTacticalLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.title} ({loc.tacticalConfig?.gridCols || 25}x
                  {loc.tacticalConfig?.gridRows || 25})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="btn-save-tactical-map"
            onClick={() => {
              onSaveTacticalMap(config, selectedLocationId || undefined);
              setStatusBanner(`Mapa "${config.name}" guardado en Mapas Tácticos.`);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>

          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(config, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${config.name.toLowerCase().replace(/\s+/g, '-')}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>

          <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              title="Deshacer"
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-40 text-zinc-300"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              title="Rehacer"
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-40 text-zinc-300"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            data-testid="btn-toggle-tactical-preview"
            onClick={() => setIsPreviewMode((p) => !p)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isPreviewMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {isPreviewMode ? 'Modo Edición' : 'Vista Previa'}
          </button>

          <button
            type="button"
            data-testid="btn-project-tactical-live"
            onClick={() => {
              onProjectLiveToPlayers(config);
              setStatusBanner('¡Mapa Táctico proyectado en vivo para todos los jugadores!');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
          >
            <Radio className="w-3.5 h-3.5" />
            Mostrar en Vivo
          </button>

          <button
            type="button"
            data-testid="btn-close-tactical-studio"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white"
            title="Cerrar estudio de mapas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN STUDIO BODY */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR: Capas, Tipo de Cuadrícula, Tamaño de Cuadrícula & Tamaño de Fichas */}
        <aside className="w-72 bg-[#11141c] border-r border-zinc-800/90 flex flex-col overflow-y-auto p-3.5 space-y-5 shrink-0">
          {/* CAPAS (3 down to 0) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Capas del Mapa (0 a 3)
              </span>
            </div>
            <div className="space-y-1.5">
              {layerOrder.map((lid) => {
                const layer = config.layers[lid];
                const isActive = activeLayerId === lid;
                return (
                  <div
                    key={lid}
                    data-testid={`studio-layer-item-${lid}`}
                    onClick={() => setActiveLayerId(lid)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-sky-950/60 border-sky-500/80 text-white shadow'
                        : 'bg-zinc-900/70 border-zinc-800/90 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold truncate">{layer.name}</div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        ({layer.subtitle})
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        data-testid={`studio-layer-vis-${lid}`}
                        onClick={() =>
                          pushConfigUpdate((draft) => {
                            draft.layers[lid].visible = !draft.layers[lid].visible;
                            return draft;
                          })
                        }
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
                      >
                        {layer.visible ? (
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        data-testid={`studio-layer-lock-${lid}`}
                        onClick={() =>
                          pushConfigUpdate((draft) => {
                            draft.layers[lid].locked = !draft.layers[lid].locked;
                            return draft;
                          })
                        }
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
                      >
                        {layer.locked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1">
              <span>ⓘ Inaccesibilidad y props asociados a la capa activa (1–3).</span>
            </p>

            {/* CAPA 0 BASE IMAGE UPLOADER */}
            <div className="mt-3 p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-2">
              <div className="text-[11px] font-bold text-zinc-200">
                Fondo de Capa 0 (Mapa Base)
              </div>
              <label className="w-full py-1.5 px-2.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Subir Imagen Capa 0</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLayer0BgUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={config.layers[0].bgImageUrl || ''}
                onChange={(e) =>
                  pushConfigUpdate((draft) => {
                    draft.layers[0].bgImageUrl = e.target.value;
                    return draft;
                  })
                }
                placeholder="O pega URL de imagen de fondo..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300"
              />
            </div>
          </div>

          {/* TIPO DE CUADRÍCULA (Strictly Cuadrada and Hexagonal) */}
          <div className="pt-3 border-t border-zinc-800/80">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Tipo de Cuadrícula
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="btn-grid-type-square"
                onClick={() =>
                  pushConfigUpdate((draft) => {
                    draft.gridType = 'square';
                    return draft;
                  })
                }
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                  config.gridType === 'square'
                    ? 'bg-sky-950/70 border-sky-500 text-white shadow'
                    : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Grid className="w-5 h-5 text-sky-400" />
                <span>Cuadrada</span>
              </button>

              <button
                type="button"
                data-testid="btn-grid-type-hex"
                onClick={() =>
                  pushConfigUpdate((draft) => {
                    draft.gridType = 'hex';
                    return draft;
                  })
                }
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                  config.gridType === 'hex'
                    ? 'bg-sky-950/70 border-sky-500 text-white shadow'
                    : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Hexagon className="w-5 h-5 text-sky-400" />
                <span>Hexagonal</span>
              </button>
            </div>
          </div>

          {/* TAMAÑO DE CUADRÍCULA (10x10, 25x25, 100x100, Personalizado) */}
          <div className="pt-3 border-t border-zinc-800/80">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Tamaño de Cuadrícula
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { label: '10x10', cols: 10, rows: 10, sub: 'Pequeño' },
                { label: '25x25', cols: 25, rows: 25, sub: 'Mediano' },
                { label: '100x100', cols: 100, rows: 100, sub: 'Mundi' },
              ].map((preset) => {
                const active =
                  config.gridCols === preset.cols && config.gridRows === preset.rows;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    data-testid={`btn-grid-preset-${preset.label}`}
                    onClick={() => handleGridSizePreset(preset.cols, preset.rows)}
                    className={`py-2 px-1.5 rounded-lg border text-center transition-all ${
                      active
                        ? 'bg-sky-950/80 border-sky-500 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{preset.label}</div>
                    <div className="text-[9px] text-zinc-400">{preset.sub}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                data-testid="input-custom-grid-cols"
                min={5}
                max={120}
                value={customColsInput}
                onChange={(e) => setCustomColsInput(Number(e.target.value))}
                className="w-14 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-center text-white font-bold"
              />
              <span className="text-xs text-zinc-500 font-bold">x</span>
              <input
                type="number"
                data-testid="input-custom-grid-rows"
                min={5}
                max={120}
                value={customRowsInput}
                onChange={(e) => setCustomRowsInput(Number(e.target.value))}
                className="w-14 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-center text-white font-bold"
              />
              <button
                type="button"
                data-testid="btn-apply-custom-grid"
                onClick={() => handleGridSizePreset(customColsInput, customRowsInput)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                Personalizado
              </button>
            </div>
          </div>

          {/* TAMAÑO DE FICHAS DE JUGADOR (Normal 1x1 vs Superfichas 2x2) */}
          <div className="pt-3 border-t border-zinc-800/80">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Escala de Fichas de Jugador
            </div>
            <p className="text-[10px] text-zinc-400 mb-2">
              Usa Superfichas (2x2) en mapas grandes como 100x100 para distinguir mejor a cada jugador.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="btn-token-size-normal"
                onClick={() =>
                  pushConfigUpdate((draft) => {
                    draft.tokenSizeMode = 'normal_1x1';
                    return draft;
                  })
                }
                className={`p-2 rounded-lg border text-xs font-bold ${
                  config.tokenSizeMode === 'normal_1x1'
                    ? 'bg-sky-950/80 border-sky-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                Normal (1x1)
              </button>
              <button
                type="button"
                data-testid="btn-token-size-super"
                onClick={() =>
                  pushConfigUpdate((draft) => {
                    draft.tokenSizeMode = 'super_2x2';
                    return draft;
                  })
                }
                className={`p-2 rounded-lg border text-xs font-bold ${
                  config.tokenSizeMode === 'super_2x2'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                Superficha (2x2)
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER INTERACTIVE CANVAS AREA */}
        <main className="flex-1 relative bg-[#07090d] flex flex-col min-w-0 overflow-hidden">
          {/* Floating Top Canvas Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#141822]/95 border border-zinc-700/80 shadow-2xl">
            {[
              { id: 'select', label: 'Seleccionar / Mover Fichas', icon: MousePointer },
              { id: 'pan', label: 'Mano / Desplazar', icon: Hand },
              { id: 'paint_color', label: 'Pintar Terreno (Brush)', icon: Paintbrush },
              { id: 'fill_color', label: 'Rellenar Área (Bucket)', icon: PaintBucket },
              { id: 'place_prop', label: 'Colocar Stamp / Prop', icon: Sparkles },
              { id: 'paint_blocked', label: 'Pintar Zona Inaccesible (Rojo)', icon: ShieldAlert },
              { id: 'paint_stairs', label: 'Pintar Escalera / Puente de Capa', icon: Footprints },
              { id: 'erase_blocked', label: 'Borrar Bloqueo', icon: Eraser },
            ].map((tool) => {
              const Icon = tool.icon;
              const active = studioTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  data-testid={`studio-toolbar-${tool.id}`}
                  onClick={() => setStudioTool(tool.id as TacticalStudioTool)}
                  title={tool.label}
                  className={`p-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}

            <div className="h-4 w-px bg-zinc-700 mx-1" />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
              title="Alejar Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-zinc-300 px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
              title="Acercar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Map Viewport */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
            <TacticalMapCanvas
              config={config}
              viewerRole={isPreviewMode ? 'player' : 'studio'}
              currentPlayerCharacterId={
                partyCharacters[0]?.id ||
                config.tokens.find((t) => t.tokenType === 'player' || t.kind === 'player')
                  ?.characterId
              }
              charactersById={charactersById}
              activeLayerId={activeLayerId}
              studioTool={studioTool}
              activeBrushColor={activeBrushColor}
              activeFowModuleId={activeFowModuleId}
              selectedPropTemplate={
                currentSelectedProp
                  ? {
                      label: currentSelectedProp.label,
                      imageUrl: currentSelectedProp.imageUrl,
                      spanCols: propSpanCols,
                      spanRows: propSpanRows,
                    }
                  : null
              }
              zoom={zoom}
              onCellStudioAction={handleCellStudioAction}
              onTokenMove={(tokenId, targetCol, targetRow, newLayerId) => {
                pushConfigUpdate((draft) => {
                  const tok = draft.tokens.find((t) => t.id === tokenId);
                  if (tok) {
                    tok.col = targetCol;
                    tok.row = targetRow;
                    tok.layerId = newLayerId;
                  }
                  return draft;
                });
              }}
              onDmModifyToken={(tokenId, patch) => {
                pushConfigUpdate((draft) => {
                  const idx = draft.tokens.findIndex((t) => t.id === tokenId);
                  if (idx >= 0) {
                    draft.tokens[idx] = { ...draft.tokens[idx], ...patch };
                  }
                  return draft;
                });
              }}
              onDmDeleteToken={(tokenId) => {
                pushConfigUpdate((draft) => {
                  draft.tokens = draft.tokens.filter((t) => t.id !== tokenId);
                  return draft;
                });
              }}
              moveFeedback={statusBanner}
              onMoveFeedback={setStatusBanner}
            />
          </div>

          {/* FLOATING COLLAPSIBLE CAPAS DRAWER (Bottom-Left as in Mockup) */}
          <div className="absolute bottom-3 left-3 z-40 w-72 rounded-xl bg-[#131722]/95 border border-zinc-700/80 shadow-2xl overflow-hidden">
            <button
              type="button"
              data-testid="toggle-floating-layers-drawer"
              onClick={() => setIsFloatingLayersOpen((o) => !o)}
              className="w-full px-3 py-2 bg-zinc-900/90 flex items-center justify-between text-xs font-bold text-zinc-200 hover:bg-zinc-800/80"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Capas Rápidas (Activa: Capa {activeLayerId})
              </span>
              {isFloatingLayersOpen ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            {isFloatingLayersOpen && (
              <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                {layerOrder.map((lid) => {
                  const l = config.layers[lid];
                  return (
                    <div
                      key={`float-layer-${lid}`}
                      onClick={() => setActiveLayerId(lid)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer ${
                        activeLayerId === lid
                          ? 'bg-sky-950/80 border-sky-500 text-white font-bold'
                          : 'bg-zinc-900/70 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <span className="truncate">{l.name}</span>
                      <span className="text-[10px] text-zinc-400">
                        {l.visible ? 'Visible' : 'Oculta'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR: Collapsible Drawers for Stamps/Props, Brush/Relleno, Zonas Inaccesibles, Fog of War & Staging */}
        <aside className="w-[390px] bg-[#11141c] border-l border-zinc-800/90 flex flex-col overflow-y-auto p-3 space-y-3 shrink-0">
          {/* 1. STAMPS / PROPS & SUBIR PNGs CON SELECTOR DE CUADRÍCULAS */}
          <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden shrink-0">
            <button
              type="button"
              data-testid="toggle-props-drawer"
              onClick={() => setIsPropsDrawerOpen((o) => !o)}
              className="w-full px-3 py-2.5 bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-100 hover:bg-zinc-800/70"
            >
              <span>Stamps / Props y Recursos PNG</span>
              {isPropsDrawerOpen ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {isPropsDrawerOpen && (
              <div className="p-3 space-y-3">
                {/* Grid Span Selector (Cuántas cuadrículas usa el prop) */}
                <div>
                  <div className="text-[11px] font-semibold text-zinc-300 mb-1.5">
                    Tamaño del Prop en Cuadrículas (Auto-ajuste):
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: '1x1 (1)', c: 1, r: 1 },
                      { label: '2x2 (4)', c: 2, r: 2 },
                      { label: '2x3 (6)', c: 2, r: 3 },
                      { label: '3x3 (9)', c: 3, r: 3 },
                    ].map((sp) => {
                      const active = propSpanCols === sp.c && propSpanRows === sp.r;
                      return (
                        <button
                          key={sp.label}
                          type="button"
                          data-testid={`btn-prop-span-${sp.c}x${sp.r}`}
                          onClick={() => {
                            setPropSpanCols(sp.c);
                            setPropSpanRows(sp.r);
                            setStudioTool('place_prop');
                          }}
                          className={`py-1.5 px-1 rounded border text-[11px] font-bold ${
                            active
                              ? 'bg-sky-600 border-sky-400 text-white'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {sp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gallery of Stamps/Props */}
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                  {allProps.map((prop) => {
                    const isSelected = selectedPropId === prop.id;
                    return (
                      <button
                        key={prop.id}
                        type="button"
                        data-testid={`studio-prop-item-${prop.id}`}
                        onClick={() => {
                          setSelectedPropId(prop.id);
                          setPropSpanCols(prop.defaultSpanCols);
                          setPropSpanRows(prop.defaultSpanRows);
                          setStudioTool('place_prop');
                        }}
                        className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? 'bg-sky-950/80 border-sky-500 ring-1 ring-sky-400'
                            : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <img
                          src={prop.imageUrl}
                          alt={prop.label}
                          className="w-10 h-10 object-contain"
                        />
                        <span className="text-[9px] text-zinc-300 truncate w-full text-center">
                          {prop.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Upload Custom PNG & Erase Prop */}
                <div className="flex items-center gap-2">
                  <label className="flex-1 py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-bold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Subir PNG personalizado (Transparente)</span>
                    <input
                      type="file"
                      accept="image/png,image/webp,image/gif,image/*"
                      onChange={handleCustomPropUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setStudioTool('erase_prop')}
                    className={`p-2 rounded-lg border ${
                      studioTool === 'erase_prop'
                        ? 'bg-red-600/30 border-red-500 text-red-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                    title="Borrar Prop de la cuadrícula"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. HERRAMIENTA DE COLOREAR CUADRÍCULAS (BRUSH / RELLENO) */}
          <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden shrink-0">
            <button
              type="button"
              data-testid="toggle-color-drawer"
              onClick={() => setIsColorDrawerOpen((o) => !o)}
              className="w-full px-3 py-2.5 bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-100 hover:bg-zinc-800/70"
            >
              <span className="flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-emerald-400" />
                Herramienta de colorear cuadrículas (Brush/Relleno)
              </span>
              {isColorDrawerOpen ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {isColorDrawerOpen && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    data-testid="studio-color-wheel-input"
                    value={activeBrushColor}
                    onChange={(e) => {
                      setActiveBrushColor(e.target.value);
                      if (studioTool !== 'fill_color') setStudioTool('paint_color');
                    }}
                    className="w-12 h-12 rounded-full border-2 border-zinc-700 cursor-pointer bg-transparent shrink-0"
                  />
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      data-testid="btn-tool-paint-brush"
                      onClick={() => setStudioTool('paint_color')}
                      className={`py-1.5 px-2 rounded border text-[11px] font-bold ${
                        studioTool === 'paint_color'
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      Brush (1x1)
                    </button>
                    <button
                      type="button"
                      data-testid="btn-tool-paint-fill"
                      onClick={() => setStudioTool('fill_color')}
                      className={`py-1.5 px-2 rounded border text-[11px] font-bold ${
                        studioTool === 'fill_color'
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      Relleno
                    </button>
                    <button
                      type="button"
                      data-testid="btn-tool-erase-color"
                      onClick={() => setStudioTool('erase_color')}
                      className={`py-1.5 px-2 rounded border text-[11px] font-bold ${
                        studioTool === 'erase_color'
                          ? 'bg-red-600 border-red-400 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      Borrar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TERRAIN_COLOR_SWATCHES.map((sw) => (
                    <button
                      key={sw.color}
                      type="button"
                      onClick={() => {
                        setActiveBrushColor(sw.color);
                        if (studioTool !== 'fill_color') setStudioTool('paint_color');
                      }}
                      title={sw.label}
                      className={`w-6 h-6 rounded-full border transition-transform ${
                        activeBrushColor === sw.color
                          ? 'scale-110 border-white ring-2 ring-sky-400'
                          : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: sw.color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. ZONAS INACCESIBLES (PAREDES / BLOQUEOS, ESCALERAS Y SILUETA VOID) */}
          <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden shrink-0">
            <button
              type="button"
              data-testid="toggle-walkability-drawer"
              onClick={() => setIsWalkabilityDrawerOpen((o) => !o)}
              className="w-full px-3 py-2.5 bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-100 hover:bg-zinc-800/70"
            >
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                Zonas Inaccesibles y Puentes de Capa
              </span>
              {isWalkabilityDrawerOpen ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {isWalkabilityDrawerOpen && (
              <div className="p-3 space-y-2">
                <button
                  type="button"
                  data-testid="btn-paint-blocked-red"
                  onClick={() => setStudioTool('paint_blocked')}
                  className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    studioTool === 'paint_blocked'
                      ? 'bg-red-600/30 border-red-500 text-red-200 shadow'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-red-500/50'
                  }`}
                >
                  <span>Pintar Bloqueo (Rojo - Inaccesible en Capa {activeLayerId})</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-paint-stairs-bridge"
                  onClick={() => setStudioTool('paint_stairs')}
                  className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    studioTool === 'paint_stairs'
                      ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 shadow'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-cyan-500/50'
                  }`}
                >
                  <span>Pintar Escalera / Puente entre Capas</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="btn-paint-void-black"
                    onClick={() => setStudioTool('paint_void')}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold ${
                      studioTool === 'paint_void'
                        ? 'bg-zinc-800 border-white text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Cuadrícula Negra (Void)
                  </button>

                  <button
                    type="button"
                    data-testid="btn-erase-blocked"
                    onClick={() => setStudioTool('erase_blocked')}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold ${
                      studioTool === 'erase_blocked'
                        ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    Borrar Bloqueo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. FOG OF WAR GENERAL & FOW MODULAR POR ÁREAS */}
          <div className="grid grid-cols-1 gap-3 shrink-0">
            {/* FOW General */}
            <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden shrink-0">
              <button
                type="button"
                data-testid="toggle-fow-general-drawer"
                onClick={() => setIsFowGeneralOpen((o) => !o)}
                className="w-full px-3 py-2.5 bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-100"
              >
                <span>Fog of War General (Estático/Dinámico)</span>
                {isFowGeneralOpen ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {isFowGeneralOpen && (
                <div className="p-3 space-y-2.5 text-xs">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-zinc-300 font-semibold">Activar FOW General</span>
                    <input
                      type="checkbox"
                      data-testid="toggle-fow-general-enabled"
                      checked={config.fow.generalEnabled}
                      onChange={(e) =>
                        pushConfigUpdate((draft) => {
                          draft.fow.generalEnabled = e.target.checked;
                          return draft;
                        })
                      }
                      className="accent-sky-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-zinc-300">Cegado (Oscuridad Total)</span>
                    <input
                      type="checkbox"
                      data-testid="toggle-fow-blinded"
                      checked={config.fow.blinded}
                      onChange={(e) =>
                        pushConfigUpdate((draft) => {
                          draft.fow.blinded = e.target.checked;
                          return draft;
                        })
                      }
                      className="accent-sky-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-zinc-300">Niebla de Exploración (Gris)</span>
                    <input
                      type="checkbox"
                      checked={config.fow.explorationFogEnabled}
                      onChange={(e) =>
                        pushConfigUpdate((draft) => {
                          draft.fow.explorationFogEnabled = e.target.checked;
                          return draft;
                        })
                      }
                      className="accent-sky-500 w-4 h-4"
                    />
                  </label>

                  <div className="pt-1 border-t border-zinc-800 flex items-center justify-between gap-2">
                    <span className="text-zinc-300">Visión de Jugadores (casillas):</span>
                    <input
                      type="number"
                      data-testid="input-fow-vision-cells"
                      min={1}
                      max={60}
                      value={config.fow.defaultVisionCells ?? config.fow.playerVisionRangeCells ?? 8}
                      onChange={(e) =>
                        pushConfigUpdate((draft) => {
                          const nextVal = Math.max(1, Number(e.target.value));
                          draft.fow.defaultVisionCells = nextVal;
                          draft.fow.playerVisionRangeCells = nextVal;
                          return draft;
                        })
                      }
                      className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-center font-bold text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* FOW Modular por Áreas */}
            <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden shrink-0">
              <button
                type="button"
                data-testid="toggle-fow-modular-drawer"
                onClick={() => setIsFowModularOpen((o) => !o)}
                className="w-full px-3 py-2.5 bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-100"
              >
                <span>FOW Modular por Áreas (Dungeon Master)</span>
                {isFowModularOpen ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {isFowModularOpen && (
                <div className="p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        pushConfigUpdate((draft) => {
                          draft.fow.modules.forEach((m) => (m.revealed = false));
                          return draft;
                        })
                      }
                      className="py-1.5 px-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200"
                    >
                      Ocultar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pushConfigUpdate((draft) => {
                          draft.fow.modules.forEach((m) => (m.revealed = true));
                          return draft;
                        })
                      }
                      className="py-1.5 px-2 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-500/50 text-xs font-bold text-sky-200"
                    >
                      Revelar Todas
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {config.fow.modules.map((mod) => {
                      const isEditingThis =
                        activeFowModuleId === mod.id && studioTool === 'paint_fow_module';
                      return (
                        <div
                          key={mod.id}
                          data-testid={`fow-module-row-${mod.id}`}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                            isEditingThis
                              ? 'bg-sky-950/60 border-sky-500'
                              : 'bg-zinc-950/80 border-zinc-800'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveFowModuleId(mod.id);
                              setStudioTool('paint_fow_module');
                            }}
                            className="text-left flex-1 truncate font-semibold text-zinc-200 hover:text-sky-300"
                            title="Haz clic para pintar las celdas de esta área"
                          >
                            {mod.name}{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({Object.keys(mod.cells || {}).length} celdas)
                            </span>
                          </button>

                          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold">
                            <span className={mod.revealed ? 'text-emerald-400' : 'text-zinc-500'}>
                              {mod.revealed ? 'Revelado' : 'Oculto'}
                            </span>
                            <input
                              type="checkbox"
                              data-testid={`toggle-fow-module-${mod.id}`}
                              checked={mod.revealed}
                              onChange={(e) =>
                                pushConfigUpdate((draft) => {
                                  const target = draft.fow.modules.find((m) => m.id === mod.id);
                                  if (target) target.revealed = e.target.checked;
                                  return draft;
                                })
                              }
                              className="accent-sky-500 w-3.5 h-3.5"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newFowAreaName}
                      onChange={(e) => setNewFowAreaName(e.target.value)}
                      placeholder="Nombre del área (ej. Área 3: Cripta)..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      data-testid="btn-create-fow-module"
                      onClick={handleCreateFowModule}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                    >
                      + Crear Nueva Área (FOW Modular)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5. PRE-STAGING: COLOCAR FICHAS DE JUGADORES Y ENEMIGOS ANTES DE MOSTRAR EN VIVO */}
          <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden shrink-0">
            <button
              type="button"
              data-testid="toggle-token-staging-drawer"
              onClick={() => setIsTokenStagingOpen((o) => !o)}
              className="w-full px-3 py-2.5 bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-100"
            >
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                Pre-Staging de Fichas ({config.tokens.length} en mapa)
              </span>
              {isTokenStagingOpen ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {isTokenStagingOpen && (
              <div className="p-3 space-y-3 text-xs">
                <div>
                  <div className="text-[11px] font-bold text-amber-300 mb-1.5">
                    Añadir Fichas de Jugadores (con su Skin de Ficha):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {partyCharacters.length > 0 ? (
                      partyCharacters.map((char) => (
                        <button
                          key={char.id}
                          type="button"
                          data-testid={`btn-stage-player-${char.id}`}
                          onClick={() => handleAddPlayerTokenToMap(char)}
                          className="px-2 py-1 rounded bg-zinc-950 hover:bg-amber-950/60 border border-zinc-800 hover:border-amber-500/50 text-[11px] text-zinc-200 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-amber-400" />
                          <span>{char.name}</span>
                        </button>
                      ))
                    ) : (
                      [
                        { id: 'sample-valeros', name: 'Valeros del Alba', hpCurrent: 28, hpMax: 28, ac: 18 },
                        { id: 'sample-lyra', name: 'Lyra Nocturna', hpCurrent: 21, hpMax: 21, ac: 15 },
                        { id: 'sample-tharok', name: 'Tharok Martillo', hpCurrent: 34, hpMax: 34, ac: 17 },
                      ].map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          data-testid={`btn-stage-player-${sample.id}`}
                          onClick={() =>
                            handleAddPlayerTokenToMap({
                              id: sample.id,
                              name: sample.name,
                              hpCurrent: sample.hpCurrent,
                              hpMax: sample.hpMax,
                              ac: sample.ac,
                            } as Character5e)
                          }
                          className="px-2 py-1 rounded bg-zinc-950 hover:bg-amber-950/60 border border-zinc-800 hover:border-amber-500/50 text-[11px] text-zinc-200 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-amber-400" />
                          <span>{sample.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-red-300 mb-1.5 flex items-center gap-1">
                    <Skull className="w-3 h-3 text-red-400" />
                    <span>Añadir Fichas de Enemigos (1x1 Circular):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {monsters.slice(0, 12).map((mon) => (
                      <button
                        key={mon.id}
                        type="button"
                        data-testid={`btn-stage-enemy-${mon.id}`}
                        onClick={() => handleAddEnemyTokenToMap(mon)}
                        className="px-2 py-1 rounded bg-zinc-950 hover:bg-red-950/60 border border-zinc-800 hover:border-red-500/50 text-[11px] text-zinc-200 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-red-400" />
                        <span>{mon.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {config.tokens.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">
                      Arrastra las fichas en el lienzo para su posición inicial.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        pushConfigUpdate((draft) => {
                          draft.tokens = [];
                          return draft;
                        })
                      }
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Limpiar fichas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
