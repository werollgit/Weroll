import React, { useState, useEffect } from 'react';
import { Shield, Zap, Eye, Plus, Minus, RotateCw } from 'lucide-react';
import { EntityAvatar } from '../common/EntityAvatar';
import {
  Character5e,
  PartyMemberLive,
  AppSkinThemeTokens,
  DiceRollResult,
  TarotHpVisualStyle,
  TarotCardModuleItem,
} from '../../types/dnd';
import { soundManager } from '../../utils/audio';
import {
  formatModifier,
  calculateProficiencyBonus,
  calculatePassivePerception,
  parseAlignmentDescriptor,
  calculateEquippedItemStatBonuses,
  resolveTarotCardAbilityScores,
  formatCompactRollDieBadge,
  isTarotElementVisibleOnSide,
} from '../../utils/dnd-math';
import {
  resolveTarotStudioConfig,
  createDefaultTarotModules,
  buildGeometricElementStyle,
} from '../../utils/playerSkinLayout';
import { GeometricSvgBorder } from '../common/GeometricSvgBorder';

// Shared lightweight skin catalog cache so every CharacterTarotCard across Lobby, Sheet, and Map Mode
// automatically displays its owner's equipped playerSkinId to all players and the DM.
let cachedPlayerSkinsMap: Record<string, AppSkinThemeTokens> = {};
let catalogFetchPromise: Promise<void> | null = null;
const skinCacheListeners = new Set<() => void>();

export function getCachedSkinTokensById(skinId?: string | null): AppSkinThemeTokens | undefined {
  if (!skinId) return undefined;
  return cachedPlayerSkinsMap[skinId];
}

export function subscribeToSkinCatalogCache(cb: () => void): () => void {
  skinCacheListeners.add(cb);
  fetchTarotSkinCatalogOnce();
  return () => {
    skinCacheListeners.delete(cb);
  };
}

export function invalidateTarotSkinCache() {
  catalogFetchPromise = null;
  fetchTarotSkinCatalogOnce(true);
}

function fetchTarotSkinCatalogOnce(force = false) {
  if (typeof window === 'undefined') return;
  if (catalogFetchPromise && !force) return;
  catalogFetchPromise = fetch('/api/creator/catalog')
    .then((r) => r.json())
    .then((data) => {
      const allSkins = [
        ...(Array.isArray(data?.skins) ? data.skins : []),
        ...(Array.isArray(data?.playerSkins) ? data.playerSkins : []),
        ...(Array.isArray(data?.dmSkins) ? data.dmSkins : []),
        ...(Array.isArray(data?.appSkins) ? data.appSkins : []),
      ];
      if (allSkins.length > 0) {
        const nextMap: Record<string, AppSkinThemeTokens> = {};
        for (const s of allSkins) {
          if (s && s.id && s.themeTokens) {
            nextMap[s.id] = s.themeTokens;
          }
        }
        if (data.activeOnlinePlayerSkinId && nextMap[data.activeOnlinePlayerSkinId]) {
          nextMap['__online_default__'] = nextMap[data.activeOnlinePlayerSkinId];
        }
        if (data.activeOnlineDmSkinId && nextMap[data.activeOnlineDmSkinId]) {
          nextMap['__online_dm_default__'] = nextMap[data.activeOnlineDmSkinId];
        }
        cachedPlayerSkinsMap = nextMap;
        skinCacheListeners.forEach((cb) => cb());
      }
    })
    .catch(() => {});
}

export interface CharacterTarotCardProps {
  character?: Character5e;
  member?: PartyMemberLive;
  skinTokens?: AppSkinThemeTokens;
  forcedSide?: 'front' | 'back';
  isOnline?: boolean;
  compact?: boolean;
  miniGrid?: boolean;
  miniature?: boolean;
  showLastRollInMap?: boolean;
  lastRoll?: DiceRollResult | null;
  onClickCoinPouch?: () => void;
  showDmControls?: boolean;
  onDmAdjustPlayer?: (
    characterId: string,
    updates: { hpDelta?: number; setHp?: number; gpDelta?: number }
  ) => void;
  footerActions?: React.ReactNode;
  className?: string;
  dataTestId?: string;
  testId?: string;
}

