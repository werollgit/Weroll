import React, { useState, useMemo } from 'react';
import {
  TacticalMapConfig,
  TacticalLayerId,
  TacticalMapToken,
  Character5e,
} from '../../types/dnd';
import {
  makeCellKey,
  parseCellKey,
  hasCellKey,
  isTokenOwnedByPlayer,
  evaluateTacticalTokenMove,
  computeCellVisibilityForPlayers,
  getTokenOccupiedCells,
} from '../../utils/tacticalMapEngine';
import { PlayerTacticalTokenRenderer } from '../character/CharacterTarotCard';
import { Shield, Footprints, Layers, Lock, AlertCircle, Sparkles, Heart, Trash2 } from 'lucide-react';

export type TacticalStudioTool =
  | 'select'
  | 'pan'
  | 'paint_color'
  | 'fill_color'
  | 'erase_color'
  | 'paint_blocked'
  | 'erase_blocked'
  | 'paint_stairs'
  | 'paint_void'
  | 'place_prop'
  | 'erase_prop'
  | 'paint_fow_module'
  | 'erase_fow_module';

export interface TacticalMapCanvasProps {
  config: TacticalMapConfig;
  viewerRole: 'dm' | 'player' | 'studio';
  currentPlayerCharacterId?: string;
  charactersById?: Record<string, Character5e>;
  activeLayerId?: TacticalLayerId;
  studioTool?: TacticalStudioTool;
  activeBrushColor?: string;
  activeFowModuleId?: string | null;
  selectedPropTemplate?: {
    label: string;
    imageUrl: string;
    spanCols: number;
    spanRows: number;
  } | null;
  zoom?: number;
  showBlockedOverlay?: boolean;
  onCellStudioAction?: (col: number, row: number, isDrag?: boolean) => void;
  onTokenMove?: (
    tokenId: string,
    targetCol: number,
    targetRow: number,
    newLayerId: TacticalLayerId,
    transitionedLayer: boolean
  ) => void;
  onDmModifyToken?: (tokenId: string, patch: Partial<TacticalMapToken>) => void;
  onDmDeleteToken?: (tokenId: string) => void;
  onSelectToken?: (token: TacticalMapToken | null) => void;
  selectedTokenId?: string | null;
  moveFeedback?: string | null;
  onMoveFeedback?: (msg: string | null) => void;
}

