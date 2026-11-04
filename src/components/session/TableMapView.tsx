import React, { useState, useMemo } from 'react';
import {
  Shield,
  Sword,
  Sparkles,
  BookOpen,
  Scroll,
  Plus,
  Minus,
  Upload,
  ArrowLeft,
  Coins,
  Compass,
  MapPin,
  Crown,
  MessageSquare,
  Dices,
  Eye,
  EyeOff,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Image as ImageIcon,
  Layers,
  Send,
  Skull,
  FolderPlus,
  Edit3,
  Users,
} from 'lucide-react';
import { EntityAvatar } from '../common/EntityAvatar';
import {
  Character5e,
  DMWorkspace,
  AbilityKey,
  SkillKey,
  PartyMemberLive,
  LiveCombatantMini,
  LiveRoomProjection,
  DiceRollResult,
  PlaceAlbumPhoto,
  Combatant,
  LocationRecord,
  ZoneMapRecord,
  VisualQueueItem,
  TacticalMapToken,
  TacticalMapConfig,
  TacticalLayerId,
  AppSkinRecord,
} from '../../types/dnd';
import {
  calculateModifier,
  formatModifier,
  calculateProficiencyBonus,
  calculatePassivePerception,
  deriveEquippedWeaponAttacks,
  deriveAllCharacterActions,
  calculateEquippedItemStatBonuses,
  calculateTotalAbilityScore,
  getEffectiveAbilityModifier,
  buildAtlasBreadcrumbs,
  getParentAtlasFolder,
  getReturnToParentButtonLabel,
  getChildFoldersForAtlas,
  ensureCompleteFolderHierarchy,
  getPinPositionForChildPlace,
  filterAlbumPhotosByPlace,
  MAX_ENCOUNTER_ENEMIES,
  canAddEnemyToEncounter,
  buildLiveProjectionFromWorkspace,
  enqueueVisualItem,
  removeVisualFromQueue,
  moveTacticalTokenOnGrid,
  buildDeduplicatedPlayerSkillCards,
  pickMostRecentRoll,
  pickMostRecentRollForRoller,
} from '../../utils/dnd-math';
import {
  resolvePlayerMapLayout,
  buildSpatialBlockInlineStyle,
  buildInnerButtonInlineStyle,
  getInnerButtonLabel,
} from '../../utils/playerSkinLayout';
import {
  canAccessTacticalMaps,
  createDefaultTacticalMapConfig,
  isTokenOwnedByPlayer,
  modifyTacticalTokenLive,
} from '../../utils/tacticalMapEngine';
import { TacticalMapCanvas } from '../tactical/TacticalMapCanvas';
import { TacticalMapStudioModal } from '../tactical/TacticalMapStudioModal';
import { CharacterTarotCard } from '../character/CharacterTarotCard';
import { ABILITY_LABELS, SKILL_METADATA, SKILLS_5E } from '../../data/srd';
import { getFolderDepth } from '../../utils/storage';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';
import { soundFx } from '../../utils/audio';

interface TableMapViewProps {
  mode: 'player' | 'dm';
  roomCode: string;
  worldName?: string;
  currentUserRole?: 'client' | 'moderator' | 'creator' | 'admin' | string | null;
  // Player props
  character?: Character5e;
  onUpdateCharacter?: (updated: Character5e) => void;
  // DM props
  workspace?: DMWorkspace;
  onUpdateWorkspace?: (updated: DMWorkspace) => void;
  onDmAdjustPlayer?: (characterId: string, adjustment: { hpDelta?: number; gpDelta?: number }) => void;
  onUpdateDmLiveMessage?: (msg: string) => void;
  // Shared room state
  partyMembers: PartyMemberLive[];
  dmConnected?: boolean;
  dmLiveMessage?: string;
  showCombatantsOnTable?: boolean;
  liveCombatants?: LiveCombatantMini[];
  liveProjection?: LiveRoomProjection;
  rollFeed: DiceRollResult[];
  onRollSubmitted?: (result: DiceRollResult) => void;
  onRollComplete?: (result: DiceRollResult) => void;
  onTriggerRoll?: (title: string, modifier: number, diceType?: number) => void;
  onOpenRollFeed?: () => void;
  onSendPlayerMessageToDM?: (
    title: string,
    description: string
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
  // Navigation & Cloud Save
  onReturnToSheet: () => void;
  onSaveToCloud?: () => void;
}

const DICE_TYPES: { sides: number; label: string }[] = [
  { sides: 4, label: 'D4' },
  { sides: 6, label: 'D6' },
  { sides: 8, label: 'D8' },
  { sides: 10, label: 'D10' },
  { sides: 12, label: 'D12' },
  { sides: 20, label: 'D20' },
  { sides: 100, label: 'D100' },
];

function renderPolyhedralDieIcon(sides: number) {
  switch (sides) {
    case 4:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,3 21,19 3,19" />
          <line x1="12" y1="3" x2="12" y2="19" strokeOpacity="0.5" />
        </svg>
      );
    case 6:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="9" cy="9" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case 8:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 21,12 12,22 3,12" />
          <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.5" />
        </svg>
      );
    case 10:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 20,10 12,22 4,10" />
          <polyline points="4,10 12,13 20,10" strokeOpacity="0.5" />
        </svg>
      );
    case 12:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 21,8.5 17.5,19.5 6.5,19.5 3,8.5" />
          <polygon points="12,7 16,10 14.5,15 9.5,15 8,10" strokeOpacity="0.5" />
        </svg>
      );
    case 20:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 20.5,7 20.5,17 12,22 3.5,17 3.5,7" />
          <polygon points="12,6 17,15 7,15" strokeOpacity="0.55" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="12" r="6" />
          <circle cx="15" cy="12" r="6" strokeOpacity="0.7" />
        </svg>
      );
  }
}