const MapLastRollDieBadge: React.FC<{
  roll?: DiceRollResult | null;
  size?: 'xs' | 'sm';
}> = ({ roll, size = 'sm' }) => {
  const parsed = formatCompactRollDieBadge(roll);
  const sides = parsed?.sides || 20;
  const valueText = parsed ? String(parsed.displayValue) : '—';
  const labelText = parsed ? parsed.diceLabel.toUpperCase() : '1D20';
  const strokeColor = parsed?.isCritSuccess
    ? '#34d399'
    : parsed?.isCritFail
    ? '#f87171'
    : '#e5c478';
  const fillColor = parsed?.isCritSuccess
    ? '#064e3b'
    : parsed?.isCritFail
    ? '#7f1d1d'
    : '#141824';

  const svgSizeClass = size === 'xs' ? 'w-6 h-6' : 'w-8 h-8';

  return (
    <div
      data-testid="tarot-map-last-roll-badge"
      title={
        roll
          ? `Última tirada: ${roll.label || labelText} = ${valueText} (${roll.formula || labelText})`
          : 'Sin tiradas recientes'
      }
      className="flex flex-col items-center justify-center bg-[#0d1018]/90 border border-[#c8a45c]/75 rounded-lg px-1.5 py-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.85)] select-none"
    >
      <div className={`relative ${svgSizeClass} flex items-center justify-center`}>
        <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow">
          {sides === 4 && (
            <polygon
              points="18,3 33,31 3,31"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          )}
          {sides === 6 && (
            <rect
              x="5"
              y="5"
              width="26"
              height="26"
              rx="4"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2.2"
            />
          )}
          {sides === 8 && (
            <polygon
              points="18,2 33,18 18,34 3,18"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          )}
          {sides === 10 && (
            <polygon
              points="18,2 33,14 27,33 9,33 3,14"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          )}
          {sides === 12 && (
            <polygon
              points="18,2 31,9 34,23 25,33 11,33 2,23 5,9"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          )}
          {(sides === 20 || sides === 100) && (
            <polygon
              points="18,2 32,10 32,26 18,34 4,26 4,10"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-cinzel font-black ${
            sides === 4 ? 'pt-1.5 text-[9px]' : size === 'xs' ? 'text-[10px]' : 'text-[11px]'
          } text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] leading-none`}
        >
          {valueText}
        </span>
      </div>
      <span className="text-[7px] font-mono font-black text-[#e5c478] tracking-tighter leading-none mt-0.5 uppercase">
        {labelText}
      </span>
    </div>
  );
};

export const AlignmentBadgeIcon: React.FC<{
  alignment?: string;
  size?: 'xs' | 'sm' | 'md';
  customIconUrl?: string;
}> = ({ alignment = 'Neutral Bueno', size = 'md', customIconUrl }) => {
  const desc = parseAlignmentDescriptor(alignment);

  const colorClasses =
    desc.colorTone === 'green'
      ? {
          icon: 'text-emerald-400',
          glow: 'shadow-[0_0_12px_rgba(16,185,129,0.55)]',
          bg: 'from-emerald-950/90 to-[#11181c]',
          stroke: '#34d399',
          secondaryStroke: '#10b981',
        }
      : desc.colorTone === 'red'
      ? {
          icon: 'text-red-400',
          glow: 'shadow-[0_0_12px_rgba(239,68,68,0.55)]',
          bg: 'from-red-950/90 to-[#1c1113]',
          stroke: '#f87171',
          secondaryStroke: '#ef4444',
        }
      : {
          icon: 'text-slate-300',
          glow: 'shadow-[0_0_12px_rgba(148,163,184,0.45)]',
          bg: 'from-slate-800/90 to-[#14171f]',
          stroke: '#cbd5e1',
          secondaryStroke: '#94a3b8',
        };

  const boxDim =
    size === 'xs'
      ? 'w-5 h-5 rounded'
      : size === 'sm'
      ? 'w-6 h-6 rounded-md'
      : 'w-8 h-8 rounded-lg';
  const svgDim =
    size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div
      className={`relative group inline-flex items-center justify-center ${boxDim} bg-gradient-to-b ${colorClasses.bg} border border-[#c8a45c]/85 ${colorClasses.glow} cursor-help shrink-0 select-none`}
      data-testid="character-alignment-badge"
      aria-label={`Alineamiento: ${desc.labelEs}`}
    >
      {customIconUrl ? (
        <img
          src={customIconUrl}
          alt={desc.labelEs}
          className={`${svgDim} object-contain rounded-sm`}
        />
      ) : (
        <>
          {desc.shape === 'spiral' && (
            /* Caótico: Swirling Arcane Vortex / Spiral */
            <svg viewBox="0 0 24 24" className={svgDim} fill="none">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke={colorClasses.secondaryStroke}
                strokeWidth="1.2"
                strokeDasharray="3 2"
                opacity="0.65"
              />
              <path
                d="M12 12c0-2.2 1.8-4 4-4s4 1.8 4 4c0 3.5-2.8 6.3-6.3 6.3-4.6 0-8.2-3.7-8.2-8.2 0-5.2 4.3-9.1 9.5-9.1"
                stroke={colorClasses.stroke}
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <path
                d="M12 12c0 2.2-1.8 4-4 4s-4-1.8-4-4c0-3.5 2.8-6.3 6.3-6.3 4.6 0 8.2 3.7 8.2 8.2"
                stroke={colorClasses.secondaryStroke}
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.85"
              />
              <circle cx="12" cy="12" r="2" fill={colorClasses.stroke} />
            </svg>
          )}

          {desc.shape === 'equilibrium' && (
            /* Neutral: Cosmic Equilibrium / Balance Crest */
            <svg viewBox="0 0 24 24" className={svgDim} fill="none">
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke={colorClasses.stroke}
                strokeWidth="1.8"
              />
              <polygon
                points="12,4.5 19.5,12 12,19.5 4.5,12"
                stroke={colorClasses.secondaryStroke}
                strokeWidth="1.6"
                fill={colorClasses.stroke}
                fillOpacity="0.18"
              />
              <line
                x1="4"
                y1="12"
                x2="20"
                y2="12"
                stroke={colorClasses.stroke}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="2.2" fill={colorClasses.stroke} />
            </svg>
          )}

          {desc.shape === 'scales' && (
            /* Legal: Scales of Justice & Law */
            <svg viewBox="0 0 24 24" className={svgDim} fill="none">
              <line
                x1="12"
                y1="3.5"
                x2="12"
                y2="19.5"
                stroke={colorClasses.stroke}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="19.5"
                x2="16"
                y2="19.5"
                stroke={colorClasses.stroke}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M5 7.5h14"
                stroke={colorClasses.stroke}
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <path
                d="M6 7.5L3.8 13h4.4L6 7.5z"
                stroke={colorClasses.secondaryStroke}
                strokeWidth="1.5"
                fill={colorClasses.stroke}
                fillOpacity="0.25"
              />
              <path
                d="M18 7.5L15.8 13h4.4L18 7.5z"
                stroke={colorClasses.secondaryStroke}
                strokeWidth="1.5"
                fill={colorClasses.stroke}
                fillOpacity="0.25"
              />
              <circle cx="12" cy="5" r="1.5" fill={colorClasses.stroke} />
            </svg>
          )}
        </>
      )}

      {/* Floating Beginner Tooltip on Hover */}
      <div
        role="tooltip"
        data-testid="alignment-hover-tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-2.5 rounded-xl bg-[#11131a]/98 border-2 border-[#c8a45c] shadow-[0_10px_25px_rgba(0,0,0,0.95)] text-left"
      >
        <div className="flex items-center justify-between gap-1 border-b border-[#c8a45c]/35 pb-1 mb-1">
          <span className={`font-cinzel font-black text-xs uppercase ${colorClasses.icon}`}>
            {desc.labelEs}
          </span>
          <span className="text-[9px] font-mono text-[#cbb692] uppercase">Alineamiento</span>
        </div>
        <p className="text-[11px] font-sans text-stone-200 leading-snug font-normal normal-case">
          {desc.descriptionEs}
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// FLEXIBLE HP VISUAL METER FOR TAROT CARD (FRONT / BACK / BOTH)
// Supports: classic_bar, square_bar, segmented_points, clockwork_gears,
// alchemical_potion, crimson_hearts
// ============================================================================
const TarotStyledHpMeter: React.FC<{
  styleVariant: TarotHpVisualStyle;
  currentHp: number;
  maxHp: number;
  hpPercent: number;
  isMini?: boolean;
  customPngUrl?: string;
  sideLabel?: string;
}> = ({ styleVariant, currentHp, maxHp, hpPercent, isMini = false, customPngUrl }) => {
  if (styleVariant === 'alchemical_potion') {
    const liquidColor =
      hpPercent > 50 ? '#10b981' : hpPercent > 25 ? '#f59e0b' : '#ef4444';
    return (
      <div
        data-testid="tarot-hp-style-alchemical_potion"
        className={`flex items-center justify-center gap-2.5 ${
          isMini ? 'p-1' : 'p-2'
        } rounded-xl bg-black/55 border border-[#c8a45c]/60 shadow-inner`}
      >
        <div className={`relative ${isMini ? 'w-8 h-9' : 'w-12 h-14'} flex items-center justify-center shrink-0`}>
          {customPngUrl ? (
            <img src={customPngUrl} alt="Poción" className="w-full h-full object-contain" />
          ) : (
            <svg viewBox="0 0 64 72" className="w-full h-full drop-shadow-lg">
              <defs>
                <clipPath id="potion-flask-clip">
                  <path d="M26 16 H38 V26 L52 48 C55 54 51 64 43 64 H21 C13 64 9 54 12 48 L26 26 Z" />
                </clipPath>
              </defs>
              {/* Cork & Neck */}
              <rect x="27" y="6" width="10" height="6" rx="2" fill="#92400e" stroke="#291506" strokeWidth="1.8" />
              <rect x="24" y="12" width="16" height="5" rx="2" fill="#cbd5e1" stroke="#334155" strokeWidth="1.8" />
              {/* Depleting Liquid inside Flask */}
              <g clipPath="url(#potion-flask-clip)">
                <rect x="6" y="14" width="52" height="52" fill="#0f172a" />
                <rect
                  x="6"
                  y={64 - (hpPercent / 100) * 46}
                  width="52"
                  height="52"
                  fill={liquidColor}
                  opacity="0.9"
                />
                <circle cx="26" cy={58 - (hpPercent / 100) * 20} r="2.2" fill="#ffffff" opacity="0.65" />
                <circle cx="37" cy={60 - (hpPercent / 100) * 28} r="1.6" fill="#ffffff" opacity="0.55" />
              </g>
              {/* Glass Flask Outline */}
              <path
                d="M26 16 H38 V26 L52 48 C55 54 51 64 43 64 H21 C13 64 9 54 12 48 L26 26 Z"
                fill="none"
                stroke="#e2c275"
                strokeWidth="2.5"
              />
            </svg>
          )}
        </div>
        <div className="text-left">
          <div className="text-[9px] font-cinzel font-bold uppercase tracking-wider text-amber-300">
            Elixir Vital ({Math.round(hpPercent)}%)
          </div>
          <div className={`font-cinzel font-black ${isMini ? 'text-xs' : 'text-sm sm:text-base'} text-white`}>
            PG {currentHp} / {maxHp}
          </div>
        </div>
      </div>
    );
  }

  if (styleVariant === 'clockwork_gears') {
    const totalGears = 5;
    const intactGears = Math.ceil((hpPercent / 100) * totalGears);
    return (
      <div
        data-testid="tarot-hp-style-clockwork_gears"
        className={`rounded-xl bg-[#12100e]/90 border border-amber-500/65 ${
          isMini ? 'p-1' : 'p-2'
        } space-y-1 shadow-inner`}
      >
        <div className="flex items-center justify-between text-[10px] font-cinzel font-bold text-amber-200 px-1">
          <span>Engranajes Vitales</span>
          <span className="font-mono text-white">
            PG {currentHp}/{maxHp}
          </span>
        </div>
        <div className="flex items-center justify-around py-0.5">
          {Array.from({ length: totalGears }, (_, idx) => {
            const isIntact = idx < intactGears && currentHp > 0;
            return (
              <div
                key={`gear-${idx}`}
                title={isIntact ? `Engranaje #${idx + 1} Intacto` : `Engranaje #${idx + 1} Roto`}
                className={`flex flex-col items-center transition-all ${
                  isIntact ? 'text-amber-400 scale-105' : 'text-stone-600 opacity-50 scale-90'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`${isMini ? 'w-4 h-4' : 'w-6 h-6'} ${isIntact ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '9s' }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
                  {!isIntact && <line x1="3" y1="3" x2="21" y2="21" stroke="#ef4444" strokeWidth="2.5" />}
                </svg>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (styleVariant === 'segmented_points') {
    const segments = 10;
    const filledSegments = Math.ceil((hpPercent / 100) * segments);
    return (
      <div
        data-testid="tarot-hp-style-segmented_points"
        className={`rounded-xl bg-[#0c1018]/90 border border-[#c8a45c]/70 ${
          isMini ? 'p-1' : 'p-2'
        } space-y-1`}
      >
        <div className="flex items-center justify-between text-[10px] font-cinzel font-bold text-[#f5e4be] px-0.5">
          <span>Puntos de Vida</span>
          <span className="font-mono text-white">
            {currentHp}/{maxHp}
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: segments }, (_, i) => {
            const active = i < filledSegments && currentHp > 0;
            return (
              <div
                key={`seg-${i}`}
                className={`${isMini ? 'h-2.5' : 'h-3.5'} rounded-sm border transition-all ${
                  active
                    ? hpPercent > 50
                      ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                      : hpPercent > 25
                      ? 'bg-amber-400 border-amber-200'
                      : 'bg-red-500 border-red-300'
                    : 'bg-stone-900 border-stone-700/60'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (styleVariant === 'crimson_hearts') {
    const hearts = 5;
    const activeHearts = Math.ceil((hpPercent / 100) * hearts);
    return (
      <div
        data-testid="tarot-hp-style-crimson_hearts"
        className={`rounded-xl bg-[#180c10]/90 border border-red-500/60 ${
          isMini ? 'p-1' : 'p-2'
        } flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-1">
          {Array.from({ length: hearts }, (_, idx) => {
            const filled = idx < activeHearts && currentHp > 0;
            return (
              <span
                key={`heart-${idx}`}
                className={`${isMini ? 'text-xs' : 'text-base'} transition-transform ${
                  filled ? 'text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] scale-105' : 'text-stone-700'
                }`}
              >
                ♥
              </span>
            );
          })}
        </div>
        <span className="font-mono font-black text-xs text-red-100">
          PG {currentHp}/{maxHp}
        </span>
      </div>
    );
  }

  const isSquare = styleVariant === 'square_bar';
  return (
    <div
      data-testid={`tarot-hp-style-${styleVariant}`}
      className={`w-full ${
        isMini ? 'h-5.5 p-0.5' : 'h-8 p-1'
      } ${isSquare ? 'rounded-none' : 'rounded-xl'} bg-[#0e1118] border border-[#c8a45c]/80 shadow-inner relative overflow-hidden`}
    >
      <div
        className={`h-full ${
          isSquare ? 'rounded-none' : isMini ? 'rounded' : 'rounded-lg'
        } transition-all duration-300 ${
          hpPercent > 50
            ? 'bg-gradient-to-r from-[#148858] via-[#22b573] to-[#3ddc97]'
            : hpPercent > 25
            ? 'bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400'
            : 'bg-gradient-to-r from-red-800 via-red-600 to-red-500'
        }`}
        style={{
          width: `${hpPercent}%`,
          backgroundImage: customPngUrl ? `url(${customPngUrl})` : undefined,
          backgroundSize: 'cover',
        }}
      />
      <span
        className={`absolute inset-0 flex items-center justify-center font-sans font-bold ${
          isMini ? 'text-[10px]' : 'text-xs sm:text-sm'
        } text-white tracking-wider drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]`}
      >
        PG {currentHp}/{maxHp}
      </span>
    </div>
  );
};

export const CharacterTarotCard: React.FC<CharacterTarotCardProps> = ({
  character,
  member,
  skinTokens,
  forcedSide,
  isOnline = true,
  compact = false,
  miniGrid = false,
  miniature = false,
  showLastRollInMap = false,
  lastRoll,
  onClickCoinPouch,
  showDmControls = false,
  onDmAdjustPlayer,
  footerActions,
  className = '',
  dataTestId,
  testId,
}) => {
  const isMini = Boolean(miniature || miniGrid);

  // Resolve unified fields from either Character5e or PartyMemberLive
  const resolvedLastRoll = lastRoll ?? member?.lastRoll ?? null;
  const charId = character?.id || member?.characterId || 'char-card';
  const name = character?.name || member?.characterName || 'Aventurero';
  const level = character?.level ?? member?.level ?? 1;
  const experience = character?.experience ?? member?.experience ?? 0;
  const alignment = character?.alignment || member?.alignment || 'Neutral Bueno';

  const raceAndClass = character
    ? `${character.race || 'Humano'} • ${character.characterClass || 'Guerrero'}`
    : member?.race && member?.characterClass && !member.characterClass.includes(member.race)
    ? `${member.race} • ${member.characterClass}`
    : (member?.characterClass || 'Humano • Aventurero').replace(/\s+/, ' • ');

  const profBonus = calculateProficiencyBonus(level);

  const equippedBonuses = React.useMemo(
    () => (character?.inventory ? calculateEquippedItemStatBonuses(character.inventory) : null),
    [character?.inventory]
  );

  const ac = character
    ? (character.armorClass ?? 10) + (equippedBonuses?.ac ?? 0)
    : member?.ac ?? 10;
  const speed = character
    ? (character.speed ?? 30) + (equippedBonuses?.speed ?? 0)
    : member?.speed ?? 30;

  // Total Ability Scores & Modifiers (FUE, DES, CON, INT, SAB, CAR)
  const resolvedAbilities = React.useMemo(
    () => resolveTarotCardAbilityScores(character, member),
    [character, member]
  );

  const strScore = resolvedAbilities.str.totalScore;
  const dexScore = resolvedAbilities.dex.totalScore;
  const conScore = resolvedAbilities.con.totalScore;
  const intScore = resolvedAbilities.int.totalScore;
  const wisScore = resolvedAbilities.wis.totalScore;
  const chaScore = resolvedAbilities.cha.totalScore;

  const dexMod = resolvedAbilities.dex.modifier;

  const pp = character
    ? calculatePassivePerception(
        wisScore,
        character.skills.perception,
        profBonus
      )
    : member?.passivePerception ?? 10;

  const baseInit = character
    ? (typeof character.initiative === 'number'
        ? character.initiative
        : dexMod)
    : (typeof member?.initiative === 'number'
        ? member.initiative
        : dexMod);
  const initiative = baseInit + (equippedBonuses?.initiative ?? 0);

  const currentHp = character?.currentHp ?? member?.currentHp ?? 10;
  const baseMaxHp = Math.max(1, character?.maxHp ?? member?.maxHp ?? 10);
  const maxHp = baseMaxHp + (equippedBonuses?.maxHp ?? 0);
  const hpPercent = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));

  const currency = character?.currency ||
    member?.currency || {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0,
    };

  const avatarType = character?.avatarType || member?.avatarType;
  const avatarCustomUrl =
    character?.avatarCustomUrl ||
    character?.avatarUrl ||
    member?.avatarCustomUrl ||
    member?.avatarUrl;
  const avatarIcon = character?.avatarIcon || member?.avatarIcon;

  const activePlayerSkinId =
    character?.playerSkinId || member?.playerSkinId || 'skin-player-default';

  const [, setSkinCacheTick] = useState(0);
  useEffect(() => {
    fetchTarotSkinCatalogOnce();
    const listener = () => setSkinCacheTick((t) => t + 1);
    skinCacheListeners.add(listener);
    return () => {
      skinCacheListeners.delete(listener);
    };
  }, []);

  const effectiveSkinTokens =
    skinTokens ||
    member?.skinTokens ||
    cachedPlayerSkinsMap[activePlayerSkinId] ||
    (activePlayerSkinId === 'skin-player-default'
      ? cachedPlayerSkinsMap['__online_default__']
      : undefined);

  const tarotCfg = React.useMemo(
    () => resolveTarotStudioConfig(effectiveSkinTokens),
    [effectiveSkinTokens]
  );

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const activeSide: 'front' | 'back' = forcedSide || (isFlipped ? 'back' : 'front');

  const skinVisuals = React.useMemo(() => {
    if (activePlayerSkinId === 'skin-player-crimson-dragon') {
      return {
        cardBg: 'from-[#321216] via-[#210d11] to-[#14080a]',
        border: 'border-red-500/90 ring-red-400/30',
        titleColor: 'text-amber-300',
        badgeText: 'Escamas Carmesí',
        badgeClasses: 'bg-red-950/90 border-red-400/70 text-red-200',
      };
    }
    if (activePlayerSkinId === 'skin-player-frost-2026') {
      return {
        cardBg: 'from-[#0d2238] via-[#091829] to-[#06101c]',
        border: 'border-cyan-400/90 ring-cyan-300/35',
        titleColor: 'text-cyan-200',
        badgeText: 'Escarcha Invernal 2026',
        badgeClasses: 'bg-cyan-950/90 border-cyan-400/70 text-cyan-200',
      };
    }
    if (activePlayerSkinId && activePlayerSkinId !== 'skin-player-default') {
      return {
        cardBg: 'from-[#231934] via-[#181226] to-[#110c1c]',
        border: 'border-purple-400/90 ring-purple-300/30',
        titleColor: 'text-purple-200',
        badgeText: 'Skin de Héroe',
        badgeClasses: 'bg-purple-950/90 border-purple-400/70 text-purple-200',
      };
    }
    return {
      cardBg: 'from-[#1f2533] via-[#1a1f2c] to-[#141822]',
      border: 'border-[#c8a45c] ring-[#e2c275]/25',
      titleColor: 'text-[#e5c478]',
      badgeText: null,
      badgeClasses: '',
    };
  }, [activePlayerSkinId]);

  const handleToggleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (forcedSide) return;
    soundManager.playCardFlip(effectiveSkinTokens?.sheetAudioProfile);
    setIsFlipped((prev) => !prev);
  };

  const abilityItems = [
    { abbr: 'FUE', label: 'Fuerza', score: strScore, mod: resolvedAbilities.str.modifier },
    { abbr: 'DES', label: 'Destreza', score: dexScore, mod: resolvedAbilities.dex.modifier },
    { abbr: 'CON', label: 'Constitución', score: conScore, mod: resolvedAbilities.con.modifier },
    { abbr: 'INT', label: 'Inteligencia', score: intScore, mod: resolvedAbilities.int.modifier },
    { abbr: 'SAB', label: 'Sabiduría', score: wisScore, mod: resolvedAbilities.wis.modifier },
    { abbr: 'CAR', label: 'Carisma', score: chaScore, mod: resolvedAbilities.cha.modifier },
  ] as const;

  const showHpOnThisSide =
    tarotCfg.hpPlacement === 'both' ||
    tarotCfg.hpPlacement === activeSide ||
    isTarotElementVisibleOnSide('hpBar', activeSide, tarotCfg.elementSides);

  const showStatsGridOnThisSide =
    (tarotCfg.statsPlacement === 'both' ||
      (tarotCfg.statsPlacement === 'front_grid' && activeSide === 'front') ||
      (tarotCfg.statsPlacement === 'back_grid' && activeSide === 'back')) &&
    isTarotElementVisibleOnSide('abilityStats', activeSide, tarotCfg.elementSides);

  const showEdgeStats =
    (tarotCfg.statsPlacement === 'card_edges' || tarotCfg.statsPlacement === 'floating_corners') &&
    isTarotElementVisibleOnSide('abilityStats', activeSide, tarotCfg.elementSides);

  // Render Animated Border Preset or Custom GIF Overlay
  const renderAnimatedBorderOverlays = () => (
    <>
      {tarotCfg.animatedBorderGifUrl && (
        <img
          src={tarotCfg.animatedBorderGifUrl}
          alt="Animated Tarot Border"
          data-testid="tarot-animated-border-gif"
          className="pointer-events-none absolute inset-0 w-full h-full object-fill z-20 rounded-2xl"
        />
      )}
      {tarotCfg.borderEffectPreset && tarotCfg.borderEffectPreset !== 'none' && (
        <div
          data-testid={`tarot-border-preset-${tarotCfg.borderEffectPreset}`}
          className="pointer-events-none absolute inset-0 rounded-2xl z-20 flex flex-col justify-between p-1.5 opacity-85"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span>
              {tarotCfg.borderEffectPreset === 'fire_embers' && '🔥'}
              {tarotCfg.borderEffectPreset === 'frost_crystals' && '❄️'}
              {tarotCfg.borderEffectPreset === 'steampunk_gears' && '⚙️'}
              {tarotCfg.borderEffectPreset === 'necrotic_skulls' && '💀'}
              {tarotCfg.borderEffectPreset === 'celestial_runes' && '✨'}
            </span>
            <span>
              {tarotCfg.borderEffectPreset === 'fire_embers' && '🔥'}
              {tarotCfg.borderEffectPreset === 'frost_crystals' && '❄️'}
              {tarotCfg.borderEffectPreset === 'steampunk_gears' && '⚙️'}
              {tarotCfg.borderEffectPreset === 'necrotic_skulls' && '💀'}
              {tarotCfg.borderEffectPreset === 'celestial_runes' && '✨'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span>
              {tarotCfg.borderEffectPreset === 'fire_embers' && '🔥'}
              {tarotCfg.borderEffectPreset === 'frost_crystals' && '❄️'}
              {tarotCfg.borderEffectPreset === 'steampunk_gears' && '⚙️'}
              {tarotCfg.borderEffectPreset === 'necrotic_skulls' && '💀'}
              {tarotCfg.borderEffectPreset === 'celestial_runes' && '✨'}
            </span>
            <span>
              {tarotCfg.borderEffectPreset === 'fire_embers' && '🔥'}
              {tarotCfg.borderEffectPreset === 'frost_crystals' && '❄️'}
              {tarotCfg.borderEffectPreset === 'steampunk_gears' && '⚙️'}
              {tarotCfg.borderEffectPreset === 'necrotic_skulls' && '💀'}
              {tarotCfg.borderEffectPreset === 'celestial_runes' && '✨'}
            </span>
          </div>
        </div>
      )}
      {tarotCfg.hpPlacement === 'border' && (
        <div
          data-testid="tarot-hp-border-frame"
          className="pointer-events-none absolute inset-0 rounded-2xl z-20 border-4 transition-all"
          style={{
            borderColor:
              hpPercent > 50 ? '#10b981' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
            clipPath: `inset(${100 - hpPercent}% 0 0 0)`,
          }}
        />
      )}
      {(tarotCfg.customStickers || [])
        .filter((st) => st.side === activeSide)
        .map((st) => (
          <img
            key={st.id}
            src={st.url}
            alt="Sticker"
            style={{
              left: `${st.xPercent}%`,
              top: `${st.yPercent}%`,
              width: `${st.widthPx}px`,
              height: `${st.heightPx}px`,
              opacity: st.opacity ?? 1,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 object-contain z-30"
          />
        ))}
    </>
  );

  // Render Edge / Floating Corner Ability Stats if selected
  const renderEdgeAbilityStats = () => {
    if (!showEdgeStats) return null;
    return (
      <div
        data-testid="tarot-edge-stats-overlay"
        className="pointer-events-auto absolute inset-y-12 inset-x-1 z-30 flex justify-between items-center pointer-events-none"
      >
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {abilityItems.slice(0, 3).map((st) => {
            const modFormatted = formatModifier(st.mod);
            return (
              <div
                key={`edge-${st.abbr}`}
                data-testid={`tarot-stat-${st.abbr.toLowerCase()}`}
                title={`${st.label}: ${st.score} (Bono ${modFormatted})`}
                className="group relative cursor-help px-1.5 py-0.5 rounded-lg bg-[#0d1018]/95 border border-[#c8a45c] text-center shadow-lg"
              >
                <div
                  data-testid={`tarot-stat-tooltip-${st.abbr.toLowerCase()}`}
                  className="pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 absolute -top-6 left-1/2 -translate-x-1/2 z-50 px-1.5 py-0.5 rounded bg-black border border-[#e2c275] text-[#f5e4be] font-mono font-black text-[10px] whitespace-nowrap"
                >
                  {modFormatted}
                </div>
                <div className="text-[7px] font-cinzel font-bold text-[#d8ba73]">{st.abbr}</div>
                <div className="text-[11px] font-cinzel font-black text-white leading-none">{st.score}</div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {abilityItems.slice(3, 6).map((st) => {
            const modFormatted = formatModifier(st.mod);
            return (
              <div
                key={`edge-${st.abbr}`}
                data-testid={`tarot-stat-${st.abbr.toLowerCase()}`}
                title={`${st.label}: ${st.score} (Bono ${modFormatted})`}
                className="group relative cursor-help px-1.5 py-0.5 rounded-lg bg-[#0d1018]/95 border border-[#c8a45c] text-center shadow-lg"
              >
                <div
                  data-testid={`tarot-stat-tooltip-${st.abbr.toLowerCase()}`}
                  className="pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 absolute -top-6 left-1/2 -translate-x-1/2 z-50 px-1.5 py-0.5 rounded bg-black border border-[#e2c275] text-[#f5e4be] font-mono font-black text-[10px] whitespace-nowrap"
                >
                  {modFormatted}
                </div>
                <div className="text-[7px] font-cinzel font-bold text-[#d8ba73]">{st.abbr}</div>
                <div className="text-[11px] font-cinzel font-black text-white leading-none">{st.score}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const defaultTarotMods = React.useMemo(() => {
    const map: Record<string, TarotCardModuleItem> = {};
    for (const m of createDefaultTarotModules()) {
      map[m.id] = m;
    }
    return map;
  }, []);

  const currentTarotModsMap = React.useMemo(() => {
    const map: Record<string, TarotCardModuleItem> = {};
    for (const m of tarotCfg.modules || []) {
      map[m.id] = m;
    }
    return map;
  }, [tarotCfg.modules]);

  const getTarotModOffsetStyle = (modId: string): React.CSSProperties => {
    const cur = currentTarotModsMap[modId];
    const def = defaultTarotMods[modId];
    if (!cur) return {};
    if (cur.visible === false || cur.opacity <= 0.01) {
      return { display: 'none' };
    }
    const scaleFactor = isMini ? 0.55 : compact ? 0.78 : 1;
    const dx = def ? (cur.x - def.x) * scaleFactor : 0;
    const dy = def ? (cur.y - def.y) * scaleFactor : 0;
    return {
      position: 'relative',
      opacity: cur.opacity,
      transform: dx !== 0 || dy !== 0 ? `translate(${Math.round(dx)}px, ${Math.round(dy)}px)` : undefined,
      color: cur.textColor || undefined,
      fontFamily: cur.fontFamily || undefined,
    };
  };

  const renderLiveModuleBadge = (mod: TarotCardModuleItem) => {
    if (mod.visible === false || mod.opacity <= 0.01) return null;
    let displayVal = mod.exampleValue || '';
    if (mod.kind === 'hp_bar') displayVal = `${currentHp}/${maxHp}`;
    else if (mod.kind === 'stat_ca') displayVal = `${ac}`;
    else if (mod.kind === 'stat_init') displayVal = formatModifier(initiative);
    else if (mod.kind === 'stat_speed') displayVal = `${speed}ft`;
    else if (mod.kind === 'stat_pp') displayVal = `${pp}`;
    else if (mod.kind === 'coin_gp') displayVal = `${currency.gp || 0} PO`;
    else if (mod.kind === 'coin_sp') displayVal = `${currency.sp || 0} PP`;
    else if (mod.kind === 'coin_cp') displayVal = `${currency.cp || 0} PC`;
    else if (mod.kind === 'coin_pp') displayVal = `${currency.pp || 0} PL`;
    else if (mod.kind === 'alignment_badge') displayVal = alignment;
    else if (mod.kind === 'character_name') displayVal = name;
    else if (mod.kind === 'race_class') displayVal = raceAndClass;
    else if (mod.kind === 'level_xp_badge') displayVal = `Niv. ${level}`;
    else if (mod.kind === 'ability_str') displayVal = `${strScore}`;
    else if (mod.kind === 'ability_dex') displayVal = `${dexScore}`;
    else if (mod.kind === 'ability_con') displayVal = `${conScore}`;
    else if (mod.kind === 'ability_int') displayVal = `${intScore}`;
    else if (mod.kind === 'ability_wis') displayVal = `${wisScore}`;
    else if (mod.kind === 'ability_cha') displayVal = `${chaScore}`;

    return (
      <div
        key={mod.id}
        data-testid={`tarot-custom-mod-${mod.id}`}
        style={{
          backgroundColor: mod.bgColor || '#11141d',
          borderColor: mod.hideBorder ? 'transparent' : mod.borderColor || '#c8a45c',
          borderWidth: mod.hideBorder ? 0 : `${mod.borderWidthPx ?? 1}px`,
          borderStyle: mod.hideBorder ? 'none' : 'solid',
          borderRadius: mod.shape === 'circle' ? '9999px' : mod.shape === 'square' ? '0px' : `${mod.borderRadiusPx ?? 8}px`,
          color: mod.textColor || '#f5e4be',
          opacity: mod.opacity ?? 1,
        }}
        className="px-2 py-1 text-[10px] font-cinzel font-bold flex items-center justify-between gap-1.5 shadow"
      >
        {mod.label && <span className="text-[8px] opacity-80 uppercase">{mod.label}</span>}
        <span className="font-mono font-black">{displayVal}</span>
      </div>
    );
  };

  const extraSideModules = (tarotCfg.modules || []).filter(
    (m) => m.side === activeSide && !defaultTarotMods[m.id] && m.visible !== false
  );

  if (activeSide === 'back') {
    const backBgImg =
      tarotCfg.backBgImageUrl || effectiveSkinTokens?.tarotCardBackCustomPngUrl;
    return (
      <div
        data-testid={dataTestId || testId || `character-tarot-card-${charId}`}
        data-player-skin={activePlayerSkinId}
        data-tarot-side="back"
        onClick={handleToggleFlip}
        style={{
          borderColor: tarotCfg.borderColor || effectiveSkinTokens?.tarotBorderColor || '#c8a45c',
          boxShadow:
            tarotCfg.glowColor || effectiveSkinTokens?.tarotGlowColor
              ? `0 0 28px ${tarotCfg.glowColor || effectiveSkinTokens?.tarotGlowColor}`
              : undefined,
          backgroundColor: tarotCfg.backBgColor || undefined,
          backgroundImage: backBgImg ? `url(${backBgImg})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className={`relative rounded-2xl bg-gradient-to-b from-[#1a1326] via-[#120e1c] to-[#0b0912] border-2 ${skinVisuals.border} ring-1 ring-inset shadow-[0_12px_35px_rgba(0,0,0,0.85)] ${
          isMini
            ? 'p-2.5 min-h-[245px]'
            : compact
            ? 'p-3.5 min-h-[320px]'
            : 'p-4 sm:p-5 min-h-[420px]'
        } flex flex-col justify-between text-[#f5e4be] select-none overflow-hidden cursor-pointer transition-all duration-500 ${className}`}
      >
        {renderAnimatedBorderOverlays()}
        {renderEdgeAbilityStats()}

        <div className="flex items-center justify-between z-30">
          <span className="px-2 py-0.5 rounded bg-black/65 border border-amber-500/40 text-[9px] font-cinzel font-bold text-amber-300 uppercase">
            Reverso • {name}
          </span>
          {!forcedSide && (
            <button
              type="button"
              onClick={handleToggleFlip}
              className="px-2 py-0.5 rounded-lg bg-black/75 border border-amber-500/60 text-amber-200 font-cinzel font-bold text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Anverso</span>
            </button>
          )}
        </div>

        <div className="my-auto space-y-3 py-2 z-20">
          {/* Central emblem if no back custom image */}
          {!backBgImg && (
            <div className="p-3 rounded-2xl border border-amber-500/35 bg-black/45 flex flex-col items-center justify-center text-center space-y-1.5">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400/70 flex items-center justify-center text-lg shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                ✦
              </div>
              <span className="font-cinzel font-black text-xs sm:text-sm text-amber-300 uppercase tracking-widest">
                {name}
              </span>
              <span className="text-[10px] text-stone-300">{raceAndClass}</span>
            </div>
          )}

          {/* Back Side HP Meter (e.g. Alchemical Potion or Clockwork Gears!) */}
          {showHpOnThisSide && (
            <TarotStyledHpMeter
              styleVariant={tarotCfg.backHpStyle || 'alchemical_potion'}
              currentHp={currentHp}
              maxHp={maxHp}
              hpPercent={hpPercent}
              isMini={isMini}
              customPngUrl={tarotCfg.backHpCustomPngUrl}
            />
          )}

          {/* Optional Back Side Combat Stats */}
          {isTarotElementVisibleOnSide('combatStats', 'back', tarotCfg.elementSides) && (
            <div className="grid grid-cols-4 gap-1.5 text-center bg-black/55 p-1.5 rounded-xl border border-[#c8a45c]/40">
              <div>
                <div className="text-[8px] font-cinzel text-amber-300">CA</div>
                <div className="font-cinzel font-black text-xs text-white">{ac}</div>
              </div>
              <div>
                <div className="text-[8px] font-cinzel text-amber-300">INIC</div>
                <div className="font-cinzel font-black text-xs text-white">
                  {formatModifier(initiative)}
                </div>
              </div>
              <div>
                <div className="text-[8px] font-cinzel text-amber-300">VEL</div>
                <div className="font-cinzel font-black text-xs text-white">{speed}ft</div>
              </div>
              <div>
                <div className="text-[8px] font-cinzel text-amber-300">PP</div>
                <div className="font-cinzel font-black text-xs text-white">{pp}</div>
              </div>
            </div>
          )}

          {/* Optional Back Side Ability Stats Grid */}
          {showStatsGridOnThisSide && (
            <div className="grid grid-cols-3 gap-1.5">
              {abilityItems.map((st) => {
                const modFormatted = formatModifier(st.mod);
                return (
                  <div
                    key={`back-st-${st.abbr}`}
                    data-testid={`tarot-stat-${st.abbr.toLowerCase()}`}
                    title={`${st.label}: ${st.score} (Bono ${modFormatted})`}
                    className="group relative cursor-help rounded-lg py-1 px-1.5 bg-black/70 border border-[#c8a45c]/65 flex flex-col items-center justify-center"
                  >
                    <div
                      data-testid={`tarot-stat-tooltip-${st.abbr.toLowerCase()}`}
                      className="pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 absolute -top-6 left-1/2 -translate-x-1/2 z-40 px-1.5 py-0.5 rounded bg-[#0e1017] border border-[#e2c275] text-[#f5e4be] font-mono font-black text-[10px]"
                    >
                      {modFormatted}
                    </div>
                    <span className="text-[8px] font-cinzel font-bold text-[#d8ba73]">
                      {st.abbr}
                    </span>
                    <span className="font-cinzel font-black text-xs text-white">{st.score}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional Lore / Quote on Back */}
          {isTarotElementVisibleOnSide('loreQuote', 'back', tarotCfg.elementSides) &&
            (character?.appearance || character?.backstory || tarotCfg.backLoreQuoteText) && (
              <p
                style={getTarotModOffsetStyle('mod_lore_quote')}
                className="text-[10px] italic text-amber-100/80 text-center line-clamp-3 bg-black/45 p-2 rounded-xl border border-white/10"
              >
                “{character?.appearance || character?.backstory || tarotCfg.backLoreQuoteText}”
              </p>
            )}

          {extraSideModules.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {extraSideModules.map((mod) => renderLiveModuleBadge(mod))}
            </div>
          )}
        </div>

        <div className="text-center text-[9px] font-mono text-stone-400 z-20">
          Reverso Tarot Arcano
        </div>
      </div>
    );
  }

  const portraitGeom = buildGeometricElementStyle({
    shape: tarotCfg.artworkShape || effectiveSkinTokens?.portraitGeometricShape || 'circle',
    hideBorder: tarotCfg.artworkHideBorder ?? effectiveSkinTokens?.portraitHideBorder,
    edgeFadePercent:
      tarotCfg.artworkEdgeFadePercent ?? effectiveSkinTokens?.portraitEdgeFadePercent ?? 0,
  });
  const popoutScale = Math.max(0.7, Math.min(1.65, Number(tarotCfg.artworkPopoutScale) || 1));

  return (
    <div
      data-testid={dataTestId || testId || `character-tarot-card-${charId}`}
      data-player-skin={activePlayerSkinId}
      data-tarot-side="front"
      style={{
        borderColor: tarotCfg.borderColor || effectiveSkinTokens?.tarotBorderColor || undefined,
        boxShadow:
          tarotCfg.glowColor || effectiveSkinTokens?.tarotGlowColor
            ? `0 0 25px ${tarotCfg.glowColor || effectiveSkinTokens?.tarotGlowColor}`
            : undefined,
        backgroundColor: tarotCfg.frontBgColor || undefined,
        backgroundImage: tarotCfg.frontBgImageUrl
          ? `url(${tarotCfg.frontBgImageUrl})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className={`relative rounded-2xl bg-gradient-to-b ${skinVisuals.cardBg} border-2 ${skinVisuals.border} ring-1 ring-inset shadow-[0_12px_35px_rgba(0,0,0,0.85)] ${
        isMini
          ? 'p-2.5 space-y-1.5'
          : compact
          ? 'p-3.5 space-y-2.5'
          : 'p-4 sm:p-5 space-y-3.5'
      } flex flex-col justify-between text-[#f5e4be] select-none ${
        tarotCfg.artworkOverflowCinema ? 'overflow-visible' : 'overflow-hidden'
      } transition-all duration-300 ${className}`}
    >
      {/* Optional Custom Frame PNG and Holo Overlay PNG */}
      {(tarotCfg.frontCustomFramePngUrl || effectiveSkinTokens?.tarotCardCustomFramePngUrl) && (
        <img
          src={tarotCfg.frontCustomFramePngUrl || effectiveSkinTokens?.tarotCardCustomFramePngUrl}
          alt="Tarot Frame"
          className="pointer-events-none absolute inset-0 w-full h-full object-fill z-20 rounded-2xl"
        />
      )}
      {effectiveSkinTokens?.tarotCardCustomOverlayPngUrl && (
        <img
          src={effectiveSkinTokens.tarotCardCustomOverlayPngUrl}
          alt="Tarot Overlay"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen z-10 rounded-2xl"
        />
      )}
      {effectiveSkinTokens?.tarotParticleEffect &&
        effectiveSkinTokens.tarotParticleEffect !== 'none' && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-[10px] opacity-75 z-20">
            {effectiveSkinTokens.tarotParticleEffect === 'embers' && '🔥 ✨ 🔥'}
            {effectiveSkinTokens.tarotParticleEffect === 'snow' && '❄️ ❅ ❄️'}
            {effectiveSkinTokens.tarotParticleEffect === 'arcane_sparkles' && '✨ 🔮 ✨'}
            {effectiveSkinTokens.tarotParticleEffect === 'golden_dust' && '🌟 ✨ 🌟'}
          </div>
        )}
      {renderAnimatedBorderOverlays()}
      {renderEdgeAbilityStats()}

      {/* Top-Left Active Player Skin Badge & 3D Flip Button */}
      <div
        className={`absolute ${
          isMini ? 'top-2 left-2.5' : 'top-3.5 left-4'
        } flex items-center gap-1 z-30`}
      >
        {skinVisuals.badgeText && (
          <div
            className={`px-1.5 py-0.5 rounded-md border ${
              isMini ? 'text-[8px]' : 'text-[9px]'
            } font-cinzel font-bold uppercase tracking-wider shadow ${skinVisuals.badgeClasses}`}
          >
            ✨ {skinVisuals.badgeText}
          </div>
        )}
        {!forcedSide && (
          <button
            type="button"
            onClick={handleToggleFlip}
            title="Voltear Carta Tarot 3D"
            className="p-1 rounded-md bg-black/50 hover:bg-black/80 border border-[#c8a45c]/50 text-[#e5c478] transition cursor-pointer"
          >
            <RotateCw className={isMini ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          </button>
        )}
      </div>

      {/* Top-Right Online Status Pill + Map Mode Last Die Roll Badge */}
      {(isOnline || showLastRollInMap) && (
        <div
          style={getTarotModOffsetStyle('mod_online_badge')}
          className={`absolute ${
            isMini ? 'top-2 right-2.5 gap-1' : 'top-3.5 right-4 gap-1.5'
          } flex flex-col items-end z-30`}
        >
          {isOnline && (
            <div
              className={`flex items-center gap-1 text-emerald-400 ${
                isMini ? 'text-[9px]' : 'text-xs'
              } font-semibold`}
            >
              <span
                className={`${
                  isMini ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5'
                } rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]`}
              />
              <span>En Línea</span>
            </div>
          )}
          {showLastRollInMap && (
            <MapLastRollDieBadge roll={resolvedLastRoll} size={isMini ? 'xs' : 'sm'} />
          )}
        </div>
      )}

      {/* 1. Geometric / Cinema Pop-Out Portrait + Overlapping Level & XP Ribbon */}
      {isTarotElementVisibleOnSide('identity', 'front', tarotCfg.elementSides) && (
        <div style={getTarotModOffsetStyle('mod_portrait')} className="flex flex-col items-center pt-0.5">
          <div
            style={{
              ...portraitGeom,
              transform:
                popoutScale !== 1 || tarotCfg.artworkOffsetX || tarotCfg.artworkOffsetY
                  ? `translate(${tarotCfg.artworkOffsetX || 0}px, ${
                      tarotCfg.artworkOffsetY || 0
                    }px) scale(${popoutScale})`
                  : undefined,
            }}
            className={`relative ${
              isMini
                ? 'w-14 h-14'
                : compact
                ? 'w-20 h-20'
                : 'w-24 h-24 sm:w-28 sm:h-28'
            } ${
              tarotCfg.artworkHideBorder
                ? ''
                : 'p-0.5 bg-gradient-to-b from-[#e6c77c] via-[#b89146] to-[#785920] shadow-[0_6px_20px_rgba(0,0,0,0.85)]'
            } ${tarotCfg.artworkOverflowCinema ? 'z-30' : ''}`}
          >
            <GeometricSvgBorder
              shape={
                tarotCfg.artworkShape ||
                effectiveSkinTokens?.portraitGeometricShape ||
                'circle'
              }
              borderColor={tarotCfg.borderColor || '#c8a45c'}
              borderWidthPx={2}
              hideBorder={
                tarotCfg.artworkHideBorder ??
                effectiveSkinTokens?.portraitHideBorder
              }
            />
            <EntityAvatar
              avatarType={avatarType}
              customUrl={avatarCustomUrl}
              iconId={avatarIcon}
              category="player"
              size={isMini ? 'md' : 'lg'}
              className="w-full h-full object-cover bg-[#131722]"
            />
          </div>

          {/* Overlapping Ribbon Banner: Niv. X • Y XP */}
          <div
            style={getTarotModOffsetStyle('mod_level_xp')}
            className={`relative ${
              isMini ? '-mt-2.5' : '-mt-3.5'
            } z-30 flex items-center justify-center`}
          >
            {/* Left Ribbon Tail */}
            <svg
              viewBox="0 0 18 24"
              className={`${
                isMini ? 'w-3 h-4' : 'w-4 h-5'
              } -mr-1 text-[#9e7c3c] fill-[#171b26] stroke-current`}
              strokeWidth="2"
            >
              <polygon points="18,2 2,2 8,12 2,22 18,22" />
            </svg>
            <div
              className={`${
                isMini
                  ? 'px-2.5 py-0.5 text-[10px]'
                  : 'px-3.5 py-0.5 text-xs sm:text-sm'
              } rounded bg-gradient-to-b from-[#232938] to-[#171b26] border border-[#c8a45c] shadow-md font-sans font-bold text-[#f3e3c3] tracking-wide whitespace-nowrap`}
            >
              Niv. {level} • {experience} XP
            </div>
            {/* Right Ribbon Tail */}
            <svg
              viewBox="0 0 18 24"
              className={`${
                isMini ? 'w-3 h-4' : 'w-4 h-5'
              } -ml-1 text-[#9e7c3c] fill-[#171b26] stroke-current`}
              strokeWidth="2"
            >
              <polygon points="0,2 16,2 10,12 16,22 0,22" />
            </svg>
          </div>
        </div>
      )}

      {/* 2. Character Name + Alignment Badge + Race • Class */}
      {isTarotElementVisibleOnSide('identity', 'front', tarotCfg.elementSides) && (
        <div style={getTarotModOffsetStyle('mod_char_name')} className="text-center space-y-0.5 px-1">
          <div className="flex items-center justify-center gap-1.5 flex-nowrap max-w-full">
            <h3
              style={{
                color:
                  currentTarotModsMap['mod_char_name']?.textColor ||
                  tarotCfg.titleColor ||
                  undefined,
              }}
              className={`font-cinzel font-black ${
                isMini
                  ? 'text-xs sm:text-sm'
                  : compact
                  ? 'text-sm sm:text-base'
                  : 'text-base sm:text-lg'
              } ${skinVisuals.titleColor} uppercase tracking-wider leading-tight truncate`}
              title={name}
            >
              {name}
            </h3>
            {isTarotElementVisibleOnSide('alignment', 'front', tarotCfg.elementSides) && (
              <div style={getTarotModOffsetStyle('mod_alignment')}>
                <AlignmentBadgeIcon
                  alignment={alignment}
                  size={isMini ? 'xs' : 'sm'}
                  customIconUrl={effectiveSkinTokens?.alignmentCustomIcons?.[alignment]}
                />
              </div>
            )}
          </div>
          <div
            style={{
              ...getTarotModOffsetStyle('mod_race_class'),
              color:
                currentTarotModsMap['mod_race_class']?.textColor ||
                tarotCfg.subtitleColor ||
                undefined,
            }}
            className={`${
              isMini ? 'text-[10px]' : 'text-xs sm:text-sm'
            } text-[#9aa3b5] font-medium tracking-wide truncate`}
          >
            {raceAndClass}
          </div>
        </div>
      )}

      {/* 3. 4-Box Combat Stat Row: CA | INIC | VEL | PP */}
      {isTarotElementVisibleOnSide('combatStats', 'front', tarotCfg.elementSides) && (
        <div className={`grid grid-cols-4 ${isMini ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
          {/* CA */}
          <div
            style={{
              ...getTarotModOffsetStyle('mod_stat_ca'),
              backgroundColor: currentTarotModsMap['mod_stat_ca']?.bgColor || undefined,
              borderColor: currentTarotModsMap['mod_stat_ca']?.borderColor || undefined,
            }}
            className={`${
              isMini ? 'rounded-lg py-1 px-0.5' : 'rounded-xl py-1.5 px-1'
            } bg-[#11141d] border border-[#c8a45c]/70 flex flex-col items-center justify-center shadow-inner`}
          >
            <div
              className={`flex items-center gap-0.5 ${
                isMini ? 'text-[8px]' : 'text-[10px] sm:text-[11px]'
              } font-cinzel font-bold text-[#cbb692] uppercase`}
            >
              <Shield className={isMini ? 'w-2.5 h-2.5 text-[#d6b265]' : 'w-3 h-3 text-[#d6b265]'} />
              <span>{currentTarotModsMap['mod_stat_ca']?.label || 'CA'}</span>
            </div>
            <span
              className={`font-cinzel font-black ${
                isMini ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
              } text-white leading-tight`}
            >
              {ac}
            </span>
          </div>

          {/* INIC */}
          <div
            style={{
              ...getTarotModOffsetStyle('mod_stat_init'),
              backgroundColor: currentTarotModsMap['mod_stat_init']?.bgColor || undefined,
              borderColor: currentTarotModsMap['mod_stat_init']?.borderColor || undefined,
            }}
            className={`${
              isMini ? 'rounded-lg py-1 px-0.5' : 'rounded-xl py-1.5 px-1'
            } bg-[#11141d] border border-[#c8a45c]/70 flex flex-col items-center justify-center shadow-inner`}
          >
            <div
              className={`flex items-center gap-0.5 ${
                isMini ? 'text-[8px]' : 'text-[10px] sm:text-[11px]'
              } font-cinzel font-bold text-[#cbb692] uppercase`}
            >
              <Zap className={isMini ? 'w-2.5 h-2.5 text-[#d6b265]' : 'w-3 h-3 text-[#d6b265]'} />
              <span>{currentTarotModsMap['mod_stat_init']?.label || 'INIC'}</span>
            </div>
            <span
              className={`font-cinzel font-black ${
                isMini ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
              } text-white leading-tight`}
            >
              {formatModifier(initiative)}
            </span>
          </div>

          {/* VEL */}
          <div
            style={{
              ...getTarotModOffsetStyle('mod_stat_speed'),
              backgroundColor: currentTarotModsMap['mod_stat_speed']?.bgColor || undefined,
              borderColor: currentTarotModsMap['mod_stat_speed']?.borderColor || undefined,
            }}
            className={`${
              isMini ? 'rounded-lg py-1 px-0.5' : 'rounded-xl py-1.5 px-1'
            } bg-[#11141d] border border-[#c8a45c]/70 flex flex-col items-center justify-center shadow-inner`}
          >
            <div
              className={`flex items-center gap-0.5 ${
                isMini ? 'text-[8px]' : 'text-[10px] sm:text-[11px]'
              } font-cinzel font-bold text-[#cbb692] uppercase`}
            >
              <span className={`text-[#d6b265] ${isMini ? 'text-[8px]' : 'text-[10px]'}`}>🦶</span>
              <span>{currentTarotModsMap['mod_stat_speed']?.label || 'VEL'}</span>
            </div>
            <span
              className={`font-cinzel font-black ${
                isMini ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
              } text-white leading-tight`}
            >
              {speed}{' '}
              <small className={`${isMini ? 'text-[8px]' : 'text-[10px]'} font-normal text-[#cbb692]`}>
                FT
              </small>
            </span>
          </div>

          {/* PP */}
          <div
            style={{
              ...getTarotModOffsetStyle('mod_stat_pp'),
              backgroundColor: currentTarotModsMap['mod_stat_pp']?.bgColor || undefined,
              borderColor: currentTarotModsMap['mod_stat_pp']?.borderColor || undefined,
            }}
            className={`${
              isMini ? 'rounded-lg py-1 px-0.5' : 'rounded-xl py-1.5 px-1'
            } bg-[#11141d] border border-[#c8a45c]/70 flex flex-col items-center justify-center shadow-inner`}
          >
            <div
              className={`flex items-center gap-0.5 ${
                isMini ? 'text-[8px]' : 'text-[10px] sm:text-[11px]'
              } font-cinzel font-bold text-[#cbb692] uppercase`}
            >
              <Eye className={isMini ? 'w-2.5 h-2.5 text-[#d6b265]' : 'w-3 h-3 text-[#d6b265]'} />
              <span>{currentTarotModsMap['mod_stat_pp']?.label || 'PP'}</span>
            </div>
            <span
              className={`font-cinzel font-black ${
                isMini ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
              } text-white leading-tight`}
            >
              {pp}
            </span>
          </div>
        </div>
      )}

      {/* 4. Customizable Front Health Meter (Bar, Square, Points, Gears, Potion, Hearts) + DM Controls */}
      {showHpOnThisSide && (
        <div style={getTarotModOffsetStyle('mod_hp_bar')} className="space-y-1">
          <TarotStyledHpMeter
            styleVariant={tarotCfg.frontHpStyle || 'classic_bar'}
            currentHp={currentHp}
            maxHp={maxHp}
            hpPercent={hpPercent}
            isMini={isMini}
            customPngUrl={tarotCfg.frontHpCustomPngUrl}
          />

          {/* DM-only HP Heal / Damage Controls */}
          {showDmControls && onDmAdjustPlayer && (
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                data-testid={`dm-heal-player-${charId}`}
                onClick={() => onDmAdjustPlayer(charId, { hpDelta: 1 })}
                className={`${
                  isMini ? 'py-0.5 px-1.5 text-[9px]' : 'py-1 px-2 text-[10px]'
                } rounded-lg bg-emerald-950/90 hover:bg-emerald-800 border border-emerald-500/60 text-emerald-200 font-cinzel font-bold flex items-center justify-center gap-1 transition cursor-pointer`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Salud (+1)</span>
              </button>
              <button
                type="button"
                data-testid={`dm-damage-player-${charId}`}
                onClick={() => onDmAdjustPlayer(charId, { hpDelta: -1 })}
                className={`${
                  isMini ? 'py-0.5 px-1.5 text-[9px]' : 'py-1 px-2 text-[10px]'
                } rounded-lg bg-red-950/90 hover:bg-red-800 border border-red-500/60 text-red-200 font-cinzel font-bold flex items-center justify-center gap-1 transition cursor-pointer`}
              >
                <Minus className="w-2.5 h-2.5" />
                <span>Daño (-1)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. 3x2 Total Ability Scores Grid (FUE, DES, CON, INT, SAB, CAR) with Floating Modifier Bonus Tooltip on Hover */}
      {showStatsGridOnThisSide && (
        <div className={`grid grid-cols-3 ${isMini ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
          {abilityItems.map((st) => {
            const modFormatted = formatModifier(st.mod);
            const abilityKeyMap: Record<string, string> = {
              FUE: 'mod_ability_str',
              DES: 'mod_ability_dex',
              CON: 'mod_ability_con',
              INT: 'mod_ability_int',
              SAB: 'mod_ability_wis',
              CAR: 'mod_ability_cha',
            };
            const modId = abilityKeyMap[st.abbr];
            const customMod = currentTarotModsMap[modId];
            return (
              <div
                key={st.abbr}
                data-testid={`tarot-stat-${st.abbr.toLowerCase()}`}
                title={`${st.label}: ${st.score} (Bono ${modFormatted})`}
                style={{
                  ...getTarotModOffsetStyle(modId),
                  backgroundColor: customMod?.bgColor || undefined,
                  borderColor: customMod?.borderColor || undefined,
                }}
                className={`group relative cursor-help ${
                  isMini ? 'rounded-lg py-0.5 px-1' : 'rounded-xl py-1.5 px-2'
                } bg-[#11141d] hover:bg-[#191e2b] border border-[#c8a45c]/70 hover:border-[#f3dfb2] flex flex-col items-center justify-center shadow-inner transition-colors`}
              >
                {/* Floating Tooltip Tab showing Modifier Bonus (e.g. +4) on Hover */}
                <div
                  data-testid={`tarot-stat-tooltip-${st.abbr.toLowerCase()}`}
                  className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute -top-7 left-1/2 -translate-x-1/2 z-40 px-2 py-0.5 rounded-md bg-[#0e1017]/95 border border-[#e2c275] text-[#f5e4be] font-mono font-black text-[11px] leading-tight shadow-[0_4px_14px_rgba(0,0,0,0.95)] whitespace-nowrap"
                >
                  {modFormatted}
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-[#0e1017] border-r border-b border-[#e2c275]" />
                </div>

                <span
                  className={`${
                    isMini ? 'text-[8px]' : 'text-[10px] sm:text-xs'
                  } font-cinzel font-bold text-[#d8ba73] uppercase tracking-wider leading-tight`}
                >
                  {customMod?.label || st.abbr}
                </span>
                <span
                  className={`font-cinzel font-black ${
                    isMini ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
                  } text-white leading-tight`}
                >
                  {st.score}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Divider + Leather Coin Pouch & 4 Metallic Coins (PO, PP, PC, PL) */}
      {isTarotElementVisibleOnSide('coins', 'front', tarotCfg.elementSides) && (
        <div
          style={getTarotModOffsetStyle('mod_coin_gp')}
          className={`${isMini ? 'pt-1' : 'pt-2'} border-t border-[#c8a45c]/35`}
        >
          <div
            onClick={onClickCoinPouch}
            className={`flex items-center justify-between ${
              isMini ? 'gap-1.5' : 'gap-2'
            } ${onClickCoinPouch ? 'cursor-pointer hover:opacity-95 transition' : ''}`}
            title={onClickCoinPouch ? 'Clic para gestionar monedas e inventario' : undefined}
          >
            {/* Illustrated Leather Coin Pouch SVG */}
            <div
              className={`${
                isMini ? 'w-8 h-8' : 'w-11 h-11 sm:w-12 sm:h-12'
              } flex items-center justify-center shrink-0`}
            >
              <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md">
                {/* Pouch Top Frill */}
                <path
                  d="M22 14 C24 10, 29 12, 32 10 C35 12, 40 10, 42 14 L38 22 L26 22 Z"
                  fill="#7a5436"
                  stroke="#23160c"
                  strokeWidth="2.2"
                />
                {/* Main Leather Bag Body */}
                <path
                  d="M24 22 C13 28, 10 44, 15 52 C19 57, 45 57, 49 52 C54 44, 51 28, 40 22 Z"
                  fill="#8c6240"
                  stroke="#23160c"
                  strokeWidth="2.4"
                />
                {/* Bag Shading / Creases */}
                <path
                  d="M22 28 C18 36, 18 46, 22 52"
                  stroke="#593b22"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M40 28 C44 36, 44 46, 40 52"
                  stroke="#ab7e57"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Drawstring Cord */}
                <rect
                  x="23"
                  y="20"
                  width="18"
                  height="4"
                  rx="2"
                  fill="#c8a45c"
                  stroke="#23160c"
                  strokeWidth="1.8"
                />
                <path
                  d="M35 23 C38 28, 39 34, 37 40"
                  stroke="#c8a45c"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* 4 Metallic Medallion Coins: PO (Gold), PP (Silver), PC (Copper), PL (Platinum) */}
            <div className={`flex-1 grid grid-cols-4 ${isMini ? 'gap-1' : 'gap-1.5'}`}>
              {/* PO - Gold */}
              <div className="flex flex-col items-center">
                <div
                  className={`${
                    isMini ? 'w-7 h-7' : 'w-10 h-10 sm:w-11 sm:h-11'
                  } rounded-full bg-gradient-to-b from-[#fbe285] via-[#d9a738] to-[#9b6c15] p-0.5 shadow-md flex items-center justify-center`}
                >
                  <div className="w-full h-full rounded-full border border-dashed border-[#5c3d06]/70 bg-gradient-to-b from-[#f3cf65] to-[#b88622] flex items-center justify-center">
                    <span
                      className={`font-cinzel font-black ${
                        isMini ? 'text-[10px]' : 'text-xs sm:text-sm'
                      } text-[#2b1a03]`}
                    >
                      {currency.gp || 0}
                    </span>
                  </div>
                </div>
                <span
                  className={`${
                    isMini ? 'text-[8px]' : 'text-[10px]'
                  } font-cinzel font-bold text-[#e2c275] mt-0.5`}
                >
                  PO
                </span>
              </div>

              {/* PP - Silver */}
              <div className="flex flex-col items-center">
                <div
                  className={`${
                    isMini ? 'w-7 h-7' : 'w-10 h-10 sm:w-11 sm:h-11'
                  } rounded-full bg-gradient-to-b from-[#f1f5f9] via-[#94a3b8] to-[#475569] p-0.5 shadow-md flex items-center justify-center`}
                >
                  <div className="w-full h-full rounded-full border border-dashed border-slate-700/70 bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] flex items-center justify-center">
                    <span
                      className={`font-cinzel font-black ${
                        isMini ? 'text-[10px]' : 'text-xs sm:text-sm'
                      } text-slate-900`}
                    >
                      {currency.sp || 0}
                    </span>
                  </div>
                </div>
                <span
                  className={`${
                    isMini ? 'text-[8px]' : 'text-[10px]'
                  } font-cinzel font-bold text-slate-300 mt-0.5`}
                >
                  PP
                </span>
              </div>

              {/* PC - Copper */}
              <div className="flex flex-col items-center">
                <div
                  className={`${
                    isMini ? 'w-7 h-7' : 'w-10 h-10 sm:w-11 sm:h-11'
                  } rounded-full bg-gradient-to-b from-[#f6ad85] via-[#c46d3b] to-[#7c3a16] p-0.5 shadow-md flex items-center justify-center`}
                >
                  <div className="w-full h-full rounded-full border border-dashed border-[#4d2109]/70 bg-gradient-to-b from-[#e39264] to-[#9e4f24] flex items-center justify-center">
                    <span
                      className={`font-cinzel font-black ${
                        isMini ? 'text-[10px]' : 'text-xs sm:text-sm'
                      } text-[#291003]`}
                    >
                      {currency.cp || 0}
                    </span>
                  </div>
                </div>
                <span
                  className={`${
                    isMini ? 'text-[8px]' : 'text-[10px]'
                  } font-cinzel font-bold text-[#d98a5f] mt-0.5`}
                >
                  PC
                </span>
              </div>

              {/* PL - Platinum */}
              <div className="flex flex-col items-center">
                <div
                  className={`${
                    isMini ? 'w-7 h-7' : 'w-10 h-10 sm:w-11 sm:h-11'
                  } rounded-full bg-gradient-to-b from-[#ffffff] via-[#cbd5e1] to-[#64748b] p-0.5 shadow-md flex items-center justify-center`}
                >
                  <div className="w-full h-full rounded-full border border-[#334155]/70 bg-gradient-to-b from-[#f8fafc] to-[#cbd5e1] flex items-center justify-center">
                    <span
                      className={`font-cinzel font-black ${
                        isMini ? 'text-[10px]' : 'text-xs sm:text-sm'
                      } text-slate-900`}
                    >
                      {currency.pp || 0}
                    </span>
                  </div>
                </div>
                <span
                  className={`${
                    isMini ? 'text-[8px]' : 'text-[10px]'
                  } font-cinzel font-bold text-cyan-200 mt-0.5`}
                >
                  PL
                </span>
              </div>
            </div>
          </div>

          {/* Optional DM Gold Controls */}
          {showDmControls && onDmAdjustPlayer && (
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <span className={`${isMini ? 'text-[9px]' : 'text-[10px]'} font-cinzel text-[#cbb692]`}>
                Ajustar Oro (DM):
              </span>
              <button
                type="button"
                onClick={() => onDmAdjustPlayer(charId, { gpDelta: 1 })}
                className="px-1.5 py-0.5 rounded bg-amber-950 hover:bg-amber-800 border border-amber-500/60 text-amber-200 text-[9px] font-mono font-bold cursor-pointer"
              >
                +1 PO
              </button>
              <button
                type="button"
                onClick={() => onDmAdjustPlayer(charId, { gpDelta: -1 })}
                className="px-1.5 py-0.5 rounded bg-stone-900 hover:bg-red-950 border border-stone-700 text-stone-300 text-[9px] font-mono font-bold cursor-pointer"
              >
                -1 PO
              </button>
            </div>
          )}
        </div>
      )}

      {/* Any extra duplicated/custom modules placed on Front */}
      {extraSideModules.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 z-20">
          {extraSideModules.map((mod) => renderLiveModuleBadge(mod))}
        </div>
      )}

      {/* Optional Footer Actions (e.g. inside Lobby Character Deck) */}
      {footerActions && <div className="pt-2 border-t border-[#c8a45c]/30">{footerActions}</div>}
    </div>
  );
};

export interface PlayerTacticalTokenRendererProps {
  label: string;
  avatarUrl?: string;
  color?: string;
  hp?: number;
  maxHp?: number;
  ac?: number;
  alignment?: string;
  goldGp?: number;
  playerSkinId?: string;
  skinTokens?: AppSkinThemeTokens | null;
  sizePx?: number;
}

export const PlayerTacticalTokenRenderer: React.FC<PlayerTacticalTokenRendererProps> = ({
  label,
  avatarUrl,
  color = '#f59e0b',
  hp,
  maxHp,
  ac,
  alignment,
  goldGp,
  playerSkinId,
  skinTokens,
  sizePx = 44,
}) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribeToSkinCatalogCache(() => setTick((t) => t + 1));
  }, []);

  const resolvedSkin =
    skinTokens ||
    (playerSkinId ? cachedPlayerSkinsMap[playerSkinId] : undefined) ||
    cachedPlayerSkinsMap['__online_default__'];

  const tarotCfg = React.useMemo(
    () => resolveTarotStudioConfig(resolvedSkin),
    [resolvedSkin]
  );

  const tokenModules = (tarotCfg.modules || []).filter(
    (m) => m.side === 'token' && m.visible !== false
  );
  const extraTokenModules = tokenModules.filter((m) => m.id !== 'mod_token_portrait');
  const portraitMod = tokenModules.find((m) => m.id === 'mod_token_portrait');

  const shape = portraitMod?.shape || tarotCfg.tokenShape || 'circle';
  const borderColor =
    portraitMod?.borderColor || tarotCfg.tokenBorderColor || color || '#c8a45c';
  const bgColor = portraitMod?.bgColor || tarotCfg.tokenBgColor || '#131722';
  const hideBorder = portraitMod?.hideBorder ?? tarotCfg.tokenHideBorder ?? false;

  const geomStyle = buildGeometricElementStyle({
    shape,
    hideBorder,
    borderColor,
    bgColor,
    borderWidthPx: Math.max(2, Math.min(4, tarotCfg.tokenBorderWidthPx ?? 3)),
    edgeFadePercent: tarotCfg.tokenEdgeFadePercent || 0,
  });

  const hpPct =
    hp !== undefined && maxHp && maxHp > 0
      ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)))
      : 100;

  return (
    <div
      className="relative w-full h-full flex items-center justify-center select-none overflow-hidden"
      style={{ width: sizePx, height: sizePx }}
    >
      {/* Looping Animated Border GIF inside the square perimeter */}
      {tarotCfg.tokenAnimatedBorderGifUrl && (
        <img
          src={tarotCfg.tokenAnimatedBorderGifUrl}
          alt=""
          className="pointer-events-none absolute inset-0 w-full h-full object-contain z-20"
        />
      )}
      {tarotCfg.tokenCustomFramePngUrl && (
        <img
          src={tarotCfg.tokenCustomFramePngUrl}
          alt=""
          className="pointer-events-none absolute inset-0 w-full h-full object-contain z-20"
        />
      )}

      {/* Main Token Body (Default Circular Character Image or Custom Geometric Shape) */}
      <div
        style={geomStyle}
        className="relative w-[86%] h-[86%] flex items-center justify-center overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
      >
        <GeometricSvgBorder
          shape={shape}
          borderColor={borderColor}
          borderWidthPx={2}
          hideBorder={hideBorder}
        />
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-cinzel font-black text-white text-xs uppercase drop-shadow">
            {(label || 'PJ').slice(0, 2)}
          </span>
        )}
      </div>

      {/* Extra Modules copied from Tarot Card to Token in Apartado 4 (HP, Gold, CA, Alignment) */}
      {extraTokenModules.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0.5 bottom-0.5 z-30 flex flex-col items-center gap-0.5">
          {extraTokenModules.slice(0, 2).map((mod) => {
            if (mod.kind === 'hp_bar' || (hp !== undefined && maxHp !== undefined && mod.id.includes('hp'))) {
              return (
                <div
                  key={mod.id}
                  className="w-[92%] h-2.5 rounded-full bg-black/90 border border-emerald-500/70 overflow-hidden relative flex items-center justify-center"
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${hpPct}%`,
                      backgroundColor: mod.fillColor || '#22b573',
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-mono font-black text-white leading-none">
                    {hp ?? 44}/{maxHp ?? 44}
                  </span>
                </div>
              );
            }
            let badgeText = mod.exampleValue || mod.label || '';
            if (mod.kind === 'coin_gp') badgeText = `${goldGp ?? 125} PO`;
            else if (mod.kind === 'stat_ca') badgeText = `CA ${ac ?? 16}`;
            else if (mod.kind === 'alignment_badge') badgeText = alignment || 'LB';
            return (
              <div
                key={mod.id}
                style={{
                  backgroundColor: mod.bgColor || 'rgba(15,19,28,0.92)',
                  borderColor: mod.borderColor || '#c8a45c',
                  color: mod.textColor || '#fde68a',
                }}
                className="px-1 py-0.2 rounded border text-[7px] font-mono font-black leading-tight truncate max-w-[94%]"
              >
                {badgeText}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