export const TacticalMapCanvas: React.FC<TacticalMapCanvasProps> = ({
  config,
  viewerRole,
  currentPlayerCharacterId,
  charactersById = {},
  activeLayerId = 2,
  studioTool = 'select',
  activeFowModuleId = null,
  selectedPropTemplate = null,
  zoom = 1,
  showBlockedOverlay = true,
  onCellStudioAction,
  onTokenMove,
  onDmModifyToken,
  onDmDeleteToken,
  onSelectToken,
  selectedTokenId: controlledSelectedTokenId,
  moveFeedback: externalFeedback,
  onMoveFeedback,
}) => {
  const [internalSelectedTokenId, setInternalSelectedTokenId] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const selectedTokenId =
    controlledSelectedTokenId !== undefined ? controlledSelectedTokenId : internalSelectedTokenId;

  const setSelectedToken = (tok: TacticalMapToken | null) => {
    if (onSelectToken) onSelectToken(tok);
    else setInternalSelectedTokenId(tok ? tok.id : null);
  };

  const setFeedback = (msg: string | null) => {
    setLocalFeedback(msg);
    if (onMoveFeedback) onMoveFeedback(msg);
  };

  const feedbackMessage = externalFeedback !== undefined ? externalFeedback : localFeedback;

  // Base cell size in px depending on grid dimensions so 10x10, 25x25, and 100x100 all remain usable
  const baseCellPx = useMemo(() => {
    const maxDim = Math.max(config.gridCols, config.gridRows);
    if (maxDim >= 80) return 22;
    if (maxDim >= 40) return 32;
    if (maxDim >= 20) return 42;
    return 56;
  }, [config.gridCols, config.gridRows]);

  const cellPx = Math.max(14, Math.round(baseCellPx * zoom));
  const isHex = config.gridType === 'hex';

  // Compute FOW visibility map
  const visibilityMap = useMemo(() => {
    return computeCellVisibilityForPlayers(config);
  }, [config]);

  // Determine the current player's active layer if viewerRole === 'player'
  const playerActiveLayerId: TacticalLayerId = useMemo(() => {
    if (viewerRole === 'player' && currentPlayerCharacterId) {
      const myToken = config.tokens.find((t) =>
        isTokenOwnedByPlayer(t, currentPlayerCharacterId)
      );
      if (myToken && myToken.layerId !== undefined) return myToken.layerId;
    }
    return activeLayerId;
  }, [viewerRole, currentPlayerCharacterId, config.tokens, activeLayerId]);

  const selectedToken = useMemo(
    () => config.tokens.find((t) => t.id === selectedTokenId) || null,
    [config.tokens, selectedTokenId]
  );

  const handleCellClick = (col: number, row: number) => {
    if (viewerRole === 'studio' && studioTool !== 'select' && studioTool !== 'pan') {
      onCellStudioAction?.(col, row, false);
      return;
    }

    // If a token is selected, attempt to move it to (col, row)
    if (selectedToken && onTokenMove) {
      const canControl =
        viewerRole === 'dm' ||
        viewerRole === 'studio' ||
        (viewerRole === 'player' &&
          isTokenOwnedByPlayer(selectedToken, currentPlayerCharacterId));

      if (!canControl) {
        setFeedback('Solo puedes mover tu propia ficha de jugador.');
        return;
      }

      const moveResult = evaluateTacticalTokenMove({
        config,
        token: selectedToken,
        targetCol: col,
        targetRow: row,
        actorRole: viewerRole === 'player' ? 'player' : 'dm',
        actorCharacterId: currentPlayerCharacterId,
      });

      if (!moveResult.allowed) {
        setFeedback(moveResult.reason || 'Movimiento inválido.');
        return;
      }

      setFeedback(
        moveResult.transitionedLayer
          ? `Ficha movida a (${col + 1}, ${row + 1}) — Cambió a Capa ${moveResult.newLayerId}`
          : null
      );
      onTokenMove(
        selectedToken.id,
        col,
        row,
        moveResult.newLayerId,
        moveResult.transitionedLayer
      );
      return;
    }
  };

  const handleCellMouseEnter = (col: number, row: number) => {
    setHoverCell({ col, row });
    if (
      isMouseDown &&
      viewerRole === 'studio' &&
      studioTool !== 'select' &&
      studioTool !== 'pan' &&
      studioTool !== 'fill_color' &&
      studioTool !== 'place_prop'
    ) {
      onCellStudioAction?.(col, row, true);
    }
  };

  const handleTokenClick = (e: React.MouseEvent, token: TacticalMapToken) => {
    e.stopPropagation();
    const tokCol = token.col ?? token.x ?? 0;
    const tokRow = token.row ?? token.y ?? 0;
    if (viewerRole === 'studio' && studioTool !== 'select' && studioTool !== 'pan') {
      // Allow painting over cells even if a token is there
      onCellStudioAction?.(tokCol, tokRow, false);
      return;
    }

    if (viewerRole === 'player') {
      const isMine = isTokenOwnedByPlayer(token, currentPlayerCharacterId);
      if (!isMine) {
        setFeedback('Solo puedes seleccionar y mover tu propia ficha.');
        return;
      }
    }

    if (selectedTokenId === token.id) {
      setSelectedToken(null);
    } else {
      setSelectedToken(token);
      setFeedback(null);
    }
  };

  const handleTokenDragStart = (e: React.DragEvent, token: TacticalMapToken) => {
    if (viewerRole === 'player') {
      const isMine = isTokenOwnedByPlayer(token, currentPlayerCharacterId);
      if (!isMine) {
        e.preventDefault();
        setFeedback('Solo puedes arrastrar tu propia ficha.');
        return;
      }
    }
    setSelectedToken(token);
    e.dataTransfer.setData('text/plain', token.id);
  };

  const handleCellDrop = (e: React.DragEvent, col: number, row: number) => {
    e.preventDefault();
    const draggedTokenId = e.dataTransfer.getData('text/plain') || selectedTokenId;
    if (!draggedTokenId || !onTokenMove) return;

    const token = config.tokens.find((t) => t.id === draggedTokenId);
    if (!token) return;

    if (viewerRole === 'player' && !isTokenOwnedByPlayer(token, currentPlayerCharacterId)) {
      setFeedback('Solo puedes mover tu propia ficha.');
      return;
    }

    const moveResult = evaluateTacticalTokenMove({
      config,
      token,
      targetCol: col,
      targetRow: row,
      actorRole: viewerRole === 'player' ? 'player' : 'dm',
      actorCharacterId: currentPlayerCharacterId,
    });

    if (!moveResult.allowed) {
      setFeedback(moveResult.reason || 'Movimiento bloqueado.');
      return;
    }

    setFeedback(
      moveResult.transitionedLayer
        ? `Ficha movida a (${col + 1}, ${row + 1}) — Cambió a Capa ${moveResult.newLayerId}`
        : null
    );
    onTokenMove(token.id, col, row, moveResult.newLayerId, moveResult.transitionedLayer);
  };

  const layer0 = config.layers[0];
  const visibleInteractiveLayers: TacticalLayerId[] = [1, 2, 3].filter((lid) => {
    const l = config.layers[lid as TacticalLayerId];
    if (!l?.visible) return false;
    // In player view, if player is on layer 1 or 2, hide layer 3 (roofs/upper floor) unless player is on layer 3
    if (viewerRole === 'player' && lid > playerActiveLayerId) {
      return false;
    }
    return true;
  }) as TacticalLayerId[];

  const totalWidthPx =
    config.gridCols * cellPx + (isHex ? Math.round(cellPx * 0.5) : 0);
  const totalHeightPx = config.gridRows * cellPx;

  // Helper to get pixel coordinates for a (col, row)
  const getCellPixelPos = (col: number, row: number) => {
    const hexOffset = isHex && row % 2 === 1 ? Math.round(cellPx * 0.5) : 0;
    return {
      left: col * cellPx + hexOffset,
      top: row * cellPx,
    };
  };

  // Active FOW module lookup for studio highlight
  const activeFowMod = useMemo(
    () => config.fow.modules.find((m) => m.id === activeFowModuleId) || null,
    [config.fow.modules, activeFowModuleId]
  );

  return (
    <div
      className="relative select-none flex flex-col items-center"
      onMouseDown={() => setIsMouseDown(true)}
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => {
        setIsMouseDown(false);
        setHoverCell(null);
      }}
    >
      {/* Status / Feedback Banner */}
      {feedbackMessage && (
        <div
          data-testid="tactical-map-feedback-banner"
          className="mb-2 px-3.5 py-1.5 rounded-lg bg-zinc-900/95 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-2 shadow-lg z-30"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-2 text-[10px] text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selected Token Helper / DM Live Editor Bar */}
      {selectedToken && (
        <div
          data-testid={
            viewerRole === 'dm' || viewerRole === 'studio'
              ? 'dm-live-token-editor-bar'
              : 'player-active-token-bar'
          }
          className="mb-2 px-3 py-1.5 rounded-xl bg-indigo-950/95 border border-indigo-500/50 text-indigo-100 text-[11px] flex flex-wrap items-center gap-2 shadow-xl z-30"
        >
          <Footprints className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          {viewerRole === 'dm' || viewerRole === 'studio' ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Editor DM ({selectedToken.tokenType === 'player' || selectedToken.kind === 'player' ? 'Jugador' : 'Monstruo'}):
              </span>
              {/* Token Name */}
              <input
                type="text"
                data-testid="dm-token-edit-name"
                value={selectedToken.name || selectedToken.label || ''}
                onChange={(e) =>
                  onDmModifyToken?.(selectedToken.id, {
                    name: e.target.value,
                    label: e.target.value,
                  })
                }
                className="w-28 px-2 py-0.5 rounded bg-zinc-900 border border-indigo-400/50 text-white text-[11px] font-semibold focus:outline-none focus:border-amber-400"
                title="Nombre de la ficha"
              />

              {/* HP Current / Max Controls */}
              <div className="flex items-center gap-1 bg-zinc-900/90 border border-emerald-500/40 rounded-lg px-1.5 py-0.5">
                <span className="text-[10px] font-bold text-emerald-300">PG:</span>
                <button
                  type="button"
                  data-testid="dm-token-hp-minus-5"
                  onClick={() => {
                    const cur = selectedToken.hpCurrent ?? selectedToken.hp ?? 20;
                    const next = Math.max(0, cur - 5);
                    onDmModifyToken?.(selectedToken.id, { hpCurrent: next, hp: next });
                  }}
                  className="px-1 py-0.2 rounded bg-red-950/80 hover:bg-red-800 text-red-200 text-[10px] font-bold"
                >
                  -5
                </button>
                <button
                  type="button"
                  data-testid="dm-token-hp-minus-1"
                  onClick={() => {
                    const cur = selectedToken.hpCurrent ?? selectedToken.hp ?? 20;
                    const next = Math.max(0, cur - 1);
                    onDmModifyToken?.(selectedToken.id, { hpCurrent: next, hp: next });
                  }}
                  className="px-1 py-0.2 rounded bg-red-950/80 hover:bg-red-800 text-red-200 text-[10px] font-bold"
                >
                  -1
                </button>
                <input
                  type="number"
                  data-testid="dm-token-edit-hp"
                  value={selectedToken.hpCurrent ?? selectedToken.hp ?? 20}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    onDmModifyToken?.(selectedToken.id, { hpCurrent: val, hp: val });
                  }}
                  className="w-11 text-center bg-zinc-950 border border-zinc-700 rounded text-[11px] font-mono font-bold text-emerald-300"
                  title="Puntos de Golpe Actuales"
                />
                <span className="text-zinc-400">/</span>
                <input
                  type="number"
                  data-testid="dm-token-edit-hpmax"
                  value={selectedToken.hpMax ?? selectedToken.maxHp ?? 20}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    onDmModifyToken?.(selectedToken.id, { hpMax: val, maxHp: val });
                  }}
                  className="w-11 text-center bg-zinc-950 border border-zinc-700 rounded text-[11px] font-mono text-zinc-300"
                  title="Puntos de Golpe Máximos"
                />
                <button
                  type="button"
                  data-testid="dm-token-hp-plus-1"
                  onClick={() => {
                    const cur = selectedToken.hpCurrent ?? selectedToken.hp ?? 20;
                    const max = selectedToken.hpMax ?? selectedToken.maxHp ?? 20;
                    const next = Math.min(max, cur + 1);
                    onDmModifyToken?.(selectedToken.id, { hpCurrent: next, hp: next });
                  }}
                  className="px-1 py-0.2 rounded bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold"
                >
                  +1
                </button>
                <button
                  type="button"
                  data-testid="dm-token-hp-plus-5"
                  onClick={() => {
                    const cur = selectedToken.hpCurrent ?? selectedToken.hp ?? 20;
                    const max = selectedToken.hpMax ?? selectedToken.maxHp ?? 20;
                    const next = Math.min(max, cur + 5);
                    onDmModifyToken?.(selectedToken.id, { hpCurrent: next, hp: next });
                  }}
                  className="px-1 py-0.2 rounded bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold"
                >
                  +5
                </button>
              </div>

              {/* AC (CA) */}
              <div className="flex items-center gap-1 bg-zinc-900/90 border border-sky-500/40 rounded-lg px-1.5 py-0.5">
                <span className="text-[10px] font-bold text-sky-300">CA:</span>
                <input
                  type="number"
                  data-testid="dm-token-edit-ac"
                  value={selectedToken.ac ?? 15}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 10);
                    onDmModifyToken?.(selectedToken.id, { ac: val });
                  }}
                  className="w-10 text-center bg-zinc-950 border border-zinc-700 rounded text-[11px] font-mono font-bold text-sky-200"
                  title="Clase de Armadura (CA)"
                />
              </div>

              {/* Layer Switcher (C1, C2, C3) */}
              <div className="flex items-center gap-0.5 bg-zinc-900/90 border border-amber-500/40 rounded-lg px-1 py-0.5">
                <span className="text-[10px] font-bold text-amber-300 mr-0.5">Capa:</span>
                {([1, 2, 3] as TacticalLayerId[]).map((lid) => (
                  <button
                    key={lid}
                    type="button"
                    data-testid={`dm-token-layer-${lid}`}
                    onClick={() => onDmModifyToken?.(selectedToken.id, { layerId: lid })}
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      selectedToken.layerId === lid
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    C{lid}
                  </button>
                ))}
              </div>

              {/* Token Size Switcher (1x1 vs 2x2) */}
              <button
                type="button"
                data-testid="dm-token-toggle-size"
                onClick={() => {
                  const curMode =
                    selectedToken.sizeMode ||
                    ((selectedToken.tokenType === 'player' || selectedToken.kind === 'player')
                      ? config.tokenSizeMode
                      : 'standard_1x1');
                  const nextMode = curMode === 'super_2x2' ? 'standard_1x1' : 'super_2x2';
                  onDmModifyToken?.(selectedToken.id, { sizeMode: nextMode });
                }}
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-200"
                title="Alternar tamaño de la ficha (1x1 o 2x2)"
              >
                {(selectedToken.sizeMode ||
                  (selectedToken.tokenType === 'player' ? config.tokenSizeMode : 'standard_1x1')) ===
                'super_2x2'
                  ? '2x2'
                  : '1x1'}
              </button>

              {onDmDeleteToken && (
                <button
                  type="button"
                  data-testid="dm-token-delete"
                  onClick={() => {
                    onDmDeleteToken(selectedToken.id);
                    setSelectedToken(null);
                  }}
                  className="px-2 py-0.5 rounded bg-red-950/90 hover:bg-red-800 border border-red-500/50 text-[10px] font-bold text-red-200"
                  title="Eliminar ficha del mapa"
                >
                  Eliminar
                </button>
              )}
            </>
          ) : (
            <span>
              Tu ficha activa: <strong className="text-white">{selectedToken.name}</strong> (Capa{' '}
              {selectedToken.layerId}) — Haz clic o arrastra a cualquier casilla accesible para mover
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelectedToken(null)}
            className="ml-auto px-1.5 py-0.5 rounded bg-indigo-900/80 hover:bg-indigo-800 text-[10px] text-indigo-200"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Map Board Container */}
      <div
        data-testid="tactical-map-board"
        data-grid-type={config.gridType}
        data-grid-cols={config.gridCols}
        data-grid-rows={config.gridRows}
        className="relative bg-[#0b0d12] border-2 border-zinc-800/90 rounded-lg shadow-2xl overflow-hidden"
        style={{
          width: `${totalWidthPx}px`,
          height: `${totalHeightPx}px`,
        }}
      >
        {/* CAPA 0: FONDO (Mapa base) */}
        {layer0?.visible && layer0.bgImageUrl && (
          <img
            src={layer0.bgImageUrl}
            alt="Capa 0 Mapa Base"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: layer0.bgOpacity ?? 1 }}
          />
        )}

        {/* CAPAS 1, 2, 3: Pintura de cuadrículas y Props/Stamps */}
        {visibleInteractiveLayers.map((lid) => {
          const layerData = config.layers[lid];
          if (!layerData) return null;
          const isCurrentEditedLayer = viewerRole === 'studio' && activeLayerId === lid;

          return (
            <div
              key={`layer-render-${lid}`}
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: lid * 5,
                opacity:
                  viewerRole === 'studio' && activeLayerId !== 0 && activeLayerId !== lid
                    ? 0.65
                    : 1,
              }}
            >
              {/* Painted Terrain Cells */}
              {Object.entries(layerData.paintedCells || {}).map(([cellKey, color]) => {
                const { col, row } = parseCellKey(cellKey);
                if (col < 0 || col >= config.gridCols || row < 0 || row >= config.gridRows) {
                  return null;
                }
                const pos = getCellPixelPos(col, row);
                return (
                  <div
                    key={`paint-${lid}-${cellKey}`}
                    className="absolute"
                    style={{
                      left: `${pos.left}px`,
                      top: `${pos.top}px`,
                      width: `${cellPx}px`,
                      height: `${cellPx}px`,
                      backgroundColor: color,
                      clipPath: isHex
                        ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                        : undefined,
                    }}
                  />
                );
              })}

              {/* Stamps / Props on this layer */}
              {(layerData.props || []).map((prop) => {
                const pos = getCellPixelPos(prop.col, prop.row);
                const propWidth = Math.max(1, prop.spanCols) * cellPx;
                const propHeight = Math.max(1, prop.spanRows) * cellPx;
                return (
                  <div
                    key={prop.id}
                    data-testid={`tactical-prop-${prop.id}`}
                    className={`absolute flex items-center justify-center ${
                      isCurrentEditedLayer ? 'ring-1 ring-amber-400/40' : ''
                    }`}
                    style={{
                      left: `${pos.left}px`,
                      top: `${pos.top}px`,
                      width: `${propWidth}px`,
                      height: `${propHeight}px`,
                      opacity: prop.opacity ?? 1,
                      transform: prop.rotation ? `rotate(${prop.rotation}deg)` : undefined,
                    }}
                  >
                    <img
                      src={prop.imageUrl}
                      alt={prop.label}
                      className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* INTERACTIVE GRID CELLS, WALKABILITY OVERLAYS & FOW */}
        <div className="absolute inset-0" style={{ zIndex: 25 }}>
          {Array.from({ length: config.gridRows }).map((_, row) =>
            Array.from({ length: config.gridCols }).map((__, col) => {
              const key = makeCellKey(col, row);
              const pos = getCellPixelPos(col, row);

              // Check walkability state on relevant layer
              const inspectLayerId: TacticalLayerId =
                viewerRole === 'player'
                  ? playerActiveLayerId
                  : activeLayerId === 0
                  ? 2
                  : activeLayerId;
              const inspectLayer = config.layers[inspectLayerId];

              const isVoid = Boolean(
                hasCellKey(inspectLayer?.voidCells, key) ||
                  hasCellKey(config.layers[2]?.voidCells, key) ||
                  hasCellKey(config.layers[1]?.voidCells, key)
              );
              const isBlocked = hasCellKey(inspectLayer?.blockedCells, key);
              const isStairBridge = hasCellKey(inspectLayer?.stairBridgeCells, key);

              // FOW state
              const visState = visibilityMap[key] || 'visible';
              const isInActiveFowMod = hasCellKey(activeFowMod?.cells, key);

              // Find if any unrevealed FOW module covers this cell (for DM/Studio tint)
              const coveringFowMod = config.fow.modules.find((m) => hasCellKey(m.cells, key));

              // If void cell: in player or preview mode, render pure black/invisible silhouette
              if (isVoid && viewerRole !== 'studio') {
                return (
                  <div
                    key={key}
                    data-testid={`tactical-cell-${col}-${row}`}
                    data-void="true"
                    className="absolute bg-[#050608]"
                    style={{
                      left: `${pos.left}px`,
                      top: `${pos.top}px`,
                      width: `${cellPx}px`,
                      height: `${cellPx}px`,
                    }}
                  />
                );
              }

              return (
                <div
                  key={key}
                  data-testid={`tactical-cell-${col}-${row}`}
                  data-blocked={isBlocked ? 'true' : 'false'}
                  data-stairs={isStairBridge ? 'true' : 'false'}
                  data-void={isVoid ? 'true' : 'false'}
                  data-fow={visState}
                  onClick={() => handleCellClick(col, row)}
                  onMouseEnter={() => handleCellMouseEnter(col, row)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleCellDrop(e, col, row)}
                  className={`absolute transition-colors cursor-pointer ${
                    isHex
                      ? 'border border-white/15'
                      : 'border-r border-b border-black/45 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)]'
                  } ${
                    hoverCell?.col === col && hoverCell?.row === row
                      ? 'bg-amber-400/20 z-10'
                      : ''
                  }`}
                  style={{
                    left: `${pos.left}px`,
                    top: `${pos.top}px`,
                    width: `${cellPx}px`,
                    height: `${cellPx}px`,
                    clipPath: isHex
                      ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                      : undefined,
                  }}
                >
                  {/* Void cell indicator in Studio */}
                  {isVoid && viewerRole === 'studio' && (
                    <div className="absolute inset-0 bg-black/90 border border-zinc-700/60 flex items-center justify-center">
                      <span className="text-[8px] text-zinc-500 font-mono">VOID</span>
                    </div>
                  )}

                  {/* Red Blocked Zone Overlay (shown in Studio & optionally DM view) */}
                  {isBlocked &&
                    (viewerRole === 'studio' || (viewerRole === 'dm' && showBlockedOverlay)) && (
                      <div
                        className="absolute inset-0 bg-red-600/35 border border-red-500/80 pointer-events-none"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(239,68,68,0.28) 0px, rgba(239,68,68,0.28) 3px, transparent 3px, transparent 7px)',
                        }}
                      />
                    )}

                  {/* Stairs / Layer Bridge Indicator */}
                  {isStairBridge && (
                    <div
                      title="Escalera / Puente entre capas"
                      className="absolute inset-0.5 rounded border border-cyan-400/80 bg-cyan-500/25 flex items-center justify-center pointer-events-none"
                    >
                      <Layers className="w-3 h-3 text-cyan-200 drop-shadow" />
                    </div>
                  )}

                  {/* Studio FOW Module Highlight */}
                  {viewerRole === 'studio' && coveringFowMod && (
                    <div
                      className={`absolute inset-0 pointer-events-none ${
                        isInActiveFowMod ? 'ring-1 ring-sky-300' : ''
                      }`}
                      style={{
                        backgroundColor: coveringFowMod.revealed
                          ? 'rgba(56, 189, 248, 0.14)'
                          : 'rgba(15, 23, 42, 0.68)',
                      }}
                    />
                  )}

                  {/* Live Fog of War Mask */}
                  {visState === 'hidden' && viewerRole === 'player' && (
                    <div className="absolute inset-0 bg-[#05070b] pointer-events-none z-20" />
                  )}
                  {visState === 'explored_fog' && viewerRole === 'player' && (
                    <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[1px] pointer-events-none z-20" />
                  )}
                  {visState === 'hidden' && viewerRole === 'dm' && (
                    <div
                      title="Oculto por Fog of War para los jugadores"
                      className="absolute inset-0 bg-slate-950/50 pointer-events-none"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Prop Placement Ghost Preview in Studio */}
        {viewerRole === 'studio' &&
          studioTool === 'place_prop' &&
          selectedPropTemplate &&
          hoverCell && (
            <div
              className="absolute pointer-events-none border-2 border-dashed border-sky-400 bg-sky-500/15 rounded flex items-center justify-center"
              style={{
                zIndex: 28,
                left: `${getCellPixelPos(hoverCell.col, hoverCell.row).left}px`,
                top: `${getCellPixelPos(hoverCell.col, hoverCell.row).top}px`,
                width: `${selectedPropTemplate.spanCols * cellPx}px`,
                height: `${selectedPropTemplate.spanRows * cellPx}px`,
              }}
            >
              <img
                src={selectedPropTemplate.imageUrl}
                alt={selectedPropTemplate.label}
                className="w-full h-full object-contain opacity-75"
              />
              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-sky-950/90 text-sky-200 text-[9px] font-bold rounded">
                {selectedPropTemplate.spanCols}x{selectedPropTemplate.spanRows}
              </span>
            </div>
          )}

        {/* TOKENS LAYER (Players & Enemies) */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 35 }}>
          {config.tokens.map((token) => {
            const occupied = getTokenOccupiedCells(token, config.tokenSizeMode);
            const isPlayerKind = token.tokenType === 'player' || token.kind === 'player';
            // If viewer is a player, hide enemy tokens that are inside 'hidden' FOW cells
            if (viewerRole === 'player' && !isPlayerKind) {
              const anyVisible = occupied.some(
                (c) => visibilityMap[makeCellKey(c.col, c.row)] === 'visible'
              );
              if (!anyVisible) return null;
            }

            const pos = getCellPixelPos(token.col, token.row);
            const span =
              token.sizeMode === 'super_2x2'
                ? 2
                : token.sizeMode === 'standard_1x1'
                ? 1
                : isPlayerKind && config.tokenSizeMode === 'super_2x2'
                ? 2
                : 1;
            const tokenBoxPx = span * cellPx;
            const isSelected = selectedTokenId === token.id;
            const linkedCharacter =
              token.characterId && charactersById[token.characterId]
                ? charactersById[token.characterId]
                : null;
            const canViewerMoveToken =
              viewerRole === 'dm' ||
              viewerRole === 'studio' ||
              (viewerRole === 'player' && isTokenOwnedByPlayer(token, currentPlayerCharacterId));

            return (
              <div
                key={token.id}
                data-testid={`tactical-token-${token.id}`}
                data-token-type={token.tokenType || token.kind}
                data-token-col={token.col}
                data-token-row={token.row}
                data-token-layer={token.layerId}
                data-token-span={span}
                data-can-move={canViewerMoveToken ? 'true' : 'false'}
                draggable={canViewerMoveToken}
                onDragStart={(e) => handleTokenDragStart(e, token)}
                onClick={(e) => handleTokenClick(e, token)}
                className={`absolute pointer-events-auto ${
                  canViewerMoveToken ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'
                } transition-all duration-150 flex items-center justify-center ${
                  isSelected
                    ? 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.75)] z-40 scale-105'
                    : 'hover:scale-105 z-30'
                }`}
                style={{
                  left: `${pos.left}px`,
                  top: `${pos.top}px`,
                  width: `${tokenBoxPx}px`,
                  height: `${tokenBoxPx}px`,
                }}
              >
                {isPlayerKind ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <PlayerTacticalTokenRenderer
                      character={
                        linkedCharacter
                          ? {
                              ...linkedCharacter,
                              name: token.name || token.label || linkedCharacter.name,
                              hpCurrent:
                                token.hpCurrent ??
                                token.hp ??
                                linkedCharacter.hpCurrent ??
                                linkedCharacter.currentHp ??
                                24,
                              currentHp:
                                token.hpCurrent ??
                                token.hp ??
                                linkedCharacter.currentHp ??
                                linkedCharacter.hpCurrent ??
                                24,
                              hpMax:
                                token.hpMax ??
                                token.maxHp ??
                                linkedCharacter.hpMax ??
                                linkedCharacter.maxHp ??
                                24,
                              maxHp:
                                token.hpMax ??
                                token.maxHp ??
                                linkedCharacter.maxHp ??
                                linkedCharacter.hpMax ??
                                24,
                              ac:
                                token.ac ??
                                linkedCharacter.ac ??
                                linkedCharacter.armorClass ??
                                15,
                              armorClass:
                                token.ac ??
                                linkedCharacter.armorClass ??
                                linkedCharacter.ac ??
                                15,
                            }
                          : {
                              id: token.characterId || token.id,
                              name: token.name || token.label || 'Aventurero',
                              avatarUrl: token.imageUrl || token.avatarUrl,
                              hpCurrent: token.hpCurrent ?? token.hp ?? 24,
                              hpMax: token.hpMax ?? token.maxHp ?? 24,
                              ac: token.ac ?? 15,
                              alignment: 'Neutral Bueno',
                              playerSkinId: token.playerSkinId,
                              coins: { gp: 100, sp: 0, cp: 0, ep: 0, pp: 0 },
                            }
                      }
                      sizePx={Math.max(20, tokenBoxPx - 2)}
                    />
                    {/* Layer badge */}
                    <span
                      className="absolute -top-1 -right-1 px-1 py-0.2 rounded bg-zinc-950/90 border border-amber-500/50 text-[8px] font-bold text-amber-300 shadow"
                      title={`Capa actual: ${token.layerId}`}
                    >
                      C{token.layerId}
                    </span>
                  </div>
                ) : (
                  /* Generic Circular Enemy Token */
                  <div
                    className="relative w-[92%] h-[92%] rounded-full border-2 border-red-500 bg-zinc-950 overflow-hidden shadow-[0_2px_10px_rgba(239,68,68,0.65)] flex items-center justify-center"
                    title={`${token.name || token.label} (Enemigo - Capa ${token.layerId} | PG: ${token.hpCurrent ?? token.hp ?? 15}/${token.hpMax ?? token.maxHp ?? 15} | CA: ${token.ac ?? 13})`}
                  >
                    {token.imageUrl || token.avatarUrl ? (
                      <img
                        src={token.imageUrl || token.avatarUrl}
                        alt={token.name || token.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Shield className="w-1/2 h-1/2 text-red-400" />
                    )}
                    <div
                      data-testid={`enemy-token-hp-${token.id}`}
                      className="absolute top-0 inset-x-0 bg-black/85 text-[7px] font-mono font-bold text-emerald-300 text-center truncate px-0.5"
                    >
                      {token.hpCurrent ?? token.hp ?? 15}/{token.hpMax ?? token.maxHp ?? 15}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-red-950/90 text-[8px] font-bold text-red-200 text-center truncate px-0.5">
                      {token.name || token.label}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