export const TableMapView: React.FC<TableMapViewProps> = ({
  mode,
  roomCode,
  worldName = 'Reinos Olvidados',
  currentUserRole = 'client',
  character,
  onUpdateCharacter,
  workspace,
  onUpdateWorkspace,
  onDmAdjustPlayer,
  onUpdateDmLiveMessage,
  partyMembers = [],
  dmConnected = true,
  dmLiveMessage = '',
  showCombatantsOnTable = false,
  liveCombatants = [],
  liveProjection,
  rollFeed = [],
  onRollSubmitted,
  onRollComplete,
  onOpenRollFeed,
  onSendPlayerMessageToDM,
  onReturnToSheet,
  onSaveToCloud,
}) => {
  const isTacticalMapsAllowed = canAccessTacticalMaps(currentUserRole);
  const [isTacticalStudioOpen, setIsTacticalStudioOpen] = useState<boolean>(false);

  // Load Player & DM Skins from catalog so Map Mode reflects custom layouts and colors
  const [catalogPlayerSkins, setCatalogPlayerSkins] = useState<AppSkinRecord[]>([]);
  const [catalogDmSkins, setCatalogDmSkins] = useState<AppSkinRecord[]>([]);
  const [onlineDefaultPlayerSkinId, setOnlineDefaultPlayerSkinId] = useState<string>('skin-player-classic-gold');
  const [onlineDefaultDmSkinId, setOnlineDefaultDmSkinId] = useState<string>('skin-dm-crimson-overlord');

  React.useEffect(() => {
    let mounted = true;
    fetch('/api/creator/catalog')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const pSkins: AppSkinRecord[] = [];
        const dSkins: AppSkinRecord[] = [];
        if (Array.isArray(data.playerSkins)) pSkins.push(...data.playerSkins);
        if (Array.isArray(data.dmSkins)) dSkins.push(...data.dmSkins);
        if (Array.isArray(data.skins)) {
          for (const s of data.skins) {
            if (s.scope === 'player' && !pSkins.some((p) => p.id === s.id)) pSkins.push(s);
            if (s.scope === 'dm' && !dSkins.some((d) => d.id === s.id)) dSkins.push(s);
          }
        }
        setCatalogPlayerSkins(pSkins);
        setCatalogDmSkins(dSkins);
        if (data.activeOnlinePlayerSkinId) setOnlineDefaultPlayerSkinId(data.activeOnlinePlayerSkinId);
        if (data.activeOnlineDmSkinId) setOnlineDefaultDmSkinId(data.activeOnlineDmSkinId);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const activePlayerSkinRecord = useMemo(() => {
    const targetId = character?.playerSkinId || onlineDefaultPlayerSkinId;
    return (
      catalogPlayerSkins.find((s) => s.id === targetId) ||
      catalogPlayerSkins.find((s) => s.id === onlineDefaultPlayerSkinId) ||
      null
    );
  }, [character?.playerSkinId, catalogPlayerSkins, onlineDefaultPlayerSkinId]);

  const activePlayerSkinTokens = activePlayerSkinRecord?.themeTokens || null;
  const resolvedPlayerMap = useMemo(
    () => resolvePlayerMapLayout(activePlayerSkinTokens),
    [activePlayerSkinTokens]
  );

  const activeDmSkinRecord = useMemo(() => {
    const targetId = workspace?.dmSkinId || onlineDefaultDmSkinId;
    return (
      catalogDmSkins.find((s) => s.id === targetId) ||
      catalogDmSkins.find((s) => s.id === onlineDefaultDmSkinId) ||
      null
    );
  }, [workspace?.dmSkinId, catalogDmSkins, onlineDefaultDmSkinId]);

  const activeDmSkinTokens = activeDmSkinRecord?.themeTokens || null;

  // =========================================================================
  // 1. MINIMIZABLE OVERLAYS STATE (CARDS / PROJECTION & NOTEBOOK)
  // =========================================================================
  const [isLeftOverlayMinimized, setIsLeftOverlayMinimized] = useState<boolean>(false);
  const [isNotebookMinimized, setIsNotebookMinimized] = useState<boolean>(false);
  const [isPlayersDeckOpen, setIsPlayersDeckOpen] = useState<boolean>(false);

  // Map Zoom & Pan Controls
  const [mapZoom, setMapZoom] = useState<number>(1);

  // Player Decks State (Read-only view of Attacks, Skills, Spells)
  const [activePlayerDeck, setActivePlayerDeck] = useState<'attacks' | 'skills' | 'spells'>('attacks');
  const [playerDeckScrollIdx, setPlayerDeckScrollIdx] = useState<number>(0);

  // DM Projection Overlay Tab ('gallery' | 'tactical' | 'queue')
  const [dmProjectionTab, setDmProjectionTab] = useState<'gallery' | 'tactical' | 'queue'>('gallery');

  // DM Viewport Mode: 'dm' (Vista DM para revisar/editar) vs 'live' (Vista en Vivo que ven los jugadores)
  const [dmViewportMode, setDmViewportMode] = useState<'dm' | 'live'>('dm');

  // Tactical Grid Selected Token ID for click-to-move on grid
  const [selectedTacticalTokenId, setSelectedTacticalTokenId] = useState<string | null>(null);

  // Inline Edit Visual Modal inside DM Map View
  const [editingVisualItem, setEditingVisualItem] = useState<{
    kind: 'map' | 'zonemap' | 'album' | 'tactical';
    id: string;
    title: string;
    imageUrl: string;
    folder: string;
    gridCols?: number;
    gridRows?: number;
  } | null>(null);

  // Quick New Tactical Map Inputs inside DM Map View
  const [newTacticalTitle, setNewTacticalTitle] = useState<string>('');
  const [newTacticalUrl, setNewTacticalUrl] = useState<string>('');
  const [newTacticalCols, setNewTacticalCols] = useState<number>(10);
  const [newTacticalRows, setNewTacticalRows] = useState<number>(10);

  // DM Edit Map / Upload Photo / Sub-Place Modals
  const [isEditMapModalOpen, setIsEditMapModalOpen] = useState<boolean>(false);
  const [isAddSubPlaceModalOpen, setIsAddSubPlaceModalOpen] = useState<boolean>(false);
  const [newSubPlaceName, setNewSubPlaceName] = useState<string>('');
  const [newGalleryTitle, setNewGalleryTitle] = useState<string>('');
  const [newGalleryUrl, setNewGalleryUrl] = useState<string>('');
  const [mapUrlDraft, setMapUrlDraft] = useState<string>('');
  const [isAddEnemyModalOpen, setIsAddEnemyModalOpen] = useState<boolean>(false);

  // Dice Box State (D4..D100 + 1 to 6 Dice Count + Roll Action)
  const [selectedDiceSides, setSelectedDiceSides] = useState<number>(20);
  const [selectedDiceCount, setSelectedDiceCount] = useState<number>(1);
  const [diceModifier, setDiceModifier] = useState<number>(0);
  const [lastBoxRoll, setLastBoxRoll] = useState<DiceRollResult | null>(null);
  const [isRollHistoryExpanded, setIsRollHistoryExpanded] = useState<boolean>(false);

  // Notebook / Chronicles Quick Entry State
  const [dmQuickLogTitle, setDmQuickLogTitle] = useState<string>('');
  const [dmQuickLogSummary, setDmQuickLogSummary] = useState<string>('');
  const [notebookSavedFeedback, setNotebookSavedFeedback] = useState<string>('');

  // DM Live Message Input
  const [dmMessageInput, setDmMessageInput] = useState<string>(
    workspace?.dmLiveMessage || dmLiveMessage || ''
  );
  const [dmMessageSentToast, setDmMessageSentToast] = useState<boolean>(false);

  // Player Whisper to DM Modal
  const [isWhisperModalOpen, setIsWhisperModalOpen] = useState<boolean>(false);
  const [whisperTitle, setWhisperTitle] = useState<string>('');
  const [whisperBody, setWhisperBody] = useState<string>('');
  const [whisperStatus, setWhisperStatus] = useState<string>('');

  // =========================================================================
  // 2. ATLAS / LOCATION & VISUAL PROJECTION RESOLUTION
  // =========================================================================
  const [dmInspectedVisual, setDmInspectedVisual] = useState<{
    kind: 'map' | 'album' | 'tactical';
    id: string;
    title: string;
    imageUrl: string;
    folder: string;
  } | null>(null);

  const selectedFolder = useMemo(() => {
    if (mode === 'dm' && workspace) {
      return workspace.activeAtlasFolder || workspace.activeLiveVisual?.folder || 'all';
    }
    return liveProjection?.locationFolder || 'all';
  }, [mode, workspace, liveProjection]);

  const autoSyncLiveOnZoneChange = Boolean(workspace?.autoSyncLiveOnZoneChange);

  const buildDefaultVisualForFolder = (folderPath: string, ws: DMWorkspace) => {
    const shortName =
      folderPath === 'all'
        ? worldName || 'Mundo Completo'
        : folderPath.split('/').map((s) => s.trim()).filter(Boolean).pop() || folderPath;
    const mapForPlace = ws.atlasMaps?.[folderPath] || '';
    const photosForPlace = filterAlbumPhotosByPlace(ws.placeAlbumPhotos || [], folderPath);
    if (mapForPlace) {
      return {
        kind: 'map' as const,
        id: `map-${folderPath}`,
        title: `Mapa: ${shortName}`,
        imageUrl: mapForPlace,
        folder: folderPath,
      };
    }
    if (photosForPlace[0]) {
      return {
        kind: 'album' as const,
        id: photosForPlace[0].id,
        title: photosForPlace[0].title,
        imageUrl: photosForPlace[0].imageUrl,
        folder: folderPath,
      };
    }
    return {
      kind: 'map' as const,
      id: `map-${folderPath}`,
      title: shortName,
      imageUrl: '',
      folder: folderPath,
    };
  };

  const setDmSelectedFolder = (folderPath: string) => {
    if (!workspace || !onUpdateWorkspace) return;
    const targetFolder = String(folderPath || 'all').trim() || 'all';
    setDmInspectedVisual(null);

    if (workspace.autoSyncLiveOnZoneChange) {
      const nextVisual = buildDefaultVisualForFolder(targetFolder, workspace);
      onUpdateWorkspace({
        ...workspace,
        activeAtlasFolder: targetFolder,
        activeLiveVisual: nextVisual,
      });
    } else {
      // Preserve existing activeLiveVisual so players keep seeing the projected image/zone
      // while the DM freely inspects maps and sub-zones!
      const preservedLiveVisual =
        workspace.activeLiveVisual ||
        buildDefaultVisualForFolder(
          workspace.activeAtlasFolder || 'all',
          workspace
        );
      onUpdateWorkspace({
        ...workspace,
        activeAtlasFolder: targetFolder,
        activeLiveVisual: preservedLiveVisual,
      });
    }
  };

  const handleToggleAutoSyncLiveOnZoneChange = (checked: boolean) => {
    if (!workspace || !onUpdateWorkspace) return;
    if (checked) {
      const syncedVisual = buildDefaultVisualForFolder(selectedFolder, workspace);
      onUpdateWorkspace({
        ...workspace,
        autoSyncLiveOnZoneChange: true,
        activeLiveVisual: syncedVisual,
      });
    } else {
      onUpdateWorkspace({
        ...workspace,
        autoSyncLiveOnZoneChange: false,
      });
    }
  };

  const allHierarchyFolders = useMemo(
    () => ensureCompleteFolderHierarchy(workspace?.folders || []),
    [workspace?.folders]
  );

  const breadcrumbs = useMemo(() => buildAtlasBreadcrumbs(selectedFolder), [selectedFolder]);

  const childFolders = useMemo(
    () => getChildFoldersForAtlas(allHierarchyFolders, selectedFolder),
    [allHierarchyFolders, selectedFolder]
  );

  const currentPlaceShortName = useMemo(() => {
    if (mode === 'player' && liveProjection?.locationName) {
      return liveProjection.locationName;
    }
    if (selectedFolder === 'all') return worldName || 'Mundo Completo';
    const parts = selectedFolder.split('/').map((s) => s.trim());
    return parts[parts.length - 1] || selectedFolder;
  }, [mode, liveProjection, selectedFolder, worldName]);

  const currentPlaceDepth = useMemo(
    () => (selectedFolder === 'all' ? 0 : getFolderDepth(selectedFolder)),
    [selectedFolder]
  );

  const currentPlaceMapUrl = useMemo(() => {
    if (mode === 'dm' && workspace) {
      return workspace.atlasMaps?.[selectedFolder] || '';
    }
    return '';
  }, [mode, workspace, selectedFolder]);

  const filteredAlbumPhotos = useMemo(() => {
    if (mode === 'dm' && workspace) {
      return filterAlbumPhotosByPlace(workspace.placeAlbumPhotos || [], selectedFolder);
    }
    return liveProjection?.galleryPhotos || [];
  }, [mode, workspace, selectedFolder, liveProjection]);

  const filteredZoneMaps = useMemo(() => {
    if (mode === 'dm' && workspace) {
      const allZ = workspace.zoneMaps || [];
      if (selectedFolder === 'all') return allZ;
      return allZ.filter(
        (m) => m.folder === selectedFolder || m.folder.startsWith(`${selectedFolder} / `)
      );
    }
    return [];
  }, [mode, workspace, selectedFolder]);

  const filteredTacticalMaps = useMemo(() => {
    if (mode === 'dm' && workspace) {
      const allT = (workspace.locations || []).filter(
        (l) => Boolean(l.mapImageUrl) || Boolean(l.tacticalConfig)
      );
      if (selectedFolder === 'all') return allT;
      return allT.filter(
        (l) => l.folder === selectedFolder || l.folder.startsWith(`${selectedFolder} / `)
      );
    }
    return [];
  }, [mode, workspace, selectedFolder]);

  // Live projection currently broadcast to players
  const liveProjectedToPlayers = useMemo(() => {
    if (workspace) {
      return buildLiveProjectionFromWorkspace(workspace, worldName);
    }
    return liveProjection;
  }, [workspace, worldName, liveProjection]);

  // Currently displayed visual on canvas (for DM: depends on dmViewportMode 'dm' vs 'live'; for Player: liveProjectedToPlayers)
  const activeVisual = useMemo(() => {
    if (mode === 'dm' && workspace) {
      // When DM toggles to "Vista en Vivo", show the EXACT visual projected to players!
      if (dmViewportMode === 'live') {
        if (workspace.activeLiveVisual && workspace.activeLiveVisual.imageUrl) {
          return {
            id: workspace.activeLiveVisual.id,
            kind: workspace.activeLiveVisual.kind,
            title: workspace.activeLiveVisual.title,
            imageUrl: workspace.activeLiveVisual.imageUrl,
            folder: workspace.activeLiveVisual.folder || 'all',
          };
        }
        if (liveProjectedToPlayers && liveProjectedToPlayers.visualImageUrl) {
          return {
            id: 'live-proj',
            kind: (liveProjectedToPlayers.visualKind === 'photo'
              ? 'album'
              : liveProjectedToPlayers.visualKind || 'map') as 'map' | 'album' | 'tactical',
            title:
              liveProjectedToPlayers.visualTitle ||
              liveProjectedToPlayers.locationName ||
              'Escena en Vivo',
            imageUrl: liveProjectedToPlayers.visualImageUrl,
            folder: liveProjectedToPlayers.locationFolder || 'all',
          };
        }
      }

      // In "Vista DM", show the inspected visual first if one was clicked
      if (dmInspectedVisual) {
        return {
          id: dmInspectedVisual.id,
          kind: dmInspectedVisual.kind,
          title: dmInspectedVisual.title,
          imageUrl: dmInspectedVisual.imageUrl,
          folder: dmInspectedVisual.folder,
        };
      }
      const liveFolder = workspace.activeLiveVisual?.folder || 'all';
      if (
        workspace.activeLiveVisual &&
        (workspace.activeLiveVisual.imageUrl || workspace.activeLiveVisual.kind === 'tactical') &&
        liveFolder === selectedFolder
      ) {
        return {
          id: workspace.activeLiveVisual.id,
          kind: workspace.activeLiveVisual.kind,
          title: workspace.activeLiveVisual.title,
          imageUrl: workspace.activeLiveVisual.imageUrl,
          folder: liveFolder,
        };
      }
      if (currentPlaceMapUrl) {
        return {
          id: `map-${selectedFolder}`,
          kind: 'map' as const,
          title: `Mapa: ${currentPlaceShortName}`,
          imageUrl: currentPlaceMapUrl,
          folder: selectedFolder,
        };
      }
      if (filteredAlbumPhotos[0]) {
        return {
          id: filteredAlbumPhotos[0].id,
          kind: 'album' as const,
          title: filteredAlbumPhotos[0].title,
          imageUrl: filteredAlbumPhotos[0].imageUrl,
          folder: selectedFolder,
        };
      }
      return {
        id: `map-${selectedFolder}`,
        kind: 'map' as const,
        title: currentPlaceShortName,
        imageUrl: '',
        folder: selectedFolder,
      };
    }

    // Player mode uses liveProjection from DM (with workspace fallback for instant sync)
    const fallbackProj = workspace
      ? buildLiveProjectionFromWorkspace(workspace, worldName)
      : undefined;

    if (
      liveProjection &&
      (liveProjection.visualImageUrl ||
        liveProjection.visualKind === 'tactical' ||
        liveProjection.tacticalConfig)
    ) {
      return {
        id: liveProjection.visualId || 'live-proj',
        kind: liveProjection.tacticalConfig
          ? ('tactical' as const)
          : liveProjection.visualKind || 'map',
        title:
          liveProjection.visualTitle ||
          liveProjection.locationName ||
          'Escena Actual',
        imageUrl: liveProjection.visualImageUrl,
      };
    }

    if (
      fallbackProj &&
      (fallbackProj.visualImageUrl ||
        fallbackProj.visualKind === 'tactical' ||
        fallbackProj.tacticalConfig)
    ) {
      return {
        id: fallbackProj.visualId || 'ws-fallback-proj',
        kind: fallbackProj.tacticalConfig
          ? ('tactical' as const)
          : fallbackProj.visualKind || 'map',
        title: fallbackProj.visualTitle || fallbackProj.locationName || 'Escena Actual',
        imageUrl: fallbackProj.visualImageUrl,
      };
    }

    if (liveProjection?.galleryPhotos?.[0]?.imageUrl) {
      return {
        id: 'live-gallery-fallback',
        kind: 'photo' as const,
        title: liveProjection.galleryPhotos[0].title || currentPlaceShortName,
        imageUrl: liveProjection.galleryPhotos[0].imageUrl,
      };
    }

    return {
      id: 'default-proj',
      kind: (liveProjection?.visualKind || fallbackProj?.visualKind || 'map') as
        | 'map'
        | 'photo'
        | 'tactical',
      title:
        liveProjection?.visualTitle ||
        fallbackProj?.visualTitle ||
        currentPlaceShortName,
      imageUrl: '',
    };
  }, [mode, workspace, worldName, currentPlaceMapUrl, filteredAlbumPhotos, selectedFolder, currentPlaceShortName, liveProjection, dmViewportMode, dmInspectedVisual, liveProjectedToPlayers]);

  // =========================================================================
  // 3. PARTY PLAYER CARDS (SAME DESIGN AS PLAYER SHEET BOTTOM-RIGHT CARD)
  // =========================================================================
  const resolvedPlayerCards: PartyMemberLive[] = useMemo(() => {
    const map = new Map<string, PartyMemberLive>();
    for (const p of partyMembers) {
      if (p && p.characterId) {
        map.set(p.characterId, {
          ...p,
          lastRoll: pickMostRecentRollForRoller({
            characterName: p.characterName,
            playerName: p.playerName,
            rollFeed,
            fallbackRoll: p.lastRoll,
          }),
        });
      }
    }
    // Ensure the active player's own character (or fallback character in single-tab DM preview) is present and up to date
    if ((mode === 'player' || map.size === 0) && character) {
      const prof = calculateProficiencyBonus(character.level);
      const equippedBonuses = character.inventory
        ? calculateEquippedItemStatBonuses(character.inventory)
        : null;

      const strScore = calculateTotalAbilityScore(character.abilities.str, equippedBonuses?.str ?? 0).totalScore;
      const dexScore = calculateTotalAbilityScore(character.abilities.dex, equippedBonuses?.dex ?? 0).totalScore;
      const conScore = calculateTotalAbilityScore(character.abilities.con, equippedBonuses?.con ?? 0).totalScore;
      const intScore = calculateTotalAbilityScore(character.abilities.int, equippedBonuses?.int ?? 0).totalScore;
      const wisScore = calculateTotalAbilityScore(character.abilities.wis, equippedBonuses?.wis ?? 0).totalScore;
      const chaScore = calculateTotalAbilityScore(character.abilities.cha, equippedBonuses?.cha ?? 0).totalScore;

      const pp = calculatePassivePerception(
        wisScore,
        character.skills.perception,
        prof
      );
      const existingSelf = map.get(character.id);
      const latestSelfRoll = pickMostRecentRollForRoller({
        characterName: character.name,
        playerName: character.playerName,
        rollFeed,
        localBoxRoll: lastBoxRoll,
        fallbackRoll: existingSelf?.lastRoll,
      });

      map.set(character.id, {
        characterId: character.id,
        characterName: character.name,
        playerName: character.playerName || 'Jugador',
        avatarType: character.avatarType || (character.avatarUrl ? 'custom' : 'icon'),
        avatarCustomUrl: character.avatarCustomUrl || character.avatarUrl,
        avatarIcon: character.avatarIcon || 'anonymous',
        avatarUrl: character.avatarUrl,
        currentHp: character.currentHp,
        maxHp: character.maxHp + (equippedBonuses?.maxHp ?? 0),
        ac: character.armorClass + (equippedBonuses?.ac ?? 0),
        passivePerception: pp,
        level: character.level,
        experience: character.experience ?? character.xp ?? 0,
        alignment: character.alignment,
        speed: (character.speed ?? 30) + (equippedBonuses?.speed ?? 0),
        initiative: (character.initiativeBonus ?? 0) + (equippedBonuses?.initiative ?? 0),
        race: character.race,
        characterClass: `${character.race} ${character.characterClass}`,
        lastPing: Date.now(),
        lastRoll: latestSelfRoll,
        abilities: {
          str: strScore,
          dex: dexScore,
          con: conScore,
          int: intScore,
          wis: wisScore,
          cha: chaScore,
        },
        currency: character.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      });
    }
    return Array.from(map.values());
  }, [partyMembers, mode, character, rollFeed, lastBoxRoll]);

  // =========================================================================
  // 4. ENEMY CARDS IN SALA EN VIVO
  // =========================================================================
  const resolvedEnemies: LiveCombatantMini[] = useMemo(() => {
    if (mode === 'dm' && workspace) {
      const combatants = workspace.activeEncounter?.combatants || [];
      return combatants
        .filter((c) => (c.faction || (c.isPlayer ? 'ally' : 'enemy')) === 'enemy')
        .map((c) => {
          const mon = (workspace.monsters || []).find(
            (m) => m.id === c.sourceId || m.name.toLowerCase() === c.name.toLowerCase()
          );
          return {
            id: c.id,
            name: c.name,
            hp: c.hp,
            maxHp: c.maxHp,
            ac: c.ac,
            passivePerception: c.passivePerception ?? 10,
            faction: 'enemy' as const,
            isPlayer: false,
            conditions: c.conditions || [],
            levelOrCr: mon?.cr ? `CR ${mon.cr}` : 'Niv 1',
            initiative: c.initiative || 10,
            speed: mon?.speed || '30 ft',
            avatarType: mon?.avatarType,
            avatarCustomUrl: mon?.avatarCustomUrl || mon?.avatarUrl,
            avatarIcon: mon?.avatarIcon || 'skull',
          };
        });
    }
    if (!showCombatantsOnTable) return [];
    return (liveCombatants || []).filter((c) => c.faction === 'enemy' && !c.isPlayer);
  }, [mode, workspace, showCombatantsOnTable, liveCombatants]);

  const handleDmAdjustEnemyHp = (combatantId: string, delta: number) => {
    if (mode !== 'dm' || !workspace || !onUpdateWorkspace) return;
    const enc = workspace.activeEncounter;
    if (!enc) return;
    const updatedCombatants = (enc.combatants || []).map((c) => {
      if (c.id !== combatantId) return c;
      const nextHp = Math.max(0, Math.min(c.maxHp, c.hp + delta));
      return { ...c, hp: nextHp };
    });
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...enc,
        combatants: updatedCombatants,
      },
    });
  };

  const handleDmToggleBroadcastEnemies = () => {
    if (mode !== 'dm' || !workspace || !onUpdateWorkspace) return;
    const enc = workspace.activeEncounter || {
      id: 'enc-default',
      name: 'Encuentro Activo',
      round: 1,
      currentTurnIndex: 0,
      combatants: [],
      isActive: true,
      combatNotes: '',
      combatLog: [],
      broadcastEnemiesToTable: false,
    };
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...enc,
        broadcastEnemiesToTable: !enc.broadcastEnemiesToTable,
      },
    });
  };

  const handleDmAddMonsterToTable = (monId: string) => {
    if (mode !== 'dm' || !workspace || !onUpdateWorkspace) return;
    const mon = (workspace.monsters || []).find((m) => m.id === monId);
    if (!mon) return;
    const enc = workspace.activeEncounter || {
      id: 'enc-default',
      name: 'Encuentro Activo',
      round: 1,
      currentTurnIndex: 0,
      combatants: [],
      isActive: true,
      combatNotes: '',
      combatLog: [],
      broadcastEnemiesToTable: true,
    };
    if (!canAddEnemyToEncounter(enc.combatants || [], MAX_ENCOUNTER_ENEMIES)) {
      return;
    }
    const dexMod = calculateModifier(mon.dex || 10);
    const initRoll = Math.floor(Math.random() * 20) + 1 + dexMod;
    const newCombatant: Combatant = {
      id: `cmb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: mon.name,
      initiative: initRoll,
      hp: mon.hp || mon.maxHp || 15,
      maxHp: mon.maxHp || 15,
      ac: mon.ac || 12,
      passivePerception: 10 + calculateModifier(mon.wis || 10),
      isPlayer: false,
      faction: 'enemy',
      conditions: [],
      sourceId: mon.id,
    };
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...enc,
        broadcastEnemiesToTable: true,
        combatants: [...(enc.combatants || []), newCombatant],
      },
    });
    setIsAddEnemyModalOpen(false);
  };

  // =========================================================================
  // 5. PLAYER READ-ONLY DECKS (ATAQUES, HABILIDADES, CONJUROS)
  // =========================================================================
  const playerAttackCards = useMemo(() => {
    if (!character) return [];
    const customAtks = (character.attacks || []).map((a) => ({
      ...a,
      sourceName: a.range ? `Alcance: ${a.range}` : 'Ataque Base',
    }));
    const profBonus = calculateProficiencyBonus(character.level);
    const derivedActions = deriveAllCharacterActions(
      character.inventory || [],
      character.spells || [],
      character.featuresAndTraits || [],
      character.abilities?.str?.score ?? 10,
      character.abilities?.dex?.score ?? 10,
      profBonus
    ).map((d) => ({
      id: d.id,
      name: d.name,
      sourceName: d.sourceName || 'Arma / Objeto',
      attackBonus: d.attackBonus ?? d.potenciador ?? 0,
      damageDice: d.damageDice || d.dice || '1d6',
      damageType: d.damageType || '',
      type: (d.actionType === 'bonus' ? 'bonus' : d.actionType === 'reaction' ? 'reaction' : 'melee') as any,
      notes: d.description || '',
      imageUrl: d.imageUrl,
    }));
    const existingNames = new Set(customAtks.map((a) => a.name.toLowerCase()));
    const combined = [
      ...customAtks,
      ...derivedActions.filter((d) => !existingNames.has(d.name.toLowerCase())),
    ];
    return combined;
  }, [character]);

  const playerSkillCards = useMemo(() => {
    if (!character) return [];
    return buildDeduplicatedPlayerSkillCards(character, SKILLS_5E).map((sk) => ({
      id: sk.id,
      name: sk.name,
      abilityAbbr: ABILITY_LABELS[sk.ability].abbr,
      totalMod: sk.totalBonus,
      proficiency: sk.proficiency,
      description: sk.description,
      imageUrl: sk.imageUrl,
    }));
  }, [character]);

  const playerSpellCards = useMemo(() => {
    if (!character) return [];
    return (character.spells || []).filter((s) => s.prepared || s.level === 0);
  }, [character]);

  const currentPlayerDeckCount =
    activePlayerDeck === 'attacks'
      ? playerAttackCards.length
      : activePlayerDeck === 'skills'
      ? playerSkillCards.length
      : playerSpellCards.length;

  const maxPlayerDeckScroll = Math.max(0, currentPlayerDeckCount - 3);
  const safePlayerDeckScroll = Math.min(playerDeckScrollIdx, maxPlayerDeckScroll);

  // =========================================================================
  // 6. DICE BOX ROLL HANDLER (SUPPORTS 1 TO 6 DICE)
  // =========================================================================
  const executeDiceRoll = (
    sides: number,
    count: number,
    mod: number,
    customTitle?: string
  ) => {
    const safeCount = Math.max(1, Math.min(6, count));
    const rolls: number[] = [];
    for (let i = 0; i < safeCount; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const sumRolls = rolls.reduce((acc, r) => acc + r, 0);
    const total = sumRolls + mod;
    const formula = `${safeCount}d${sides}${mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : ''}`;
    const rollerName =
      mode === 'dm'
        ? 'Dungeon Master'
        : character
        ? character.name
        : 'Aventurero';

    const result: DiceRollResult = {
      id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rollerName,
      rollTitle: customTitle || `Tirada ${safeCount}D${sides}`,
      formula,
      mode: 'normal',
      diceType: sides,
      rolls,
      chosenRoll: sumRolls,
      modifier: mod,
      total,
      isCrit: sides === 20 && rolls.includes(20),
      isFumble: sides === 20 && rolls.includes(1) && !rolls.includes(20),
      timestamp: Date.now(),
    };

    try {
      soundFx.playDiceRoll();
    } catch {}

    setLastBoxRoll(result);
    if (onRollSubmitted) {
      onRollSubmitted(result);
    } else if (onRollComplete) {
      onRollComplete(result);
    }
  };

  // =========================================================================
  // 7. DM MAP & GALLERY PROJECTION HANDLERS
  // =========================================================================
  //Clicking a visual in Proyección de Zona previews it for the DM first (without changing players' view)
  const handleDmPreviewMapOnly = () => {
    setDmViewportMode('dm');
    setDmInspectedVisual({
      kind: 'map',
      id: `map-${selectedFolder}`,
      title: `Mapa: ${currentPlaceShortName}`,
      imageUrl: currentPlaceMapUrl,
      folder: selectedFolder,
    });
  };

  // Explicit "Proyectar" button sends the primary zone map to the players
  const handleDmSelectMapProjection = () => {
    if (!workspace || !onUpdateWorkspace) return;
    const nextVisual = {
      kind: 'map' as const,
      id: `map-${selectedFolder}`,
      title: `Mapa: ${currentPlaceShortName}`,
      imageUrl: currentPlaceMapUrl,
      folder: selectedFolder,
    };
    setDmInspectedVisual(nextVisual);
    onUpdateWorkspace({
      ...workspace,
      activeLiveVisual: nextVisual,
    });
  };

  const handleDmPreviewZoneMapOnly = (zMap: ZoneMapRecord) => {
    setDmViewportMode('dm');
    setDmInspectedVisual({
      kind: 'map',
      id: zMap.id,
      title: zMap.title,
      imageUrl: zMap.imageUrl,
      folder: zMap.folder,
    });
  };

  const handleDmProjectZoneMap = (zMap: ZoneMapRecord) => {
    if (!workspace || !onUpdateWorkspace) return;
    const nextVisual = {
      kind: 'map' as const,
      id: zMap.id,
      title: zMap.title,
      imageUrl: zMap.imageUrl,
      folder: zMap.folder,
    };
    setDmInspectedVisual(nextVisual);
    onUpdateWorkspace({
      ...workspace,
      activeLiveVisual: nextVisual,
    });
  };

  const handleDmPreviewGalleryPhotoOnly = (photo: PlaceAlbumPhoto) => {
    setDmViewportMode('dm');
    setDmInspectedVisual({
      kind: 'album',
      id: photo.id,
      title: photo.title,
      imageUrl: photo.imageUrl,
      folder: selectedFolder,
    });
  };

  const handleDmSelectGalleryPhoto = (photo: PlaceAlbumPhoto) => {
    if (!workspace || !onUpdateWorkspace) return;
    const nextVisual = {
      kind: 'album' as const,
      id: photo.id,
      title: photo.title,
      imageUrl: photo.imageUrl,
      folder: selectedFolder,
    };
    setDmInspectedVisual(nextVisual);
    onUpdateWorkspace({
      ...workspace,
      activeLiveVisual: nextVisual,
    });
  };

  const handleDmPreviewTacticalMapOnly = (tMap: LocationRecord) => {
    setDmViewportMode('dm');
    setDmInspectedVisual({
      kind: 'tactical',
      id: tMap.id,
      title: tMap.name,
      imageUrl: tMap.mapImageUrl || '',
      folder: tMap.folder,
    });
  };

  const handleDmProjectTacticalMap = (tMap: LocationRecord) => {
    if (!workspace || !onUpdateWorkspace) return;
    const nextVisual = {
      kind: 'tactical' as const,
      id: tMap.id,
      title: tMap.name,
      imageUrl: tMap.mapImageUrl || '',
      folder: tMap.folder,
      gridCols: tMap.gridCols || 10,
      gridRows: tMap.gridRows || 10,
      tacticalTokens: tMap.tokens || [],
    };
    setDmInspectedVisual({
      kind: 'tactical',
      id: tMap.id,
      title: tMap.name,
      imageUrl: tMap.mapImageUrl || '',
      folder: tMap.folder,
    });
    onUpdateWorkspace({
      ...workspace,
      activeLiveVisual: nextVisual,
    });
  };

  const handleDmEnqueueVisual = (item: {
    id?: string;
    sourceId?: string;
    kind: 'map' | 'album' | 'tactical';
    title: string;
    imageUrl?: string;
    folder?: string;
  }) => {
    if (!workspace || !onUpdateWorkspace) return;
    const nextQueue = enqueueVisualItem(workspace.visualQueue, item);
    onUpdateWorkspace({
      ...workspace,
      visualQueue: nextQueue,
    });
  };

  const handleDmRemoveFromQueue = (queueItemId: string) => {
    if (!workspace || !onUpdateWorkspace) return;
    const nextQueue = removeVisualFromQueue(workspace.visualQueue, queueItemId);
    onUpdateWorkspace({
      ...workspace,
      visualQueue: nextQueue,
    });
  };

  const handleDmSaveEditedVisualItem = () => {
    if (!editingVisualItem || !workspace || !onUpdateWorkspace) return;
    const { kind, id, title, imageUrl, folder, gridCols, gridRows } = editingVisualItem;
    const cleanTitle = title.trim() || 'Visual';
    const cleanUrl = imageUrl.trim();
    const cleanFolder = folder.trim() || 'General';

    if (kind === 'map') {
      const nextAtlasMaps = { ...(workspace.atlasMaps || {}), [selectedFolder]: cleanUrl };
      onUpdateWorkspace({
        ...workspace,
        atlasMaps: nextAtlasMaps,
      });
    } else if (kind === 'zonemap') {
      const nextZoneMaps = (workspace.zoneMaps || []).map((zm) =>
        zm.id === id ? { ...zm, title: cleanTitle, imageUrl: cleanUrl, folder: cleanFolder } : zm
      );
      onUpdateWorkspace({
        ...workspace,
        zoneMaps: nextZoneMaps,
      });
    } else if (kind === 'album') {
      const nextPhotos = (workspace.placeAlbumPhotos || []).map((p) =>
        p.id === id ? { ...p, title: cleanTitle, imageUrl: cleanUrl, folder: cleanFolder } : p
      );
      onUpdateWorkspace({
        ...workspace,
        placeAlbumPhotos: nextPhotos,
      });
    } else if (kind === 'tactical') {
      const nextLocations = (workspace.locations || []).map((loc) =>
        loc.id === id
          ? {
              ...loc,
              name: cleanTitle,
              mapImageUrl: cleanUrl,
              folder: cleanFolder,
              gridCols: gridCols || loc.gridCols || 10,
              gridRows: gridRows || loc.gridRows || 10,
            }
          : loc
      );
      onUpdateWorkspace({
        ...workspace,
        locations: nextLocations,
      });
    }
    setEditingVisualItem(null);
  };

  const handleCreateQuickTacticalMapInTable = () => {
    if (!newTacticalUrl.trim() || !workspace || !onUpdateWorkspace) return;
    const newLoc: LocationRecord = {
      id: `tactical-${Date.now()}`,
      name: newTacticalTitle.trim() || `Tablero Táctico de ${currentPlaceShortName}`,
      type: 'Mapa Táctico',
      status: 'Explorando',
      description: 'Mapa táctico con cuadrícula y fichas.',
      dmSecrets: '',
      folder: selectedFolder === 'all' ? 'General' : selectedFolder,
      mapImageUrl: newTacticalUrl.trim(),
      gridCols: Math.max(4, Math.min(24, Number(newTacticalCols) || 10)),
      gridRows: Math.max(4, Math.min(24, Number(newTacticalRows) || 10)),
      tokens: [],
    };
    onUpdateWorkspace({
      ...workspace,
      locations: [newLoc, ...(workspace.locations || [])],
    });
    setDmViewportMode('dm');
    setDmInspectedVisual({
      kind: 'tactical',
      id: newLoc.id,
      title: newLoc.name,
      imageUrl: newLoc.mapImageUrl || '',
      folder: newLoc.folder,
    });
    setNewTacticalTitle('');
    setNewTacticalUrl('');
  };

  // Active Tactical Map LocationRecord resolution (when activeVisual.kind === 'tactical')
  const activeTacticalLocation = useMemo(() => {
    if (activeVisual.kind !== 'tactical') return null;
    if (workspace) {
      const byId = (workspace.locations || []).find(
        (l) =>
          l.id === activeVisual.id ||
          `tactical-${l.tacticalConfig?.id}` === activeVisual.id ||
          `loc-tactical-${l.tacticalConfig?.id}` === l.id
      );
      if (byId) return byId;
      const byUrl = (workspace.locations || []).find(
        (l) => l.mapImageUrl && l.mapImageUrl === activeVisual.imageUrl
      );
      if (byUrl) return byUrl;
    }
    return null;
  }, [activeVisual, workspace]);

  const [localPlayerTacticalConfig, setLocalPlayerTacticalConfig] =
    useState<TacticalMapConfig | null>(null);

  const activeTacticalConfig: TacticalMapConfig | null = useMemo(() => {
    const raw =
      activeTacticalLocation?.tacticalConfig ||
      workspace?.activeLiveVisual?.tacticalConfig ||
      liveProjection?.tacticalConfig ||
      localPlayerTacticalConfig ||
      null;
    return raw;
  }, [
    activeTacticalLocation,
    workspace?.activeLiveVisual?.tacticalConfig,
    liveProjection?.tacticalConfig,
    localPlayerTacticalConfig,
  ]);

  const handleSaveTacticalMapFromTable = (
    tacticalCfg: TacticalMapConfig,
    existingLocationId?: string
  ) => {
    if (!workspace || !onUpdateWorkspace) return;
    const folderTarget = selectedFolder !== 'all' ? selectedFolder : 'General';
    const existingLoc = existingLocationId
      ? (workspace.locations || []).find((l) => l.id === existingLocationId)
      : (workspace.locations || []).find(
          (l) => l.tacticalConfig?.id === tacticalCfg.id || l.name === tacticalCfg.name
        );

    const locId = existingLoc ? existingLoc.id : `loc-tactical-${tacticalCfg.id}`;
    const updatedLoc: LocationRecord = existingLoc
      ? {
          ...existingLoc,
          name: tacticalCfg.name,
          title: tacticalCfg.name,
          mapImageUrl: tacticalCfg.layers[0]?.bgImageUrl || existingLoc.mapImageUrl,
          gridCols: tacticalCfg.gridCols,
          gridRows: tacticalCfg.gridRows,
          tacticalConfig: tacticalCfg,
        }
      : {
          id: locId,
          name: tacticalCfg.name,
          title: tacticalCfg.name,
          region: currentPlaceShortName || 'General',
          type: 'Mapa Táctico',
          description: `Mapa táctico (${tacticalCfg.gridCols}x${tacticalCfg.gridRows})`,
          secretsForDm: '',
          notes: '',
          evolution: '',
          pointsOfInterest: [],
          folder: folderTarget,
          mapImageUrl: tacticalCfg.layers[0]?.bgImageUrl || '',
          gridCols: tacticalCfg.gridCols,
          gridRows: tacticalCfg.gridRows,
          tacticalConfig: tacticalCfg,
        };

    const nextLocations = existingLoc
      ? (workspace.locations || []).map((l) => (l.id === existingLoc.id ? updatedLoc : l))
      : [updatedLoc, ...(workspace.locations || [])];

    onUpdateWorkspace({
      ...workspace,
      locations: nextLocations,
    });
  };

  const handleProjectTacticalMapFromTable = (tacticalCfg: TacticalMapConfig) => {
    setLocalPlayerTacticalConfig(tacticalCfg);
    if (!workspace || !onUpdateWorkspace) return;
    const folderTarget = selectedFolder !== 'all' ? selectedFolder : 'General';
    const existingLoc = (workspace.locations || []).find(
      (l) => l.tacticalConfig?.id === tacticalCfg.id || l.name === tacticalCfg.name
    );
    const locId = existingLoc ? existingLoc.id : `loc-tactical-${tacticalCfg.id}`;
    const updatedLoc: LocationRecord = existingLoc
      ? {
          ...existingLoc,
          name: tacticalCfg.name,
          title: tacticalCfg.name,
          mapImageUrl: tacticalCfg.layers[0]?.bgImageUrl || existingLoc.mapImageUrl,
          gridCols: tacticalCfg.gridCols,
          gridRows: tacticalCfg.gridRows,
          tacticalConfig: tacticalCfg,
        }
      : {
          id: locId,
          name: tacticalCfg.name,
          title: tacticalCfg.name,
          region: currentPlaceShortName || 'General',
          type: 'Mapa Táctico',
          description: `Mapa táctico (${tacticalCfg.gridCols}x${tacticalCfg.gridRows})`,
          secretsForDm: '',
          notes: '',
          evolution: '',
          pointsOfInterest: [],
          folder: folderTarget,
          mapImageUrl: tacticalCfg.layers[0]?.bgImageUrl || '',
          gridCols: tacticalCfg.gridCols,
          gridRows: tacticalCfg.gridRows,
          tacticalConfig: tacticalCfg,
        };
    const nextLocations = existingLoc
      ? (workspace.locations || []).map((l) => (l.id === existingLoc.id ? updatedLoc : l))
      : [updatedLoc, ...(workspace.locations || [])];

    const liveVisual = {
      kind: 'tactical' as const,
      id: `tactical-${tacticalCfg.id}`,
      title: tacticalCfg.name,
      imageUrl: tacticalCfg.layers[0]?.bgImageUrl || '',
      folder: folderTarget,
      gridCols: tacticalCfg.gridCols,
      gridRows: tacticalCfg.gridRows,
      tacticalConfig: tacticalCfg,
    };
    setDmInspectedVisual({
      kind: 'tactical',
      id: liveVisual.id,
      title: liveVisual.title,
      imageUrl: liveVisual.imageUrl,
      folder: folderTarget,
    });
    onUpdateWorkspace({
      ...workspace,
      locations: nextLocations,
      activeLocationId: locId,
      dmPreviewVisual: liveVisual,
      activeLiveVisual: liveVisual,
    });
  };

  const tacticalCharactersById = useMemo(() => {
    const map: Record<string, Character5e> = {};
    for (const p of resolvedPlayerCards) {
      map[p.characterId] = {
        id: p.characterId,
        name: p.characterName,
        playerName: p.playerName,
        race: p.race || 'Humano',
        characterClass: p.characterClass || 'Guerrero',
        subclass: '',
        level: p.level || 1,
        xp: p.experience || 0,
        experience: p.experience || 0,
        background: '',
        alignment: p.alignment || 'Neutral Bueno',
        avatarType: p.avatarType,
        avatarCustomUrl: p.avatarCustomUrl || p.avatarUrl,
        avatarIcon: p.avatarIcon,
        avatarUrl: p.avatarCustomUrl || p.avatarUrl,
        currentHp: p.currentHp,
        hpCurrent: p.currentHp,
        maxHp: p.maxHp,
        hpMax: p.maxHp,
        tempHp: 0,
        armorClass: p.ac,
        ac: p.ac,
        initiativeBonus: p.initiative || 0,
        speed: p.speed || 30,
        hitDiceTotal: `${p.level || 1}d10`,
        hitDiceRemaining: p.level || 1,
        deathSaves: { successes: 0, failures: 0 },
        abilities: {
          str: { score: p.abilities?.str ?? 10, saveProficient: false },
          dex: { score: p.abilities?.dex ?? 10, saveProficient: false },
          con: { score: p.abilities?.con ?? 10, saveProficient: false },
          int: { score: p.abilities?.int ?? 10, saveProficient: false },
          wis: { score: p.abilities?.wis ?? 10, saveProficient: false },
          cha: { score: p.abilities?.cha ?? 10, saveProficient: false },
        },
        skills: {} as any,
        attacks: [],
        spells: [],
        inventory: [],
        currency: p.currency || { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
        coins: p.currency || { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
        proficienciesAndLanguages: '',
        featuresAndTraits: [],
        backstory: '',
        alliesAndOrganizations: '',
        treasureNotes: '',
      };
    }
    if (character) {
      map[character.id] = character;
    }
    return map;
  }, [resolvedPlayerCards, character]);

  const applyUpdatedTacticalConfigToWorkspace = (nextConfig: TacticalMapConfig) => {
    setLocalPlayerTacticalConfig(nextConfig);
    if (workspace && onUpdateWorkspace) {
      const nextLocations = (workspace.locations || []).map((loc) =>
        loc.tacticalConfig?.id === nextConfig.id
          ? { ...loc, tacticalConfig: nextConfig }
          : loc
      );
      const nextLiveVisual =
        workspace.activeLiveVisual?.tacticalConfig?.id === nextConfig.id ||
        workspace.activeLiveVisual?.kind === 'tactical'
          ? {
              ...workspace.activeLiveVisual,
              kind: 'tactical' as const,
              tacticalConfig: nextConfig,
            }
          : workspace.activeLiveVisual;
      onUpdateWorkspace({
        ...workspace,
        locations: nextLocations,
        activeLiveVisual: nextLiveVisual,
      });
    }
  };

  const syncTacticalActionToServer = (payload: {
    action: 'move' | 'modify' | 'delete' | 'replace_config';
    tokenId?: string;
    targetCol?: number;
    targetRow?: number;
    newLayerId?: TacticalLayerId;
    patch?: Partial<TacticalMapToken>;
    tacticalConfig?: TacticalMapConfig;
  }) => {
    if (!roomCode) return;
    fetch(`/api/session/room/${encodeURIComponent(roomCode)}/tactical-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorMode: mode,
        actorCharacterId: character?.id,
        ...payload,
      }),
    }).catch(() => {});
  };

  const handleTacticalCanvasTokenMove = (
    tokenId: string,
    targetCol: number,
    targetRow: number,
    newLayerId: TacticalLayerId
  ) => {
    if (!activeTacticalConfig) return;
    const targetToken = activeTacticalConfig.tokens.find((t) => t.id === tokenId);
    if (!targetToken) return;

    // Enforce strict player ownership on move
    if (mode === 'player' && !isTokenOwnedByPlayer(targetToken, character?.id)) {
      return;
    }

    const nextConfig: TacticalMapConfig = {
      ...activeTacticalConfig,
      tokens: activeTacticalConfig.tokens.map((t) =>
        t.id === tokenId
          ? { ...t, col: targetCol, row: targetRow, layerId: newLayerId }
          : t
      ),
    };
    applyUpdatedTacticalConfigToWorkspace(nextConfig);
    syncTacticalActionToServer({
      action: 'move',
      tokenId,
      targetCol,
      targetRow,
      newLayerId,
      tacticalConfig: nextConfig,
    });
  };

  const handleDmModifyTacticalToken = (
    tokenId: string,
    patch: Partial<TacticalMapToken>
  ) => {
    if (mode !== 'dm' || !activeTacticalConfig) return;
    const modRes = modifyTacticalTokenLive({
      config: activeTacticalConfig,
      tokenId,
      patch,
      actorMode: mode,
      actorCharacterId: character?.id,
    });
    if (!modRes.allowed || !modRes.updatedToken) return;

    const updatedTok = modRes.updatedToken;

    // Update workspace & local state
    setLocalPlayerTacticalConfig(modRes.config);
    if (workspace && onUpdateWorkspace) {
      const nextLocations = (workspace.locations || []).map((loc) =>
        loc.tacticalConfig?.id === modRes.config.id
          ? { ...loc, tacticalConfig: modRes.config }
          : loc
      );
      const nextLiveVisual =
        workspace.activeLiveVisual?.tacticalConfig?.id === modRes.config.id ||
        workspace.activeLiveVisual?.kind === 'tactical'
          ? {
              ...workspace.activeLiveVisual,
              kind: 'tactical' as const,
              tacticalConfig: modRes.config,
            }
          : workspace.activeLiveVisual;

      // If this is an enemy token and HP/AC/Name changed, also sync activeEncounter combatants if matching
      let nextEncounter = workspace.activeEncounter;
      if (
        (updatedTok.tokenType === 'enemy' || updatedTok.kind === 'enemy') &&
        workspace.activeEncounter
      ) {
        const nextCombatants = (workspace.activeEncounter.combatants || []).map((c) => {
          if (
            c.id === updatedTok.id ||
            (updatedTok.monsterId && c.sourceId === updatedTok.monsterId) ||
            c.name.toLowerCase() === (updatedTok.name || '').toLowerCase()
          ) {
            return {
              ...c,
              name: updatedTok.name || c.name,
              hp: updatedTok.hpCurrent ?? updatedTok.hp ?? c.hp,
              maxHp: updatedTok.hpMax ?? updatedTok.maxHp ?? c.maxHp,
              ac: updatedTok.ac ?? c.ac,
            };
          }
          return c;
        });
        nextEncounter = {
          ...workspace.activeEncounter,
          combatants: nextCombatants,
        };
      }

      onUpdateWorkspace({
        ...workspace,
        locations: nextLocations,
        activeLiveVisual: nextLiveVisual,
        activeEncounter: nextEncounter,
      });
    }

    // If this is a player token and HP was modified by DM, also sync to the live player sheet in room!
    if (
      (updatedTok.tokenType === 'player' || updatedTok.kind === 'player') &&
      updatedTok.characterId &&
      (patch.hpCurrent !== undefined || patch.hp !== undefined)
    ) {
      const nextHpVal = updatedTok.hpCurrent ?? updatedTok.hp ?? 0;
      const prevPlayer = resolvedPlayerCards.find(
        (p) => p.characterId === updatedTok.characterId
      );
      if (prevPlayer && onDmAdjustPlayer) {
        const delta = nextHpVal - prevPlayer.currentHp;
        if (delta !== 0) {
          onDmAdjustPlayer(updatedTok.characterId, { hpDelta: delta });
        }
      }
      if (roomCode) {
        fetch(`/api/session/room/${encodeURIComponent(roomCode)}/dm-adjust-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: updatedTok.characterId,
            setHp: nextHpVal,
          }),
        }).catch(() => {});
      }
    }

    syncTacticalActionToServer({
      action: 'modify',
      tokenId,
      patch,
      tacticalConfig: modRes.config,
    });
  };

  const handleDmDeleteTacticalToken = (tokenId: string) => {
    if (mode !== 'dm' || !activeTacticalConfig) return;
    const nextConfig: TacticalMapConfig = {
      ...activeTacticalConfig,
      tokens: activeTacticalConfig.tokens.filter((t) => t.id !== tokenId),
    };
    applyUpdatedTacticalConfigToWorkspace(nextConfig);
    syncTacticalActionToServer({
      action: 'delete',
      tokenId,
      tacticalConfig: nextConfig,
    });
  };

  const handleDmAddPlayersToRichTacticalMap = () => {
    if (mode !== 'dm' || !activeTacticalConfig) return;
    const existingTokens = [...activeTacticalConfig.tokens];
    const sourcePlayers =
      resolvedPlayerCards.length > 0
        ? resolvedPlayerCards
        : [
            {
              characterId: 'sample-valeros',
              characterName: 'Valeros del Alba',
              playerName: 'Jugador',
              currentHp: 28,
              maxHp: 28,
              ac: 18,
              passivePerception: 12,
              level: 3,
              characterClass: 'Humano Guerrero',
              lastPing: Date.now(),
            } as PartyMemberLive,
          ];

    sourcePlayers.forEach((p, idx) => {
      const alreadyExists = existingTokens.some(
        (t) =>
          t.characterId === p.characterId ||
          t.id === `tok-player-${p.characterId}` ||
          t.id === `token-player-${p.characterId}`
      );
      if (!alreadyExists) {
        existingTokens.push({
          id: `tok-player-${p.characterId}`,
          name: p.characterName,
          label: p.characterName,
          tokenType: 'player',
          kind: 'player',
          characterId: p.characterId,
          imageUrl: p.avatarCustomUrl || p.avatarUrl,
          avatarUrl: p.avatarCustomUrl || p.avatarUrl,
          col: Math.min(activeTacticalConfig.gridCols - 2, 1 + (idx % 4) * 2),
          row: Math.min(activeTacticalConfig.gridRows - 2, 1 + Math.floor(idx / 4) * 2),
          layerId: 2,
          hpCurrent: p.currentHp,
          hp: p.currentHp,
          hpMax: p.maxHp,
          maxHp: p.maxHp,
          ac: p.ac,
        });
      }
    });

    const nextConfig: TacticalMapConfig = {
      ...activeTacticalConfig,
      tokens: existingTokens,
    };
    applyUpdatedTacticalConfigToWorkspace(nextConfig);
    syncTacticalActionToServer({
      action: 'replace_config',
      tacticalConfig: nextConfig,
    });
  };

  const handleDmAddMonsterToRichTacticalMap = () => {
    if (mode !== 'dm' || !activeTacticalConfig) return;
    const existingTokens = [...activeTacticalConfig.tokens];
    const enemyCount = existingTokens.filter(
      (t) => t.tokenType === 'enemy' || t.kind === 'enemy'
    ).length;
    const firstMon = workspace?.monsters?.[enemyCount % Math.max(1, workspace?.monsters?.length || 1)];
    const newTok: TacticalMapToken = {
      id: `tok-enemy-${Date.now().toString().slice(-5)}`,
      name: firstMon ? `${firstMon.name} ${enemyCount + 1}` : `Trasgo ${enemyCount + 1}`,
      label: firstMon ? `${firstMon.name} ${enemyCount + 1}` : `Trasgo ${enemyCount + 1}`,
      tokenType: 'enemy',
      kind: 'enemy',
      monsterId: firstMon?.id,
      imageUrl: firstMon?.avatarCustomUrl || firstMon?.avatarUrl,
      col: Math.min(
        activeTacticalConfig.gridCols - 1,
        Math.floor(activeTacticalConfig.gridCols / 2) + (enemyCount % 3)
      ),
      row: Math.min(
        activeTacticalConfig.gridRows - 1,
        Math.floor(activeTacticalConfig.gridRows / 2)
      ),
      layerId: 2,
      hpCurrent: firstMon?.maxHp || 18,
      hp: firstMon?.maxHp || 18,
      hpMax: firstMon?.maxHp || 18,
      maxHp: firstMon?.maxHp || 18,
      ac: firstMon?.ac || 14,
    };
    const nextConfig: TacticalMapConfig = {
      ...activeTacticalConfig,
      tokens: [...existingTokens, newTok],
    };
    applyUpdatedTacticalConfigToWorkspace(nextConfig);
    syncTacticalActionToServer({
      action: 'replace_config',
      tacticalConfig: nextConfig,
    });
  };

  const activeTacticalGridCols =
    activeTacticalConfig?.gridCols ||
    activeTacticalLocation?.gridCols ||
    workspace?.activeLiveVisual?.gridCols ||
    liveProjection?.tacticalGridCols ||
    10;
  const activeTacticalGridRows =
    activeTacticalConfig?.gridRows ||
    activeTacticalLocation?.gridRows ||
    workspace?.activeLiveVisual?.gridRows ||
    liveProjection?.tacticalGridRows ||
    10;
  const activeTacticalTokens: TacticalMapToken[] =
    activeTacticalLocation?.tokens ||
    workspace?.activeLiveVisual?.tacticalTokens ||
    liveProjection?.tacticalTokens ||
    [];

  const handleMoveTokenOnActiveTacticalMap = (col: number, row: number) => {
    if (!selectedTacticalTokenId) return;
    const selectedTok = activeTacticalTokens.find((t) => t.id === selectedTacticalTokenId);
    if (!selectedTok) return;
    // In player mode, player can only move their own token
    if (mode === 'player' && !isTokenOwnedByPlayer(selectedTok, character?.id)) {
      return;
    }

    const nextTokens = moveTacticalTokenOnGrid(
      activeTacticalTokens,
      selectedTacticalTokenId,
      col,
      row,
      activeTacticalGridCols,
      activeTacticalGridRows
    );
    if (workspace && onUpdateWorkspace) {
      const targetId = activeTacticalLocation?.id || activeVisual.id;
      const nextLocations = (workspace.locations || []).map((loc) =>
        loc.id === targetId ? { ...loc, tokens: nextTokens } : loc
      );
      const isCurrentlyLive =
        workspace.activeLiveVisual?.kind === 'tactical' &&
        (workspace.activeLiveVisual?.id === targetId ||
          workspace.activeLiveVisual?.imageUrl === activeVisual.imageUrl);

      onUpdateWorkspace({
        ...workspace,
        locations: nextLocations,
        activeLiveVisual:
          isCurrentlyLive && workspace.activeLiveVisual
            ? {
                ...workspace.activeLiveVisual,
                tacticalTokens: nextTokens,
              }
            : workspace.activeLiveVisual,
      });
    }
  };

  const handlePopulatePlayersOnTacticalMap = () => {
    if (mode !== 'dm' || !workspace || !onUpdateWorkspace) return;
    const targetId = activeTacticalLocation?.id || activeVisual.id;
    const existingTokens = [...activeTacticalTokens];
    const sourcePlayers = resolvedPlayerCards;
    sourcePlayers.forEach((p, idx) => {
      const tokenId = `token-player-${p.characterId}`;
      if (!existingTokens.some((t) => t.id === tokenId)) {
        existingTokens.push({
          id: tokenId,
          label: p.characterName,
          col: Math.min(activeTacticalGridCols - 1, 1 + (idx % 4)),
          row: Math.min(activeTacticalGridRows - 1, activeTacticalGridRows - 2),
          kind: 'player',
          color: '#10b981',
          avatarUrl: p.avatarCustomUrl,
        });
      }
    });
    const nextLocations = (workspace.locations || []).map((loc) =>
      loc.id === targetId ? { ...loc, tokens: existingTokens } : loc
    );
    const isCurrentlyLive =
      workspace.activeLiveVisual?.kind === 'tactical' &&
      (workspace.activeLiveVisual?.id === targetId ||
        workspace.activeLiveVisual?.imageUrl === activeVisual.imageUrl);

    onUpdateWorkspace({
      ...workspace,
      locations: nextLocations,
      activeLiveVisual:
        isCurrentlyLive && workspace.activeLiveVisual
          ? { ...workspace.activeLiveVisual, tacticalTokens: existingTokens }
          : workspace.activeLiveVisual,
    });
    if (existingTokens[0] && !selectedTacticalTokenId) {
      setSelectedTacticalTokenId(existingTokens[0].id);
    }
  };

  const handleAddEnemyTokenToTacticalMap = () => {
    if (mode !== 'dm' || !workspace || !onUpdateWorkspace) return;
    const targetId = activeTacticalLocation?.id || activeVisual.id;
    const existingTokens = [...activeTacticalTokens];
    const enemyNum = existingTokens.filter((t) => t.kind === 'enemy').length + 1;
    const newToken: TacticalMapToken = {
      id: `token-enemy-${Date.now()}`,
      label: `Enemigo ${enemyNum}`,
      col: Math.min(activeTacticalGridCols - 1, Math.floor(activeTacticalGridCols / 2)),
      row: Math.min(activeTacticalGridRows - 1, 2),
      kind: 'enemy',
      color: '#ef4444',
    };
    const nextTokens = [...existingTokens, newToken];
    const nextLocations = (workspace.locations || []).map((loc) =>
      loc.id === targetId ? { ...loc, tokens: nextTokens } : loc
    );
    const isCurrentlyLive =
      workspace.activeLiveVisual?.kind === 'tactical' &&
      (workspace.activeLiveVisual?.id === targetId ||
        workspace.activeLiveVisual?.imageUrl === activeVisual.imageUrl);

    onUpdateWorkspace({
      ...workspace,
      locations: nextLocations,
      activeLiveVisual:
        isCurrentlyLive && workspace.activeLiveVisual
          ? { ...workspace.activeLiveVisual, tacticalTokens: nextTokens }
          : workspace.activeLiveVisual,
    });
    setSelectedTacticalTokenId(newToken.id);
  };

  const handleDmUploadMapFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace || !onUpdateWorkspace) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1000, 0.86);
      onUpdateWorkspace({
        ...workspace,
        atlasMaps: {
          ...(workspace.atlasMaps || {}),
          [selectedFolder]: dataUrl,
        },
        activeLiveVisual: {
          kind: 'map',
          id: `map-${selectedFolder}`,
          title: `Mapa: ${currentPlaceShortName}`,
          imageUrl: dataUrl,
          folder: selectedFolder,
        },
      });
    } catch {}
    e.target.value = '';
  };

  const handleDmUploadGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace || !onUpdateWorkspace) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1000, 0.86);
      const newPhoto: PlaceAlbumPhoto = {
        id: `photo-${Date.now()}`,
        title: newGalleryTitle.trim() || `Escena de ${currentPlaceShortName}`,
        imageUrl: dataUrl,
        folder: selectedFolder === 'all' ? 'General' : selectedFolder,
        createdAt: Date.now(),
      };
      onUpdateWorkspace({
        ...workspace,
        placeAlbumPhotos: [newPhoto, ...(workspace.placeAlbumPhotos || [])],
        activeLiveVisual: {
          kind: 'album',
          id: newPhoto.id,
          title: newPhoto.title,
          imageUrl: newPhoto.imageUrl,
          folder: selectedFolder,
        },
      });
      setNewGalleryTitle('');
    } catch {}
    e.target.value = '';
  };

  const handleDmAddGalleryByUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGalleryUrl.trim() || !workspace || !onUpdateWorkspace) return;
    const newPhoto: PlaceAlbumPhoto = {
      id: `photo-${Date.now()}`,
      title: newGalleryTitle.trim() || `Escena de ${currentPlaceShortName}`,
      imageUrl: newGalleryUrl.trim(),
      folder: selectedFolder === 'all' ? 'General' : selectedFolder,
      createdAt: Date.now(),
    };
    onUpdateWorkspace({
      ...workspace,
      placeAlbumPhotos: [newPhoto, ...(workspace.placeAlbumPhotos || [])],
      activeLiveVisual: {
        kind: 'album',
        id: newPhoto.id,
        title: newPhoto.title,
        imageUrl: newPhoto.imageUrl,
        folder: selectedFolder,
      },
    });
    setNewGalleryTitle('');
    setNewGalleryUrl('');
    setIsEditMapModalOpen(false);
  };

  const handleDmCreateSubPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubPlaceName.trim() || !workspace || !onUpdateWorkspace) return;
    const clean = newSubPlaceName.trim().replace(/\//g, '-');
    const newFolderPath =
      selectedFolder === 'all' ? clean : `${selectedFolder} / ${clean}`;
    const existingFolders = workspace.folders || [];
    const nextFolders = existingFolders.includes(newFolderPath)
      ? existingFolders
      : [...existingFolders, newFolderPath];

    onUpdateWorkspace({
      ...workspace,
      folders: nextFolders,
      activeAtlasFolder: newFolderPath,
      activeLiveVisual: {
        kind: 'map',
        id: `map-${newFolderPath}`,
        title: clean,
        imageUrl: workspace.atlasMaps?.[newFolderPath] || '',
        folder: newFolderPath,
      },
    });
    setNewSubPlaceName('');
    setIsAddSubPlaceModalOpen(false);
  };

  // =========================================================================
  // 8. NOTEBOOK / CHRONICLES HANDLERS
  // =========================================================================
  const handleSaveDmQuickChronicle = () => {
    if (!workspace || !onUpdateWorkspace) return;
    if (!dmQuickLogTitle.trim() && !dmQuickLogSummary.trim()) return;
    const newEntry = {
      id: `log-${Date.now()}`,
      sessionNumber: (workspace.campaignLogs?.length || 0) + 1,
      title: dmQuickLogTitle.trim() || `Crónica en ${currentPlaceShortName}`,
      date: new Date().toLocaleDateString(),
      summary: dmQuickLogSummary.trim(),
      publicNotes: dmQuickLogSummary.trim(),
      privateNotes: '',
      tags: [currentPlaceShortName],
      folder: selectedFolder === 'all' ? 'General' : selectedFolder,
    };
    onUpdateWorkspace({
      ...workspace,
      campaignLogs: [newEntry, ...(workspace.campaignLogs || [])],
    });
    setDmQuickLogTitle('');
    setDmQuickLogSummary('');
    setNotebookSavedFeedback('✓ Entrada guardada en Crónicas');
    setTimeout(() => setNotebookSavedFeedback(''), 2500);
  };

  const handleSendLiveMessageFromDm = () => {
    if (mode !== 'dm') return;
    if (workspace && onUpdateWorkspace) {
      onUpdateWorkspace({
        ...workspace,
        dmLiveMessage: dmMessageInput,
      });
    }
    if (onUpdateDmLiveMessage) {
      onUpdateDmLiveMessage(dmMessageInput);
    }
    setDmMessageSentToast(true);
    setTimeout(() => setDmMessageSentToast(false), 2500);
  };

  const handleSendWhisperToDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendPlayerMessageToDM || !whisperTitle.trim() || !whisperBody.trim()) return;
    const res = await onSendPlayerMessageToDM(whisperTitle.trim(), whisperBody.trim());
    if (res.ok) {
      setWhisperStatus('✓ Mensaje enviado al Dungeon Master');
      setWhisperTitle('');
      setWhisperBody('');
      setTimeout(() => {
        setWhisperStatus('');
        setIsWhisperModalOpen(false);
      }, 1500);
    } else {
      setWhisperStatus(res.error || 'Error al enviar el mensaje');
    }
  };

  const latestRoll = useMemo(
    () => pickMostRecentRoll(rollFeed, lastBoxRoll),
    [rollFeed, lastBoxRoll]
  );

  return (
    <div
      className="w-full max-w-[1920px] mx-auto px-1 sm:px-2.5 py-2 text-stone-200 select-none flex flex-col gap-2.5 rounded-2xl transition-colors"
      data-testid="table-map-view"
      data-player-skin-id={mode === 'player' ? activePlayerSkinRecord?.id || 'default' : undefined}
      data-dm-skin-id={mode === 'dm' ? activeDmSkinRecord?.id || 'default' : undefined}
      style={
        mode === 'dm'
          ? {
              backgroundColor: activeDmSkinTokens?.dmScreenBgColor || undefined,
              backgroundImage: activeDmSkinTokens?.dmScreenCustomBgTextureUrl
                ? `url(${activeDmSkinTokens.dmScreenCustomBgTextureUrl})`
                : undefined,
              backgroundSize: 'cover',
            }
          : {
              backgroundColor:
                resolvedPlayerMap.wallpaperColor ||
                activePlayerSkinTokens?.playerSheetBgColor ||
                undefined,
              backgroundImage: resolvedPlayerMap.wallpaperUrl
                ? `url(${resolvedPlayerMap.wallpaperUrl})`
                : undefined,
              backgroundSize: 'cover',
            }
      }
    >
      {/* =================================================================== */}
      {/* MAIN 2-COLUMN TABLETOP MAP GRID (Full Left Expansion + Right Column) */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_325px] xl:grid-cols-[minmax(0,1fr)_350px] gap-2.5 items-stretch">
        {/* ================================================================= */}
        {/* LEFT/CENTER EXPANDED COLUMN: MAP VIEWPORT + MINIMIZABLE OVERLAYS  */}
        {/* ================================================================= */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* DM-ONLY TOP LOCATION SWITCHER BAR ("Ruta de la Zona") */}
          {mode === 'dm' && workspace && (
            <div
              className="bg-gradient-to-r from-[#191b24] via-[#151720] to-[#191b24] border-2 border-[#c8a45c]/75 rounded-2xl px-3.5 py-2.5 shadow-xl space-y-2"
              data-testid="dm-map-top-location-bar"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {selectedFolder !== 'all' && (
                    <button
                      type="button"
                      data-testid="btn-dm-map-up-zone"
                      onClick={() => setDmSelectedFolder(getParentAtlasFolder(selectedFolder))}
                      className="px-2.5 py-1 rounded-xl bg-amber-950/90 hover:bg-amber-900 border border-[#e2c275] text-[#f5e4be] font-cinzel font-bold text-xs flex items-center gap-1 transition cursor-pointer shrink-0 shadow"
                      title="Regresar a la zona anterior / nivel superior"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-amber-300" />
                      <span>Zona Anterior</span>
                    </button>
                  )}
                  <span className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] truncate">
                    Ruta de la Zona ( 🍺 {currentPlaceShortName} )
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {/* Direct All-Zones Dropdown Selector */}
                  <select
                    data-testid="select-dm-map-zone-top"
                    value={selectedFolder}
                    onChange={(e) => setDmSelectedFolder(e.target.value)}
                    className="px-2.5 py-1 rounded-xl bg-[#12141c] border border-[#c8a45c]/75 text-[#f5e4be] font-cinzel font-bold text-xs focus:outline-none focus:border-amber-400 cursor-pointer max-w-[210px]"
                    title="Cambiar directamente a cualquier zona del mundo"
                  >
                    <option value="all">🌍 Mundo Completo ({worldName || 'Raíz'})</option>
                    {allHierarchyFolders.map((folderPath) => {
                      const depth = getFolderDepth(folderPath);
                      const indent = '—'.repeat(Math.max(0, depth - 1));
                      return (
                        <option key={folderPath} value={folderPath}>
                          {indent ? `${indent} ` : ''}📍 {folderPath}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    data-testid="btn-dm-map-edit"
                    onClick={() => {
                      setMapUrlDraft(currentPlaceMapUrl);
                      setIsEditMapModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-[#252019] hover:bg-[#332b20] border border-[#c8a45c]/80 text-[#f5e4be] font-cinzel font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                    <span>Editar Mapa / Galería</span>
                  </button>

                  {currentPlaceDepth < 4 && (
                    <button
                      type="button"
                      data-testid="btn-dm-add-subplace"
                      onClick={() => setIsAddSubPlaceModalOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-[#1a1d28] hover:bg-[#242938] border border-[#c8a45c]/60 text-[#f5e4be] font-cinzel font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-amber-300" />
                      <span>+ Sub-Lugar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Breadcrumbs + Direct Sub-Place Selector Pills + Auto-Sync Toggle */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-0.5 border-t border-[#c8a45c]/25">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {breadcrumbs.map((crumb, idx) => {
                    const targetPath = crumb.folderPath || crumb.fullPath || 'all';
                    return (
                      <React.Fragment key={targetPath}>
                        {idx > 0 && (
                          <ChevronRight className="w-3.5 h-3.5 text-[#c8a45c]/70 shrink-0" />
                        )}
                        <button
                          type="button"
                          data-testid={`breadcrumb-zone-${idx}`}
                          onClick={() => setDmSelectedFolder(targetPath)}
                          className={`px-2 py-0.5 rounded-lg font-cinzel font-bold transition cursor-pointer flex items-center gap-1 ${
                            selectedFolder === targetPath
                              ? 'bg-amber-950/90 border border-[#e2c275] text-[#f5e4be]'
                              : 'bg-black/40 border border-stone-700 text-stone-300 hover:text-white hover:border-amber-500/60'
                          }`}
                        >
                          {idx === 0 && <Compass className="w-3 h-3 text-amber-400" />}
                          <span>{crumb.label}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}

                  {childFolders.length > 0 && (
                    <>
                      <span className="text-[10px] text-stone-400 font-cinzel ml-1">
                        Sub-zonas:
                      </span>
                      {childFolders.map((sub) => {
                        const shortSub = sub.split('/').pop()?.trim() || sub;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setDmSelectedFolder(sub)}
                            className="px-2 py-0.5 rounded-lg bg-[#1e2230] hover:bg-amber-950/70 border border-[#c8a45c]/50 text-amber-200 text-[11px] font-cinzel font-bold transition cursor-pointer flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{shortSub}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Checkbox: Auto-sync live player projection when changing zone */}
                <label
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/45 border border-[#c8a45c]/45 text-[11px] text-[#e8d8b9] hover:border-[#e2c275] cursor-pointer select-none"
                  title="Si está desactivado, puedes explorar cualquier zona y revisar tus mapas sin que a los jugadores se les cambie la imagen que están viendo"
                >
                  <input
                    type="checkbox"
                    data-testid="checkbox-auto-sync-zone-live-top"
                    checked={autoSyncLiveOnZoneChange}
                    onChange={(e) => handleToggleAutoSyncLiveOnZoneChange(e.target.checked)}
                    className="rounded border-amber-500 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="font-cinzel font-bold">
                    Cambiar imagen a jugadores al cambiar de zona
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* MAIN MAP / SCENE CANVAS CONTAINER */}
          <div
            data-testid="map-center-canvas-block"
            className="relative flex-1 min-h-[650px] rounded-2xl bg-[#11131a] border-2 border-[#c8a45c]/80 overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.9)] flex flex-col justify-between"
            style={
              mode === 'player'
                ? buildSpatialBlockInlineStyle(resolvedPlayerMap.blocks.map_center_canvas)
                : {
                    borderColor:
                      activeDmSkinTokens?.dmMapCanvasBorder ||
                      activeDmSkinTokens?.dmScreenBaseBorder ||
                      undefined,
                  }
            }
          >
            {/* Top Bar Inside Map Viewport: DM/Live Mode Toggle + Proyectar a Jugadores + Zoom Controls */}
            <div className="relative z-20 px-3.5 py-2 flex items-center justify-between gap-2 pointer-events-none flex-wrap">
              <div className="flex items-center gap-2 flex-wrap max-w-[84%] pointer-events-auto">
                {/* DM Mode Toggle: Vista DM vs Vista en Vivo + Proyectar a Jugadores ONLY */}
                {mode === 'dm' && (
                  <>
                    <div
                      data-testid="dm-viewport-mode-switcher"
                      className="inline-flex items-center rounded-xl bg-black/85 border border-[#c8a45c]/75 p-0.5 shadow-lg"
                    >
                      <button
                        type="button"
                        data-testid="btn-toggle-dm-view-mode"
                        onClick={() => setDmViewportMode('dm')}
                        className={`px-2.5 py-1 rounded-lg font-cinzel font-bold text-[10px] flex items-center gap-1 transition cursor-pointer ${
                          dmViewportMode === 'dm'
                            ? 'bg-amber-600 text-stone-950 shadow'
                            : 'text-stone-300 hover:text-white'
                        }`}
                        title="Modo Edición/Exploración del DM: revisa y modifica mapas sin afectar lo que ven los jugadores"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Vista DM</span>
                      </button>
                      <button
                        type="button"
                        data-testid="btn-toggle-live-view-mode"
                        onClick={() => setDmViewportMode('live')}
                        className={`px-2.5 py-1 rounded-lg font-cinzel font-bold text-[10px] flex items-center gap-1 transition cursor-pointer ${
                          dmViewportMode === 'live'
                            ? 'bg-emerald-600 text-stone-950 shadow'
                            : 'text-stone-300 hover:text-white'
                        }`}
                        title="Vista en Vivo: mira e interactúa exactamente con lo que les estás proyectando a los jugadores"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                        <span>Vista en Vivo</span>
                      </button>
                    </div>

                    {workspace && (
                      <button
                        type="button"
                        data-testid="btn-dm-project-current-view-live"
                        onClick={() => {
                          if (!onUpdateWorkspace) return;
                          onUpdateWorkspace({
                            ...workspace,
                            activeLiveVisual: {
                              kind:
                                activeVisual.kind === 'photo' || activeVisual.kind === 'album'
                                  ? 'album'
                                  : activeVisual.kind === 'tactical'
                                  ? 'tactical'
                                  : 'map',
                              id: activeVisual.id || `map-${selectedFolder}`,
                              title: activeVisual.title,
                              imageUrl: activeVisual.imageUrl,
                              folder: selectedFolder,
                              gridCols: activeTacticalGridCols,
                              gridRows: activeTacticalGridRows,
                              tacticalTokens: activeTacticalTokens,
                            },
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-300/80 text-stone-950 font-cinzel font-black text-[10px] uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center gap-1.5"
                        title="Proyectar este mapa o imagen actual a los jugadores"
                      >
                        <span className="w-2 h-2 rounded-full bg-stone-950 animate-ping" />
                        <span>Proyectar a Jugadores</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center bg-black/75 border border-[#c8a45c]/50 rounded-xl overflow-hidden pointer-events-auto shadow-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
                  title="Alejar mapa"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMapZoom(1)}
                  className="px-2 text-[10px] font-mono text-amber-300 hover:text-white cursor-pointer"
                  title="Restablecer zoom"
                >
                  {Math.round(mapZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.min(2.25, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
                  title="Acercar mapa"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Center Map / Gallery / Interactive Tactical Grid Layer */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#0d0e14]">
              {/* Top-Left Return to Parent Place Button Inside Map Drawing (DM Mode) */}
              {mode === 'dm' &&
                dmViewportMode === 'dm' &&
                selectedFolder !== 'all' &&
                activeVisual.kind !== 'tactical' && (
                <button
                  type="button"
                  data-testid="btn-map-canvas-return-parent"
                  onClick={() => setDmSelectedFolder(getParentAtlasFolder(selectedFolder))}
                  className="absolute top-12 left-3.5 z-20 px-3 py-1.5 rounded-xl bg-black/85 hover:bg-amber-950/95 border border-[#e2c275] text-[#f5e4be] font-cinzel font-bold text-xs flex items-center gap-1.5 shadow-xl transition cursor-pointer"
                  title="Regresar a la carpeta o lugar anterior"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#e2c275]" />
                  <span>{getReturnToParentButtonLabel(selectedFolder, worldName)}</span>
                </button>
              )}

              {activeVisual.imageUrl ? (
                <img
                  data-testid="table-map-projected-image"
                  src={activeVisual.imageUrl}
                  alt={activeVisual.title}
                  style={{ transform: `scale(${mapZoom})` }}
                  className="w-full h-full object-contain transition-transform duration-200"
                />
              ) : (
                /* Stylized Tabletop Cartography Canvas Fallback when no custom image is set yet */
                <div
                  style={{ transform: `scale(${mapZoom})` }}
                  className="w-full h-full flex flex-col items-center justify-center relative bg-[radial-gradient(circle_at_center,#292016_0%,#15120e_70%,#0b0a09_100%)] transition-transform duration-200"
                >
                  {/* Subtle Dungeon / Parchment Grid Overlay */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, #c8a45c 1px, transparent 1px), linear-gradient(to bottom, #c8a45c 1px, transparent 1px)',
                      backgroundSize: '48px 48px',
                    }}
                  />
                  <div className="relative z-10 text-center px-6 py-8 rounded-3xl bg-black/55 border-2 border-[#c8a45c]/50 backdrop-blur-sm max-w-md space-y-2.5 shadow-2xl">
                    <Compass className="w-12 h-12 text-[#e2c275] mx-auto" />
                    <h3 className="font-cinzel font-black text-lg text-[#f5e4be] uppercase tracking-wider">
                      {currentPlaceShortName}
                    </h3>
                    <p className="text-xs text-[#cbb692] leading-relaxed">
                      {mode === 'dm'
                        ? 'Selecciona un mapa, imagen o mapa táctico en "Proyección de Zona" abajo para revisarlo y proyectarlo a los jugadores.'
                        : `Explorando ${currentPlaceShortName}. Aquí verás en vivo los mapas e imágenes de galería que proyecte el Dungeon Master.`}
                    </p>
                  </div>
                </div>
              )}

              {/* INTERACTIVE TACTICAL GRID & TOKENS OVERLAY WHEN ACTIVE VISUAL IS TACTICAL */}
              {activeVisual.kind === 'tactical' && (
                <div
                  data-testid="tactical-map-grid-overlay"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-auto pt-14 px-4 pb-4 pointer-events-auto bg-[#07090e]/95"
                >
                  {activeTacticalConfig ? (
                    <div className="flex flex-col items-center gap-2 max-w-full max-h-full">
                      {mode === 'dm' && (
                        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/95 border border-sky-500/50 shadow-lg z-30">
                          <span className="text-[11px] font-cinzel font-bold text-sky-300">
                            🗺️ {activeTacticalConfig.name} ({activeTacticalConfig.gridCols}x
                            {activeTacticalConfig.gridRows})
                          </span>
                          <button
                            type="button"
                            data-testid="btn-live-tactical-add-players"
                            onClick={handleDmAddPlayersToRichTacticalMap}
                            className="px-2 py-0.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/70 text-emerald-200 text-[10px] font-cinzel font-bold cursor-pointer"
                            title="Añadir fichas de los jugadores de la mesa al mapa táctico"
                          >
                            + Fichas Jugadores
                          </button>
                          <button
                            type="button"
                            data-testid="btn-live-tactical-add-monster"
                            onClick={handleDmAddMonsterToRichTacticalMap}
                            className="px-2 py-0.5 rounded-lg bg-red-950/90 hover:bg-red-900 border border-red-400/70 text-red-200 text-[10px] font-cinzel font-bold cursor-pointer"
                            title="Añadir ficha de monstruo/enemigo al mapa táctico en vivo"
                          >
                            + Ficha Monstruo
                          </button>
                          {isTacticalMapsAllowed && (
                            <button
                              type="button"
                              data-testid="btn-open-tactical-studio-from-map"
                              onClick={() => setIsTacticalStudioOpen(true)}
                              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Editar Capas / Props / FOW en Estudio
                            </button>
                          )}
                        </div>
                      )}
                      <TacticalMapCanvas
                        config={activeTacticalConfig}
                        viewerRole={mode === 'dm' ? 'dm' : 'player'}
                        currentPlayerCharacterId={character?.id}
                        charactersById={tacticalCharactersById}
                        zoom={mapZoom}
                        onTokenMove={handleTacticalCanvasTokenMove}
                        onDmModifyToken={
                          mode === 'dm' ? handleDmModifyTacticalToken : undefined
                        }
                        onDmDeleteToken={
                          mode === 'dm' ? handleDmDeleteTacticalToken : undefined
                        }
                      />
                    </div>
                  ) : (
                    /* Fallback Simple Grid if no rich TacticalMapConfig exists */
                    <div className="w-full h-full flex flex-col justify-between">
                      {mode === 'dm' && (
                        <div className="mt-12 mx-auto px-3 py-1.5 rounded-xl bg-black/85 border border-red-500/70 flex items-center gap-2 flex-wrap shadow-2xl z-20">
                          <span className="text-[10px] font-cinzel font-bold text-red-300 uppercase">
                            ⚔️ Cuadrícula Táctica ({activeTacticalGridCols}x{activeTacticalGridRows}):
                          </span>
                          <button
                            type="button"
                            data-testid="btn-tactical-populate-players"
                            onClick={handlePopulatePlayersOnTacticalMap}
                            className="px-2 py-0.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/70 text-emerald-200 text-[10px] font-cinzel font-bold cursor-pointer"
                          >
                            + Fichas Jugadores
                          </button>
                          <button
                            type="button"
                            data-testid="btn-tactical-add-enemy-token"
                            onClick={handleAddEnemyTokenToTacticalMap}
                            className="px-2 py-0.5 rounded-lg bg-red-950/90 hover:bg-red-900 border border-red-400/70 text-red-200 text-[10px] font-cinzel font-bold cursor-pointer"
                          >
                            + Ficha Enemigo
                          </button>
                        </div>
                      )}

                      <div
                        className="relative flex-1 w-full h-full"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${activeTacticalGridCols}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${activeTacticalGridRows}, minmax(0, 1fr))`,
                        }}
                      >
                        {Array.from({
                          length: activeTacticalGridCols * activeTacticalGridRows,
                        }).map((_, cellIdx) => {
                          const col = cellIdx % activeTacticalGridCols;
                          const row = Math.floor(cellIdx / activeTacticalGridCols);
                          const tokensInCell = activeTacticalTokens.filter(
                            (t) => (t.col ?? t.x ?? 0) === col && (t.row ?? t.y ?? 0) === row
                          );
                          return (
                            <div
                              key={`cell-${col}-${row}`}
                              data-testid={`tactical-cell-${col}-${row}`}
                              onClick={() => handleMoveTokenOnActiveTacticalMap(col, row)}
                              className={`border border-amber-300/20 flex items-center justify-center relative transition ${
                                selectedTacticalTokenId
                                  ? 'hover:bg-amber-400/20 cursor-pointer'
                                  : ''
                              }`}
                            >
                              {tokensInCell.map((tok) => {
                                const isSelected = selectedTacticalTokenId === tok.id;
                                const canSelectTok =
                                  mode === 'dm' ||
                                  (mode === 'player' &&
                                    isTokenOwnedByPlayer(tok, character?.id));
                                return (
                                  <button
                                    key={tok.id}
                                    type="button"
                                    data-testid={`tactical-token-${tok.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canSelectTok) {
                                        setSelectedTacticalTokenId(tok.id);
                                      }
                                    }}
                                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[9px] font-cinzel font-black text-white shadow-xl transition ${
                                      canSelectTok ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'
                                    } ${
                                      isSelected
                                        ? 'ring-4 ring-amber-400 scale-110 z-20'
                                        : 'border-2 border-white/90 z-10'
                                    }`}
                                    style={{
                                      backgroundColor:
                                        tok.color || (tok.kind === 'player' ? '#10b981' : '#ef4444'),
                                    }}
                                    title={`${tok.label} (${col}, ${row})`}
                                  >
                                    <span className="truncate px-0.5">
                                      {(tok.label || tok.name || 'TOK').slice(0, 3).toUpperCase()}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Sub-Place Pins on Map for DM (in Vista DM when viewing a normal zone map) */}
              {mode === 'dm' &&
                dmViewportMode === 'dm' &&
                activeVisual.kind === 'map' &&
                childFolders.map((subFolder, idx) => {
                  const shortLabel = subFolder.split('/').pop()?.trim() || subFolder;
                  const pos = getPinPositionForChildPlace(
                    subFolder,
                    idx,
                    childFolders.length,
                    workspace?.atlasPinPositions
                  );
                  return (
                    <button
                      key={subFolder}
                      type="button"
                      onClick={() => setDmSelectedFolder(subFolder)}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#171821]/95 hover:bg-amber-950 border-2 border-[#e2c275] text-[#f5e4be] text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.95)] hover:scale-105 transition cursor-pointer"
                      title={`Entrar a ${shortLabel}`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{shortLabel}</span>
                    </button>
                  );
                })}
            </div>

            {/* =============================================================== */}
            {/* BOTTOM OVERLAYS ON MAP:                                         */}
            {/* Left (Mazos de Personaje / Proyección de Zona) + Right (Libreta)*/}
            {/* =============================================================== */}
            <div className="relative z-20 p-3 flex flex-col gap-2.5 pointer-events-none mt-auto">
              <div className="flex flex-col xl:flex-row items-end justify-between gap-2.5">
                {/* ------------------------------------------------------------- */}
                {/* BOTTOM-LEFT OVERLAY:                                          */}
                {/* Player Action Decks OR DM Proyección de Zona                  */}
                {/* ------------------------------------------------------------- */}
                <div className="w-full xl:w-[58%] pointer-events-auto flex flex-col gap-2">
                  {mode === 'player' ? (
                    /* PLAYER MINIMIZABLE DECK OVERLAY (Ataques, Habilidades, Conjuros) */
                    <div
                      className="rounded-2xl bg-[#12131c]/95 backdrop-blur-md border-2 border-[#c8a45c]/85 shadow-[0_10px_30px_rgba(0,0,0,0.95)] overflow-hidden transition-all"
                      data-testid="player-map-cards-overlay"
                    >
                      {/* Header with Minimize Toggle */}
                      <div className="px-3 py-2 bg-gradient-to-r from-[#241c14] via-[#1a1510] to-[#14110d] border-b border-[#c8a45c]/40 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#e2c275]" />
                          <span className="font-cinzel font-black text-xs text-[#f5e4be] uppercase tracking-wider">
                            Mazos de {character?.name || 'Personaje'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid="btn-toggle-player-cards-overlay"
                            onClick={() => setIsLeftOverlayMinimized((prev) => !prev)}
                            className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-black/80 border border-[#c8a45c]/50 text-[#e2c275] text-[10px] font-cinzel font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {isLeftOverlayMinimized ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Abrir Cartas</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>Minimizar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {!isLeftOverlayMinimized && (
                        <div className="p-2.5 space-y-2">
                          {/* 3 Deck Category Tabs (Ataques, Habilidades, Conjuros) */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActivePlayerDeck('attacks');
                                setPlayerDeckScrollIdx(0);
                              }}
                              className={`py-1.5 px-2 rounded-xl border font-cinzel font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                activePlayerDeck === 'attacks'
                                  ? 'bg-gradient-to-b from-[#3b2919] to-[#1d140c] border-[#f5e4be] text-[#f5e4be] shadow'
                                  : 'bg-[#171923] border-[#c8a45c]/35 text-stone-300 hover:text-white'
                              }`}
                            >
                              <Sword className="w-3.5 h-3.5 text-amber-400" />
                              <span>Ataques ({playerAttackCards.length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActivePlayerDeck('skills');
                                setPlayerDeckScrollIdx(0);
                              }}
                              className={`py-1.5 px-2 rounded-xl border font-cinzel font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                activePlayerDeck === 'skills'
                                  ? 'bg-gradient-to-b from-[#17303a] to-[#0f1c22] border-cyan-300 text-cyan-100 shadow'
                                  : 'bg-[#171923] border-[#c8a45c]/35 text-stone-300 hover:text-white'
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Habilidades ({playerSkillCards.length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActivePlayerDeck('spells');
                                setPlayerDeckScrollIdx(0);
                              }}
                              className={`py-1.5 px-2 rounded-xl border font-cinzel font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                activePlayerDeck === 'spells'
                                  ? 'bg-gradient-to-b from-[#2f1a42] to-[#180d22] border-purple-300 text-purple-100 shadow'
                                  : 'bg-[#171923] border-[#c8a45c]/35 text-stone-300 hover:text-white'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>Conjuros ({playerSpellCards.length})</span>
                            </button>
                          </div>

                          {/* Cards Row with Scroll Arrows (Read-only, Click to Roll, Illustrated + Adaptive Font) */}
                          <div className="flex items-center gap-1.5">
                            {currentPlayerDeckCount > 3 && (
                              <button
                                type="button"
                                disabled={safePlayerDeckScroll === 0}
                                onClick={() =>
                                  setPlayerDeckScrollIdx(Math.max(0, safePlayerDeckScroll - 1))
                                }
                                className="w-6 h-28 rounded-xl bg-[#191c28] hover:bg-amber-950 disabled:opacity-30 border border-[#c8a45c]/60 text-[#f5e4be] flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            )}

                            <div className="flex-1 grid grid-cols-3 gap-2 min-h-[118px]">
                              {activePlayerDeck === 'attacks' &&
                                playerAttackCards
                                  .slice(safePlayerDeckScroll, safePlayerDeckScroll + 3)
                                  .map((atk) => {
                                    const isLongTitle = (atk.name || '').length > 18;
                                    return (
                                      <button
                                        key={atk.id}
                                        type="button"
                                        onClick={() =>
                                          executeDiceRoll(20, 1, atk.attackBonus, `Ataque: ${atk.name}`)
                                        }
                                        className="rounded-xl bg-gradient-to-b from-[#251d15] via-[#1a140f] to-[#120e0b] border-2 border-[#c8a45c]/80 hover:border-[#f5e4be] p-2 flex flex-col justify-between text-left transition hover:-translate-y-0.5 cursor-pointer shadow-lg group"
                                        title={`Clic para tirar impacto con ${atk.name} (${formatModifier(atk.attackBonus)}) • Daño: ${atk.damageDice}`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#e2c275]/75 bg-black/70 flex items-center justify-center shrink-0 shadow-inner">
                                            {atk.imageUrl ? (
                                              <img
                                                src={atk.imageUrl}
                                                alt={atk.name}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <Sword className="w-4 h-4 text-amber-400" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[8px] font-cinzel text-amber-300/85 truncate">
                                                {(atk as any).sourceName || 'Arma'}
                                              </span>
                                              <span className="text-[9px] font-mono font-black text-amber-300 px-1 py-0.2 rounded bg-black/70 border border-amber-500/40 shrink-0">
                                                {formatModifier(atk.attackBonus)}
                                              </span>
                                            </div>
                                            <div
                                              className={`font-cinzel font-black ${
                                                isLongTitle ? 'text-[9px]' : 'text-[10px]'
                                              } text-[#f5e4be] uppercase leading-tight line-clamp-2 break-words mt-0.5`}
                                            >
                                              {atk.name}
                                            </div>
                                            {atk.notes && (
                                              <p className="text-[8px] text-amber-200/80 line-clamp-2 leading-tight mt-0.5">
                                                {atk.notes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-[#cbb692] border-t border-[#c8a45c]/30 pt-1 mt-1">
                                          <span className="truncate font-bold text-amber-200">
                                            🎲 {atk.damageDice}
                                          </span>
                                          {atk.damageType && (
                                            <span className="text-[8px] text-stone-400 truncate">
                                              {atk.damageType}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}

                              {activePlayerDeck === 'skills' &&
                                playerSkillCards
                                  .slice(safePlayerDeckScroll, safePlayerDeckScroll + 3)
                                  .map((sk) => {
                                    const isLongTitle = (sk.name || '').length > 18;
                                    return (
                                      <button
                                        key={sk.id}
                                        type="button"
                                        onClick={() =>
                                          executeDiceRoll(20, 1, sk.totalMod, `Habilidad: ${sk.name}`)
                                        }
                                        className="rounded-xl bg-gradient-to-b from-[#162730] via-[#121f26] to-[#0d151a] border-2 border-cyan-500/65 hover:border-cyan-300 p-2 flex flex-col justify-between text-left transition hover:-translate-y-0.5 cursor-pointer shadow-lg"
                                        title={`${sk.name}: ${sk.description}`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-cyan-400/65 bg-black/70 flex items-center justify-center shrink-0 shadow-inner">
                                            {sk.imageUrl ? (
                                              <img
                                                src={sk.imageUrl}
                                                alt={sk.name}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <Shield className="w-4 h-4 text-cyan-300" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[8px] font-cinzel font-bold text-cyan-300">
                                                {sk.abilityAbbr}
                                              </span>
                                              <span className="text-[9px] font-mono font-black text-cyan-200 px-1 py-0.2 rounded bg-black/70 border border-cyan-500/40 shrink-0">
                                                {formatModifier(sk.totalMod)}
                                              </span>
                                            </div>
                                            <div
                                              className={`font-cinzel font-black ${
                                                isLongTitle ? 'text-[9px]' : 'text-[10px]'
                                              } text-[#f5e4be] uppercase leading-tight line-clamp-2 break-words mt-0.5`}
                                            >
                                              {sk.name}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-1 text-[8px] text-cyan-200/85 border-t border-cyan-500/30 pt-1 mt-1">
                                          <span className="truncate">
                                            {sk.proficiency === 'expertise' ? '★ Pericia' : '● Competente'}
                                          </span>
                                          {sk.description && (
                                            <span className="text-cyan-100/65 truncate max-w-[90px]">
                                              {sk.description}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}

                              {activePlayerDeck === 'spells' &&
                                playerSpellCards
                                  .slice(safePlayerDeckScroll, safePlayerDeckScroll + 3)
                                  .map((sp) => {
                                    const isLongTitle = (sp.name || '').length > 18;
                                    return (
                                      <button
                                        key={sp.id}
                                        type="button"
                                        onClick={() =>
                                          executeDiceRoll(20, 1, 0, `Conjuro: ${sp.name}`)
                                        }
                                        className="rounded-xl bg-gradient-to-b from-[#261736] via-[#1c1128] to-[#120b1a] border-2 border-purple-400/70 hover:border-purple-200 p-2 flex flex-col justify-between text-left transition hover:-translate-y-0.5 cursor-pointer shadow-lg"
                                        title={sp.description}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-purple-400/65 bg-black/70 flex items-center justify-center shrink-0 shadow-inner">
                                            {sp.imageUrl ? (
                                              <img
                                                src={sp.imageUrl}
                                                alt={sp.name}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <Sparkles className="w-4 h-4 text-purple-300" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[8px] font-cinzel text-purple-300/85 truncate">
                                                {sp.school || 'Magia'}
                                              </span>
                                              <span className="text-[9px] font-mono font-black text-purple-200 px-1 py-0.2 rounded bg-black/70 border border-purple-500/40 shrink-0">
                                                {sp.level === 0 ? 'Truco' : `Niv ${sp.level}`}
                                              </span>
                                            </div>
                                            <div
                                              className={`font-cinzel font-black ${
                                                isLongTitle ? 'text-[9px]' : 'text-[10px]'
                                              } text-[#f5e4be] uppercase leading-tight line-clamp-2 break-words mt-0.5`}
                                            >
                                              {sp.name}
                                            </div>
                                            {sp.description && (
                                              <p className="text-[8px] text-purple-200/80 line-clamp-2 leading-tight mt-0.5">
                                                {sp.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-1 text-[8px] text-purple-200/85 border-t border-purple-500/30 pt-1 mt-1">
                                          <span className="truncate">{sp.castingTime || '1 Acción'}</span>
                                          {sp.damageOrHeal && (
                                            <span className="font-mono font-bold text-purple-200 truncate">
                                              {sp.damageOrHeal}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}

                              {currentPlayerDeckCount === 0 && (
                                <div className="col-span-3 rounded-xl border border-dashed border-[#c8a45c]/35 bg-black/40 flex items-center justify-center p-3 text-center text-[11px] text-stone-400 font-cinzel">
                                  Sin cartas preparadas en este mazo.
                                </div>
                              )}
                            </div>

                            {currentPlayerDeckCount > 3 && (
                              <button
                                type="button"
                                disabled={safePlayerDeckScroll >= maxPlayerDeckScroll}
                                onClick={() =>
                                  setPlayerDeckScrollIdx(
                                    Math.min(maxPlayerDeckScroll, safePlayerDeckScroll + 1)
                                  )
                                }
                                className="w-6 h-28 rounded-xl bg-[#191c28] hover:bg-amber-950 disabled:opacity-30 border border-[#c8a45c]/60 text-[#f5e4be] flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                  /* DM MINIMIZABLE PROJECTION PANEL ("Proyección de Zona") */
                  <div
                    className="rounded-2xl bg-[#12141d]/95 backdrop-blur-md border-2 border-[#c8a45c]/85 shadow-[0_10px_30px_rgba(0,0,0,0.95)] overflow-hidden transition-all"
                    data-testid="dm-map-projection-overlay"
                  >
                    <div className="px-3 py-2 bg-gradient-to-r from-[#241d14] via-[#181510] to-[#13110e] border-b border-[#c8a45c]/40 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedFolder !== 'all' && (
                          <button
                            type="button"
                            data-testid="btn-dm-projection-up-zone"
                            onClick={() => setDmSelectedFolder(getParentAtlasFolder(selectedFolder))}
                            className="px-2 py-0.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-[#e2c275] text-[#f5e4be] text-[10px] font-cinzel font-bold flex items-center gap-1 cursor-pointer shrink-0"
                            title="Volver a la zona anterior"
                          >
                            <ArrowLeft className="w-3 h-3 text-amber-300" />
                            <span>Zona Anterior</span>
                          </button>
                        )}
                        <span className="font-cinzel font-black text-xs text-[#f5e4be] truncate">
                          Proyección de Zona ( 🍺 {currentPlaceShortName} )
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-testid="btn-toggle-dm-projection-overlay"
                          onClick={() => setIsLeftOverlayMinimized((prev) => !prev)}
                          className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-black/80 border border-[#c8a45c]/50 text-[#e2c275] text-[10px] font-cinzel font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {isLeftOverlayMinimized ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Abrir Proyección</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Minimizar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {!isLeftOverlayMinimized && (
                      <div className="p-2.5 space-y-2">
                        {/* Zone Switcher Bar + Auto-Sync Checkbox inside Proyección de Zona */}
                        <div className="rounded-xl bg-[#181a25] border border-[#c8a45c]/45 p-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[180px]">
                              <span className="text-[10px] font-cinzel font-bold text-amber-300 shrink-0">
                                Zona:
                              </span>
                              <select
                                data-testid="select-dm-projection-zone"
                                value={selectedFolder}
                                onChange={(e) => setDmSelectedFolder(e.target.value)}
                                className="flex-1 min-w-[140px] px-2 py-1 rounded-lg bg-[#10121a] border border-[#c8a45c]/60 text-[#f5e4be] font-cinzel font-bold text-[11px] focus:outline-none focus:border-amber-400 cursor-pointer"
                              >
                                <option value="all">🌍 Mundo Completo ({worldName || 'Raíz'})</option>
                                {allHierarchyFolders.map((folderPath) => {
                                  const depth = getFolderDepth(folderPath);
                                  const indent = '—'.repeat(Math.max(0, depth - 1));
                                  return (
                                    <option key={folderPath} value={folderPath}>
                                      {indent ? `${indent} ` : ''}📍 {folderPath}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <label
                              className="inline-flex items-center gap-1.5 text-[10px] text-[#e8d8b9] cursor-pointer select-none"
                              title="Activa esta casilla si quieres que la imagen de los jugadores cambie automáticamente al moverte de zona. Si está desactivada, la imagen solo cambia cuando tú lo elijas."
                            >
                              <input
                                type="checkbox"
                                data-testid="checkbox-auto-sync-zone-live"
                                checked={autoSyncLiveOnZoneChange}
                                onChange={(e) =>
                                  handleToggleAutoSyncLiveOnZoneChange(e.target.checked)
                                }
                                className="rounded border-amber-500 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <span className="font-cinzel font-bold">
                                Cambiar imagen al cambiar de zona
                              </span>
                            </label>
                          </div>

                          {/* Breadcrumbs & Quick Sub-Zone Pills inside Proyección de Zona */}
                          <div className="flex items-center gap-1 flex-wrap text-[10px]">
                            {breadcrumbs.map((crumb, idx) => {
                              const targetPath = crumb.folderPath || crumb.fullPath || 'all';
                              return (
                                <React.Fragment key={`proj-crumb-${targetPath}`}>
                                  {idx > 0 && (
                                    <ChevronRight className="w-3 h-3 text-[#c8a45c]/60 shrink-0" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setDmSelectedFolder(targetPath)}
                                    className={`px-1.5 py-0.5 rounded font-cinzel font-bold transition cursor-pointer ${
                                      selectedFolder === targetPath
                                        ? 'bg-amber-950 border border-[#e2c275] text-[#f5e4be]'
                                        : 'bg-black/40 border border-stone-700 text-stone-300 hover:text-white'
                                    }`}
                                  >
                                    {crumb.label}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                            {childFolders.map((sub) => {
                              const shortSub = sub.split('/').pop()?.trim() || sub;
                              return (
                                <button
                                  key={`proj-sub-${sub}`}
                                  type="button"
                                  onClick={() => setDmSelectedFolder(sub)}
                                  className="px-1.5 py-0.5 rounded bg-[#212536] hover:bg-amber-950/70 border border-[#c8a45c]/45 text-amber-200 font-cinzel font-bold transition cursor-pointer flex items-center gap-0.5"
                                >
                                  <MapPin className="w-2.5 h-2.5 text-amber-400" />
                                  <span>{shortSub}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3 Tabs: Mapa e Imágenes | Mapas Tácticos | Ver Cola */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            data-testid="tab-dm-projection-gallery"
                            onClick={() => setDmProjectionTab('gallery')}
                            className={`py-1.5 px-2 rounded-xl font-cinzel font-bold text-[11px] border transition cursor-pointer ${
                              dmProjectionTab === 'gallery'
                                ? 'bg-amber-950/80 border-[#e2c275] text-[#f5e4be]'
                                : 'bg-[#181a24] border-stone-700 text-stone-400 hover:text-white'
                            }`}
                          >
                            Mapa e Imágenes ({filteredAlbumPhotos.length + filteredZoneMaps.length + 1})
                          </button>
                          {isTacticalMapsAllowed ? (
                            <button
                              type="button"
                              data-testid="tab-dm-projection-tactical"
                              onClick={() => setDmProjectionTab('tactical')}
                              className={`py-1.5 px-2 rounded-xl font-cinzel font-bold text-[11px] border transition cursor-pointer ${
                                dmProjectionTab === 'tactical'
                                  ? 'bg-sky-950/80 border-sky-400 text-sky-100'
                                  : 'bg-[#181a24] border-stone-700 text-stone-300 hover:text-white'
                              }`}
                            >
                              Mapas Tácticos ({filteredTacticalMaps.length})
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid="tab-dm-projection-tactical"
                              disabled
                              title="Los Mapas Tácticos están en progreso para el rol de cliente."
                              className="py-1.5 px-2 rounded-xl font-cinzel font-bold text-[10px] border bg-stone-900/70 border-stone-800 text-stone-500 opacity-60 cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>Mapas Tácticos</span>
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 uppercase tracking-wider">
                                En Progreso
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid="tab-dm-projection-queue"
                            onClick={() => setDmProjectionTab('queue')}
                            className={`py-1.5 px-2 rounded-xl font-cinzel font-bold text-[11px] border transition cursor-pointer ${
                              dmProjectionTab === 'queue'
                                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100'
                                : 'bg-[#181a24] border-stone-700 text-stone-400 hover:text-white'
                            }`}
                          >
                            Ver Cola ({(workspace?.visualQueue || []).length})
                          </button>
                        </div>

                        {/* Inline Quick Editor Modal/Box when DM clicks Editar on any item */}
                        {editingVisualItem && (
                          <div
                            data-testid="dm-inline-visual-editor"
                            className="p-2.5 rounded-xl bg-[#181b26] border-2 border-amber-400/80 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[10px] font-cinzel font-bold text-amber-300 uppercase">
                              <span>Editando Visual: {editingVisualItem.title}</span>
                              <button
                                type="button"
                                onClick={() => setEditingVisualItem(null)}
                                className="text-stone-400 hover:text-white cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                              <input
                                type="text"
                                data-testid="input-inline-edit-visual-title"
                                value={editingVisualItem.title}
                                onChange={(e) =>
                                  setEditingVisualItem((prev) =>
                                    prev ? { ...prev, title: e.target.value } : null
                                  )
                                }
                                placeholder="Nombre"
                                className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-xs text-stone-100"
                              />
                              <input
                                type="text"
                                data-testid="input-inline-edit-visual-url"
                                value={editingVisualItem.imageUrl}
                                onChange={(e) =>
                                  setEditingVisualItem((prev) =>
                                    prev ? { ...prev, imageUrl: e.target.value } : null
                                  )
                                }
                                placeholder="URL de Imagen"
                                className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-xs text-stone-100"
                              />
                              <input
                                type="text"
                                data-testid="input-inline-edit-visual-folder"
                                value={editingVisualItem.folder}
                                onChange={(e) =>
                                  setEditingVisualItem((prev) =>
                                    prev ? { ...prev, folder: e.target.value } : null
                                  )
                                }
                                placeholder="Carpeta / Lugar"
                                className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-xs text-amber-200"
                              />
                            </div>
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingVisualItem(null)}
                                className="px-2.5 py-1 rounded bg-stone-800 text-[10px] text-stone-300 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                data-testid="btn-save-inline-visual-edit"
                                onClick={handleDmSaveEditedVisualItem}
                                className="px-3 py-1 rounded bg-emerald-600 text-stone-950 font-cinzel font-bold text-[10px] cursor-pointer"
                              >
                                Guardar Cambios
                              </button>
                            </div>
                          </div>
                        )}

                        {dmProjectionTab === 'gallery' ? (
                          <>
                            {/* Horizontal Thumbnail Cards: Base Place Map + Extra Zone Maps + Gallery Photos */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[155px] overflow-y-auto pr-1">
                              {/* Card 1: Base Map of the Place (Click previews for DM; Proyectar sends to players) */}
                              {(() => {
                                const liveVis = workspace?.activeLiveVisual;
                                const isMapLiveForPlayers =
                                  (liveVis?.kind === 'map' &&
                                    (liveVis?.folder || 'all') === selectedFolder &&
                                    liveVis?.id === `map-${selectedFolder}`) ||
                                  (!liveVis && selectedFolder === (workspace?.activeAtlasFolder || 'all'));
                                const isMapInspectedByDm =
                                  activeVisual.kind === 'map' &&
                                  activeVisual.id === `map-${selectedFolder}`;
                                return (
                                  <div
                                    className={`rounded-xl border-2 p-1.5 flex flex-col justify-between text-left transition overflow-hidden ${
                                      isMapLiveForPlayers
                                        ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                                        : isMapInspectedByDm
                                        ? 'bg-amber-950/30 border-[#e2c275]'
                                        : 'bg-[#171922] border-stone-700 hover:border-[#c8a45c]'
                                    }`}
                                  >
                                    {/* Clicking thumbnail ONLY previews for DM! */}
                                    <button
                                      type="button"
                                      data-testid="btn-preview-base-zone-map"
                                      onClick={handleDmPreviewMapOnly}
                                      className="text-left w-full cursor-pointer"
                                      title="Clic para ver y editar en tu Vista DM (no cambia la vista de los jugadores hasta que presiones Proyectar)"
                                    >
                                      <span className="text-[10px] font-cinzel font-bold text-[#f5e4be] truncate block w-full">
                                        Mapa: {currentPlaceShortName}
                                      </span>
                                      <div className="h-11 w-full rounded-lg bg-black/60 border border-stone-800 my-1 overflow-hidden flex items-center justify-center">
                                        {currentPlaceMapUrl ? (
                                          <img
                                            src={currentPlaceMapUrl}
                                            alt={currentPlaceShortName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <Compass className="w-5 h-5 text-amber-400/70" />
                                        )}
                                      </div>
                                    </button>
                                    <div className="flex items-center justify-between gap-1 text-[9px] font-cinzel font-bold flex-wrap">
                                      <button
                                        type="button"
                                        data-testid="btn-project-base-zone-map"
                                        onClick={handleDmSelectMapProjection}
                                        className="flex items-center gap-1 cursor-pointer"
                                        title="Mandar este mapa a los jugadores"
                                      >
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            isMapLiveForPlayers
                                              ? 'bg-emerald-400 animate-pulse'
                                              : 'bg-stone-500'
                                          }`}
                                        />
                                        <span
                                          className={
                                            isMapLiveForPlayers
                                              ? 'text-emerald-300'
                                              : 'text-amber-200 hover:underline'
                                          }
                                        >
                                          {isMapLiveForPlayers ? 'EN VIVO' : 'PROYECTAR'}
                                        </span>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingVisualItem({
                                              kind: 'map',
                                              id: `map-${selectedFolder}`,
                                              title: `Mapa: ${currentPlaceShortName}`,
                                              imageUrl: currentPlaceMapUrl,
                                              folder: selectedFolder,
                                            })
                                          }
                                          className="px-1 py-0.2 rounded bg-stone-800 hover:bg-stone-700 text-[8px] text-stone-200 cursor-pointer"
                                        >
                                          Editar
                                        </button>
                                        {currentPlaceMapUrl && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDmEnqueueVisual({
                                                kind: 'map',
                                                sourceId: `map-${selectedFolder}`,
                                                title: `Mapa: ${currentPlaceShortName}`,
                                                imageUrl: currentPlaceMapUrl,
                                                folder: selectedFolder,
                                              })
                                            }
                                            className="px-1 py-0.2 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-[8px] text-amber-200 cursor-pointer"
                                          >
                                            + Cola
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Extra Zone Maps of the Place */}
                              {filteredZoneMaps.map((zMap) => {
                                const liveVis = workspace?.activeLiveVisual;
                                const isZMapLive =
                                  liveVis?.kind === 'map' && liveVis?.id === zMap.id;
                                const isZMapInspected =
                                  activeVisual.kind === 'map' && activeVisual.id === zMap.id;
                                return (
                                  <div
                                    key={zMap.id}
                                    className={`rounded-xl border-2 p-1.5 flex flex-col justify-between text-left transition overflow-hidden ${
                                      isZMapLive
                                        ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                                        : isZMapInspected
                                        ? 'bg-amber-950/30 border-[#e2c275]'
                                        : 'bg-[#171922] border-stone-700 hover:border-[#c8a45c]'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleDmPreviewZoneMapOnly(zMap)}
                                      className="text-left w-full cursor-pointer"
                                      title="Clic para previsualizar en Vista DM sin cambiar lo que ven los jugadores"
                                    >
                                      <span className="text-[10px] font-cinzel font-bold text-[#f5e4be] truncate block w-full">
                                        {zMap.title}
                                      </span>
                                      <div className="h-11 w-full rounded-lg bg-black/60 border border-stone-800 my-1 overflow-hidden flex items-center justify-center">
                                        <img
                                          src={zMap.imageUrl}
                                          alt={zMap.title}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    </button>
                                    <div className="flex items-center justify-between gap-1 text-[9px] font-cinzel font-bold flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => handleDmProjectZoneMap(zMap)}
                                        className="flex items-center gap-1 cursor-pointer"
                                      >
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            isZMapLive ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
                                          }`}
                                        />
                                        <span className={isZMapLive ? 'text-emerald-300' : 'text-amber-200 hover:underline'}>
                                          {isZMapLive ? 'EN VIVO' : 'PROYECTAR'}
                                        </span>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingVisualItem({
                                              kind: 'zonemap',
                                              id: zMap.id,
                                              title: zMap.title,
                                              imageUrl: zMap.imageUrl,
                                              folder: zMap.folder,
                                            })
                                          }
                                          className="px-1 py-0.2 rounded bg-stone-800 hover:bg-stone-700 text-[8px] text-stone-200 cursor-pointer"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDmEnqueueVisual({
                                              kind: 'map',
                                              sourceId: zMap.id,
                                              title: zMap.title,
                                              imageUrl: zMap.imageUrl,
                                              folder: zMap.folder,
                                            })
                                          }
                                          className="px-1 py-0.2 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-[8px] text-amber-200 cursor-pointer"
                                        >
                                          + Cola
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Gallery / Album Photos of the Place */}
                              {filteredAlbumPhotos.map((photo) => {
                                const liveVis = workspace?.activeLiveVisual;
                                const isPhotoLiveForPlayers =
                                  (liveVis?.kind === 'album' || (liveVis?.kind as string) === 'photo') &&
                                  liveVis?.id === photo.id;
                                const isPhotoInspectedByDm =
                                  activeVisual.kind === 'album' && activeVisual.id === photo.id;
                                return (
                                  <div
                                    key={photo.id}
                                    className={`rounded-xl border-2 p-1.5 flex flex-col justify-between text-left transition overflow-hidden ${
                                      isPhotoLiveForPlayers
                                        ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                                        : isPhotoInspectedByDm
                                        ? 'bg-amber-950/30 border-[#e2c275]'
                                        : 'bg-[#171922] border-stone-700 hover:border-[#c8a45c]'
                                    }`}
                                  >
                                    {/* Clicking thumbnail ONLY previews for DM! */}
                                    <button
                                      type="button"
                                      data-testid={`btn-preview-gallery-photo-${photo.id}`}
                                      onClick={() => handleDmPreviewGalleryPhotoOnly(photo)}
                                      className="text-left w-full cursor-pointer"
                                      title="Clic para revisar en Vista DM sin cambiar lo que ven los jugadores"
                                    >
                                      <span className="text-[10px] font-cinzel font-bold text-[#f5e4be] truncate block w-full">
                                        {photo.title}
                                      </span>
                                      <div className="h-11 w-full rounded-lg bg-black/60 border border-stone-800 my-1 overflow-hidden flex items-center justify-center">
                                        <img
                                          src={photo.imageUrl}
                                          alt={photo.title}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    </button>
                                    <div className="flex items-center justify-between gap-1 text-[9px] font-cinzel font-bold flex-wrap">
                                      <button
                                        type="button"
                                        data-testid={`btn-project-gallery-photo-${photo.id}`}
                                        onClick={() => handleDmSelectGalleryPhoto(photo)}
                                        className="flex items-center gap-1 cursor-pointer"
                                        title="Mostrar esta imagen en vivo a los jugadores"
                                      >
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            isPhotoLiveForPlayers
                                              ? 'bg-emerald-400 animate-pulse'
                                              : 'bg-stone-500'
                                          }`}
                                        />
                                        <span
                                          className={
                                            isPhotoLiveForPlayers
                                              ? 'text-emerald-300'
                                              : 'text-amber-200 hover:underline'
                                          }
                                        >
                                          {isPhotoLiveForPlayers ? 'EN VIVO' : 'PROYECTAR'}
                                        </span>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingVisualItem({
                                              kind: 'album',
                                              id: photo.id,
                                              title: photo.title,
                                              imageUrl: photo.imageUrl,
                                              folder: photo.folder,
                                            })
                                          }
                                          className="px-1 py-0.2 rounded bg-stone-800 hover:bg-stone-700 text-[8px] text-stone-200 cursor-pointer"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDmEnqueueVisual({
                                              kind: 'album',
                                              sourceId: photo.id,
                                              title: photo.title,
                                              imageUrl: photo.imageUrl,
                                              folder: photo.folder,
                                            })
                                          }
                                          className="px-1 py-0.2 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-[8px] text-amber-200 cursor-pointer"
                                        >
                                          + Cola
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setMapUrlDraft(currentPlaceMapUrl);
                                setIsEditMapModalOpen(true);
                              }}
                              className="w-full py-1.5 px-3 rounded-xl bg-[#1a1d28] hover:bg-[#252a3a] border border-[#c8a45c]/65 text-[#f5e4be] font-cinzel font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-300" />
                              <span>+ Subir Mapa o Imágenes de Galería</span>
                            </button>
                          </>
                        ) : dmProjectionTab === 'tactical' ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-cinzel font-bold text-sky-300">
                                Tableros Tácticos de {currentPlaceShortName}
                              </span>
                              <button
                                type="button"
                                data-testid="btn-open-full-tactical-studio-tab"
                                onClick={() => setIsTacticalStudioOpen(true)}
                                className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-cinzel font-bold text-[10px] cursor-pointer shadow"
                              >
                                ✨ Abrir Estudio de Mapas Tácticos (Capas, Props y FOW)
                              </button>
                            </div>
                            {filteredTacticalMaps.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[145px] overflow-y-auto pr-1">
                                {filteredTacticalMaps.map((tMap) => {
                                  const liveVis = workspace?.activeLiveVisual;
                                  const isTacLive =
                                    liveVis?.kind === 'tactical' && liveVis?.id === tMap.id;
                                  const isTacInspected =
                                    activeVisual.kind === 'tactical' && activeVisual.id === tMap.id;
                                  return (
                                    <div
                                      key={tMap.id}
                                      className={`rounded-xl border-2 p-1.5 flex flex-col justify-between text-left transition overflow-hidden ${
                                        isTacLive
                                          ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                                          : isTacInspected
                                          ? 'bg-red-950/30 border-red-400'
                                          : 'bg-[#171922] border-stone-700 hover:border-red-400/70'
                                      }`}
                                    >
                                      {/* Clicking previews tactical map for DM so DM can place/move tokens before projecting! */}
                                      <button
                                        type="button"
                                        data-testid={`btn-preview-tactical-map-${tMap.id}`}
                                        onClick={() => handleDmPreviewTacticalMapOnly(tMap)}
                                        className="text-left w-full cursor-pointer"
                                        title="Clic para abrir y preparar fichas en Vista DM antes de proyectar a los jugadores"
                                      >
                                        <span className="text-[10px] font-cinzel font-bold text-[#f5e4be] truncate block w-full">
                                          ⚔️ {tMap.name}
                                        </span>
                                        <div className="h-11 w-full rounded-lg bg-black/60 border border-stone-800 my-1 overflow-hidden flex items-center justify-center relative">
                                          <img
                                            src={tMap.mapImageUrl}
                                            alt={tMap.name}
                                            className="w-full h-full object-cover"
                                          />
                                          <span className="absolute bottom-0.5 right-1 px-1 rounded bg-black/80 text-[8px] font-mono text-red-200">
                                            {tMap.gridCols || 10}x{tMap.gridRows || 10}
                                          </span>
                                        </div>
                                      </button>
                                      <div className="flex items-center justify-between gap-1 text-[9px] font-cinzel font-bold flex-wrap">
                                        <button
                                          type="button"
                                          data-testid={`btn-project-tactical-map-${tMap.id}`}
                                          onClick={() => handleDmProjectTacticalMap(tMap)}
                                          className="flex items-center gap-1 cursor-pointer"
                                        >
                                          <span
                                            className={`w-2 h-2 rounded-full ${
                                              isTacLive ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
                                            }`}
                                          />
                                          <span className={isTacLive ? 'text-emerald-300' : 'text-amber-200 hover:underline'}>
                                            {isTacLive ? 'EN VIVO' : 'PROYECTAR'}
                                          </span>
                                        </button>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingVisualItem({
                                                kind: 'tactical',
                                                id: tMap.id,
                                                title: tMap.name,
                                                imageUrl: tMap.mapImageUrl || '',
                                                folder: tMap.folder,
                                                gridCols: tMap.gridCols || 10,
                                                gridRows: tMap.gridRows || 10,
                                              })
                                            }
                                            className="px-1 py-0.2 rounded bg-stone-800 hover:bg-stone-700 text-[8px] text-stone-200 cursor-pointer"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDmEnqueueVisual({
                                                kind: 'tactical',
                                                sourceId: tMap.id,
                                                title: tMap.name,
                                                imageUrl: tMap.mapImageUrl || '',
                                                folder: tMap.folder,
                                              })
                                            }
                                            className="px-1 py-0.2 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-[8px] text-amber-200 cursor-pointer"
                                          >
                                            + Cola
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-stone-400 text-center py-2">
                                No hay mapas tácticos en esta zona. Crea uno abajo:
                              </p>
                            )}

                            {/* Quick create tactical map */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center pt-1 border-t border-stone-800">
                              <input
                                type="text"
                                value={newTacticalTitle}
                                onChange={(e) => setNewTacticalTitle(e.target.value)}
                                placeholder="Nombre del tablero táctico..."
                                className="sm:col-span-4 bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-[11px] text-stone-100"
                              />
                              <input
                                type="text"
                                value={newTacticalUrl}
                                onChange={(e) => setNewTacticalUrl(e.target.value)}
                                placeholder="URL de imagen del mapa táctico..."
                                className="sm:col-span-5 bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-[11px] text-stone-100"
                              />
                              <button
                                type="button"
                                data-testid="btn-quick-create-tactical-in-map"
                                onClick={handleCreateQuickTacticalMapInTable}
                                disabled={!newTacticalUrl.trim()}
                                className="sm:col-span-3 py-1 px-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-cinzel font-bold text-[10px] cursor-pointer"
                              >
                                + Tablero Táctico
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* TAB 3: VER COLA (Ordered Visual Queue across all zones) */
                          <div data-testid="dm-projection-queue-panel" className="space-y-2">
                            {(workspace?.visualQueue || []).length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[155px] overflow-y-auto pr-1">
                                {(workspace?.visualQueue || []).map((qItem, idx) => {
                                  const isLive =
                                    workspace?.activeLiveVisual?.imageUrl === qItem.imageUrl &&
                                    workspace?.activeLiveVisual?.title === qItem.title;
                                  return (
                                    <div
                                      key={qItem.id}
                                      data-testid={`projection-queue-card-${idx}`}
                                      className={`rounded-xl border-2 p-1.5 flex flex-col justify-between text-left transition overflow-hidden ${
                                        isLive
                                          ? 'bg-emerald-950/40 border-emerald-400'
                                          : 'bg-[#171922] border-stone-700 hover:border-amber-400'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDmViewportMode('dm');
                                          setDmInspectedVisual({
                                            kind: qItem.kind,
                                            id: qItem.sourceId,
                                            title: qItem.title,
                                            imageUrl: qItem.imageUrl,
                                            folder: qItem.folder,
                                          });
                                        }}
                                        className="text-left w-full cursor-pointer"
                                        title="Clic para previsualizar en Vista DM"
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[10px] font-cinzel font-bold text-[#f5e4be] truncate">
                                            #{idx + 1} {qItem.title}
                                          </span>
                                        </div>
                                        <div className="h-11 w-full rounded-lg bg-black/60 border border-stone-800 my-1 overflow-hidden flex items-center justify-center">
                                          <img
                                            src={qItem.imageUrl}
                                            alt={qItem.title}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      </button>
                                      <div className="flex items-center justify-between gap-1 text-[9px] font-cinzel font-bold">
                                        <button
                                          type="button"
                                          data-testid={`btn-project-queued-item-${idx}`}
                                          onClick={() => {
                                            if (!workspace || !onUpdateWorkspace) return;
                                            const matchingTac =
                                              qItem.kind === 'tactical'
                                                ? (workspace.locations || []).find(
                                                    (l) => l.id === qItem.sourceId
                                                  )
                                                : undefined;
                                            onUpdateWorkspace({
                                              ...workspace,
                                              activeLiveVisual: {
                                                kind: qItem.kind,
                                                id: qItem.sourceId,
                                                title: qItem.title,
                                                imageUrl: qItem.imageUrl,
                                                folder: qItem.folder,
                                                gridCols: matchingTac?.gridCols,
                                                gridRows: matchingTac?.gridRows,
                                                tacticalTokens: matchingTac?.tokens,
                                              },
                                            });
                                          }}
                                          className="text-amber-200 hover:underline cursor-pointer"
                                        >
                                          {isLive ? 'EN VIVO' : 'PROYECTAR'}
                                        </button>
                                        <button
                                          type="button"
                                          data-testid={`btn-remove-queued-item-${idx}`}
                                          onClick={() => handleDmRemoveFromQueue(qItem.id)}
                                          className="px-1.5 py-0.5 rounded bg-red-950/70 hover:bg-red-900 text-red-300 cursor-pointer"
                                          title="Tachar / Quitar de la cola"
                                        >
                                          ✕ Quitar
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-xl bg-black/40 border border-stone-800 p-3 text-center text-[11px] text-stone-400">
                                La cola está vacía. Usa el botón <strong className="text-amber-300">+ Cola</strong> en cualquier mapa, foto o tablero táctico para preparar el orden de tu sesión.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* BOTTOM-RIGHT OVERLAY: MINIMIZABLE OPEN NOTEBOOK / LIBRETA     */}
              {/* ------------------------------------------------------------- */}
              <div className="w-full xl:w-[42%] pointer-events-auto">
                <div
                  className="rounded-2xl bg-gradient-to-b from-[#2b2117] via-[#1f1811] to-[#15100b] border-2 border-[#e2c275] shadow-[0_10px_30px_rgba(0,0,0,0.95)] overflow-hidden transition-all"
                  data-testid="map-notebook-overlay"
                >
                  {/* Notebook Spine Header with Minimize Toggle */}
                  <div className="px-3 py-2 bg-gradient-to-r from-[#3a2a19] via-[#281d12] to-[#1c140d] border-b border-[#e2c275]/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-4 h-4 text-[#f5e4be] shrink-0" />
                      <span className="font-cinzel font-black text-xs text-[#f5e4be] truncate">
                        {mode === 'dm'
                          ? 'Crónicas del DM'
                          : `Libreta de ${character?.name || 'Aventurero'}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="btn-toggle-notebook-overlay"
                      onClick={() => setIsNotebookMinimized((prev) => !prev)}
                      className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-black/80 border border-[#e2c275]/50 text-[#f5e4be] text-[10px] font-cinzel font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {isNotebookMinimized ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Abrir Libreta</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Minimizar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!isNotebookMinimized && (
                    <div className="p-2.5 space-y-2">
                      {/* Open Parchment Pages Look */}
                      <div className="rounded-xl bg-gradient-to-r from-[#e8dab8] via-[#f3e7c9] to-[#e5d4ad] border-2 border-[#8c6732] p-2.5 text-[#2b1e10] shadow-inner space-y-1.5">
                        {mode === 'player' && character ? (
                          <>
                            <div className="flex items-center justify-between border-b border-[#8c6732]/40 pb-1">
                              <span className="font-cinzel font-bold text-[10px] uppercase tracking-wider text-[#5c3e18]">
                                Apuntes Rápidos de Sesión
                              </span>
                              <span className="text-[9px] font-mono text-[#6e4d23]">
                                Autoguardado
                              </span>
                            </div>
                            <textarea
                              rows={4}
                              value={character.notes || ''}
                              onChange={(e) => {
                                if (onUpdateCharacter) {
                                  onUpdateCharacter({
                                    ...character,
                                    notes: e.target.value,
                                  });
                                }
                              }}
                              placeholder="Escribe aquí tus pistas, nombres de NPCs o notas del mapa..."
                              className="w-full bg-transparent text-xs text-[#24180b] placeholder-[#7a5c37] font-serif leading-relaxed focus:outline-none resize-none"
                            />
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={dmQuickLogTitle}
                              onChange={(e) => setDmQuickLogTitle(e.target.value)}
                              placeholder={`Título (ej. Sucesos en ${currentPlaceShortName})...`}
                              className="w-full bg-transparent border-b border-[#8c6732]/40 pb-1 text-xs font-cinzel font-bold text-[#24180b] placeholder-[#7a5c37] focus:outline-none"
                            />
                            <textarea
                              rows={3}
                              value={dmQuickLogSummary}
                              onChange={(e) => setDmQuickLogSummary(e.target.value)}
                              placeholder="Anota eventos clave de la escena para el Gran Tomo de Crónicas..."
                              className="w-full bg-transparent text-xs text-[#24180b] placeholder-[#7a5c37] font-serif leading-relaxed focus:outline-none resize-none"
                            />
                          </>
                        )}
                      </div>

                      {mode === 'dm' && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-emerald-300 font-cinzel font-bold">
                            {notebookSavedFeedback}
                          </span>
                          <button
                            type="button"
                            onClick={handleSaveDmQuickChronicle}
                            className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#3d2c19] to-[#261b0f] hover:from-amber-800 hover:to-amber-950 border border-[#e2c275] text-[#f5e4be] font-cinzel font-bold text-[11px] cursor-pointer shadow"
                          >
                            Nueva Entrada
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: SALA EN VIVO + HISTORIAL + CAJA DE DADOS            */}
        {/* ================================================================= */}
        <div className="flex flex-col justify-between gap-2.5 min-w-0">
          {/* 1. SALA EN VIVO: CARTAS DE MONSTRUOS Y ENEMIGOS EN MESA */}
          <div
            data-testid="map-enemies-row-block"
            className="bg-gradient-to-b from-[#171820] via-[#13141b] to-[#101117] border-2 border-[#c8a45c]/75 rounded-2xl p-3 shadow-xl space-y-2"
            style={
              mode === 'player'
                ? buildSpatialBlockInlineStyle(resolvedPlayerMap.blocks.map_enemies_row)
                : {
                    backgroundColor: activeDmSkinTokens?.dmCombatTrackerBg || undefined,
                    borderColor: activeDmSkinTokens?.dmCombatEnemyBorder || undefined,
                  }
            }
          >
            <div className="flex items-center justify-between border-b border-[#c8a45c]/35 pb-1.5">
              <div>
                <h3 className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] uppercase tracking-wider leading-none">
                  COMBATE ({resolvedEnemies.length}/{MAX_ENCOUNTER_ENEMIES})
                </h3>
                <span className="text-[10px] font-cinzel text-[#cbb692] uppercase block mt-0.5">
                  Cartas de Monstruos y Enemigos en Mesa
                </span>
              </div>
              {mode === 'dm' && (
                <button
                  type="button"
                  disabled={resolvedEnemies.length >= MAX_ENCOUNTER_ENEMIES}
                  onClick={() => setIsAddEnemyModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-red-950/90 hover:bg-red-900 disabled:opacity-40 border border-red-500/60 text-red-100 font-cinzel font-bold text-[10px] flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  title={
                    resolvedEnemies.length >= MAX_ENCOUNTER_ENEMIES
                      ? `Tope máximo de ${MAX_ENCOUNTER_ENEMIES} enemigos alcanzado`
                      : 'Añadir monstruo a la mesa'
                  }
                >
                  <Plus className="w-3 h-3" />
                  <span>Enemigo</span>
                </button>
              )}
            </div>

            {resolvedEnemies.length === 0 ? (
              <div className="rounded-xl bg-black/45 border border-stone-800 p-3 text-center text-[11px] text-stone-400 font-cinzel">
                {mode === 'dm'
                  ? 'Sin enemigos activos en mesa. Usa "+ Enemigo" para desplegar monstruos.'
                  : 'Sin enemigos visibles en la mesa en este momento.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[195px] overflow-y-auto pr-0.5">
                {resolvedEnemies.map((enemy) => {
                  const pct = Math.min(
                    100,
                    Math.max(0, (enemy.hp / Math.max(1, enemy.maxHp)) * 100)
                  );
                  return (
                    <div
                      key={enemy.id}
                      data-testid={`map-enemy-card-${enemy.id}`}
                      className="rounded-xl bg-gradient-to-b from-[#241619] to-[#140e10] border border-[#c8a45c]/65 p-2 flex flex-col justify-between gap-1.5 shadow"
                    >
                      <div className="flex items-center gap-1.5">
                        <EntityAvatar
                          avatarType={enemy.avatarType}
                          customUrl={enemy.avatarCustomUrl}
                          iconId={enemy.avatarIcon || 'skull'}
                          category="monster"
                          size="sm"
                          className="rounded-full border border-red-400/60 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-cinzel font-bold text-[11px] text-[#f5e4be] truncate leading-tight">
                            {enemy.name}
                          </div>
                          <div className="text-[9px] text-amber-300/90 font-mono">
                            {enemy.levelOrCr || 'Niv 1'}
                          </div>
                        </div>
                      </div>

                      {/* HP Bar */}
                      <div className="w-full h-3.5 rounded-full bg-black/80 border border-emerald-500/40 overflow-hidden relative">
                        <div
                          className={`h-full transition-all ${
                            pct > 50 ? 'bg-emerald-600' : pct > 25 ? 'bg-amber-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-0 text-[9px] font-mono font-bold text-white flex items-center justify-center">
                          HP {enemy.hp}/{enemy.maxHp}
                        </span>
                      </div>

                      {/* Base Stats (CA, Inic, Vel) + DM-only HP +/- */}
                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-stone-300 pt-0.5 border-t border-white/10">
                        <div className="truncate">
                          <span className="text-[#e2c275] font-bold">CA {enemy.ac}</span>
                          {enemy.initiative !== undefined && (
                            <span className="text-stone-400"> • Inic {enemy.initiative}</span>
                          )}
                        </div>

                        {mode === 'dm' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-testid={`dm-heal-enemy-${enemy.id}`}
                              onClick={() => handleDmAdjustEnemyHp(enemy.id, 1)}
                              className="w-5 h-5 rounded bg-emerald-950 hover:bg-emerald-800 border border-emerald-500/50 text-emerald-200 flex items-center justify-center font-bold cursor-pointer"
                              title="Curar +1 HP al enemigo"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              data-testid={`dm-damage-enemy-${enemy.id}`}
                              onClick={() => handleDmAdjustEnemyHp(enemy.id, -1)}
                              className="w-5 h-5 rounded bg-red-950 hover:bg-red-800 border border-red-500/50 text-red-200 flex items-center justify-center font-bold cursor-pointer"
                              title="Dañar -1 HP al enemigo"
                            >
                              -
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mode === 'dm' && (
              <div className="pt-1 border-t border-[#c8a45c]/25 flex items-center justify-between text-[11px]">
                <span className="text-stone-400 font-cinzel">Visibilidad para Jugadores:</span>
                <button
                  type="button"
                  onClick={handleDmToggleBroadcastEnemies}
                  className={`font-cinzel font-bold flex items-center gap-1 cursor-pointer ${
                    workspace?.activeEncounter?.broadcastEnemiesToTable
                      ? 'text-emerald-400'
                      : 'text-stone-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    Enemigos en Mesa:{' '}
                    {workspace?.activeEncounter?.broadcastEnemiesToTable ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 2. HISTORIAL DE DADOS TIRADOS Y ÚLTIMOS DADOS */}
          <div
            data-testid="map-dice-log-block"
            className="bg-gradient-to-b from-[#171820] to-[#111218] border-2 border-[#c8a45c]/75 rounded-2xl p-3 shadow-xl space-y-2"
            style={
              mode === 'player'
                ? buildSpatialBlockInlineStyle(resolvedPlayerMap.blocks.map_dice_log)
                : {
                    backgroundColor: activeDmSkinTokens?.dmRollFeedBg || undefined,
                    borderColor: activeDmSkinTokens?.dmRollFeedBorder || undefined,
                  }
            }
          >
            <h3 className="font-cinzel font-black text-xs text-[#f5e4be] uppercase tracking-wider text-center">
              HISTORIAL DE DADOS TIRADOS Y ÚLTIMOS DADOS
            </h3>

            {/* Parchment Scroll Banner for Latest Roll */}
            <div
              data-testid="map-latest-roll-banner"
              className="rounded-xl bg-gradient-to-b from-[#d8c396] via-[#cbb17c] to-[#b59860] border-2 border-[#6e4f22] px-3 py-2.5 text-[#231709] shadow-inner"
            >
              {latestRoll ? (
                <div className="space-y-0.5">
                  <div className="text-xs font-serif font-bold flex items-center justify-between gap-1">
                    <span className="truncate">
                      📜 Último: <strong>{latestRoll.rollerName}</strong>
                    </span>
                    <span
                      data-testid="map-latest-roll-total"
                      className="font-mono font-black text-sm text-[#4a1c0b] shrink-0"
                    >
                      = {latestRoll.total}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#3b2810] flex items-center justify-between">
                    <span className="truncate">
                      {latestRoll.rollTitle} ({latestRoll.formula})
                    </span>
                    <span>[{latestRoll.rolls.join(', ')}]</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-serif italic text-center py-1 text-[#4a3519]">
                  📜 Aún no se han lanzado dados en esta sesión.
                </div>
              )}
            </div>

            {isRollHistoryExpanded && rollFeed.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1 bg-black/50 border border-[#c8a45c]/35 rounded-xl p-2 text-[11px]">
                {rollFeed
                  .slice()
                  .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
                  .slice(0, 12)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 border-b border-stone-800/80 pb-1 last:border-0"
                    >
                      <span className="text-stone-300 truncate">
                        <strong className="text-amber-300">{r.rollerName}</strong> • {r.formula}
                      </span>
                      <span className="font-mono font-bold text-emerald-300 shrink-0">
                        = {r.total} [{r.rolls.join(',')}]
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsRollHistoryExpanded((prev) => !prev)}
              className="w-full py-1 px-3 rounded-xl bg-[#1a1c26] hover:bg-[#242736] border border-[#c8a45c]/50 text-[#e2c275] font-cinzel font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>
                {isRollHistoryExpanded ? 'Ocultar Historia [▼]' : `↑ Historia (${rollFeed.length}) [▲]`}
              </span>
            </button>
          </div>

          {/* 3. LA CAJA DE DADOS (D4..D100 + 1-6 MULTI-DICE SELECTOR + TIRAR) */}
          <div
            className="bg-gradient-to-b from-[#171820] via-[#13141b] to-[#0e0f14] border-2 border-[#e2c275] rounded-2xl p-3 shadow-xl space-y-2.5"
            data-testid="la-caja-de-dados"
          >
            <div className="flex items-center justify-between border-b border-[#c8a45c]/35 pb-1.5">
              <h3 className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] uppercase tracking-wider">
                LA CAJA DE DADOS
              </h3>
              <span className="text-[11px] font-mono font-bold text-amber-300">
                {selectedDiceCount}D{selectedDiceSides}
                {diceModifier !== 0 ? (diceModifier > 0 ? `+${diceModifier}` : diceModifier) : ''}
              </span>
            </div>

            {/* Polyhedral Dice Selector Grid (D4, D6, D8, D10, D12, D20, D100) */}
            <div className="grid grid-cols-4 gap-1.5">
              {DICE_TYPES.map((d) => {
                const isSelected = selectedDiceSides === d.sides;
                return (
                  <button
                    key={d.sides}
                    type="button"
                    data-testid={`dice-select-d${d.sides}`}
                    onClick={() => setSelectedDiceSides(d.sides)}
                    className={`py-1.5 px-1 rounded-xl border font-cinzel font-bold flex flex-col items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#423119] to-[#241a0d] border-[#f5e4be] text-[#f5e4be] shadow-[0_0_12px_rgba(226,194,117,0.45)] scale-105'
                        : 'bg-[#181a24] hover:bg-[#222534] border-[#c8a45c]/45 text-[#cbb692]'
                    }`}
                  >
                    {renderPolyhedralDieIcon(d.sides)}
                    <span className="text-[10px] mt-0.5">{d.label}</span>
                  </button>
                );
              })}

              {/* Optional Modifier Mini Control */}
              <div className="rounded-xl bg-[#14161f] border border-[#c8a45c]/40 flex flex-col items-center justify-center px-1 py-1">
                <span className="text-[8px] font-cinzel text-stone-400 uppercase">Bono</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDiceModifier((m) => m - 1)}
                    className="text-xs font-mono font-bold text-stone-300 hover:text-white px-1 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-mono font-bold text-amber-300">
                    {diceModifier >= 0 ? `+${diceModifier}` : diceModifier}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDiceModifier((m) => m + 1)}
                    className="text-xs font-mono font-bold text-stone-300 hover:text-white px-1 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Selector of 1 to 6 Dice (Replaces the redundant "Regresar al Panel" slot inside Dice Box) */}
            <div className="bg-[#12141c] border border-[#c8a45c]/55 rounded-xl p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-cinzel text-[#cbb692]">
                <span>Cantidad de Dados (1 a 6):</span>
                <span className="font-mono font-bold text-amber-300">
                  {selectedDiceCount} {selectedDiceCount === 1 ? 'Dado' : 'Dados'}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[1, 2, 3, 4, 5, 6].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    data-testid={`dice-count-${cnt}`}
                    onClick={() => setSelectedDiceCount(cnt)}
                    className={`py-1 rounded-lg font-mono font-bold text-xs border transition cursor-pointer ${
                      selectedDiceCount === cnt
                        ? 'bg-amber-500 text-stone-950 border-[#f5e4be] shadow'
                        : 'bg-[#1a1d28] text-stone-300 border-stone-700 hover:border-[#c8a45c]'
                    }`}
                  >
                    {cnt}D
                  </button>
                ))}
              </div>
            </div>

            {/* Emerald TIRAR Button (Replaces the redundant "Guardar" slot inside Dice Box) */}
            <button
              type="button"
              data-testid="btn-roll-dice-box"
              onClick={() =>
                executeDiceRoll(selectedDiceSides, selectedDiceCount, diceModifier)
              }
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-500 border-2 border-emerald-300/80 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition cursor-pointer"
            >
              <Dices className="w-4 h-4 text-amber-200" />
              <span>
                Tirar {selectedDiceCount}D{selectedDiceSides}
                {diceModifier !== 0
                  ? diceModifier > 0
                    ? ` + ${diceModifier}`
                    : ` - ${Math.abs(diceModifier)}`
                  : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM BAR: MINIATURE PLAYER TAROT CARDS (BOTH DM AND PLAYERS)      */}
      {/* =================================================================== */}
      <div
        data-testid="map-bottom-player-cards-bar"
        className="w-full rounded-2xl bg-gradient-to-r from-[#171822] via-[#13141c] to-[#171822] border-2 border-[#c8a45c]/80 p-3 shadow-2xl space-y-2.5"
        style={
          mode === 'player'
            ? buildSpatialBlockInlineStyle(resolvedPlayerMap.blocks.map_player_tarot_dock)
            : {
                borderColor: activeDmSkinTokens?.dmScreenBaseBorder || undefined,
              }
        }
      >
        <div className="flex items-center justify-between border-b border-[#c8a45c]/35 pb-1.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] uppercase tracking-wider">
              Cartas de Jugadores en la Mesa ({resolvedPlayerCards.length})
            </span>
          </div>
          <span className="text-[10px] font-cinzel text-[#cbb692]">
            Sala: <strong className="text-amber-300 font-mono">{roomCode}</strong>
          </span>
        </div>

        {resolvedPlayerCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#c8a45c]/40 bg-[#12131a]/80 p-4 text-center">
            <p className="font-cinzel font-bold text-xs text-[#f5e4be]">
              Sin aventureros conectados aún en la sala {roomCode}
            </p>
          </div>
        ) : (
          <div
            data-testid="map-player-cards-grid"
            className="flex flex-wrap items-stretch justify-center sm:justify-start gap-3"
          >
            {resolvedPlayerCards.map((member) => (
              <div
                key={member.characterId}
                className="w-full sm:w-[255px] md:w-[265px] shrink-0"
              >
                <CharacterTarotCard
                  member={member}
                  character={
                    character && character.id === member.characterId ? character : undefined
                  }
                  isOnline={true}
                  miniature={true}
                  miniGrid={true}
                  showLastRollInMap={true}
                  lastRoll={member.lastRoll}
                  showDmControls={mode === 'dm'}
                  onDmAdjustPlayer={onDmAdjustPlayer}
                  dataTestId={`map-player-card-${member.characterId}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODALS: EDIT MAP/GALLERY, ADD SUB-PLACE, ADD ENEMY, WHISPER TO DM   */}
      {/* =================================================================== */}

      {/* 1. DM Edit Map & Upload Gallery Image Modal */}
      {isEditMapModalOpen && mode === 'dm' && workspace && onUpdateWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-[#171922] border-2 border-[#e2c275] rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <h3 className="font-cinzel font-black text-base text-[#f5e4be]">
                Mapa y Galería de: {currentPlaceShortName}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditMapModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section A: Base Map of the Place */}
            <div className="space-y-2 bg-[#12141c] border border-[#c8a45c]/40 rounded-xl p-3">
              <label className="block text-xs font-cinzel font-bold text-amber-300">
                1. Mapa Principal de {currentPlaceShortName}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={mapUrlDraft}
                  onChange={(e) => setMapUrlDraft(e.target.value)}
                  placeholder="Pegar URL de imagen del mapa..."
                  className="flex-1 bg-black/60 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdateWorkspace({
                      ...workspace,
                      atlasMaps: {
                        ...(workspace.atlasMaps || {}),
                        [selectedFolder]: mapUrlDraft.trim(),
                      },
                      activeLiveVisual: {
                        kind: 'map',
                        id: `map-${selectedFolder}`,
                        title: `Mapa: ${currentPlaceShortName}`,
                        imageUrl: mapUrlDraft.trim(),
                        folder: selectedFolder,
                      },
                    });
                    setIsEditMapModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-cinzel font-bold text-xs cursor-pointer"
                >
                  Guardar URL
                </button>
              </div>
              <div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#222534] hover:bg-[#2c3044] border border-[#c8a45c]/60 text-[#f5e4be] font-cinzel font-bold text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-amber-300" />
                  <span>Subir Archivo de Mapa desde tu PC</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDmUploadMapFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Section B: Add Photo to Place Gallery / Album */}
            <form
              onSubmit={handleDmAddGalleryByUrl}
              className="space-y-2 bg-[#12141c] border border-[#c8a45c]/40 rounded-xl p-3"
            >
              <label className="block text-xs font-cinzel font-bold text-emerald-300">
                2. Agregar Imagen a la Galería de {currentPlaceShortName}
              </label>
              <input
                type="text"
                value={newGalleryTitle}
                onChange={(e) => setNewGalleryTitle(e.target.value)}
                placeholder="Título de la escena o foto (ej. Barra de la Taberna, Sótano)..."
                className="w-full bg-black/60 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newGalleryUrl}
                  onChange={(e) => setNewGalleryUrl(e.target.value)}
                  placeholder="URL de la foto de galería..."
                  className="flex-1 bg-black/60 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-cinzel font-bold text-xs cursor-pointer"
                >
                  Añadir URL
                </button>
              </div>
              <div className="pt-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-100 font-cinzel font-bold text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Subir Foto de Galería desde tu PC</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDmUploadGalleryFile}
                    className="hidden"
                  />
                </label>
              </div>
            </form>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditMapModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. DM Create Sub-Place Modal */}
      {isAddSubPlaceModalOpen && mode === 'dm' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleDmCreateSubPlace}
            className="w-full max-w-md bg-[#171922] border-2 border-[#e2c275] rounded-2xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="font-cinzel font-black text-base text-[#f5e4be]">
                Nuevo Sub-Lugar dentro de {currentPlaceShortName}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSubPlaceModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newSubPlaceName}
              onChange={(e) => setNewSubPlaceName(e.target.value)}
              placeholder="Ej. Piso 1, Sótano Secreto, Sala del Trono..."
              className="w-full bg-black/60 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddSubPlaceModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-cinzel font-black text-xs cursor-pointer"
              >
                Crear Sub-Lugar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. DM Add Monster to Table Modal */}
      {isAddEnemyModalOpen && mode === 'dm' && workspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#171922] border-2 border-red-500/80 rounded-2xl p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="font-cinzel font-black text-base text-red-200">
                Desplegar Enemigo en la Sala en Vivo
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEnemyModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {(workspace.monsters || []).map((mon) => (
                <div
                  key={mon.id}
                  className="bg-[#12141c] border border-stone-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-cinzel font-bold text-xs text-[#f5e4be]">
                      {mon.name}
                    </div>
                    <div className="text-[10px] font-mono text-red-300">
                      CR {mon.cr} • HP {mon.maxHp} • CA {mon.ac}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDmAddMonsterToTable(mon.id)}
                    className="px-3 py-1 rounded-lg bg-red-900 hover:bg-red-800 text-white font-cinzel font-bold text-xs cursor-pointer"
                  >
                    + Desplegar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Player Whisper to DM Modal */}
      {isWhisperModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSendWhisperToDm}
            className="w-full max-w-md bg-[#181522] border-2 border-purple-400 rounded-2xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-purple-900 pb-2">
              <h3 className="font-cinzel font-bold text-base text-purple-200">
                Susurrar al Dungeon Master ({roomCode})
              </h3>
              <button
                type="button"
                onClick={() => setIsWhisperModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-cinzel text-purple-200 mb-1">Asunto *</label>
              <input
                type="text"
                required
                value={whisperTitle}
                onChange={(e) => setWhisperTitle(e.target.value)}
                placeholder="Ej. Acción sigilosa / Revisar puerta..."
                className="w-full bg-black/50 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-cinzel text-purple-200 mb-1">Mensaje *</label>
              <textarea
                rows={3}
                required
                value={whisperBody}
                onChange={(e) => setWhisperBody(e.target.value)}
                placeholder="Escribe tu mensaje privado para el DM..."
                className="w-full bg-black/50 border border-purple-500/40 rounded-xl p-3 text-xs text-white"
              />
            </div>
            {whisperStatus && (
              <p className="text-xs font-cinzel font-bold text-emerald-300">{whisperStatus}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWhisperModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-cinzel font-bold text-xs cursor-pointer"
              >
                Enviar al DM
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Full Tactical Map Studio Modal */}
      {isTacticalStudioOpen && mode === 'dm' && workspace && (
        <TacticalMapStudioModal
          isOpen={isTacticalStudioOpen}
          onClose={() => setIsTacticalStudioOpen(false)}
          initialConfig={
            activeTacticalConfig ||
            createDefaultTacticalMapConfig(
              selectedFolder !== 'all'
                ? `Mapa Táctico - ${currentPlaceShortName}`
                : 'Mapa Táctico - Taberna en Duelo'
            )
          }
          savedTacticalLocations={filteredTacticalMaps}
          partyCharacters={resolvedPlayerCards.map((pm) => ({
            id: pm.characterId,
            name: pm.characterName,
            race: pm.race || 'Humano',
            characterClass: (pm.characterClass as any) || 'Guerrero',
            subclass: '',
            level: pm.level || 1,
            xp: 0,
            background: '',
            alignment: pm.alignment || 'Neutral Bueno',
            playerName: pm.playerName || 'Jugador',
            avatarUrl: pm.avatarUrl,
            playerSkinId: pm.playerSkinId,
            ac: pm.ac || 15,
            hpCurrent: pm.currentHp ?? pm.hpCurrent ?? 20,
            hpMax: pm.maxHp ?? pm.hpMax ?? 20,
            hpTemp: 0,
            speed: 30,
            initiativeBonus: 0,
            proficiencyBonus: 2,
            inspiration: false,
            hitDiceTotal: '1d10',
            hitDiceRemaining: 1,
            deathSaves: { successes: 0, failures: 0 },
            exhaustion: 0,
            conditions: pm.conditions || [],
            concentration: '',
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            savingThrows: {
              str: false,
              dex: false,
              con: false,
              int: false,
              wis: false,
              cha: false,
            },
            skills: {} as any,
            attacks: [],
            spellcastingAbility: 'int',
            spellSaveDC: 10,
            spellAttackBonus: 2,
            spellSlots: {},
            spells: [],
            inventory: [],
            coins: { cp: 0, sp: 0, ep: 0, gp: pm.gp ?? 50, pp: 0 },
            featuresTraits: '',
            proficienciesLanguages: '',
            personalityTraits: '',
            ideals: '',
            bonds: '',
            flaws: '',
            backstory: '',
            notes: '',
          }))}
          monsters={workspace.monsters || []}
          onSaveTacticalMap={handleSaveTacticalMapFromTable}
          onProjectLiveToPlayers={handleProjectTacticalMapFromTable}
        />
      )}
    </div>
  );
};
