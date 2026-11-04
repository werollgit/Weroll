import React, { useState, useMemo } from 'react';
import {
  Users,
  Skull,
  MapPin,
  BookOpen,
  Sword,
  Sparkles,
  Plus,
  Trash2,
  Folder,
  FolderOpen,
  Radio,
  Eye,
  EyeOff,
  Shield,
  ChevronRight,
  ChevronLeft,
  Send,
  Wand2,
  Edit,
  RotateCcw,
  CheckCircle,
  FileText,
  Archive,
  Layers,
  Check,
  Upload,
  ArrowLeft,
  MessageSquare,
  Crown,
  Compass,
  Image as ImageIcon,
  X,
  Dices,
  Flag,
  Gift,
  Maximize2,
  Camera,
  Move,
  Scroll,
  Settings,
  ListPlus,
  Sliders,
  Crosshair,
  Palette,
} from 'lucide-react';
import { EntityAvatar } from '../common/EntityAvatar';
import { AvatarCustomizerModal } from '../common/AvatarCustomizerModal';
import {
  DMWorkspace,
  NPCRecord,
  MonsterRecord,
  LocationRecord,
  CampaignLogEntry,
  Combatant,
  CombatSummary,
  CombatLogEvent,
  MonsterAttack,
  DMCustomItemOrSpell,
  InventoryItem,
  PartyMemberLive,
  PlayerMessageToDM,
  PlaceAlbumPhoto,
  ZoneMapRecord,
  VisualQueueItem,
  DLCPackageRecord,
  ChronicleEntryType,
  TacticalMapConfig,
  AppSkinRecord,
} from '../../types/dnd';
import {
  canAccessTacticalMaps,
  createDefaultTacticalMapConfig,
} from '../../utils/tacticalMapEngine';
import { TacticalMapStudioModal } from '../tactical/TacticalMapStudioModal';
import {
  rollDiceExpression,
  stepInitiativeTurn,
  buildAtlasBreadcrumbs,
  getChildFoldersForAtlas,
  ensureCompleteFolderHierarchy,
  getPinPositionForChildPlace,
  filterAlbumPhotosByPlace,
  MAX_ENCOUNTER_ENEMIES,
  canAddEnemyToEncounter,
  getParentAtlasFolder,
  getReturnToParentButtonLabel,
  enqueueVisualItem,
  removeVisualFromQueue,
  canAccessArcaneOracle,
} from '../../utils/dnd-math';
import { soundFx } from '../../utils/audio';
import { FolderManagerModal } from './FolderManagerModal';
import { DMItemsAndSpellsView } from './DMItemsAndSpellsView';
import { CharacterTarotCard } from '../character/CharacterTarotCard';
import { folderMatchesFilter, getFolderDepth } from '../../utils/storage';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';

interface DMScreenViewProps {
  workspace: DMWorkspace;
  onUpdateWorkspace: (updated: DMWorkspace) => void;
  onTriggerRoll: (title: string, modifier: number, diceType?: number) => void;
  onBroadcastAnnouncement: (title: string, content: string) => void;
  onOpenAIOracle: (initialPrompt?: string, isDmContext?: boolean) => void;
  onUpdateDmLiveMessage?: (msg: string) => void;
  onGiveItemToPlayer?: (item: InventoryItem) => void;
  onSaveAndReturnToLobby?: () => void;
  onSaveToCloud?: () => void;
  worldName?: string;
  roomCode?: string;
  roomPassword?: string;
  onUpdateTableSettings?: (updates: {
    name: string;
    roomCode: string;
    roomPassword?: string;
    roomMode?: 'online' | 'offline';
  }) => Promise<void> | void;
  partyMembers?: PartyMemberLive[];
  playerMessages?: PlayerMessageToDM[];
  onDeletePlayerMessage?: (messageId: string) => void;
  onMarkPlayerMessageRead?: (messageId: string) => void;
  onOpenRollFeed?: () => void;
  recentRollsCount?: number;
  isOfflineMode?: boolean;
  onToggleOfflineMode?: (offline: boolean) => void;
  isOnlineSession?: boolean;
  onToggleOnlineSession?: () => void;
  onOpenTableMapView?: () => void;
  onDmAdjustPlayer?: (
    characterId: string,
    updates: { hpDelta?: number; setHp?: number; gpDelta?: number }
  ) => void;
  currentUserRole?: 'client' | 'moderator' | 'creator' | 'admin' | string | null;
  currentUserEmail?: string;
}

export const DMScreenView: React.FC<DMScreenViewProps> = ({
  workspace,
  onUpdateWorkspace,
  onTriggerRoll,
  onBroadcastAnnouncement,
  onOpenAIOracle,
  onUpdateDmLiveMessage,
  onGiveItemToPlayer,
  onSaveAndReturnToLobby,
  onSaveToCloud,
  worldName,
  roomCode,
  roomPassword,
  onUpdateTableSettings,
  partyMembers = [],
  playerMessages,
  onDeletePlayerMessage,
  onMarkPlayerMessageRead,
  onOpenRollFeed,
  recentRollsCount = 0,
  isOfflineMode = false,
  onToggleOfflineMode,
  isOnlineSession: isOnlineSessionProp,
  onToggleOnlineSession: onToggleOnlineSessionProp,
  onOpenTableMapView,
  onDmAdjustPlayer,
  currentUserRole = 'client',
  currentUserEmail = '',
}) => {
  const isOracleAllowed = canAccessArcaneOracle(currentUserRole);
  const isTacticalMapsAllowed = canAccessTacticalMaps(currentUserRole);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState<boolean>(false);
  const [isDmTableSettingsModalOpen, setIsDmTableSettingsModalOpen] = useState<boolean>(false);
  const [isTacticalStudioOpen, setIsTacticalStudioOpen] = useState<boolean>(false);
  const [availableDlcs, setAvailableDlcs] = useState<DLCPackageRecord[]>([]);
  const [ownedDlcIds, setOwnedDlcIds] = useState<string[]>(['dlc-srd-5e-oficial']);
  const [dlcRedeemCodeInput, setDlcRedeemCodeInput] = useState<string>('');
  const [availableDmSkins, setAvailableDmSkins] = useState<AppSkinRecord[]>([]);
  const [onlineDefaultDmSkinId, setOnlineDefaultDmSkinId] = useState<string>('skin-dm-crimson-overlord');

  React.useEffect(() => {
    let active = true;
    const loadDlcs = async () => {
      try {
        const q = currentUserEmail ? `?email=${encodeURIComponent(currentUserEmail)}` : '';
        const res = await fetch(`/api/creator/catalog${q}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (Array.isArray(data.dlcs)) setAvailableDlcs(data.dlcs);
        if (Array.isArray(data.ownedDlcIds)) setOwnedDlcIds(data.ownedDlcIds);
        const mergedDmSkins: AppSkinRecord[] = [];
        if (Array.isArray(data.dmSkins)) {
          mergedDmSkins.push(...data.dmSkins);
        }
        if (Array.isArray(data.skins)) {
          for (const s of data.skins) {
            if (s.scope === 'dm' && !mergedDmSkins.some((d) => d.id === s.id)) {
              mergedDmSkins.push(s);
            }
          }
        }
        setAvailableDmSkins(mergedDmSkins);
        if (data.activeOnlineDmSkinId) {
          setOnlineDefaultDmSkinId(data.activeOnlineDmSkinId);
        }
      } catch {
        // ignore
      }
    };
    loadDlcs();
    return () => {
      active = false;
    };
  }, [currentUserEmail, isDmTableSettingsModalOpen]);

  const activeDmSkinRecord = useMemo(() => {
    const targetId = workspace.dmSkinId || onlineDefaultDmSkinId;
    return (
      availableDmSkins.find((s) => s.id === targetId) ||
      availableDmSkins.find((s) => s.id === onlineDefaultDmSkinId) ||
      null
    );
  }, [workspace.dmSkinId, availableDmSkins, onlineDefaultDmSkinId]);

  const activeDmSkinTokens = activeDmSkinRecord?.themeTokens || null;

  const savedTacticalLocations = useMemo(
    () => (workspace.locations || []).filter((l) => Boolean(l.tacticalConfig)),
    [workspace.locations]
  );

  const handleSaveTacticalMap = (
    tacticalCfg: TacticalMapConfig,
    existingLocationId?: string
  ) => {
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
          tacticalConfig: tacticalCfg,
        }
      : {
          id: locId,
          name: tacticalCfg.name,
          title: tacticalCfg.name,
          region: currentPlaceShortName || 'General',
          type: 'Mapa Táctico',
          description: `Mapa táctico (${tacticalCfg.gridCols}x${tacticalCfg.gridRows} - ${
            tacticalCfg.gridType === 'hex' ? 'Hexagonal' : 'Cuadrada'
          })`,
          secretsForDm: '',
          notes: '',
          evolution: '',
          pointsOfInterest: [],
          folder: folderTarget,
          mapImageUrl: tacticalCfg.layers[0]?.bgImageUrl || '',
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

  const handleProjectTacticalMapLive = (tacticalCfg: TacticalMapConfig) => {
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
          description: `Mapa táctico (${tacticalCfg.gridCols}x${tacticalCfg.gridRows} - ${
            tacticalCfg.gridType === 'hex' ? 'Hexagonal' : 'Cuadrada'
          })`,
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
    onUpdateWorkspace({
      ...workspace,
      locations: nextLocations,
      activeLocationId: locId,
      dmPreviewVisual: liveVisual,
      activeLiveVisual: liveVisual,
    });
    setLiveMapToast(`🗺️ Mapa Táctico "${tacticalCfg.name}" proyectado en vivo a los jugadores`);
    setTimeout(() => setLiveMapToast(''), 3000);
  };

  const installedDlcIds = workspace.installedDlcIds || ['dlc-srd-5e-oficial'];

  const handleToggleWorkspaceDlc = (dlc: DLCPackageRecord) => {
    const isInstalled = installedDlcIds.includes(dlc.id);
    if (isInstalled) {
      // Remove DLC id and any entities explicitly tagged with dlcSourceId === dlc.id
      const nextInstalled = installedDlcIds.filter((id) => id !== dlc.id);
      onUpdateWorkspace({
        ...workspace,
        installedDlcIds: nextInstalled,
        monsters: (workspace.monsters || []).filter((m) => m.dlcSourceId !== dlc.id),
        npcs: (workspace.npcs || []).filter((n) => n.dlcSourceId !== dlc.id),
        customItemsAndSpells: (workspace.customItemsAndSpells || []).filter(
          (i) => i.dlcSourceId !== dlc.id
        ),
        locations: (workspace.locations || []).filter((l) => l.dlcSourceId !== dlc.id),
        placeAlbumPhotos: (workspace.placeAlbumPhotos || []).filter(
          (p) => p.dlcSourceId !== dlc.id
        ),
      });
      setLiveMapToast(`📦 DLC "${dlc.name}" desactivado de esta mesa`);
      setTimeout(() => setLiveMapToast(''), 2800);
    } else {
      // Inject DLC content into workspace
      const nextInstalled = Array.from(new Set([...installedDlcIds, dlc.id]));
      const existingMonsterIds = new Set((workspace.monsters || []).map((m) => m.id));
      const existingNpcIds = new Set((workspace.npcs || []).map((n) => n.id));
      const existingItemIds = new Set((workspace.customItemsAndSpells || []).map((i) => i.id));
      const existingLocIds = new Set((workspace.locations || []).map((l) => l.id));
      const existingPhotoIds = new Set((workspace.placeAlbumPhotos || []).map((p) => p.id));

      const injectedMonsters = (dlc.monsters || [])
        .filter((m) => !existingMonsterIds.has(m.id))
        .map((m) => ({ ...m, dlcSourceId: dlc.id }));
      const injectedNpcs = (dlc.npcs || [])
        .filter((n) => !existingNpcIds.has(n.id))
        .map((n) => ({ ...n, dlcSourceId: dlc.id }));
      const injectedItems = (dlc.itemsAndSpells || [])
        .filter((i) => !existingItemIds.has(i.id))
        .map((i) => ({ ...i, dlcSourceId: dlc.id }));
      const injectedLocations = (dlc.locations || [])
        .filter((l) => !existingLocIds.has(l.id))
        .map((l) => ({ ...l, dlcSourceId: dlc.id }));
      const injectedPhotos = (dlc.albumPhotos || [])
        .filter((p) => !existingPhotoIds.has(p.id))
        .map((p) => ({ ...p, dlcSourceId: dlc.id }));
      const nextFolders = Array.from(
        new Set([
          ...(workspace.folders || []),
          ...injectedLocations.map((l) => l.folder).filter(Boolean),
        ])
      );

      onUpdateWorkspace({
        ...workspace,
        installedDlcIds: nextInstalled,
        folders: nextFolders,
        monsters: [...(workspace.monsters || []), ...injectedMonsters],
        npcs: [...(workspace.npcs || []), ...injectedNpcs],
        customItemsAndSpells: [...(workspace.customItemsAndSpells || []), ...injectedItems],
        locations: [...(workspace.locations || []), ...injectedLocations],
        placeAlbumPhotos: [...(workspace.placeAlbumPhotos || []), ...injectedPhotos],
      });
      setLiveMapToast(`✨ DLC "${dlc.name}" inyectado y activado en tu campaña`);
      setTimeout(() => setLiveMapToast(''), 2800);
    }
  };

  const handleRedeemDlcInSettings = async () => {
    if (!dlcRedeemCodeInput.trim()) return;
    try {
      const res = await fetch('/api/creator/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUserEmail || 'invitado@willroll.local',
          code: dlcRedeemCodeInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (Array.isArray(data.ownedDlcIds)) setOwnedDlcIds(data.ownedDlcIds);
        setDlcRedeemCodeInput('');
        setLiveMapToast(`🎁 ${data.message || 'DLC desbloqueado en tu cuenta'}`);
      } else {
        setLiveMapToast(`⚠️ ${data.error || 'Código no válido'}`);
      }
      setTimeout(() => setLiveMapToast(''), 3000);
    } catch {
      // ignore
    }
  };
  const isOnlineSession = isOnlineSessionProp !== undefined ? isOnlineSessionProp : !isOfflineMode;
  const onToggleOnlineSession =
    onToggleOnlineSessionProp ||
    (onToggleOfflineMode ? () => onToggleOfflineMode(!isOfflineMode) : undefined);
  // Active Deck in "BARAJAS EN: <Lugar>" & Horizontal Card Carousel Index
  const [activeDeck, setActiveDeck] = useState<'npcs' | 'monsters' | 'items'>('npcs');
  const [dmDeckScrollIndex, setDmDeckScrollIndex] = useState<number>(0);
  const [selectedFolder, setSelectedFolderState] = useState<string>(
    () => workspace.activeAtlasFolder || 'all'
  );
  const setSelectedFolder = (folder: string) => {
    const cleanFolder = String(folder || 'all').trim() || 'all';
    setSelectedFolderState(cleanFolder);
    const shortName =
      cleanFolder === 'all'
        ? worldName || 'Mundo Completo'
        : cleanFolder.split('/').map((s) => s.trim()).filter(Boolean).pop() || cleanFolder;
    const mapForPlace = workspace.atlasMaps?.[cleanFolder] || '';
    const photosForPlace = filterAlbumPhotosByPlace(workspace.placeAlbumPhotos || [], cleanFolder);
    const nextVisual = mapForPlace
      ? {
          kind: 'map' as const,
          id: `map-${cleanFolder}`,
          title: `Mapa: ${shortName}`,
          imageUrl: mapForPlace,
          folder: cleanFolder,
        }
      : photosForPlace[0]
      ? {
          kind: 'album' as const,
          id: photosForPlace[0].id,
          title: photosForPlace[0].title,
          imageUrl: photosForPlace[0].imageUrl,
          folder: cleanFolder,
        }
      : {
          kind: 'map' as const,
          id: `map-${cleanFolder}`,
          title: shortName,
          imageUrl: '',
          folder: cleanFolder,
        };
    onUpdateWorkspace({
      ...workspace,
      activeAtlasFolder: cleanFolder,
      dmPreviewVisual: nextVisual,
      activeLiveVisual:
        workspace.autoSyncLiveOnZoneChange || !workspace.activeLiveVisual
          ? nextVisual
          : workspace.activeLiveVisual,
    });
  };
  const [settingsNameDraft, setSettingsNameDraft] = useState<string>(worldName || 'Campaña');
  const [settingsCodeDraft, setSettingsCodeDraft] = useState<string>(roomCode || 'MESA-1');
  const [settingsPasswordDraft, setSettingsPasswordDraft] = useState<string>(roomPassword || '');

  const openDmTableSettingsModal = () => {
    setSettingsNameDraft(worldName || 'Campaña');
    setSettingsCodeDraft(roomCode || 'MESA-1');
    setSettingsPasswordDraft(roomPassword || '');
    setIsDmTableSettingsModalOpen(true);
  };

  const handleSaveDmTableSettings = async () => {
    if (onUpdateTableSettings) {
      await onUpdateTableSettings({
        name: settingsNameDraft.trim() || worldName || 'Campaña',
        roomCode: settingsCodeDraft.trim().toUpperCase() || roomCode || 'MESA-1',
        roomPassword: settingsPasswordDraft.trim(),
        roomMode: isOnlineSession ? 'online' : 'offline',
      });
    }
    setIsDmTableSettingsModalOpen(false);
    setLiveMapToast('⚙️ Ajustes de la mesa guardados');
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const [inspectedPartyMemberId, setInspectedPartyMemberId] = useState<string | null>(null);
  const inspectedPartyMember =
    partyMembers.find((pm) => pm.characterId === inspectedPartyMemberId) || null;

  // Active projected location ID in Atlas
  const [projectedLocationId, setProjectedLocationId] = useState<string>(() => {
    return workspace.locations?.[0]?.id || '';
  });

  // Combat Log sub-tab ('log' | 'notes')
  const [combatBitacoraTab, setCombatBitacoraTab] = useState<'log' | 'notes'>('log');
  const [combatNoteInput, setCombatNoteInput] = useState<string>('');
  const [showResetCombatModal, setShowResetCombatModal] = useState<boolean>(false);

  // Live broadcast message input
  const [liveMessageInput, setLiveMessageInput] = useState<string>(workspace.dmLiveMessage || '');
  const [liveMessageSentAlert, setLiveMessageSentAlert] = useState<boolean>(false);
  const [liveMapToast, setLiveMapToast] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Unfolded DM Card Modal State (Desdoblar Carta de NPC, Monstruo u Objeto)
  const [unfoldedCard, setUnfoldedCard] = useState<
    | { kind: 'npc'; data: NPCRecord }
    | { kind: 'monster'; data: MonsterRecord }
    | { kind: 'item'; data: DMCustomItemOrSpell }
    | null
  >(null);

  // Hovered/Selected spotlight entity in the active deck
  const [spotlightId, setSpotlightId] = useState<string>('');

  // Secondary Thematic Modals
  const [isChroniclesModalOpen, setIsChroniclesModalOpen] = useState<boolean>(false);
  const [isPlayerMessagesModalOpen, setIsPlayerMessagesModalOpen] = useState<boolean>(false);
  const [isItemsCompendiumModalOpen, setIsItemsCompendiumModalOpen] = useState<boolean>(false);
  const [compendiumInitialTransferItem, setCompendiumInitialTransferItem] =
    useState<DMCustomItemOrSpell | null>(null);
  const [isAddCombatantPickerOpen, setIsAddCombatantPickerOpen] = useState<'enemy' | 'ally' | null>(null);
  const [isInitiativeDetailModalOpen, setIsInitiativeDetailModalOpen] = useState<boolean>(false);
  const [selectedWarSummary, setSelectedWarSummary] = useState<CombatSummary | null>(null);

  // Square Map Editor & Multiple Zone Maps Modal State (1:1 Square Map + ZoneMaps per Place)
  const [isAtlasMapModalOpen, setIsAtlasMapModalOpen] = useState<boolean>(false);
  const [selectedPinToMove, setSelectedPinToMove] = useState<string | null>(null);
  const [mapCustomUrlInput, setMapCustomUrlInput] = useState<string>('');
  const [mapCustomTitleInput, setMapCustomTitleInput] = useState<string>('');
  const [newQuickSubPlaceName, setNewQuickSubPlaceName] = useState<string>('');
  const [zoneMapTitleInput, setZoneMapTitleInput] = useState<string>('');
  const [zoneMapUrlInput, setZoneMapUrlInput] = useState<string>('');
  const [zoneMapUploadDraftUrl, setZoneMapUploadDraftUrl] = useState<string>('');
  const [editingZoneMapId, setEditingZoneMapId] = useState<string | null>(null);
  const [editZoneMapDraft, setEditZoneMapDraft] = useState<{
    title: string;
    imageUrl: string;
    folder: string;
  }>({ title: '', imageUrl: '', folder: 'General' });

  // Place Photo Album & Tactical Maps Modal State
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState<boolean>(false);
  const [isTacticalMapsModalOpen, setIsTacticalMapsModalOpen] = useState<boolean>(false);
  const [isLivePreviewModalOpen, setIsLivePreviewModalOpen] = useState<boolean>(false);
  const [albumTitleInput, setAlbumTitleInput] = useState<string>('');
  const [albumDescInput, setAlbumDescInput] = useState<string>('');
  const [albumUrlInput, setAlbumUrlInput] = useState<string>('');
  const [albumUploadDraftUrl, setAlbumUploadDraftUrl] = useState<string>('');
  const [editingAlbumPhotoId, setEditingAlbumPhotoId] = useState<string | null>(null);
  const [editAlbumDraft, setEditAlbumDraft] = useState<{
    title: string;
    imageUrl: string;
    folder: string;
  }>({ title: '', imageUrl: '', folder: 'General' });

  // Tactical Map Create / Edit State inside Tactical Maps Modal
  const [tacticalTitleInput, setTacticalTitleInput] = useState<string>('');
  const [tacticalUrlInput, setTacticalUrlInput] = useState<string>('');
  const [tacticalUploadDraftUrl, setTacticalUploadDraftUrl] = useState<string>('');
  const [tacticalColsInput, setTacticalColsInput] = useState<number>(10);
  const [tacticalRowsInput, setTacticalRowsInput] = useState<number>(8);
  const [editingTacticalMapId, setEditingTacticalMapId] = useState<string | null>(null);
  const [editTacticalDraft, setEditTacticalDraft] = useState<{
    name: string;
    mapImageUrl: string;
    folder?: string;
    gridCols: number;
    gridRows: number;
  }>({ name: '', mapImageUrl: '', folder: 'General', gridCols: 10, gridRows: 10 });

  // Moving Entity Folder Modal state
  const [movingEntity, setMovingEntity] = useState<{
    type: 'npc' | 'monster' | 'location' | 'log' | 'summary';
    id: string;
    name: string;
    currentFolder: string;
  } | null>(null);

  // NPC Modal State (Add or Edit)
  const [showNpcModal, setShowNpcModal] = useState<boolean>(false);
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [npcForm, setNpcForm] = useState<Partial<NPCRecord>>({
    name: '',
    folder: 'General',
    race: 'Humano',
    occupation: '',
    attitude: 'Neutral',
    location: '',
    appearance: '',
    personality: '',
    secretOrHook: '',
    notes: '',
    evolution: '',
  });

  // Monster Modal State (Add or Edit)
  const [showMonsterModal, setShowMonsterModal] = useState<boolean>(false);
  const [editingMonsterId, setEditingMonsterId] = useState<string | null>(null);
  const [monsterForm, setMonsterForm] = useState<Partial<MonsterRecord>>({
    name: '',
    cr: '1',
    size: 'Mediano',
    type: 'Humanoide',
    alignment: 'Neutral',
    ac: 13,
    hp: 20,
    maxHp: 20,
    speed: '30 pies',
    str: 14,
    dex: 12,
    con: 14,
    int: 10,
    wis: 10,
    cha: 10,
    traits: [],
    actions: [
      {
        id: 'atk-1',
        name: 'Espada Larga',
        type: 'melee',
        toHit: 4,
        damage: '1d8+2',
        damageType: 'Cortante',
        range: '5 pies',
        description: 'Ataque con arma a una mano',
      },
    ],
    folder: 'General',
    notes: '',
  });
  const [newAttack, setNewAttack] = useState<Partial<MonsterAttack>>({
    name: '',
    type: 'melee',
    toHit: 4,
    damage: '1d6+2',
    damageType: 'Cortante',
    range: '5 pies',
    description: '',
  });

  // Location Modal State (Add or Edit)
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [newPoiInput, setNewPoiInput] = useState<string>('');
  const [locationForm, setLocationForm] = useState<Partial<LocationRecord>>({
    name: '',
    region: '',
    type: 'Taberna',
    description: '',
    secretsForDm: '',
    notes: '',
    evolution: '',
    pointsOfInterest: [],
    folder: 'General',
    mapImageUrl: '',
  });

  // Campaign Log Modal State (Add or Edit)
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logForm, setLogForm] = useState<Partial<CampaignLogEntry>>({
    sessionNumber: (workspace.campaignLogs?.length || 0) + 1,
    title: '',
    date: 'Día de Aventura',
    summary: '',
    publicNotes: '',
    privateNotes: '',
    tags: ['Aventura'],
    folder: 'General',
  });

  // Avatar Customizer Modal
  const [avatarCustomizerConfig, setAvatarCustomizerConfig] = useState<{
    isOpen: boolean;
    title: string;
    category: 'player' | 'npc' | 'monster' | 'location' | 'journal';
    currentType?: 'icon' | 'custom';
    currentCustomUrl?: string;
    currentIconId?: string;
    onSave: (data: { type: 'icon' | 'custom'; customUrl?: string; iconId?: string }) => void;
  } | null>(null);

  const openDmAvatarCustomizer = () => {
    setAvatarCustomizerConfig({
      isOpen: true,
      title: 'Personalizar Imagen / Portada del Dungeon Master',
      category: 'player',
      currentType: workspace.dmAvatarType || (workspace.dmAvatarUrl ? 'custom' : 'icon'),
      currentCustomUrl: workspace.dmAvatarUrl,
      currentIconId: workspace.dmAvatarIcon || 'crown',
      onSave: (data) => {
        onUpdateWorkspace({
          ...workspace,
          dmAvatarType: data.type,
          dmAvatarUrl: data.customUrl,
          dmAvatarIcon: data.iconId || 'crown',
        });
      },
    });
  };

  // Resolved Player Messages
  const resolvedPlayerMessages: PlayerMessageToDM[] = useMemo(() => {
    const fromProp = Array.isArray(playerMessages) ? playerMessages : [];
    const fromWorkspace = Array.isArray(workspace.playerMessages) ? workspace.playerMessages : [];
    const map = new Map<string, PlayerMessageToDM>();
    [...fromProp, ...fromWorkspace].forEach((m) => {
      if (m && m.id) map.set(m.id, m);
    });
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [playerMessages, workspace.playerMessages]);

  const unreadMessagesCount = resolvedPlayerMessages.filter((m) => !m.readByDm).length;

  // Active Combat Encounter
  const activeEncounter = workspace.activeEncounter || {
    id: 'enc-default',
    name: 'Encuentro Activo',
    round: 1,
    currentTurnIndex: 0,
    combatants: [],
    isActive: true,
    combatNotes: '',
    combatLog: [],
  };

  const combatSummaries = workspace.combatSummaries || [];

  // Cumulative hierarchical filtering by Atlas place/folder
  const filteredNpcs = (workspace.npcs || []).filter((n) => folderMatchesFilter(n.folder, selectedFolder));
  const filteredMonsters = (workspace.monsters || []).filter((m) => folderMatchesFilter(m.folder, selectedFolder));
  const filteredLocations = (workspace.locations || []).filter((l) => folderMatchesFilter(l.folder, selectedFolder));
  const filteredLogs = (workspace.campaignLogs || []).filter((log) => folderMatchesFilter(log.folder, selectedFolder));
  const filteredCombatSummaries = (workspace.combatSummaries || []).filter((sum) =>
    folderMatchesFilter(sum.folder, selectedFolder)
  );
  const filteredItemsAndSpells = (workspace.customItemsAndSpells || []).filter((item) =>
    folderMatchesFilter(item.folder, selectedFolder)
  );

  // Atlas Breadcrumbs & Sub-places (Strict Direct Children up to 4 levels)
  const allHierarchyFolders = useMemo(
    () => ensureCompleteFolderHierarchy(workspace.folders || []),
    [workspace.folders]
  );
  const breadcrumbs = useMemo(() => buildAtlasBreadcrumbs(selectedFolder), [selectedFolder]);
  const childFolders = useMemo(
    () => getChildFoldersForAtlas(allHierarchyFolders, selectedFolder),
    [allHierarchyFolders, selectedFolder]
  );

  const currentPlaceShortName = useMemo(() => {
    if (selectedFolder === 'all') return worldName || 'Mundo Completo';
    const parts = selectedFolder.split('/').map((s) => s.trim());
    return parts[parts.length - 1] || selectedFolder;
  }, [selectedFolder, worldName]);

  const currentPlaceDepth = useMemo(
    () => (selectedFolder === 'all' ? 0 : getFolderDepth(selectedFolder)),
    [selectedFolder]
  );

  // Custom map image uploaded specifically for the current place (or 'all' for Mundo)
  const currentPlaceMapKey = selectedFolder;
  const currentPlaceMapUrl = useMemo(() => {
    const customMap = workspace.atlasMaps?.[selectedFolder];
    if (customMap && customMap.trim()) return customMap;
    return '';
  }, [workspace.atlasMaps, selectedFolder]);

  // Filtered Album Photos, Zone Maps & Tactical Maps by selected place
  const filteredAlbumPhotos = useMemo(
    () => filterAlbumPhotosByPlace(workspace.placeAlbumPhotos || [], selectedFolder),
    [workspace.placeAlbumPhotos, selectedFolder]
  );

  const filteredZoneMaps = useMemo(
    () => filterAlbumPhotosByPlace(workspace.zoneMaps || [], selectedFolder),
    [workspace.zoneMaps, selectedFolder]
  );

  const filteredTacticalMaps = useMemo(
    () =>
      filterAlbumPhotosByPlace(
        (workspace.locations || []).filter(
          (l) =>
            Boolean(l.mapImageUrl) ||
            l.type === 'Zona Táctica' ||
            l.type === 'Mapa Táctico' ||
            Boolean(l.gridCols)
        ),
        selectedFolder
      ),
    [workspace.locations, selectedFolder]
  );

  const visualQueue = useMemo(() => workspace.visualQueue || [], [workspace.visualQueue]);

  const activeProjectedLocation = useMemo(() => {
    return (
      filteredLocations.find((l) => l.id === projectedLocationId) ||
      filteredLocations[0] ||
      (workspace.locations || [])[0]
    );
  }, [filteredLocations, projectedLocationId, workspace.locations]);

  // Resolved Live Visual for "MAPA EN VIVO"
  const activeLiveVisualDisplay = useMemo(() => {
    if (workspace.activeLiveVisual && workspace.activeLiveVisual.title) {
      return workspace.activeLiveVisual;
    }
    if (filteredAlbumPhotos[0]) {
      return {
        kind: 'album' as const,
        id: filteredAlbumPhotos[0].id,
        title: filteredAlbumPhotos[0].title,
        imageUrl: filteredAlbumPhotos[0].imageUrl,
        folder: filteredAlbumPhotos[0].folder,
      };
    }
    return {
      kind: 'tactical' as const,
      id: activeProjectedLocation?.id || 'default',
      title: activeProjectedLocation?.name || currentPlaceShortName,
      imageUrl: currentPlaceMapUrl,
      folder: selectedFolder,
    };
  }, [workspace.activeLiveVisual, filteredAlbumPhotos, activeProjectedLocation, currentPlaceShortName, currentPlaceMapUrl, selectedFolder]);

  // ==================== ATLAS MAP, PIN POSITION, TACTICAL MAPS, ALBUM & QUEUE ACTIONS ====================

  const handleAddVisualToQueue = (item: {
    id?: string;
    sourceId?: string;
    kind: 'map' | 'album' | 'tactical';
    title: string;
    imageUrl?: string;
    folder?: string;
  }) => {
    const nextQueue = enqueueVisualItem(workspace.visualQueue, {
      id: item.id || item.sourceId || `vis-${Date.now()}`,
      sourceId: item.sourceId || item.id,
      kind: item.kind,
      title: item.title,
      imageUrl: item.imageUrl || '',
      folder: item.folder || selectedFolder,
    });
    onUpdateWorkspace({
      ...workspace,
      visualQueue: nextQueue,
    });
    setLiveMapToast(`📋 Añadido a la Cola (${nextQueue.length}): ${item.title}`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleAddToVisualQueue = handleAddVisualToQueue;

  const handleRemoveVisualItemFromQueue = (queueIdOrId: string) => {
    const nextQueue = removeVisualFromQueue(workspace.visualQueue, queueIdOrId);
    onUpdateWorkspace({
      ...workspace,
      visualQueue: nextQueue,
    });
  };

  const handleUploadAtlasMapFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 900, 0.86);
      const baseTitle =
        mapCustomTitleInput.trim() ||
        file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') ||
        `Mapa: ${currentPlaceShortName}`;
      const newMapRec: ZoneMapRecord = {
        id: `zmap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: baseTitle,
        imageUrl: dataUrl,
        folder: selectedFolder,
        isCover: true,
        createdAt: Date.now(),
      };
      onUpdateWorkspace({
        ...workspace,
        atlasMaps: {
          ...(workspace.atlasMaps || {}),
          [selectedFolder]: dataUrl,
        },
        zoneMaps: [newMapRec, ...(workspace.zoneMaps || [])],
        dmPreviewVisual: {
          kind: 'map',
          id: newMapRec.id,
          title: newMapRec.title,
          imageUrl: dataUrl,
          folder: selectedFolder,
        },
      });
      setMapCustomTitleInput('');
      setLiveMapToast(`🗺️ Mapa "${baseTitle}" guardado en ${currentPlaceShortName}`);
      setTimeout(() => setLiveMapToast(''), 2500);
    } catch {
      // Ignore invalid image
    }
    e.target.value = '';
  };

  const handleUploadZoneMapFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 900, 0.86);
      setZoneMapUploadDraftUrl(dataUrl);
      setZoneMapUrlInput(dataUrl);
      if (!zoneMapTitleInput.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setZoneMapTitleInput(baseName || `Mapa de ${currentPlaceShortName}`);
      }
    } catch {}
    e.target.value = '';
  };

  const handleSaveNewZoneMap = () => {
    const finalUrl = (zoneMapUploadDraftUrl || zoneMapUrlInput).trim();
    if (!finalUrl) return;
    const finalTitle = zoneMapTitleInput.trim() || `Mapa de ${currentPlaceShortName}`;
    const newMapRec: ZoneMapRecord = {
      id: `zmap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      imageUrl: finalUrl,
      folder: selectedFolder === 'all' ? 'General' : selectedFolder,
      createdAt: Date.now(),
    };
    onUpdateWorkspace({
      ...workspace,
      zoneMaps: [newMapRec, ...(workspace.zoneMaps || [])],
    });
    setZoneMapTitleInput('');
    setZoneMapUrlInput('');
    setZoneMapUploadDraftUrl('');
    setLiveMapToast(`🗺️ Mapa "${finalTitle}" añadido a ${currentPlaceShortName}`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleSetAtlasMapUrl = (url: string) => {
    const clean = url.trim();
    const nextMaps = { ...(workspace.atlasMaps || {}) };
    if (clean) {
      nextMaps[selectedFolder] = clean;
    } else {
      delete nextMaps[selectedFolder];
    }
    const baseTitle = mapCustomTitleInput.trim() || `Mapa: ${currentPlaceShortName}`;
    const nextZoneMaps = clean
      ? [
          {
            id: `zmap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: baseTitle,
            imageUrl: clean,
            folder: selectedFolder,
            isCover: true,
            createdAt: Date.now(),
          },
          ...(workspace.zoneMaps || []),
        ]
      : workspace.zoneMaps || [];

    onUpdateWorkspace({
      ...workspace,
      atlasMaps: nextMaps,
      zoneMaps: nextZoneMaps,
      dmPreviewVisual: {
        kind: 'map',
        id: `map-${selectedFolder}`,
        title: baseTitle,
        imageUrl: clean,
        folder: selectedFolder,
      },
    });
    setMapCustomTitleInput('');
    setMapCustomUrlInput('');
    setLiveMapToast(
      clean
        ? `🗺️ Mapa "${baseTitle}" guardado en ${currentPlaceShortName}`
        : `Mapa de ${currentPlaceShortName} restaurado`
    );
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleSaveEditedZoneMap = () => {
    if (!editingZoneMapId) return;
    const cleanTitle = editZoneMapDraft.title.trim() || `Mapa: ${currentPlaceShortName}`;
    const cleanUrl = editZoneMapDraft.imageUrl.trim();
    const cleanFolder = editZoneMapDraft.folder || selectedFolder;
    const nextZoneMaps = (workspace.zoneMaps || []).map((zm) =>
      zm.id === editingZoneMapId
        ? { ...zm, title: cleanTitle, imageUrl: cleanUrl, folder: cleanFolder }
        : zm
    );
    onUpdateWorkspace({
      ...workspace,
      zoneMaps: nextZoneMaps,
    });
    setEditingZoneMapId(null);
    setLiveMapToast(`✎ Mapa "${cleanTitle}" actualizado`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleDeleteZoneMap = (mapId: string) => {
    onUpdateWorkspace({
      ...workspace,
      zoneMaps: (workspace.zoneMaps || []).filter((zm) => zm.id !== mapId),
    });
  };

  const handleUpdatePinPosition = (childFolderPath: string, x: number, y: number) => {
    const clampedX = Math.max(8, Math.min(92, Math.round(x)));
    const clampedY = Math.max(10, Math.min(90, Math.round(y)));
    onUpdateWorkspace({
      ...workspace,
      atlasPinPositions: {
        ...(workspace.atlasPinPositions || {}),
        [childFolderPath]: { x: clampedX, y: clampedY },
      },
    });
  };

  const handleQuickCreateSubPlace = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newQuickSubPlaceName.trim().replace(/\//g, '-');
    if (!cleanName) return;
    const currentDepth = selectedFolder === 'all' ? 0 : getFolderDepth(selectedFolder);
    if (currentDepth >= 4) return;

    const fullPath = selectedFolder === 'all' ? cleanName : `${selectedFolder} / ${cleanName}`;
    const existing = ensureCompleteFolderHierarchy(workspace.folders || []);
    if (existing.includes(fullPath)) {
      setNewQuickSubPlaceName('');
      setSelectedPinToMove(fullPath);
      return;
    }
    const updatedFolders = [...existing, fullPath].sort();
    onUpdateWorkspace({
      ...workspace,
      folders: updatedFolders,
      atlasPinPositions: {
        ...(workspace.atlasPinPositions || {}),
        [fullPath]: { x: 50, y: 50 },
      },
    });
    setNewQuickSubPlaceName('');
    setSelectedPinToMove(fullPath);
  };

  const handleUploadAlbumPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 850, 0.85);
      setAlbumUploadDraftUrl(dataUrl);
      setAlbumUrlInput(dataUrl);
      if (!albumTitleInput.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setAlbumTitleInput(baseName || `Imagen de ${currentPlaceShortName}`);
      }
    } catch {
      // ignore
    }
    e.target.value = '';
  };

  const handleSaveNewAlbumPhoto = (e?: React.FormEvent, projectImmediately: boolean = false) => {
    if (e) e.preventDefault();
    const finalUrl = (albumUploadDraftUrl || albumUrlInput).trim();
    if (!finalUrl) return;
    const finalTitle = albumTitleInput.trim() || `Vista de ${currentPlaceShortName}`;
    const newPhoto: PlaceAlbumPhoto = {
      id: `alb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      imageUrl: finalUrl,
      folder: selectedFolder === 'all' ? 'General' : selectedFolder,
      description: albumDescInput.trim(),
      createdAt: Date.now(),
    };
    const nextPhotos = [newPhoto, ...(workspace.placeAlbumPhotos || [])];
    const visualObj = {
      kind: 'album' as const,
      id: newPhoto.id,
      title: newPhoto.title,
      imageUrl: newPhoto.imageUrl,
      folder: newPhoto.folder,
    };
    onUpdateWorkspace({
      ...workspace,
      placeAlbumPhotos: nextPhotos,
      dmPreviewVisual: visualObj,
      activeLiveVisual: projectImmediately ? visualObj : workspace.activeLiveVisual,
    });
    setAlbumTitleInput('');
    setAlbumDescInput('');
    setAlbumUrlInput('');
    setAlbumUploadDraftUrl('');
    setLiveMapToast(
      projectImmediately
        ? `🟢 Foto "${newPhoto.title}" guardada y proyectada en vivo`
        : `🖼️ Foto "${newPhoto.title}" guardada en el álbum de ${currentPlaceShortName}`
    );
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleSaveEditedAlbumPhoto = () => {
    if (!editingAlbumPhotoId) return;
    const cleanTitle = editAlbumDraft.title.trim() || 'Imagen';
    const cleanUrl = editAlbumDraft.imageUrl.trim();
    const cleanFolder = editAlbumDraft.folder || selectedFolder;
    onUpdateWorkspace({
      ...workspace,
      placeAlbumPhotos: (workspace.placeAlbumPhotos || []).map((p) =>
        p.id === editingAlbumPhotoId
          ? { ...p, title: cleanTitle, imageUrl: cleanUrl, folder: cleanFolder }
          : p
      ),
    });
    setEditingAlbumPhotoId(null);
    setLiveMapToast(`✎ Foto "${cleanTitle}" actualizada`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleSetLiveAlbumPhoto = (photo: PlaceAlbumPhoto) => {
    onUpdateWorkspace({
      ...workspace,
      activeLiveVisual: {
        kind: 'album',
        id: photo.id,
        title: photo.title,
        imageUrl: photo.imageUrl,
        folder: photo.folder,
      },
    });
    setLiveMapToast(`🟢 Proyectando a los jugadores: ${photo.title}`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleDeleteAlbumPhoto = (photoId: string) => {
    const nextPhotos = (workspace.placeAlbumPhotos || []).filter((p) => p.id !== photoId);
    onUpdateWorkspace({
      ...workspace,
      placeAlbumPhotos: nextPhotos,
    });
  };

  const handleUploadTacticalMapFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 950, 0.86);
      setTacticalUploadDraftUrl(dataUrl);
      setTacticalUrlInput(dataUrl);
      if (!tacticalTitleInput.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTacticalTitleInput(baseName || `Mapa Táctico de ${currentPlaceShortName}`);
      }
    } catch {}
    e.target.value = '';
  };

  const handleSaveNewTacticalMap = () => {
    const finalUrl = (tacticalUploadDraftUrl || tacticalUrlInput).trim();
    if (!finalUrl) return;
    const cleanTitle = tacticalTitleInput.trim() || `Mapa Táctico: ${currentPlaceShortName}`;
    const newLoc: LocationRecord = {
      id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanTitle,
      region: currentPlaceShortName,
      type: 'Zona Táctica',
      description: `Cuadrícula táctica (${tacticalColsInput}x${tacticalRowsInput})`,
      secretsForDm: '',
      pointsOfInterest: [],
      mapImageUrl: finalUrl,
      folder: selectedFolder === 'all' ? 'General' : selectedFolder,
      gridCols: tacticalColsInput || 10,
      gridRows: tacticalRowsInput || 8,
      tacticalTokens: [],
      tokens: [],
    };
    onUpdateWorkspace({
      ...workspace,
      locations: [newLoc, ...(workspace.locations || [])],
      dmPreviewVisual: {
        kind: 'tactical',
        id: newLoc.id,
        title: newLoc.name,
        imageUrl: newLoc.mapImageUrl,
        folder: selectedFolder,
      },
    });
    setTacticalTitleInput('');
    setTacticalUrlInput('');
    setTacticalUploadDraftUrl('');
    setLiveMapToast(`⚔️ Mapa Táctico "${newLoc.name}" creado`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleSaveEditedTacticalMap = () => {
    if (!editingTacticalMapId) return;
    const cleanName = editTacticalDraft.name.trim() || 'Mapa Táctico';
    onUpdateWorkspace({
      ...workspace,
      locations: (workspace.locations || []).map((l) =>
        l.id === editingTacticalMapId
          ? {
              ...l,
              name: cleanName,
              mapImageUrl: editTacticalDraft.mapImageUrl || '',
              folder: editTacticalDraft.folder || 'General',
              gridCols: editTacticalDraft.gridCols || 10,
              gridRows: editTacticalDraft.gridRows || 10,
            }
          : l
      ),
    });
    setEditingTacticalMapId(null);
    setLiveMapToast(`✎ Mapa Táctico "${cleanName}" actualizado`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  const handleDeleteTacticalMap = (tMapId: string) => {
    onUpdateWorkspace({
      ...workspace,
      locations: (workspace.locations || []).filter((l) => l.id !== tMapId),
    });
  };

  const handleProjectTacticalMap = (loc: LocationRecord) => {
    onUpdateWorkspace({
      ...workspace,
      activeLiveVisual: {
        kind: 'tactical',
        id: loc.id,
        title: loc.name,
        imageUrl: loc.mapImageUrl || '',
        folder: loc.folder || selectedFolder,
        gridCols: loc.gridCols || 10,
        gridRows: loc.gridRows || 10,
        tacticalTokens: loc.tacticalTokens || loc.tokens || [],
      },
    });
    setLiveMapToast(`🟢 Proyectando Mapa Táctico a jugadores: ${loc.name}`);
    setTimeout(() => setLiveMapToast(''), 2500);
  };

  // ==================== COMBAT & TURN ACTIONS ====================

  const handleStepTurn = (direction: 'next' | 'prev') => {
    if (activeEncounter.combatants.length === 0) return;
    const { currentTurnIndex: nextIdx, round: nextRound } = stepInitiativeTurn(
      activeEncounter.currentTurnIndex,
      activeEncounter.round,
      activeEncounter.combatants.length,
      direction
    );

    const nextCombatant = activeEncounter.combatants[nextIdx];

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        currentTurnIndex: nextIdx,
        round: nextRound,
      },
    });

    if (nextCombatant) {
      soundFx.playTurnAlert();
    }
  };

  const handleSortInitiative = () => {
    const sorted = [...activeEncounter.combatants].sort((a, b) => b.initiative - a.initiative);
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: sorted,
        currentTurnIndex: 0,
      },
    });
  };

  const handleUpdateCombatantHp = (id: string, delta: number) => {
    const target = activeEncounter.combatants.find((c) => c.id === id);
    if (!target) return;

    const nextHp = Math.max(0, Math.min(target.maxHp, target.hp + delta));
    const updated = activeEncounter.combatants.map((c) => (c.id === id ? { ...c, hp: nextHp } : c));

    const logEvent: CombatLogEvent = {
      id: `cle-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      round: activeEncounter.round,
      turn: activeEncounter.combatants[activeEncounter.currentTurnIndex]?.name || 'DM',
      note: `${target.name} ${delta > 0 ? `recuperó +${delta} PG` : `sufrió ${Math.abs(delta)} daño`} (${nextHp}/${target.maxHp} PG)`,
      timestamp: Date.now(),
    };

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: updated,
        combatLog: [logEvent, ...(activeEncounter.combatLog || [])],
      },
    });

    if (delta < 0) soundFx.playDamageHit();
    else soundFx.playHealChime();
  };

  const handleRemoveCombatant = (id: string) => {
    const filtered = activeEncounter.combatants.filter((c) => c.id !== id);
    const safeTurn = Math.min(activeEncounter.currentTurnIndex, Math.max(0, filtered.length - 1));
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: filtered,
        currentTurnIndex: safeTurn,
      },
    });
  };

  const handleAddCombatLogNote = (customNote?: string) => {
    const text = (customNote || combatNoteInput).trim();
    if (!text) return;

    const newEvent: CombatLogEvent = {
      id: `cle-${Date.now()}`,
      round: activeEncounter.round,
      turn: activeEncounter.combatants[activeEncounter.currentTurnIndex]?.name || 'DM',
      note: text,
      timestamp: Date.now(),
    };

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatLog: [newEvent, ...(activeEncounter.combatLog || [])],
      },
    });

    setCombatNoteInput('');
  };

  const handleSaveCombatSummary = () => {
    const summary: CombatSummary = {
      id: `cs-${Date.now()}`,
      name:
        activeEncounter.name && activeEncounter.name !== 'Encuentro Activo'
          ? activeEncounter.name
          : `Batalla en ${currentPlaceShortName} (Ronda ${activeEncounter.round})`,
      date: new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      roundsCount: activeEncounter.round,
      participants: activeEncounter.combatants.map((c) => c.name),
      notes: activeEncounter.combatNotes || 'Combate finalizado y archivado por el Dungeon Master.',
      logEvents: activeEncounter.combatLog || [],
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
    };

    onUpdateWorkspace({
      ...workspace,
      combatSummaries: [summary, ...combatSummaries],
      activeEncounter: {
        ...activeEncounter,
        isActive: false,
      },
    });

    setShowResetCombatModal(true);
  };

  const handleResetEncounter = (clearCombatants: boolean) => {
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        id: `enc-${Date.now()}`,
        name: `Encuentro en ${currentPlaceShortName}`,
        round: 1,
        currentTurnIndex: 0,
        broadcastEnemiesToTable: activeEncounter.broadcastEnemiesToTable,
        combatants: clearCombatants
          ? []
          : activeEncounter.combatants.map((c) => ({ ...c, hp: c.maxHp })),
        isActive: true,
        combatNotes: '',
        combatLog: [],
      },
    });
    setShowResetCombatModal(false);
  };

  const handleAddMonsterToCombat = (mon: MonsterRecord, faction: 'enemy' | 'ally' = 'enemy') => {
    if (
      faction === 'enemy' &&
      !canAddEnemyToEncounter(activeEncounter.combatants, MAX_ENCOUNTER_ENEMIES).canAdd
    ) {
      setLiveMapToast(`⚠️ Tope alcanzado: Máximo ${MAX_ENCOUNTER_ENEMIES} enemigos en combate.`);
      setTimeout(() => setLiveMapToast(''), 3000);
      return;
    }

    const wisMod = Math.floor(((mon.wis || 10) - 10) / 2);
    const pp = 10 + wisMod;
    const existingCount = activeEncounter.combatants.filter((c) => c.name.startsWith(mon.name)).length;

    const newCombatant: Combatant = {
      id: `c-mon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: existingCount > 0 ? `${mon.name} #${existingCount + 1}` : mon.name,
      initiative: Math.floor(Math.random() * 20) + 1 + Math.floor(((mon.dex || 10) - 10) / 2),
      hp: mon.maxHp,
      maxHp: mon.maxHp,
      ac: mon.ac,
      passivePerception: pp,
      isPlayer: false,
      faction,
      conditions: [],
    };

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: [...activeEncounter.combatants, newCombatant],
      },
    });
  };

  const handleAddNpcToCombat = (npc: NPCRecord, faction: 'ally' | 'enemy' = 'ally') => {
    if (
      faction === 'enemy' &&
      !canAddEnemyToEncounter(activeEncounter.combatants, MAX_ENCOUNTER_ENEMIES).canAdd
    ) {
      setLiveMapToast(`⚠️ Tope alcanzado: Máximo ${MAX_ENCOUNTER_ENEMIES} enemigos en combate.`);
      setTimeout(() => setLiveMapToast(''), 3000);
      return;
    }

    const hp = npc.stats?.hp || 25;
    const ac = npc.stats?.ac || 13;
    const newCombatant: Combatant = {
      id: `c-npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: npc.name,
      initiative: Math.floor(Math.random() * 20) + 1 + 1,
      hp,
      maxHp: hp,
      ac,
      passivePerception: 12,
      isPlayer: false,
      faction,
      conditions: [],
    };

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: [...activeEncounter.combatants, newCombatant],
      },
    });
  };

  const handleSyncPartyMemberToCombat = (pm: PartyMemberLive) => {
    const exists = activeEncounter.combatants.some(
      (c) => c.id === pm.characterId || c.name.toLowerCase().includes(pm.characterName.toLowerCase())
    );
    if (exists) return;

    const newCombatant: Combatant = {
      id: pm.characterId || `c-pj-${Date.now()}`,
      name: pm.characterName,
      initiative: Math.floor(Math.random() * 20) + 1 + 2,
      hp: pm.currentHp,
      maxHp: pm.maxHp,
      ac: pm.ac,
      passivePerception: pm.passivePerception || 12,
      isPlayer: true,
      faction: 'ally',
      conditions: [],
    };

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: [...activeEncounter.combatants, newCombatant],
      },
    });
  };

  const handleToggleCombatantFaction = (combatantId: string) => {
    const target = activeEncounter.combatants.find((c) => c.id === combatantId);
    if (
      target &&
      target.faction === 'ally' &&
      !canAddEnemyToEncounter(activeEncounter.combatants, MAX_ENCOUNTER_ENEMIES).canAdd
    ) {
      setLiveMapToast(`⚠️ Tope alcanzado: Máximo ${MAX_ENCOUNTER_ENEMIES} enemigos en combate.`);
      setTimeout(() => setLiveMapToast(''), 3000);
      return;
    }

    const updated = activeEncounter.combatants.map((c) => {
      if (c.id === combatantId) {
        const nextFaction: 'enemy' | 'ally' = c.faction === 'ally' ? 'enemy' : 'ally';
        return { ...c, faction: nextFaction };
      }
      return c;
    });

    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        combatants: updated,
      },
    });
  };

  const handleToggleBroadcastEnemies = () => {
    const nextBroadcast = !activeEncounter.broadcastEnemiesToTable;
    onUpdateWorkspace({
      ...workspace,
      activeEncounter: {
        ...activeEncounter,
        broadcastEnemiesToTable: nextBroadcast,
      },
    });
  };

  const handleRollMonsterAttack = (mon: MonsterRecord, attack: MonsterAttack) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const totalHit = d20 + attack.toHit;
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const damageRoll = rollDiceExpression(attack.damage);

    soundFx.playDiceRoll(d20 === 20);

    const logNote = `⚔️ ${mon.name} (${attack.name}): Impacto ${totalHit} (d20=${d20}+${attack.toHit})${
      isCrit ? ' ¡CRÍTICO!' : isFumble ? ' ¡PIFIA!' : ''
    } • Daño: ${damageRoll.total} ${attack.damageType}`;

    handleAddCombatLogNote(logNote);
    onTriggerRoll(`${mon.name} - ${attack.name}`, attack.toHit, 20);
  };

  const handleSendDmLiveMessage = () => {
    const text = liveMessageInput.trim();
    onUpdateWorkspace({
      ...workspace,
      dmLiveMessage: text,
    });
    if (onUpdateDmLiveMessage) {
      onUpdateDmLiveMessage(text);
    }
    setLiveMessageSentAlert(true);
    setTimeout(() => setLiveMessageSentAlert(false), 2500);
  };

  const handleMoveEntityFolder = (targetFolder: string) => {
    if (!movingEntity) return;
    const { type, id } = movingEntity;
    const updatedWorkspace = { ...workspace };

    if (type === 'npc') {
      updatedWorkspace.npcs = (workspace.npcs || []).map((n) =>
        n.id === id ? { ...n, folder: targetFolder } : n
      );
    } else if (type === 'monster') {
      updatedWorkspace.monsters = (workspace.monsters || []).map((m) =>
        m.id === id ? { ...m, folder: targetFolder } : m
      );
    } else if (type === 'location') {
      updatedWorkspace.locations = (workspace.locations || []).map((l) =>
        l.id === id ? { ...l, folder: targetFolder } : l
      );
    } else if (type === 'log') {
      updatedWorkspace.campaignLogs = (workspace.campaignLogs || []).map((l) =>
        l.id === id ? { ...l, folder: targetFolder } : l
      );
    } else if (type === 'summary') {
      updatedWorkspace.combatSummaries = (workspace.combatSummaries || []).map((s) =>
        s.id === id ? { ...s, folder: targetFolder } : s
      );
    }

    onUpdateWorkspace(updatedWorkspace);
    setMovingEntity(null);
  };

  // ==================== AI CO-PILOT ASSISTANTS ====================

  const handleAiAssistNpc = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/gemini/generate-npc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: npcForm.name,
          race: npcForm.race,
          occupation: npcForm.occupation,
          location: npcForm.location || (selectedFolder !== 'all' ? selectedFolder : 'Taberna local'),
          attitude: npcForm.attitude,
          theme: selectedFolder !== 'all' ? selectedFolder : 'Fantasía medieval 5E',
        }),
      });
      const data = await res.json();
      if (data && data.name) {
        setNpcForm((prev) => ({
          ...prev,
          name: data.name,
          race: data.race || prev.race,
          occupation: data.occupation || prev.occupation,
          attitude: data.attitude || prev.attitude,
          location: data.location || prev.location,
          appearance: data.appearance || prev.appearance,
          personality: data.personality || prev.personality,
          secretOrHook: data.secretOrHook || prev.secretOrHook,
          notes: data.notes || prev.notes,
          evolution: data.evolution || prev.evolution,
          stats: data.stats || prev.stats,
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAiAssistMonster = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/gemini/generate-monster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: monsterForm.name,
          cr: monsterForm.cr,
          type: monsterForm.type,
          environment: selectedFolder !== 'all' ? selectedFolder : 'Mazmorra oscura',
        }),
      });
      const data = await res.json();
      if (data && data.name) {
        setMonsterForm((prev) => ({
          ...prev,
          name: data.name,
          cr: data.cr || prev.cr,
          size: data.size || prev.size,
          type: data.type || prev.type,
          alignment: data.alignment || prev.alignment,
          ac: data.ac || prev.ac,
          hp: data.hp || prev.hp,
          maxHp: data.maxHp || prev.maxHp,
          speed: data.speed || prev.speed,
          str: data.str || prev.str,
          dex: data.dex || prev.dex,
          con: data.con || prev.con,
          int: data.int || prev.int,
          wis: data.wis || prev.wis,
          cha: data.cha || prev.cha,
          traits: data.traits || prev.traits,
          actions: data.actions && data.actions.length > 0 ? data.actions : prev.actions,
          notes: data.notes || prev.notes,
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAiAssistLocation = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/gemini/generate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: locationForm.name,
          type: locationForm.type,
          region: locationForm.region,
          theme: selectedFolder !== 'all' ? selectedFolder : 'Misterio y peligro en 5E',
        }),
      });
      const data = await res.json();
      if (data && data.name) {
        setLocationForm((prev) => ({
          ...prev,
          name: data.name,
          type: data.type || prev.type,
          region: data.region || prev.region,
          description: data.description || prev.description,
          secretsForDm: data.secretsForDm || prev.secretsForDm,
          notes: data.notes || prev.notes,
          evolution: data.evolution || prev.evolution,
          pointsOfInterest: data.pointsOfInterest || prev.pointsOfInterest,
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // ==================== EDIT OPENERS ====================

  const openAddNpc = () => {
    setEditingNpcId(null);
    setNpcForm({
      name: '',
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
      race: 'Humano',
      occupation: '',
      attitude: 'Neutral',
      location: currentPlaceShortName,
      appearance: '',
      personality: '',
      secretOrHook: '',
      notes: '',
      evolution: '',
    });
    setShowNpcModal(true);
  };

  const openEditNpc = (npc: NPCRecord) => {
    setEditingNpcId(npc.id);
    setNpcForm({ ...npc });
    setShowNpcModal(true);
  };

  const openAddMonster = () => {
    setEditingMonsterId(null);
    setMonsterForm({
      name: '',
      cr: '1',
      size: 'Mediano',
      type: 'Monstruosidad',
      alignment: 'Caótico Maligno',
      ac: 13,
      hp: 25,
      maxHp: 25,
      speed: '30 pies',
      str: 14,
      dex: 12,
      con: 14,
      int: 8,
      wis: 10,
      cha: 8,
      traits: [],
      actions: [
        {
          id: `atk-${Date.now()}`,
          name: 'Cimitarra',
          type: 'melee',
          toHit: 4,
          damage: '1d6+2',
          damageType: 'Cortante',
          range: '5 pies',
          description: 'Ataque cuerpo a cuerpo ágil',
        },
      ],
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
      notes: '',
    });
    setShowMonsterModal(true);
  };

  const openEditMonster = (mon: MonsterRecord) => {
    setEditingMonsterId(mon.id);
    setMonsterForm({ ...mon });
    setShowMonsterModal(true);
  };

  const openAddLocation = () => {
    setEditingLocationId(null);
    setLocationForm({
      name: '',
      region: currentPlaceShortName,
      type: 'Zona Táctica',
      description: '',
      secretsForDm: '',
      notes: '',
      evolution: '',
      pointsOfInterest: [],
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
      mapImageUrl: '',
    });
    setShowLocationModal(true);
  };

  const openEditLocation = (loc: LocationRecord) => {
    setEditingLocationId(loc.id);
    setLocationForm({ ...loc });
    setShowLocationModal(true);
  };

  const openAddLog = () => {
    setEditingLogId(null);
    setLogForm({
      sessionNumber: (workspace.campaignLogs?.length || 0) + 1,
      entryType: 'session',
      title: '',
      date: 'Día de Aventura',
      summary: '',
      publicNotes: '',
      privateNotes: '',
      tags: ['Aventura'],
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
    });
    setShowLogModal(true);
  };

  const openEditLog = (log: CampaignLogEntry) => {
    setEditingLogId(log.id);
    setLogForm({ ...log });
    setShowLogModal(true);
  };

  // Separate allies and enemies in activeEncounter
  const allyCombatants = activeEncounter.combatants.filter(
    (c) => c.isPlayer || c.faction === 'ally'
  );
  const enemyCombatants = activeEncounter.combatants.filter(
    (c) => !c.isPlayer && c.faction !== 'ally'
  );
  const currentTurnCombatant = activeEncounter.combatants[activeEncounter.currentTurnIndex];

  // Spotlight entity for the circular preview on the left of BARAJAS EN
  const activeDeckSpotlight = useMemo(() => {
    if (activeDeck === 'npcs') {
      const found = filteredNpcs.find((n) => n.id === spotlightId) || filteredNpcs[0];
      return found
        ? {
            name: found.name,
            subtitle: `${found.race} • ${found.occupation || 'Habitante'}`,
            avatarUrl: found.avatarUrl,
            avatarType: found.avatarType,
            avatarCustomUrl: found.avatarCustomUrl,
            avatarIcon: found.avatarIcon,
            category: 'npc' as const,
          }
        : null;
    }
    if (activeDeck === 'monsters') {
      const found = filteredMonsters.find((m) => m.id === spotlightId) || filteredMonsters[0];
      return found
        ? {
            name: found.name,
            subtitle: `CR ${found.cr} • CA ${found.ac} • PG ${found.maxHp}`,
            avatarUrl: found.avatarUrl,
            avatarType: found.avatarType,
            avatarCustomUrl: found.avatarCustomUrl,
            avatarIcon: found.avatarIcon,
            category: 'monster' as const,
          }
        : null;
    }
    const found =
      filteredItemsAndSpells.find((i) => i.id === spotlightId) || filteredItemsAndSpells[0];
    return found
      ? {
          name: found.name,
          subtitle: `${found.rarity || 'Único'} • ${found.category || 'Tesoro'}`,
          category: 'location' as const,
        }
      : null;
  }, [activeDeck, filteredNpcs, filteredMonsters, filteredItemsAndSpells, spotlightId]);

  return (
    <div
      data-testid="dm-screen-root"
      data-dm-skin-id={activeDmSkinRecord?.id || 'default'}
      className="max-w-[1650px] mx-auto w-full space-y-2.5 select-none rounded-2xl transition-colors"
      style={{
        backgroundColor: activeDmSkinTokens?.dmScreenBgColor || undefined,
        backgroundImage: activeDmSkinTokens?.dmScreenCustomBgTextureUrl
          ? `url(${activeDmSkinTokens.dmScreenCustomBgTextureUrl})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* =================================================================== */}
      {/* MAIN DM DASHBOARD GRID (Left 8 cols: Atlas + Barajas/Trama, Right 4 cols: Sala en Vivo + Bitácora + Resúmenes) */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        {/* =============================================================== */}
        {/* LEFT 8 COLUMNS: ATLAS DEL MUNDO + BARAJAS & MUNDO/TRAMA         */}
        {/* =============================================================== */}
        <div className="lg:col-span-8 flex flex-col gap-2.5 justify-between">
          {/* 1. ATLAS DEL MUNDO (Clean header, 3 top buttons: Álbum, Mapas Tácticos, Mapas, & Bottom Cola de Visuales) */}
          <div
            className="relative rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-3 shadow-[0_0_30px_rgba(0,0,0,0.85)]"
            style={{
              backgroundColor: activeDmSkinTokens?.dmAtlasFrameBg || undefined,
              borderColor: activeDmSkinTokens?.dmScreenBaseBorder || undefined,
            }}
          >
            {/* Header & Breadcrumbs */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="font-cinzel font-black text-sm sm:text-base text-[#f5e4be] tracking-wider uppercase"
                    style={{ color: activeDmSkinTokens?.dmHeaderTitleColor || undefined }}
                  >
                    ATLAS DEL MUNDO
                  </h2>
                  <span className="font-cinzel font-bold text-sm sm:text-base text-amber-400">
                    ({selectedFolder === 'all' ? '🌍 Mundo' : `📍 ${currentPlaceShortName}`})
                  </span>
                  {currentPlaceDepth > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-[#c8a45c]/40 text-[10px] font-cinzel text-amber-200">
                      Nivel {currentPlaceDepth}/4
                    </span>
                  )}
                </div>

                {/* Interactive 4-Level Hierarchical Breadcrumb Bar + Selector de Zona + Botón Mundo (Carpetas) */}
                <div
                  data-testid="atlas-breadcrumbs"
                  className="flex items-center gap-1.5 flex-wrap text-xs"
                >
                  <select
                    data-testid="dm-atlas-zone-selector"
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="bg-[#181b26] border border-[#c8a45c]/60 rounded-md px-2 py-0.5 text-[11px] font-cinzel font-bold text-amber-200 outline-none focus:border-amber-400 cursor-pointer max-w-[200px] truncate"
                    title="Cambiar directamente a cualquier zona del Atlas"
                  >
                    <option value="all">🌍 Mundo Completo</option>
                    {allHierarchyFolders.map((f) => (
                      <option key={f} value={f}>
                        📍 {f}
                      </option>
                    ))}
                  </select>

                  {/* Botón Mundo (Explorador Masivo de Carpetas) al lado de Mundo Completo */}
                  <button
                    type="button"
                    data-testid="btn-open-world-folder-explorer"
                    onClick={() => setIsFolderManagerOpen(true)}
                    className="px-2.5 py-0.5 rounded-md bg-amber-950/85 hover:bg-amber-900 border border-[#c8a45c]/80 text-[#f5e4be] font-cinzel font-bold text-[11px] flex items-center gap-1 transition shadow cursor-pointer"
                    title="Abrir el Explorador de Carpetas del Mundo para editar masivamente lugares, sub-lugares, mapas e imágenes"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-[#e2c275]" />
                    <span>Mundo</span>
                  </button>

                  {breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === breadcrumbs.length - 1;
                    const targetPath = crumb.folderPath || crumb.fullPath || 'all';
                    const icon =
                      crumb.depth === 0
                        ? '🌍'
                        : crumb.depth === 1
                        ? '⛰️'
                        : crumb.depth === 2
                        ? '🏰'
                        : crumb.depth === 3
                        ? '🍺'
                        : '🚪';
                    return (
                      <React.Fragment key={targetPath}>
                        {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-stone-500" />}
                        <button
                          type="button"
                          onClick={() => setSelectedFolder(targetPath)}
                          className={`px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer ${
                            isLast
                              ? 'bg-amber-950/70 border border-[#c8a45c]/70 text-[#f5e4be] font-semibold'
                              : 'text-stone-300 hover:text-amber-300 hover:bg-stone-800/60'
                          }`}
                        >
                          <span>{icon}</span>
                          <span>{crumb.label}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Top-Right 3 Visual Buttons: Álbum | Mapas Tácticos | Mapas */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  data-testid="btn-open-place-album"
                  onClick={() => setIsAlbumModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-950/75 hover:bg-amber-900/90 border border-[#c8a45c]/75 text-[#f5e4be] text-xs font-cinzel font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                  title="Ver, editar o poner en cola fotos e ilustraciones del Álbum de esta zona"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-300" />
                  <span>Álbum ({filteredAlbumPhotos.length})</span>
                </button>

                {isTacticalMapsAllowed ? (
                  <button
                    type="button"
                    data-testid="btn-open-tactical-maps"
                    onClick={() => setIsTacticalStudioOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-sky-950/85 hover:bg-sky-900 border border-sky-400/75 text-sky-100 text-xs font-cinzel font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                    title="Abrir Estudio de Mapas Tácticos (Disponible para Moderadores, Creadores y Admins)"
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-300" />
                    <span>Mapas Tácticos ({savedTacticalLocations.length})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="btn-open-tactical-maps"
                    disabled
                    className="px-3 py-1.5 rounded-lg bg-stone-900/80 border border-stone-700 text-stone-400 text-xs font-cinzel font-bold flex items-center gap-1.5 opacity-65 cursor-not-allowed shadow"
                    title="Los Mapas Tácticos están actualmente en progreso para cuentas de cliente"
                  >
                    <Layers className="w-3.5 h-3.5 text-stone-500" />
                    <span>Mapas Tácticos</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-950/90 border border-amber-500/60 text-[9px] text-amber-300 uppercase tracking-wider">
                      En Progreso
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="btn-open-atlas-map-editor"
                  onClick={() => {
                    setSelectedPinToMove(childFolders[0] || null);
                    setIsAtlasMapModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#1d202d] hover:bg-[#262a3b] border border-[#c8a45c]/75 text-[#f5e4be] text-xs font-cinzel font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                  title="Gestionar los Mapas de esta zona (carátula y mapas adicionales), editar o poner en cola y ubicar sub-lugares"
                >
                  <Compass className="w-3.5 h-3.5 text-[#e2c275]" />
                  <span>
                    Mapas ({(currentPlaceMapUrl ? 1 : 0) + filteredZoneMaps.length})
                  </span>
                </button>
              </div>
            </div>

            {/* Interactive Parchment / Custom PNG-JPG Cartography Map Canvas */}
            <div
              data-testid="atlas-map-strip"
              className="relative h-[245px] sm:h-[280px] w-full rounded-xl overflow-hidden border border-[#c8a45c]/60 bg-gradient-to-br from-[#2d2418] via-[#211b13] to-[#171410] shadow-inner group"
            >
              {/* Custom Uploaded Map Image for THIS specific place (if set) */}
              {currentPlaceMapUrl ? (
                <img
                  src={currentPlaceMapUrl}
                  alt={`Mapa de ${currentPlaceShortName}`}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 contrast-105 transition duration-500 group-hover:scale-[1.01] pointer-events-none"
                />
              ) : null}

              {/* Rich Fantasy Cartography & Architectural Blueprint SVG Overlay */}
              <svg
                viewBox="0 0 800 220"
                className={`absolute inset-0 w-full h-full pointer-events-none ${
                  currentPlaceMapUrl ? 'opacity-35' : 'opacity-85'
                }`}
                preserveAspectRatio="none"
              >
                <defs>
                  <pattern id="atlasGrid" width="36" height="36" patternUnits="userSpaceOnUse">
                    <path
                      d="M 36 0 L 0 0 0 36"
                      fill="none"
                      stroke="#d4b475"
                      strokeWidth="0.45"
                      strokeOpacity="0.35"
                    />
                  </pattern>
                  <radialGradient id="parchmentGlow" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#d4a853" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#12100d" stopOpacity="0.65" />
                  </radialGradient>
                </defs>
                <rect width="800" height="220" fill="url(#atlasGrid)" />
                <rect width="800" height="220" fill="url(#parchmentGlow)" />

                {!currentPlaceMapUrl && (
                  <>
                    {/* Winding River / Trade Road */}
                    <path
                      d="M 0 165 Q 140 130, 260 155 T 520 125 T 800 160"
                      fill="none"
                      stroke="#c8a45c"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      strokeOpacity="0.45"
                    />
                    {/* Architectural Floorplan / Regional Keep Blueprint */}
                    <path
                      d="M 45 28 L 245 28 L 245 186 L 45 186 Z M 295 40 L 615 40 L 615 192 L 295 192 Z"
                      fill="#1a150f"
                      fillOpacity="0.55"
                      stroke="#e2c275"
                      strokeWidth="1.6"
                      strokeOpacity="0.6"
                    />
                    {/* Inner Rooms, Pillars & Corridors */}
                    <path
                      d="M 245 108 L 295 108 M 395 40 L 395 192 M 505 40 L 505 135 M 45 108 L 165 108"
                      stroke="#e2c275"
                      strokeWidth="1.2"
                      strokeDasharray="5 3"
                      strokeOpacity="0.5"
                    />
                    {/* Mountain Range Silhouette */}
                    <path
                      d="M 540 36 L 568 8 L 595 36 L 628 4 L 662 36 L 690 12 L 718 36"
                      fill="none"
                      stroke="#e2c275"
                      strokeWidth="1.4"
                      strokeOpacity="0.5"
                    />
                  </>
                )}

                {/* Compass Rose at Top Right */}
                <g transform="translate(755, 42)" opacity="0.75">
                  <circle cx="0" cy="0" r="20" fill="none" stroke="#e2c275" strokeWidth="1" />
                  <circle cx="0" cy="0" r="14" fill="none" stroke="#e2c275" strokeWidth="0.6" strokeDasharray="2 2" />
                  <polygon points="0,-24 4,-5 0,-8 -4,-5" fill="#e2c275" />
                  <polygon points="0,24 3,5 0,8 -3,5" fill="#c8a45c" opacity="0.6" />
                  <polygon points="-24,0 -5,-3 -8,0 -5,3" fill="#c8a45c" opacity="0.6" />
                  <polygon points="24,0 5,-3 8,0 5,3" fill="#c8a45c" opacity="0.6" />
                </g>
              </svg>

              {/* Subtle vignette gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#12131a]/80 via-transparent to-[#12131a]/35 pointer-events-none" />

              {/* Top-left Return to Parent Place Button inside Map Canvas */}
              {selectedFolder !== 'all' && (
                <button
                  type="button"
                  data-testid="btn-atlas-up-level"
                  onClick={() => {
                    const parent = getParentAtlasFolder(selectedFolder);
                    setSelectedFolder(parent || 'all');
                  }}
                  className="absolute top-2.5 left-2.5 z-20 px-3 py-1.5 rounded-xl bg-[#14161f]/95 hover:bg-amber-950/95 border-2 border-[#c8a45c] text-[#f5e4be] text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-xl transition cursor-pointer"
                  title="Regresar al lugar anterior en el Atlas"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>{getReturnToParentButtonLabel(selectedFolder, worldName)}</span>
                </button>
              )}

              {/* Bottom-right button inside the map drawing to expand 1:1 square map */}
              <button
                type="button"
                data-testid="btn-atlas-expand-square"
                onClick={() => {
                  setSelectedPinToMove(childFolders[0] || null);
                  setIsAtlasMapModalOpen(true);
                }}
                className="absolute bottom-2 right-2.5 z-20 px-2.5 py-1 rounded-lg bg-[#14161f]/90 hover:bg-[#1e2230] border border-[#c8a45c]/60 text-[10px] font-cinzel font-bold text-[#e2c275] flex items-center gap-1 shadow cursor-pointer"
                title="Expandir mapa cuadrado 1:1 y mover puntos de sub-lugares"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Expandir 1:1</span>
              </button>

              {/* Strictly Direct Child Sub-Place Pins Positioned by Coordinates (x%, y%) */}
              <div className="relative z-10 w-full h-full">
                {childFolders.length > 0 ? (
                  childFolders.map((subFolder, idx) => {
                    const parts = subFolder.split('/').map((s) => s.trim());
                    const shortLabel = parts[parts.length - 1];
                    const depth = parts.length;
                    const pinIcon =
                      depth === 1 ? '⛰️' : depth === 2 ? '🏰' : depth === 3 ? '🍺' : '🚪';
                    const pos = getPinPositionForChildPlace(
                      subFolder,
                      idx,
                      childFolders.length,
                      workspace.atlasPinPositions
                    );
                    return (
                      <button
                        key={subFolder}
                        type="button"
                        data-testid={`atlas-pin-${shortLabel}`}
                        onClick={() => setSelectedFolder(subFolder)}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#171821]/95 hover:bg-amber-950/95 border border-[#c8a45c] text-[#f5e4be] text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.9)] hover:scale-105 transition cursor-pointer whitespace-nowrap"
                        title={`Entrar a ${shortLabel} (${pos.x}%, ${pos.y}%)`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
                        <span>
                          {pinIcon} {shortLabel}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                    <span className="text-xs font-cinzel text-[#e8d8b9]/80">
                      📍 Estás en el nivel interno de <strong>{currentPlaceShortName}</strong>
                    </span>
                    {currentPlaceDepth < 4 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPinToMove(null);
                          setIsAtlasMapModalOpen(true);
                        }}
                        className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-[#c8a45c]/60 text-[11px] font-cinzel font-bold text-[#f5e4be] cursor-pointer"
                      >
                        + Agregar Sub-Lugar en este Mapa
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-400 mt-0.5">
                        Nivel máximo alcanzado (4/4) • Puedes subir mapas o fotos arriba
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Strip: COLA DE VISUALES (Ordered Storytelling Queue for the DM) */}
            <div
              data-testid="atlas-visual-queue-strip"
              className="pt-2.5 flex items-center justify-between gap-2 flex-wrap"
            >
              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <span className="text-[11px] font-cinzel font-black text-amber-300 uppercase flex items-center gap-1 shrink-0">
                  <ListPlus className="w-3.5 h-3.5 text-[#e2c275]" />
                  <span>COLA EN VISUALES ({visualQueue.length}):</span>
                </span>

                {visualQueue.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {visualQueue.map((item, idx) => {
                      const isLive =
                        workspace.activeLiveVisual?.id === item.id &&
                        workspace.activeLiveVisual?.kind === item.kind;
                      const kindIcon =
                        item.kind === 'map' ? '🗺️' : item.kind === 'tactical' ? '⚔️' : '🖼️';
                      return (
                        <div
                          key={item.queueId}
                          data-testid={`queue-chip-${item.id}`}
                          className={`inline-flex items-center rounded-lg border text-[11px] font-cinzel font-bold overflow-hidden transition ${
                            isLive
                              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                              : 'bg-[#181a24] border-[#c8a45c]/60 text-[#f5e4be]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateWorkspace({
                                ...workspace,
                                dmPreviewVisual: {
                                  kind: item.kind,
                                  id: item.id,
                                  title: item.title,
                                  imageUrl: item.imageUrl,
                                  folder: item.folder,
                                },
                                activeLiveVisual: {
                                  kind: item.kind,
                                  id: item.id,
                                  title: item.title,
                                  imageUrl: item.imageUrl,
                                  folder: item.folder,
                                },
                              });
                              setLiveMapToast(`🟢 Proyectando desde la Cola: ${item.title}`);
                              setTimeout(() => setLiveMapToast(''), 2500);
                            }}
                            className="px-2 py-1 hover:bg-amber-900/40 flex items-center gap-1 cursor-pointer"
                            title={`Clic para mostrar "${item.title}" a los jugadores`}
                          >
                            <span className="text-[10px] font-mono text-amber-300">
                              {idx + 1}.
                            </span>
                            <span>{kindIcon}</span>
                            <span className="truncate max-w-[115px]">{item.title}</span>
                            {isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            data-testid={`btn-remove-queue-${item.queueId}`}
                            onClick={() => handleRemoveVisualItemFromQueue(item.queueId)}
                            className="px-1.5 py-1 bg-black/40 hover:bg-red-900/80 text-stone-400 hover:text-white border-l border-stone-700/70 transition cursor-pointer"
                            title="Tachar / Quitar de la cola"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[11px] text-stone-400 italic">
                    Cola vacía. Usa el botón "+ Poner en Cola" dentro de Álbum, Mapas Tácticos o Mapas para preparar el orden de tu historia.
                  </span>
                )}
              </div>

              {currentPlaceMapUrl && (
                <button
                  type="button"
                  data-testid="btn-enqueue-current-map"
                  onClick={() =>
                    handleAddVisualToQueue({
                      id: `map-${selectedFolder}`,
                      kind: 'map',
                      title: `Mapa: ${currentPlaceShortName}`,
                      imageUrl: currentPlaceMapUrl,
                      folder: selectedFolder,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#181a24] hover:bg-[#242838] border border-[#c8a45c]/50 text-[#e2c275] text-[10px] font-cinzel font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                  title="Poner el mapa actual en la cola de proyección"
                >
                  <ListPlus className="w-3 h-3" />
                  <span>+ Mapa Actual a Cola</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. BOTTOM LEFT SPLIT: BARAJAS EN <LUGAR> + MUNDO, TRAMA Y CRÓNICAS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 flex-1">
            {/* 2A. BARAJAS EN: <Lugar> (Standing Deck Cards + Overlapping Foreground Hand + Scroll Arrows) */}
            <div className="md:col-span-7 rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-3 flex flex-col justify-between shadow-[0_0_25px_rgba(0,0,0,0.8)]">
              {(() => {
                const currentDmDeckCount =
                  activeDeck === 'npcs'
                    ? filteredNpcs.length
                    : activeDeck === 'monsters'
                    ? filteredMonsters.length
                    : filteredItemsAndSpells.length;
                const maxScrollIdx = Math.max(0, currentDmDeckCount - 3);
                const safeScrollIdx = Math.min(dmDeckScrollIndex, maxScrollIdx);

                return (
                  <div className="flex flex-col justify-between h-full">
                    {/* Top Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] tracking-wider uppercase flex items-center gap-1.5">
                        <span>BARAJAS EN:</span>
                        <span className="text-amber-400">🍺 {currentPlaceShortName}</span>
                      </h3>

                      <div className="flex items-center gap-2">
                        {currentDmDeckCount > 3 && (
                          <span className="text-[10px] font-mono text-amber-300/90 bg-[#1a1d29] px-2 py-0.5 rounded border border-[#c8a45c]/40">
                            Cartas {safeScrollIdx + 1}–{Math.min(currentDmDeckCount, safeScrollIdx + 3)} de {currentDmDeckCount}
                          </span>
                        )}
                        {activeDeck === 'items' && (
                          <button
                            type="button"
                            onClick={() => setIsItemsCompendiumModalOpen(true)}
                            className="text-[10px] font-cinzel font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                          >
                            Compendio y Entrega
                          </button>
                        )}
                      </div>
                    </div>

                    {/* LAYER 1 (BACK): 3 Tall Standing Deck Cards (La mitad inferior queda cubierta por las cartas abiertas) */}
                    <div className="grid grid-cols-3 gap-2.5 px-1">
                      {/* Standing Deck 1: NPCs */}
                      <button
                        type="button"
                        data-testid="dm-deck-npcs"
                        onClick={() => {
                          setActiveDeck('npcs');
                          setDmDeckScrollIndex(0);
                        }}
                        className={`relative h-[148px] rounded-2xl border-2 p-2.5 flex flex-col items-center justify-start transition-all duration-200 cursor-pointer overflow-hidden ${
                          activeDeck === 'npcs'
                            ? 'bg-gradient-to-b from-[#382b19] via-[#221a11] to-[#14100b] border-[#f5e4be] shadow-[0_0_22px_rgba(226,194,117,0.35)] -translate-y-1 z-10'
                            : 'bg-gradient-to-b from-[#1e1b18] via-[#151419] to-[#0f1015] border-[#c8a45c]/40 opacity-80 hover:opacity-100 hover:-translate-y-0.5'
                        }`}
                      >
                        {/* Inner Filigree Card Frame */}
                        <div className="absolute inset-1.5 rounded-xl border border-[#e2c275]/25 pointer-events-none" />
                        <div className="flex items-center gap-1.5 z-10 mt-0.5">
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-[#e2c275]/70 flex items-center justify-center text-[#f5e4be] shadow-inner">
                            <Users className="w-3.5 h-3.5 text-[#e2c275]" />
                          </div>
                          <div className="text-left">
                            <div className="font-cinzel font-black text-xs text-[#f5e4be] uppercase leading-none">
                              NPCs
                            </div>
                            <div className="text-[10px] font-mono text-amber-300/90 mt-0.5">
                              {filteredNpcs.length} Cartas
                            </div>
                          </div>
                        </div>
                        {/* Decorative lower card-back watermark (partially covered by open cards) */}
                        <div className="mt-4 opacity-20 pointer-events-none">
                          <Users className="w-12 h-12 text-[#e2c275]" />
                        </div>
                      </button>

                      {/* Standing Deck 2: MONSTRUOS */}
                      <button
                        type="button"
                        data-testid="dm-deck-monsters"
                        onClick={() => {
                          setActiveDeck('monsters');
                          setDmDeckScrollIndex(0);
                        }}
                        className={`relative h-[148px] rounded-2xl border-2 p-2.5 flex flex-col items-center justify-start transition-all duration-200 cursor-pointer overflow-hidden ${
                          activeDeck === 'monsters'
                            ? 'bg-gradient-to-b from-[#3b191d] via-[#241114] to-[#140b0d] border-red-300 shadow-[0_0_22px_rgba(248,113,113,0.35)] -translate-y-1 z-10'
                            : 'bg-gradient-to-b from-[#211518] via-[#151216] to-[#0f1015] border-red-500/35 opacity-80 hover:opacity-100 hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="absolute inset-1.5 rounded-xl border border-red-400/25 pointer-events-none" />
                        <div className="flex items-center gap-1.5 z-10 mt-0.5">
                          <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-400/70 flex items-center justify-center text-red-200 shadow-inner">
                            <Skull className="w-3.5 h-3.5 text-red-400" />
                          </div>
                          <div className="text-left">
                            <div className="font-cinzel font-black text-xs text-red-100 uppercase leading-none">
                              MONSTRUOS
                            </div>
                            <div className="text-[10px] font-mono text-red-300/90 mt-0.5">
                              {filteredMonsters.length} Cartas
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 opacity-20 pointer-events-none">
                          <Skull className="w-12 h-12 text-red-400" />
                        </div>
                      </button>

                      {/* Standing Deck 3: OBJETOS */}
                      <button
                        type="button"
                        data-testid="dm-deck-items"
                        onClick={() => {
                          setActiveDeck('items');
                          setDmDeckScrollIndex(0);
                        }}
                        className={`relative h-[148px] rounded-2xl border-2 p-2.5 flex flex-col items-center justify-start transition-all duration-200 cursor-pointer overflow-hidden ${
                          activeDeck === 'items'
                            ? 'bg-gradient-to-b from-[#301b42] via-[#1d1128] to-[#120b18] border-purple-300 shadow-[0_0_22px_rgba(192,132,252,0.35)] -translate-y-1 z-10'
                            : 'bg-gradient-to-b from-[#1d1526] via-[#14111a] to-[#0f1015] border-purple-500/35 opacity-80 hover:opacity-100 hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="absolute inset-1.5 rounded-xl border border-purple-400/25 pointer-events-none" />
                        <div className="flex items-center gap-1.5 z-10 mt-0.5">
                          <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/70 flex items-center justify-center text-purple-200 shadow-inner">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div className="text-left">
                            <div className="font-cinzel font-black text-xs text-purple-100 uppercase leading-none">
                              OBJETOS
                            </div>
                            <div className="text-[10px] font-mono text-purple-300/90 mt-0.5">
                              {filteredItemsAndSpells.length} Cartas
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 opacity-20 pointer-events-none">
                          <Crown className="w-12 h-12 text-purple-300" />
                        </div>
                      </button>
                    </div>

                    {/* LAYER 2 (FOREGROUND OVERLAPPING LOWER HALF): Open Playable Cards + Scroll Arrows + Compact Empty-Card Add Slot */}
                    <div className="relative -mt-20 z-20 rounded-2xl bg-[#10121b]/95 backdrop-blur-md border-2 border-[#c8a45c]/80 p-2 shadow-[0_-10px_25px_rgba(0,0,0,0.95)] flex items-center gap-1.5">
                      {/* Left Scroll Arrow (when > 3 cards) */}
                      {currentDmDeckCount > 3 && (
                        <button
                          type="button"
                          data-testid="btn-dm-deck-prev"
                          disabled={safeScrollIdx === 0}
                          onClick={() => setDmDeckScrollIndex(Math.max(0, safeScrollIdx - 1))}
                          className="w-6 h-28 rounded-xl bg-[#191c29] hover:bg-amber-950/80 disabled:opacity-30 border border-[#c8a45c]/60 text-[#f5e4be] flex items-center justify-center shrink-0 transition cursor-pointer disabled:cursor-default shadow"
                          title="Ver cartas anteriores"
                        >
                          <ChevronLeft className="w-4 h-4 text-amber-300" />
                        </button>
                      )}

                      {/* 3 Visible Open Cards Grid */}
                      <div className="flex-1 grid grid-cols-3 gap-2 min-h-[152px]">
                        {activeDeck === 'npcs' &&
                          filteredNpcs.slice(safeScrollIdx, safeScrollIdx + 3).map((npc) => (
                            <div
                              key={npc.id}
                              role="button"
                              tabIndex={0}
                              data-testid={`dm-card-${npc.id}`}
                              onMouseEnter={() => setSpotlightId(npc.id)}
                              onClick={() => setUnfoldedCard({ kind: 'npc', data: npc })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setUnfoldedCard({ kind: 'npc', data: npc });
                                }
                              }}
                              className="group relative rounded-xl bg-gradient-to-b from-[#1e202c] to-[#12131a] border-2 border-[#c8a45c]/80 hover:border-[#f5e4be] p-2 flex flex-col justify-between transition duration-200 hover:-translate-y-1 shadow-xl cursor-pointer"
                              title="Haz clic para desdoblar la carta completa del NPC"
                            >
                              <div className="relative h-18 w-full rounded-lg overflow-hidden bg-[#151722] border border-[#c8a45c]/30 flex items-center justify-center">
                                <EntityAvatar
                                  avatarType={npc.avatarType}
                                  avatarCustomUrl={npc.avatarCustomUrl}
                                  avatarIcon={npc.avatarIcon}
                                  legacyAvatarUrl={npc.avatarUrl}
                                  name={npc.name}
                                  category="npc"
                                  size="lg"
                                  className="w-full h-full rounded-none border-0"
                                />
                                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/80 border border-[#c8a45c]/50 text-[8px] font-cinzel font-bold text-amber-300">
                                  {npc.attitude}
                                </span>
                              </div>

                              <div className="text-center my-1">
                                <div className="font-cinzel font-black text-[10px] text-[#f5e4be] uppercase truncate">
                                  {npc.occupation || npc.race}
                                </div>
                                <div className="text-[10px] text-amber-300/90 font-semibold truncate">
                                  {npc.name}
                                </div>
                              </div>

                              <div className="pt-1 border-t border-[#c8a45c]/30 flex items-center justify-between text-[9px] text-stone-400">
                                <span>CA {npc.stats?.ac || 12}</span>
                                <span className="text-[#e2c275] font-cinzel font-bold group-hover:underline">
                                  Abrir ↗
                                </span>
                              </div>
                            </div>
                          ))}

                        {activeDeck === 'monsters' &&
                          filteredMonsters.slice(safeScrollIdx, safeScrollIdx + 3).map((mon) => (
                            <div
                              key={mon.id}
                              role="button"
                              tabIndex={0}
                              data-testid={`dm-card-${mon.id}`}
                              onMouseEnter={() => setSpotlightId(mon.id)}
                              onClick={() => setUnfoldedCard({ kind: 'monster', data: mon })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setUnfoldedCard({ kind: 'monster', data: mon });
                                }
                              }}
                              className="group relative rounded-xl bg-gradient-to-b from-[#25181b] to-[#12131a] border-2 border-[#c8a45c]/80 hover:border-red-400 p-2 flex flex-col justify-between transition duration-200 hover:-translate-y-1 shadow-xl cursor-pointer"
                              title="Haz clic para desdoblar la carta del Monstruo, tirar ataques o enviarlo a la mesa"
                            >
                              <div className="relative h-18 w-full rounded-lg overflow-hidden bg-[#1b1316] border border-red-900/40 flex items-center justify-center">
                                <EntityAvatar
                                  avatarType={mon.imageUrl ? 'custom' : mon.avatarType}
                                  avatarCustomUrl={mon.imageUrl || mon.avatarCustomUrl}
                                  avatarIcon={mon.avatarIcon}
                                  legacyAvatarUrl={mon.imageUrl || mon.avatarUrl}
                                  name={mon.name}
                                  category="monster"
                                  size="lg"
                                  className="w-full h-full rounded-none border-0"
                                />
                                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-red-950/90 border border-red-500/60 text-[8px] font-mono font-bold text-red-200">
                                  CR {mon.cr}
                                </span>
                              </div>

                              <div className="text-center my-1">
                                <div className="font-cinzel font-black text-[10px] text-[#f5e4be] uppercase truncate">
                                  {mon.name}
                                </div>
                                <div className="text-[10px] text-red-300/90 font-mono truncate">
                                  PG {mon.maxHp} • CA {mon.ac}
                                </div>
                              </div>

                              <div className="pt-1 border-t border-[#c8a45c]/30 flex items-center justify-between text-[9px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddMonsterToCombat(mon, 'enemy');
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-red-950 hover:bg-red-900 text-red-200 border border-red-700/70 font-bold cursor-pointer"
                                  title="Enviar directo a la Sala en Vivo"
                                >
                                  + Mesa
                                </button>
                                <span className="text-[#e2c275] font-cinzel font-bold group-hover:underline">
                                  Abrir ↗
                                </span>
                              </div>
                            </div>
                          ))}

                        {activeDeck === 'items' &&
                          filteredItemsAndSpells.slice(safeScrollIdx, safeScrollIdx + 3).map((item) => (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              data-testid={`dm-card-${item.id}`}
                              onMouseEnter={() => setSpotlightId(item.id)}
                              onClick={() => setUnfoldedCard({ kind: 'item', data: item })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setUnfoldedCard({ kind: 'item', data: item });
                                }
                              }}
                              className="group relative rounded-xl bg-gradient-to-b from-[#211b2c] to-[#12131a] border-2 border-[#c8a45c]/80 hover:border-purple-400 p-2 flex flex-col justify-between transition duration-200 hover:-translate-y-1 shadow-xl cursor-pointer"
                              title="Haz clic para desdoblar la carta del Objeto/Conjuro y entregarlo a un jugador"
                            >
                              <div className="relative h-18 w-full rounded-lg overflow-hidden bg-[#181422] border border-purple-900/40 flex flex-col items-center justify-center p-2">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="absolute inset-0 w-full h-full object-cover opacity-85"
                                  />
                                ) : (
                                  <Crown className="w-7 h-7 text-[#e2c275] mb-1" />
                                )}
                                <span className="relative z-10 px-1.5 py-0.5 rounded bg-purple-950/90 border border-purple-500/50 text-[8px] font-cinzel font-bold text-purple-200 truncate max-w-full">
                                  {item.rarity || 'Raro'}
                                </span>
                              </div>

                              <div className="text-center my-1">
                                <div className="font-cinzel font-black text-[10px] text-[#f5e4be] uppercase truncate">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-purple-300/90 truncate">
                                  {item.category || 'Tesoro'}
                                </div>
                              </div>

                              <div className="pt-1 border-t border-[#c8a45c]/30 flex items-center justify-between text-[9px] text-stone-400">
                                <span>{item.kind === 'spell' ? 'Conjuro' : 'Objeto'}</span>
                                <span className="text-[#e2c275] font-cinzel font-bold group-hover:underline">
                                  Abrir ↗
                                </span>
                              </div>
                            </div>
                          ))}

                        {/* Empty state if 0 cards in this folder */}
                        {currentDmDeckCount === 0 && (
                          <div className="col-span-3 rounded-xl border border-dashed border-[#c8a45c]/35 bg-[#151722]/70 flex flex-col items-center justify-center p-3 text-center">
                            <span className="font-cinzel font-bold text-xs text-[#f5e4be]">
                              Sin cartas en {currentPlaceShortName}
                            </span>
                            <span className="text-[10px] text-stone-400 mt-0.5">
                              Usa el botón "+" a la derecha para crear una carta aquí
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Scroll Arrow (when > 3 cards) */}
                      {currentDmDeckCount > 3 && (
                        <button
                          type="button"
                          data-testid="btn-dm-deck-next"
                          disabled={safeScrollIdx >= maxScrollIdx}
                          onClick={() => setDmDeckScrollIndex(Math.min(maxScrollIdx, safeScrollIdx + 1))}
                          className="w-6 h-28 rounded-xl bg-[#191c29] hover:bg-amber-950/80 disabled:opacity-30 border border-[#c8a45c]/60 text-[#f5e4be] flex items-center justify-center shrink-0 transition cursor-pointer disabled:cursor-default shadow"
                          title="Ver siguientes cartas"
                        >
                          <ChevronRight className="w-4 h-4 text-amber-300" />
                        </button>
                      )}

                      {/* Compact Empty-Card Slot ("+ Nueva") on the Right Edge */}
                      <button
                        type="button"
                        data-testid="btn-dm-deck-add"
                        onClick={() => {
                          if (activeDeck === 'npcs') openAddNpc();
                          else if (activeDeck === 'monsters') openAddMonster();
                          else setIsItemsCompendiumModalOpen(true);
                        }}
                        className="w-14 sm:w-16 min-h-[152px] rounded-xl border-2 border-dashed border-[#c8a45c]/55 hover:border-[#f5e4be] bg-[#161925]/80 hover:bg-[#1e2233] p-1.5 flex flex-col items-center justify-center gap-1.5 shrink-0 text-[#e8d8b9] hover:text-white transition cursor-pointer group"
                        title="Agregar nueva carta a esta baraja"
                      >
                        <div className="w-7 h-7 rounded-full border border-[#c8a45c]/70 bg-amber-950/40 group-hover:scale-110 flex items-center justify-center transition">
                          <Plus className="w-3.5 h-3.5 text-[#e2c275]" />
                        </div>
                        <span className="font-cinzel font-bold text-[9px] uppercase tracking-wider text-center leading-tight">
                          Nueva
                          <br />
                          Carta
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 2B. MUNDO, TRAMA Y CRÓNICAS (Clickable Tome + Vertical Ancient Scroll + Subtle Brain Button) */}
            <div className="md:col-span-5 rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-3 flex flex-col justify-between shadow-[0_0_25px_rgba(0,0,0,0.8)]">
              {/* Header with Subtle Tucked-Away Campaign Brain (IA) Button */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] tracking-wider uppercase">
                  MUNDO, TRAMA Y CRÓNICAS
                </h3>

                {/* Subtle, Small Purple Campaign Brain Button (Gated by Role: moderator, creator, admin) */}
                <button
                  type="button"
                  data-testid="btn-open-campaign-brain"
                  onClick={() => {
                    if (!isOracleAllowed) {
                      setLiveMapToast('🔒 Sabio Arcano en desarrollo para cuentas de cliente');
                      setTimeout(() => setLiveMapToast(''), 3000);
                      return;
                    }
                    onOpenAIOracle(
                      '¿Qué secretos o ganchos de trama tengo listos para mi sesión de hoy?',
                      true
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-cinzel font-bold flex items-center gap-1.5 transition shrink-0 ${
                    isOracleAllowed
                      ? 'bg-[#211730] hover:bg-[#2e1f44] border-purple-400/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)] cursor-pointer'
                      : 'bg-stone-900/80 border-stone-700 text-stone-400 opacity-65 cursor-not-allowed'
                  }`}
                  title={
                    isOracleAllowed
                      ? 'Abrir Sabio Arcano / Cerebro de Campaña (Oráculo IA del DM)'
                      : 'Sabio Arcano en desarrollo para clientes (Disponible para Moderadores, Creadores y Admins)'
                  }
                >
                  <Wand2 className={`w-3.5 h-3.5 ${isOracleAllowed ? 'text-purple-300' : 'text-stone-500'}`} />
                  <span>Sabio Arcano</span>
                  {!isOracleAllowed && (
                    <span className="px-1 py-0.2 rounded bg-stone-800 border border-stone-600 text-[8px] text-amber-300 uppercase">
                      En desarrollo
                    </span>
                  )}
                </button>
              </div>

              {/* Side-by-Side: 1. Clickable Leather Tome (Gran Tomo) & 2. Vertical Ancient Scroll (Mensajes) */}
              <div className="grid grid-cols-2 gap-3 flex-1 items-stretch pt-0.5">
                {/* 1. CUADERNITO DE CRÓNICAS (Clicking directly opens Gran Tomo de Crónicas) */}
                <div
                  role="button"
                  tabIndex={0}
                  data-testid="btn-open-chronicles-tome"
                  onClick={() => setIsChroniclesModalOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsChroniclesModalOpen(true);
                    }
                  }}
                  className="relative rounded-xl bg-gradient-to-br from-[#2d231a] via-[#1e1712] to-[#120e0b] hover:from-[#382b20] border-2 border-[#c8a45c]/85 hover:border-[#f5e4be] shadow-xl flex flex-col items-center justify-between p-3 text-center group cursor-pointer transition min-h-[168px]"
                  title="Haz clic en el cuaderno para abrir el Gran Tomo de Crónicas"
                >
                  {/* Leather Book Spine & Corner Filigree */}
                  <div className="absolute left-2.5 top-0 bottom-0 w-1.5 bg-[#c8a45c]/35" />
                  <div className="absolute right-2.5 top-2 bottom-2 w-0.5 bg-[#e2c275]/15" />

                  <div className="text-[9px] font-cinzel font-bold uppercase tracking-widest text-amber-300/85 pl-2">
                    Gran Tomo
                  </div>

                  <div className="my-1 flex flex-col items-center pl-2">
                    <div className="w-11 h-11 rounded-xl bg-amber-950/70 border border-[#e2c275]/70 flex items-center justify-center mb-1.5 group-hover:scale-110 transition shadow-inner">
                      <BookOpen className="w-6 h-6 text-[#e2c275]" />
                    </div>
                    <span className="font-cinzel font-black text-xs text-[#f5e4be] leading-tight uppercase">
                      Crónicas de {worldName || 'Campaña'}
                    </span>
                    <span className="text-[10px] text-amber-200/80 line-clamp-1 mt-0.5">
                      {filteredLogs[0]?.title || 'Abrir crónicas'}
                    </span>
                  </div>

                  <div className="w-full pt-1.5 border-t border-[#c8a45c]/30 flex items-center justify-between text-[10px] font-mono text-amber-400/90 pl-2">
                    <span>{filteredLogs.length} Hojas</span>
                    <span className="font-cinzel font-bold text-[#f5e4be] group-hover:underline">
                      Abrir ↗
                    </span>
                  </div>

                  {/* Floating "+ Nueva Entrada" Corner Badge */}
                  <button
                    type="button"
                    data-testid="btn-quick-new-chronicle"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddLog();
                    }}
                    className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-b from-[#33271a] to-[#17120c] hover:from-amber-800 hover:to-amber-950 border-2 border-[#e2c275] text-[#f5e4be] shadow-lg flex flex-col items-center justify-center leading-none transition cursor-pointer z-10"
                    title="Escribir nueva entrada en el Gran Tomo de Crónicas"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-[7px] font-cinzel font-bold uppercase">Nueva</span>
                  </button>
                </div>

                {/* 2. VERTICAL ANCIENT PARCHMENT SCROLL BUTTON: MENSAJES DE JUGADOR */}
                <button
                  type="button"
                  data-testid="btn-open-player-messages"
                  onClick={() => setIsPlayerMessagesModalOpen(true)}
                  className="relative flex flex-col items-center justify-between group cursor-pointer min-h-[168px] transition hover:-translate-y-0.5"
                  title="Abrir pergamino de Mensajes de Jugador recibidos en la sala"
                >
                  {/* Top Wooden & Gold Scroll Roller */}
                  <div className="w-full h-3 rounded-full bg-gradient-to-r from-[#5c401c] via-[#e2c275] to-[#5c401c] border border-[#f5e4be]/70 shadow-md flex items-center justify-between px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2a1c0b]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2a1c0b]" />
                  </div>

                  {/* Vertical Unfurled Parchment Scroll Body */}
                  <div className="w-[92%] flex-1 bg-gradient-to-b from-[#2b2217] via-[#1f1912] to-[#292015] group-hover:from-[#362a1c] border-x-2 border-[#c8a45c]/80 px-2.5 py-2.5 flex flex-col items-center justify-between text-center relative shadow-inner">
                    {/* Subtle Parchment Horizontal Script Lines */}
                    <div className="text-[9px] font-cinzel font-bold uppercase tracking-widest text-amber-300/80">
                      Pergamino Real
                    </div>

                    <div className="my-1 flex flex-col items-center">
                      <div className="relative w-11 h-11 rounded-full bg-gradient-to-b from-amber-900/70 to-stone-950 border-2 border-[#e2c275] flex items-center justify-center mb-1.5 shadow-md group-hover:scale-110 transition">
                        <Scroll className="w-5 h-5 text-[#f5e4be]" />
                        {unreadMessagesCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-purple-600 border border-white text-white text-[9px] font-bold animate-pulse">
                            {unreadMessagesCount}
                          </span>
                        )}
                      </div>
                      <span className="font-cinzel font-black text-xs text-[#f5e4be] leading-tight uppercase">
                        Mensajes de Jugador
                      </span>
                      <span className="text-[10px] text-stone-300 mt-0.5">
                        {resolvedPlayerMessages.length} recibidos en sala
                      </span>
                    </div>

                    <div className="w-full pt-1.5 border-t border-[#c8a45c]/30 flex items-center justify-between text-[10px] text-amber-300/90">
                      <span className="font-mono">{unreadMessagesCount} nuevos</span>
                      <span className="font-cinzel font-bold text-[#f5e4be] group-hover:underline">
                        Leer ↗
                      </span>
                    </div>
                  </div>

                  {/* Bottom Wooden & Gold Scroll Roller */}
                  <div className="w-full h-3 rounded-full bg-gradient-to-r from-[#5c401c] via-[#e2c275] to-[#5c401c] border border-[#f5e4be]/70 shadow-md flex items-center justify-between px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2a1c0b]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2a1c0b]" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* RIGHT 4 COLUMNS: JUGADORES CONECTADOS + COMBATE + BITÁCORA       */}
        {/* =============================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-2 justify-between">
          {/* 3A-0. JUGADORES CONECTADOS EN LA MESA (Always visible to DM, clickable to open Tarot Card) */}
          <div
            data-testid="dm-connected-players-panel"
            className="rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-3 shadow-[0_0_25px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#c8a45c]/30">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] tracking-wider uppercase leading-none">
                  JUGADORES CONECTADOS ({partyMembers.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  En Línea
                </span>
                <button
                  type="button"
                  data-testid="btn-dm-table-settings"
                  onClick={openDmTableSettingsModal}
                  className="px-2 py-0.5 rounded-lg bg-[#191c28] hover:bg-[#232738] border border-[#c8a45c]/75 text-[#f5e4be] font-cinzel font-bold text-[10px] flex items-center gap-1 shadow transition cursor-pointer"
                  title="Ajustes de la Mesa (Nombre, Contraseña, Online/Offline y Auto-Sync)"
                >
                  <Sliders className="w-3 h-3 text-[#e2c275]" />
                  <span>Ajustes</span>
                </button>
              </div>
            </div>

            {partyMembers.length === 0 ? (
              <div className="p-2.5 rounded-xl bg-[#191c28]/70 border border-dashed border-stone-800 text-center text-[11px] text-stone-400">
                Esperando a que los jugadores entren a la sala con el código{' '}
                <strong className="text-amber-300 font-mono">{roomCode || 'MESA'}</strong>...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {partyMembers.map((pm) => {
                  const hpPct = Math.max(
                    0,
                    Math.min(100, (pm.currentHp / Math.max(1, pm.maxHp)) * 100)
                  );
                  return (
                    <button
                      key={pm.characterId}
                      type="button"
                      data-testid={`dm-connected-player-card-${pm.characterId}`}
                      onClick={() => setInspectedPartyMemberId(pm.characterId)}
                      className="group text-left p-2 rounded-xl bg-gradient-to-br from-[#1c1f2e] to-[#131520] hover:from-[#262a3f] hover:to-[#191c2a] border border-[#c8a45c]/55 hover:border-[#f0d082] transition shadow flex items-center gap-2.5 cursor-pointer"
                      title={`Clic para abrir la Carta de Personaje de ${pm.characterName}`}
                    >
                      <div className="relative shrink-0">
                        <EntityAvatar
                          avatarType={pm.avatarType}
                          customUrl={pm.avatarCustomUrl}
                          iconId={pm.avatarIcon}
                          legacyUrl={pm.avatarUrl}
                          name={pm.characterName}
                          category="character"
                          size="sm"
                          className="w-10 h-10 rounded-full border-2 border-[#d4af37] bg-[#10121a]"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-stone-950" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-cinzel font-black text-xs text-[#f8e7c1] truncate group-hover:text-amber-300">
                            {pm.characterName}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-amber-300/95 truncate">
                          Niv. {pm.level || 1} • {pm.experience ?? 0} XP
                        </div>
                        {/* Mini HP Bar */}
                        <div className="w-full h-3 rounded-full bg-stone-950 border border-[#c8a45c]/40 overflow-hidden relative mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-700 to-emerald-500 transition-all"
                            style={{ width: `${hpPct}%` }}
                          />
                          <span className="absolute inset-0 text-[8px] font-mono font-bold text-white flex items-center justify-center leading-none">
                            PG {pm.currentHp}/{pm.maxHp}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3A. COMBATE (DM Portrait Avatar + Aliados & Enemigos with Live HP Controls & 8-Enemy Cap) */}
          <div
            data-testid="dm-combat-panel"
            className="rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-3 shadow-[0_0_25px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#c8a45c]/30">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-customize-dm-avatar"
                  onClick={openDmAvatarCustomizer}
                  className="relative group rounded-lg p-0.5 bg-gradient-to-b from-[#e2c275] to-[#8a6a2c] shadow cursor-pointer"
                  title="Personalizar retrato / icono del Dungeon Master (Subir PNG/JPG o elegir icono)"
                >
                  <EntityAvatar
                    avatarType={workspace.dmAvatarType || 'icon'}
                    customUrl={workspace.dmAvatarUrl}
                    iconId={workspace.dmAvatarIcon || 'crown'}
                    category="character"
                    size="sm"
                    className="rounded-md bg-[#12141d]"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-900 border border-[#e2c275] flex items-center justify-center text-[8px] text-[#f5e4be]">
                    ✎
                  </span>
                </button>
                <div>
                  <h3 className="font-cinzel font-black text-sm text-[#f5e4be] tracking-wider uppercase leading-none">
                    COMBATE
                  </h3>
                  <button
                    type="button"
                    onClick={openDmAvatarCustomizer}
                    className="text-[10px] text-amber-300/90 hover:text-amber-200 underline cursor-pointer"
                  >
                    Retrato del DM
                  </button>
                </div>
              </div>
              <button
                type="button"
                data-testid="btn-open-initiative-modal"
                onClick={() => setIsInitiativeDetailModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#1c1f2c] hover:bg-[#272b3d] border border-[#c8a45c]/60 text-[#f5e4be] text-[11px] font-cinzel font-bold flex items-center gap-1 transition cursor-pointer"
                title="Abrir gestor detallado de iniciativa y combatientes"
              >
                <Shield className="w-3 h-3 text-[#e2c275]" />
                <span>Iniciativa ({activeEncounter.combatants.length})</span>
              </button>
            </div>

            {/* ALIADOS */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-cinzel font-bold text-[#e8d8b9]">Aliados en Combate</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {allyCombatants.length} en escena
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {allyCombatants.slice(0, 5).map((ally) => {
                  const isTurn = currentTurnCombatant?.id === ally.id;
                  const hpPct = Math.max(0, Math.min(100, (ally.hp / Math.max(1, ally.maxHp)) * 100));
                  return (
                    <div
                      key={ally.id}
                      className={`group relative rounded-lg bg-[#1b1e2b] border overflow-hidden flex flex-col justify-between transition ${
                        isTurn
                          ? 'border-amber-400 ring-2 ring-amber-400/60'
                          : 'border-emerald-700/70'
                      }`}
                      title={`${ally.name} • Ini ${ally.initiative} • CA ${ally.ac}`}
                    >
                      <div className="relative h-10 w-full flex items-center justify-center bg-[#12141d]">
                        <Users className="w-4 h-4 text-emerald-300/80" />
                        {/* Quick -1 / +1 HP buttons */}
                        <button
                          type="button"
                          data-testid={`ally-hp-minus-${ally.id}`}
                          onClick={() => handleUpdateCombatantHp(ally.id, -1)}
                          className="absolute left-0.5 bottom-0.5 w-4 h-4 rounded bg-black/80 hover:bg-red-900 text-red-300 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                          title="-1 PG"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          data-testid={`ally-hp-plus-${ally.id}`}
                          onClick={() => handleUpdateCombatantHp(ally.id, 1)}
                          className="absolute right-0.5 bottom-0.5 w-4 h-4 rounded bg-black/80 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                          title="+1 PG"
                        >
                          +
                        </button>
                      </div>
                      <div className="px-1 py-0.5 bg-[#0f1118] text-center">
                        <div className="text-[8px] text-stone-200 truncate">{ally.name}</div>
                        <div className="w-full h-2.5 rounded-sm bg-stone-900 overflow-hidden relative mt-0.5">
                          <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${hpPct}%` }}
                          />
                          <span className="absolute inset-0 text-[8px] font-mono font-bold text-white flex items-center justify-center leading-none">
                            {ally.hp}/{ally.maxHp}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* + Add Ally Tile */}
                <button
                  type="button"
                  data-testid="btn-add-ally-combatant"
                  onClick={() => setIsAddCombatantPickerOpen('ally')}
                  className="h-[60px] rounded-lg bg-[#181a24] hover:bg-[#222534] border border-dashed border-[#c8a45c]/50 flex items-center justify-center text-[#e2c275] transition cursor-pointer"
                  title="Añadir Aliado o Jugador al combate"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ENEMIGOS (Tope estricto: 8 enemigos máximo) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-cinzel font-bold text-[#e8d8b9]">
                  Enemigos ({enemyCombatants.length}/{MAX_ENCOUNTER_ENEMIES})
                </span>
                <button
                  type="button"
                  data-testid="btn-toggle-enemies-on-table"
                  onClick={handleToggleBroadcastEnemies}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-cinzel font-bold flex items-center gap-1 border transition cursor-pointer ${
                    activeEncounter.broadcastEnemiesToTable
                      ? 'bg-amber-950/70 border-[#c8a45c]/70 text-[#f5e4be]'
                      : 'bg-stone-900 border-stone-700 text-stone-400'
                  }`}
                  title="Mostrar u ocultar enemigos en la pantalla de los jugadores"
                >
                  {activeEncounter.broadcastEnemiesToTable ? (
                    <Eye className="w-3 h-3 text-amber-400" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-stone-500" />
                  )}
                  <span>
                    Enemigos en Mesa: {activeEncounter.broadcastEnemiesToTable ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {enemyCombatants.slice(0, MAX_ENCOUNTER_ENEMIES).map((enemy) => {
                  const isTurn = currentTurnCombatant?.id === enemy.id;
                  const hpPct = Math.max(
                    0,
                    Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100)
                  );
                  return (
                    <div
                      key={enemy.id}
                      className={`group relative rounded-lg bg-[#221619] border overflow-hidden flex flex-col justify-between transition ${
                        isTurn ? 'border-amber-400 ring-2 ring-amber-400/60' : 'border-red-800/80'
                      }`}
                      title={`${enemy.name} • Ini ${enemy.initiative} • CA ${enemy.ac}`}
                    >
                      <div className="relative h-10 w-full flex items-center justify-center bg-[#170f11]">
                        <Skull className="w-4 h-4 text-red-400/80" />
                        {/* Remove enemy quick button on top-right */}
                        <button
                          type="button"
                          onClick={() => handleRemoveCombatant(enemy.id)}
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded bg-black/70 hover:bg-red-800 text-stone-300 hover:text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Quitar de la mesa"
                        >
                          ×
                        </button>
                        {/* Quick -1 / +1 HP buttons */}
                        <button
                          type="button"
                          data-testid={`enemy-hp-minus-${enemy.id}`}
                          onClick={() => handleUpdateCombatantHp(enemy.id, -1)}
                          className="absolute left-0.5 bottom-0.5 w-4 h-4 rounded bg-black/80 hover:bg-red-900 text-red-300 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                          title="-1 PG"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          data-testid={`enemy-hp-plus-${enemy.id}`}
                          onClick={() => handleUpdateCombatantHp(enemy.id, 1)}
                          className="absolute right-0.5 bottom-0.5 w-4 h-4 rounded bg-black/80 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                          title="+1 PG"
                        >
                          +
                        </button>
                      </div>
                      <div className="px-1 py-0.5 bg-[#120b0d] text-center">
                        <div className="text-[8px] text-red-100 truncate">{enemy.name}</div>
                        <div className="w-full h-2.5 rounded-sm bg-stone-900 overflow-hidden relative mt-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-red-700 to-amber-600 transition-all"
                            style={{ width: `${hpPct}%` }}
                          />
                          <span className="absolute inset-0 text-[8px] font-mono font-bold text-white flex items-center justify-center leading-none">
                            {enemy.hp}/{enemy.maxHp}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* + Add Enemy Tile (only enabled if < 8 enemies) */}
                {enemyCombatants.length < MAX_ENCOUNTER_ENEMIES ? (
                  <button
                    type="button"
                    data-testid="btn-add-enemy-combatant"
                    onClick={() => setIsAddCombatantPickerOpen('enemy')}
                    className="h-[60px] rounded-lg bg-[#181a24] hover:bg-red-950/50 border border-dashed border-[#c8a45c]/50 flex items-center justify-center text-[#e2c275] transition cursor-pointer"
                    title={`Añadir Enemigo a la Mesa (${enemyCombatants.length}/${MAX_ENCOUNTER_ENEMIES})`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                ) : (
                  <div
                    data-testid="enemy-cap-reached-badge"
                    className="h-[60px] rounded-lg bg-red-950/30 border border-red-800/60 flex flex-col items-center justify-center text-center px-1"
                    title="El tope máximo es de 8 enemigos en escena"
                  >
                    <span className="text-[9px] font-cinzel font-bold text-red-300 leading-tight">
                      Máx {MAX_ENCOUNTER_ENEMIES}
                    </span>
                    <span className="text-[8px] text-red-400/80">Enemigos</span>
                  </div>
                )}
              </div>
            </div>

            {/* Turn Controls Strip (Previous Turn, Round/Turn Status, Next Turn, Reset Round) */}
            <div className="mt-2 pt-2 border-t border-[#c8a45c]/25 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="btn-prev-turn"
                  onClick={() => handleStepTurn('prev')}
                  className="px-2 py-1 rounded-lg bg-[#1c1f2c] hover:bg-[#272b3d] border border-[#c8a45c]/50 text-[#f5e4be] text-[10px] font-cinzel font-bold flex items-center gap-0.5 transition cursor-pointer"
                  title="Turno Anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-[#e2c275]" />
                  <span>Ant.</span>
                </button>
                <button
                  type="button"
                  data-testid="btn-next-turn"
                  onClick={() => handleStepTurn('next')}
                  className="px-2 py-1 rounded-lg bg-amber-700/80 hover:bg-amber-600 border border-[#e2c275] text-white text-[10px] font-cinzel font-bold flex items-center gap-0.5 transition cursor-pointer"
                  title="Siguiente Turno"
                >
                  <span>Sig.</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[10px] font-mono text-amber-200 truncate px-1">
                <strong>R{activeEncounter.round}</strong>:{' '}
                {currentTurnCombatant?.name || 'Sin turno'}
              </div>

              <button
                type="button"
                data-testid="btn-reset-round"
                onClick={() => setShowResetCombatModal(true)}
                className="px-2 py-1 rounded-lg bg-[#1c1f2c] hover:bg-red-950/70 border border-stone-700 hover:border-red-600/60 text-stone-300 hover:text-red-200 text-[10px] font-cinzel font-bold flex items-center gap-1 transition cursor-pointer"
                title="Reiniciar la ronda y borrar el registro de la bitácora"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>

          {/* 3B. BITÁCORA DE COMBATE EN VIVO */}
          <div className="rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-3 flex flex-col justify-between shadow-[0_0_25px_rgba(0,0,0,0.85)]">
            <div>
              <h3 className="font-cinzel font-black text-xs text-[#f5e4be] tracking-wider uppercase mb-1.5">
                BITÁCORA DE COMBATE EN VIVO
              </h3>

              {/* Sub-tabs: Registro | Notas */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  type="button"
                  data-testid="tab-combat-log"
                  onClick={() => setCombatBitacoraTab('log')}
                  className={`py-1 px-2 rounded-lg text-[11px] font-cinzel font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                    combatBitacoraTab === 'log'
                      ? 'bg-[#252019] border-[#e2c275] text-[#f5e4be]'
                      : 'bg-[#181a24] border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <FileText className="w-3 h-3 text-[#e2c275]" />
                  <span>Registro</span>
                </button>
                <button
                  type="button"
                  data-testid="tab-combat-notes"
                  onClick={() => setCombatBitacoraTab('notes')}
                  className={`py-1 px-2 rounded-lg text-[11px] font-cinzel font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                    combatBitacoraTab === 'notes'
                      ? 'bg-[#252019] border-[#e2c275] text-[#f5e4be]'
                      : 'bg-[#181a24] border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Edit className="w-3 h-3 text-[#e2c275]" />
                  <span>Notas</span>
                </button>
              </div>

              {combatBitacoraTab === 'log' ? (
                <div>
                  {/* Quick log input */}
                  <div className="flex items-center gap-1 mb-1.5">
                    <input
                      type="text"
                      value={combatNoteInput}
                      onChange={(e) => setCombatNoteInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCombatLogNote()}
                      placeholder="Anotar acción (ej. Goblin cayó)..."
                      className="flex-1 bg-[#10121a] border border-stone-700/80 rounded-lg px-2 py-1 text-[11px] text-stone-200 focus:outline-none focus:border-[#c8a45c]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCombatLogNote()}
                      className="px-2 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Scrollable Log Entries */}
                  <div className="space-y-1 max-h-[82px] overflow-y-auto pr-1 text-[11px] text-stone-300">
                    {(activeEncounter.combatLog || []).length === 0 ? (
                      <div className="text-stone-500 italic py-2 text-center text-[10px]">
                        Sin eventos registrados en esta ronda.
                      </div>
                    ) : (
                      (activeEncounter.combatLog || []).map((ev) => (
                        <div
                          key={ev.id}
                          className="py-0.5 border-b border-stone-800/70 truncate"
                          title={ev.note}
                        >
                          <span className="text-amber-400 font-semibold">Ronda {ev.round}:</span>{' '}
                          {ev.note}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <textarea
                  rows={3}
                  value={activeEncounter.combatNotes || ''}
                  onChange={(e) =>
                    onUpdateWorkspace({
                      ...workspace,
                      activeEncounter: {
                        ...activeEncounter,
                        combatNotes: e.target.value,
                      },
                    })
                  }
                  placeholder="Notas tácticas del encuentro, trampas o refuerzos..."
                  className="w-full bg-[#10121a] border border-stone-700/80 rounded-lg p-2 text-[11px] text-stone-200 focus:outline-none focus:border-[#c8a45c]"
                />
              )}
            </div>

            <button
              type="button"
              data-testid="btn-finalize-combat-summary"
              onClick={handleSaveCombatSummary}
              className="mt-2 w-full py-1.5 px-3 rounded-xl bg-[#1d202c] hover:bg-emerald-950/80 border border-[#c8a45c]/60 hover:border-emerald-500 text-[#f5e4be] text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5 text-[#e2c275]" />
              <span>Finalizar y Guardar Resumen</span>
            </button>
          </div>

          {/* 3C. RESÚMENES DE GUERRA */}
          <div className="rounded-2xl bg-[#14161f] border-2 border-[#c8a45c]/70 p-2.5 shadow-[0_0_25px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-cinzel font-black text-xs text-[#f5e4be] tracking-wider uppercase flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-[#e2c275]" />
                <span>RESÚMENES DE GUERRA</span>
              </h3>
              <span className="text-[10px] font-mono text-stone-400">
                {filteredCombatSummaries.length}
              </span>
            </div>

            <div className="space-y-1 max-h-[68px] overflow-y-auto pr-1">
              {filteredCombatSummaries.slice(0, 3).map((sum) => (
                <button
                  key={sum.id}
                  type="button"
                  onClick={() => setSelectedWarSummary(sum)}
                  className="w-full py-1 px-2.5 rounded-lg bg-[#191c28] hover:bg-[#232738] border border-stone-700/80 hover:border-[#c8a45c]/60 text-left text-xs text-[#e8d8b9] flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <span className="truncate flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-[#e2c275] shrink-0" />
                    <span className="truncate">{sum.name}</span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-400 shrink-0">
                    {sum.roundsCount}R
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveCombatSummary}
              className="mt-1.5 w-full py-0.5 rounded-lg bg-[#181a24] hover:bg-[#222534] border border-stone-800 text-[#e2c275] text-xs font-bold flex items-center justify-center transition cursor-pointer"
              title="Archivar combate actual en Resúmenes de Guerra"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* La barra de sesión (Regresar al Lobby, Guardar, Estandarte del DM y Ubicación/Mapa) está integrada en la barra superior */}

      {/* Floating Toast for Live Map / Projection */}
      {liveMapToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-[#181a24] border-2 border-[#c8a45c] text-[#f5e4be] text-xs font-cinzel font-bold shadow-2xl flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{liveMapToast}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: CARTA DESDOBLADA DEL DM (Unfoldable Detailed DM Card)      */}
      {/* =================================================================== */}
      {unfoldedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl bg-gradient-to-b from-[#1d1f2b] to-[#12131a] border-2 border-[#e2c275] rounded-3xl shadow-[0_0_60px_rgba(200,164,92,0.3)] overflow-hidden text-stone-200">
            {/* Top Bar */}
            <div className="px-6 py-4 bg-[#151722] border-b border-[#c8a45c]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-[#c8a45c]/60 text-[#e2c275] text-xs font-cinzel font-bold uppercase">
                  {unfoldedCard.kind === 'npc'
                    ? '👤 Carta Desdoblada • NPC'
                    : unfoldedCard.kind === 'monster'
                    ? '💀 Carta Desdoblada • Monstruo'
                    : '👑 Carta Desdoblada • Tesoro / Conjuro'}
                </span>
                <h3 className="font-cinzel font-black text-lg sm:text-xl text-[#f5e4be]">
                  {unfoldedCard.data.name}
                </h3>
              </div>

              <button
                type="button"
                data-testid="btn-close-unfolded-card"
                onClick={() => setUnfoldedCard(null)}
                className="p-1.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Unfolded Two-Leaf Body */}
            {unfoldedCard.kind === 'npc' && (
              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#c8a45c]/30 p-6 gap-6">
                {/* Left Leaf: Identity & Combat */}
                <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-3">
                      <EntityAvatar
                        avatarType={unfoldedCard.data.avatarType}
                        avatarCustomUrl={unfoldedCard.data.avatarCustomUrl}
                        avatarIcon={unfoldedCard.data.avatarIcon}
                        legacyAvatarUrl={unfoldedCard.data.avatarUrl}
                        name={unfoldedCard.data.name}
                        category="npc"
                        size="lg"
                        className="w-24 h-24 rounded-full border-2 border-[#e2c275]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAvatarCustomizerConfig({
                            isOpen: true,
                            title: `Retrato de ${unfoldedCard.data.name}`,
                            category: 'npc',
                            currentType: unfoldedCard.data.avatarType,
                            currentCustomUrl:
                              unfoldedCard.data.avatarCustomUrl || unfoldedCard.data.avatarUrl,
                            currentIconId: unfoldedCard.data.avatarIcon,
                            onSave: (avatarData) => {
                              const updatedNpc = {
                                ...unfoldedCard.data,
                                avatarType: avatarData.type,
                                avatarCustomUrl: avatarData.customUrl,
                                avatarIcon: avatarData.iconId,
                              };
                              onUpdateWorkspace({
                                ...workspace,
                                npcs: (workspace.npcs || []).map((n) =>
                                  n.id === updatedNpc.id ? updatedNpc : n
                                ),
                              });
                              setUnfoldedCard({ kind: 'npc', data: updatedNpc });
                            },
                          })
                        }
                        className="absolute bottom-0 right-0 p-1.5 rounded-full bg-amber-700 hover:bg-amber-600 text-white border border-[#f5e4be] shadow cursor-pointer"
                        title="Cambiar retrato"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="font-cinzel font-black text-xl text-[#f5e4be]">
                      {unfoldedCard.data.name}
                    </h4>
                    <p className="text-xs text-amber-300 font-semibold">
                      {unfoldedCard.data.race} • {unfoldedCard.data.occupation}
                    </p>
                    <span className="mt-1.5 px-3 py-0.5 rounded-full bg-amber-950/70 border border-[#c8a45c]/60 text-xs font-cinzel font-bold text-[#e2c275]">
                      Actitud: {unfoldedCard.data.attitude}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#14161f] p-3 rounded-xl border border-stone-800 text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 block">CA</span>
                      <strong className="text-[#f5e4be] text-sm">
                        {unfoldedCard.data.stats?.ac || 12}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">PG</span>
                      <strong className="text-emerald-400 text-sm">
                        {unfoldedCard.data.stats?.hp || 20}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">CR</span>
                      <strong className="text-amber-400 text-sm">
                        {unfoldedCard.data.stats?.cr || '1'}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleAddNpcToCombat(unfoldedCard.data, 'ally');
                        setUnfoldedCard(null);
                      }}
                      className="py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-200 text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>+ Aliado en Sala</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddNpcToCombat(unfoldedCard.data, 'enemy');
                        setUnfoldedCard(null);
                      }}
                      className="py-2 px-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-600/70 text-red-200 text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Skull className="w-3.5 h-3.5" />
                      <span>+ Enemigo en Sala</span>
                    </button>
                  </div>
                </div>

                {/* Right Leaf: Lore, DM Secrets & Actions */}
                <div className="md:col-span-7 md:pl-6 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#14161f] border border-stone-800">
                      <strong className="text-[#e2c275] font-cinzel uppercase block mb-0.5">
                        Apariencia y Personalidad:
                      </strong>
                      <p className="text-stone-300 leading-relaxed">
                        {unfoldedCard.data.appearance || 'Sin descripción física.'}{' '}
                        {unfoldedCard.data.personality}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-700/50">
                      <strong className="text-amber-300 font-cinzel uppercase block mb-0.5">
                        🔒 Secreto del DM / Gancho de Trama:
                      </strong>
                      <p className="text-amber-100/90 leading-relaxed">
                        {unfoldedCard.data.secretOrHook || 'Sin secreto registrado.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-[#14161f] border border-stone-800">
                        <strong className="text-stone-400 font-cinzel uppercase block mb-0.5">
                          Notas Privadas del DM:
                        </strong>
                        <p className="text-stone-300">
                          {unfoldedCard.data.notes || 'Sin notas adicionales.'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-purple-950/25 border border-purple-800/50">
                        <strong className="text-purple-300 font-cinzel uppercase block mb-0.5">
                          Evolución en Campaña:
                        </strong>
                        <p className="text-purple-200/90">
                          {unfoldedCard.data.evolution || 'Sin cambios registrados.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-stone-400">
                      Lugar: <strong className="text-amber-300">{unfoldedCard.data.folder}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const npc = unfoldedCard.data;
                          setUnfoldedCard(null);
                          setMovingEntity({
                            type: 'npc',
                            id: npc.id,
                            name: npc.name,
                            currentFolder: npc.folder || 'General',
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-cinzel font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const npc = unfoldedCard.data;
                          setUnfoldedCard(null);
                          openEditNpc(npc);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-cinzel font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar Carta</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const npcId = unfoldedCard.data.id;
                          onUpdateWorkspace({
                            ...workspace,
                            npcs: (workspace.npcs || []).filter((n) => n.id !== npcId),
                          });
                          setUnfoldedCard(null);
                        }}
                        className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 cursor-pointer"
                        title="Eliminar NPC"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {unfoldedCard.kind === 'monster' && (
              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#c8a45c]/30 p-6 gap-6">
                {/* Left Leaf: Monster Stats & Send to Table */}
                <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-center gap-4">
                    <EntityAvatar
                      avatarType={unfoldedCard.data.avatarType}
                      avatarCustomUrl={unfoldedCard.data.avatarCustomUrl}
                      avatarIcon={unfoldedCard.data.avatarIcon}
                      legacyAvatarUrl={unfoldedCard.data.avatarUrl}
                      name={unfoldedCard.data.name}
                      category="monster"
                      size="lg"
                      className="w-20 h-20 rounded-2xl border-2 border-red-500/70 shrink-0"
                    />
                    <div>
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700 text-xs font-mono font-bold">
                        CR {unfoldedCard.data.cr}
                      </span>
                      <h4 className="font-cinzel font-black text-lg text-[#f5e4be] mt-1">
                        {unfoldedCard.data.name}
                      </h4>
                      <p className="text-xs text-stone-400">
                        {unfoldedCard.data.size} • {unfoldedCard.data.type} •{' '}
                        {unfoldedCard.data.alignment}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#14161f] p-2.5 rounded-xl border border-stone-800 text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 block">CA</span>
                      <strong className="text-[#f5e4be] text-sm">{unfoldedCard.data.ac}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">PG Máx</span>
                      <strong className="text-red-400 text-sm">{unfoldedCard.data.maxHp}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">Velocidad</span>
                      <strong className="text-stone-200 text-xs">{unfoldedCard.data.speed}</strong>
                    </div>
                  </div>

                  {/* 6 Ability Scores */}
                  <div className="grid grid-cols-6 gap-1 bg-[#14161f] p-2 rounded-xl border border-stone-800 text-center font-mono text-[11px]">
                    {(
                      [
                        ['FUE', unfoldedCard.data.str],
                        ['DES', unfoldedCard.data.dex],
                        ['CON', unfoldedCard.data.con],
                        ['INT', unfoldedCard.data.int],
                        ['SAB', unfoldedCard.data.wis],
                        ['CAR', unfoldedCard.data.cha],
                      ] as const
                    ).map(([lbl, val]) => (
                      <div key={lbl}>
                        <span className="text-[9px] text-amber-400 block font-cinzel font-bold">
                          {lbl}
                        </span>
                        <strong className="text-stone-200">{val}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleAddMonsterToCombat(unfoldedCard.data, 'enemy');
                        setUnfoldedCard(null);
                      }}
                      className="py-2 px-3 rounded-xl bg-red-950 hover:bg-red-900 border border-red-600 text-red-100 text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <Skull className="w-3.5 h-3.5 text-red-400" />
                      <span>+ Enemigo a Mesa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddMonsterToCombat(unfoldedCard.data, 'ally');
                        setUnfoldedCard(null);
                      }}
                      className="py-2 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-600 text-emerald-100 text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>+ Aliado a Mesa</span>
                    </button>
                  </div>
                </div>

                {/* Right Leaf: Attacks, Traits & Notes */}
                <div className="md:col-span-7 md:pl-6 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <span className="text-xs font-cinzel font-bold text-[#e2c275] uppercase tracking-wider block">
                      ⚔️ Acciones y Ataques ({unfoldedCard.data.actions?.length || 0}):
                    </span>
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {(unfoldedCard.data.actions || []).map((act, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-[#14161f] border border-stone-800 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-cinzel font-bold text-amber-300 text-xs">
                              {act.name}
                            </div>
                            <div className="text-[11px] text-stone-400 font-mono">
                              +{act.toHit} al impacto • {act.damage} {act.damageType}
                            </div>
                            {act.description && (
                              <div className="text-[11px] text-stone-300 mt-0.5">
                                {act.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRollMonsterAttack(unfoldedCard.data, act)}
                            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-cinzel font-bold shrink-0 cursor-pointer shadow"
                          >
                            ⚔️ Tirar
                          </button>
                        </div>
                      ))}
                    </div>

                    {unfoldedCard.data.notes && (
                      <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-800/50 text-xs text-amber-200">
                        <strong className="text-amber-400 font-cinzel block mb-0.5">
                          Estrategia y Notas del DM:
                        </strong>
                        {unfoldedCard.data.notes}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-stone-400">
                      Lugar: <strong className="text-amber-300">{unfoldedCard.data.folder}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const mon = unfoldedCard.data;
                          setUnfoldedCard(null);
                          openEditMonster(mon);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-cinzel font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar Monstruo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const monId = unfoldedCard.data.id;
                          onUpdateWorkspace({
                            ...workspace,
                            monsters: (workspace.monsters || []).filter((m) => m.id !== monId),
                          });
                          setUnfoldedCard(null);
                        }}
                        className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {unfoldedCard.kind === 'item' && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-[#14161f] border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-cinzel font-bold text-amber-300 uppercase">
                        Categoría: {unfoldedCard.data.category || 'Tesoro'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-200 font-bold">
                        {unfoldedCard.data.rarity || 'Raro'}
                      </span>
                    </div>
                    <p className="text-stone-200 leading-relaxed">
                      {unfoldedCard.data.description}
                    </p>
                    {unfoldedCard.data.properties && (
                      <div className="p-2 rounded bg-[#10121a] border border-stone-800 text-amber-200 font-mono">
                        {unfoldedCard.data.properties}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/50 space-y-2">
                    <strong className="text-amber-300 font-cinzel uppercase block">
                      🔒 Secretos del DM y Ubicación:
                    </strong>
                    <p className="text-stone-300">
                      <strong>Quién lo tiene:</strong>{' '}
                      {unfoldedCard.data.whoHasIt || 'Sin portador asignado'}
                    </p>
                    <p className="text-stone-300">
                      <strong>Dónde se encuentra:</strong>{' '}
                      {unfoldedCard.data.whereFound || currentPlaceShortName}
                    </p>
                    {unfoldedCard.data.dmSecrets && (
                      <p className="text-amber-200/90 pt-1 border-t border-amber-900/40">
                        {unfoldedCard.data.dmSecrets}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                  <span className="text-xs font-mono text-stone-400">
                    Lugar: <strong className="text-amber-300">{unfoldedCard.data.folder}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCompendiumInitialTransferItem(unfoldedCard.data);
                        setUnfoldedCard(null);
                        setIsItemsCompendiumModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-cinzel font-bold flex items-center gap-1.5 shadow cursor-pointer"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Gestionar o Entregar a Jugador en Sala</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: GRAN TOMO DE CRÓNICAS (DM Chronicles Book Modal)           */}
      {/* =================================================================== */}
      {isChroniclesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181920] border-2 border-[#c8a45c] rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden text-stone-200 shadow-2xl">
            <div className="px-6 py-4 bg-[#13141b] border-b border-[#c8a45c]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#e2c275]" />
                <h3 className="font-cinzel font-black text-lg text-[#f5e4be]">
                  GRAN TOMO DE CRÓNICAS ({filteredLogs.length} Sesiones)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openAddLog}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-cinzel font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Entrada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsChroniclesModalOpen(false)}
                  className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm">
                  No hay crónicas registradas en este lugar. ¡Haz clic en "Nueva Entrada" para
                  iniciar la bitácora!
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-[#13151d] border border-[#c8a45c]/40 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded font-cinzel font-bold text-xs border ${
                            log.entryType === 'chapter'
                              ? 'bg-purple-950 text-purple-200 border-purple-600'
                              : log.entryType === 'summary'
                              ? 'bg-emerald-950 text-emerald-200 border-emerald-600'
                              : log.entryType === 'prologue'
                              ? 'bg-cyan-950 text-cyan-200 border-cyan-600'
                              : 'bg-amber-950 text-amber-300 border-amber-700'
                          }`}
                        >
                          {log.entryType === 'chapter'
                            ? `🏛️ Capítulo ${log.sessionNumber}`
                            : log.entryType === 'summary'
                            ? `📜 Resumen #${log.sessionNumber}`
                            : log.entryType === 'prologue'
                            ? `⏳ Prólogo`
                            : `📖 Sesión ${log.sessionNumber}`}
                        </span>
                        <h4 className="font-cinzel font-bold text-[#f5e4be] text-base">
                          {log.title}
                        </h4>
                      </div>
                      <span className="text-xs text-stone-400 font-mono">{log.date}</span>
                    </div>

                    <p className="text-xs text-stone-300 leading-relaxed">{log.summary}</p>

                    {log.publicNotes && (
                      <div className="p-3 rounded-xl bg-[#101117] border border-amber-900/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-cinzel font-bold text-amber-400">
                            Texto Público para Jugadores:
                          </span>
                          <button
                            type="button"
                            onClick={() => onBroadcastAnnouncement(log.title, log.publicNotes)}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-cinzel font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Radio className="w-3 h-3" />
                            <span>Transmitir a Jugadores</span>
                          </button>
                        </div>
                        <p className="text-xs text-amber-100/90 italic">{log.publicNotes}</p>
                      </div>
                    )}

                    {log.privateNotes && (
                      <div className="p-2.5 rounded-xl bg-red-950/25 border border-red-900/40 text-xs text-red-200">
                        <strong className="text-red-400">Secreto del DM:</strong> {log.privateNotes}
                      </div>
                    )}

                    <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs">
                      <span className="text-stone-400 font-mono">Lugar: {log.folder}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditLog(log)}
                          className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-300 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateWorkspace({
                              ...workspace,
                              campaignLogs: (workspace.campaignLogs || []).filter(
                                (l) => l.id !== log.id
                              ),
                            })
                          }
                          className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: MENSAJES DE JUGADOR                                        */}
      {/* =================================================================== */}
      {isPlayerMessagesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181920] border-2 border-[#c8a45c] rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-stone-200 shadow-2xl">
            <div className="px-6 py-4 bg-[#13141b] border-b border-[#c8a45c]/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <h3 className="font-cinzel font-black text-lg text-[#f5e4be]">
                  MENSAJES PRIVADOS DE JUGADORES ({resolvedPlayerMessages.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPlayerMessagesModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {resolvedPlayerMessages.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm">
                  Aún no hay susurros ni mensajes privados enviados por los jugadores en la sala.
                </div>
              ) : (
                resolvedPlayerMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl bg-[#13151d] border ${
                      !msg.readByDm ? 'border-purple-500' : 'border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-stone-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 font-cinzel font-bold text-xs">
                          {msg.characterName}
                        </span>
                        <span className="text-xs font-mono text-purple-300">
                          {msg.playerFullTag || msg.playerName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!msg.readByDm && (
                          <button
                            type="button"
                            onClick={() => {
                              if (onMarkPlayerMessageRead) onMarkPlayerMessageRead(msg.id);
                              onUpdateWorkspace({
                                ...workspace,
                                playerMessages: resolvedPlayerMessages.map((m) =>
                                  m.id === msg.id ? { ...m, readByDm: true } : m
                                ),
                              });
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold cursor-pointer"
                          >
                            ✓ Marcar Leído
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onDeletePlayerMessage) onDeletePlayerMessage(msg.id);
                            onUpdateWorkspace({
                              ...workspace,
                              playerMessages: resolvedPlayerMessages.filter((m) => m.id !== msg.id),
                            });
                          }}
                          className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-cinzel font-bold text-[#f5e4be] text-sm mb-1">
                      {msg.title}
                    </h4>
                    <p className="text-xs text-stone-300 whitespace-pre-wrap">{msg.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: COMPENDIO Y FORJA DE OBJETOS Y CONJUROS DEL DM             */}
      {/* =================================================================== */}
      {isItemsCompendiumModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181920] border-2 border-[#c8a45c] rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden text-stone-200 shadow-2xl">
            <div className="px-6 py-4 bg-[#13141b] border-b border-[#c8a45c]/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#e2c275]" />
                <h3 className="font-cinzel font-black text-lg text-[#f5e4be]">
                  TESOROS, OBJETOS Y CONJUROS DEL DM
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsItemsCompendiumModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <DMItemsAndSpellsView
                customItemsAndSpells={workspace.customItemsAndSpells || []}
                onUpdateItemsAndSpells={(updated) =>
                  onUpdateWorkspace({
                    ...workspace,
                    customItemsAndSpells: updated,
                  })
                }
                selectedFolder={selectedFolder}
                folders={workspace.folders || []}
                onGiveItemToPlayer={onGiveItemToPlayer}
                roomCode={roomCode}
                partyMembers={partyMembers}
                hasSrdDlcEnabled={installedDlcIds.includes('dlc-srd-5e-oficial')}
                onOpenDlcSettings={() => {
                  setIsItemsCompendiumModalOpen(false);
                  openDmTableSettingsModal();
                }}
                initialTransferItem={compendiumInitialTransferItem}
                onClearInitialTransferItem={() => setCompendiumInitialTransferItem(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: AÑADIR ALIADO / ENEMIGO RÁPIDO A LA SALA EN VIVO           */}
      {/* =================================================================== */}
      {isAddCombatantPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181920] border-2 border-[#c8a45c] rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden text-stone-200 shadow-2xl">
            <div className="px-5 py-3.5 bg-[#13141b] border-b border-[#c8a45c]/40 flex items-center justify-between">
              <h3 className="font-cinzel font-black text-base text-[#f5e4be]">
                {isAddCombatantPickerOpen === 'enemy'
                  ? '💀 Añadir Enemigo a la Sala en Vivo'
                  : '🛡️ Añadir Aliado a la Sala en Vivo'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCombatantPickerOpen(null)}
                className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Connected Players if adding Ally */}
              {isAddCombatantPickerOpen === 'ally' && partyMembers.length > 0 && (
                <div>
                  <span className="text-xs font-cinzel font-bold text-emerald-400 uppercase block mb-2">
                    Jugadores Conectados en Sala:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {partyMembers.map((pm) => (
                      <button
                        key={pm.characterId}
                        type="button"
                        onClick={() => {
                          handleSyncPartyMemberToCombat(pm);
                          setIsAddCombatantPickerOpen(null);
                        }}
                        className="p-2.5 rounded-xl bg-[#13151d] hover:bg-emerald-950/60 border border-emerald-700/60 text-left flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="font-cinzel font-bold text-xs text-stone-100">
                            {pm.characterName}
                          </div>
                          <div className="text-[10px] text-emerald-300 font-mono">
                            PG {pm.currentHp}/{pm.maxHp} • CA {pm.ac}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-emerald-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monsters from Bestiary */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-cinzel font-bold text-amber-300 uppercase">
                    Criaturas del Bestiario ({(workspace.monsters || []).length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddCombatantPickerOpen(null);
                      openAddMonster();
                    }}
                    className="text-xs font-cinzel font-bold text-amber-400 hover:underline cursor-pointer"
                  >
                    + Crear Nuevo Monstruo
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(workspace.monsters || []).map((mon) => (
                    <button
                      key={mon.id}
                      type="button"
                      onClick={() => {
                        handleAddMonsterToCombat(mon, isAddCombatantPickerOpen);
                        setIsAddCombatantPickerOpen(null);
                      }}
                      className="p-2.5 rounded-xl bg-[#13151d] hover:bg-[#1f2330] border border-stone-700 hover:border-[#c8a45c] text-left flex items-center justify-between transition cursor-pointer"
                    >
                      <div>
                        <div className="font-cinzel font-bold text-xs text-[#f5e4be]">
                          {mon.name}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          CR {mon.cr} • PG {mon.maxHp} • CA {mon.ac}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-[#e2c275]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: DETALLE DE INICIATIVA Y COMBATIENTES                       */}
      {/* =================================================================== */}
      {isInitiativeDetailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181920] border-2 border-[#c8a45c] rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-stone-200 shadow-2xl">
            <div className="px-5 py-3.5 bg-[#13141b] border-b border-[#c8a45c]/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#e2c275]" />
                <h3 className="font-cinzel font-black text-base text-[#f5e4be]">
                  ORDEN DE INICIATIVA • RONDA {activeEncounter.round}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSortInitiative}
                  className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-cinzel font-bold cursor-pointer"
                >
                  Ordenar por Iniciativa
                </button>
                <button
                  type="button"
                  onClick={() => setIsInitiativeDetailModalOpen(false)}
                  className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-2">
              {activeEncounter.combatants.map((c, idx) => {
                const isCurrent = idx === activeEncounter.currentTurnIndex;
                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      isCurrent
                        ? 'bg-amber-950/40 border-amber-400'
                        : 'bg-[#13151d] border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-stone-800 text-amber-300 font-mono text-xs font-bold flex items-center justify-center">
                        {c.initiative}
                      </span>
                      <div>
                        <div className="font-cinzel font-bold text-sm text-[#f5e4be]">
                          {c.name}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          CA {c.ac} • PG {c.hp}/{c.maxHp}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateCombatantHp(c.id, -5)}
                        className="px-2 py-1 rounded bg-red-950 text-red-300 text-xs font-mono font-bold cursor-pointer"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateCombatantHp(c.id, -1)}
                        className="px-2 py-1 rounded bg-red-950 text-red-300 text-xs font-mono font-bold cursor-pointer"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateCombatantHp(c.id, 1)}
                        className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 text-xs font-mono font-bold cursor-pointer"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateCombatantHp(c.id, 5)}
                        className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 text-xs font-mono font-bold cursor-pointer"
                      >
                        +5
                      </button>
                      {!c.isPlayer && (
                        <button
                          type="button"
                          onClick={() => handleToggleCombatantFaction(c.id)}
                          className="px-2 py-1 rounded bg-stone-800 text-[10px] font-mono text-stone-300 cursor-pointer"
                        >
                          {c.faction === 'ally' ? '🟢 Aliado' : '🔴 Enemigo'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCombatant(c.id)}
                        className="p-1 text-stone-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 7: DETALLE DE RESUMEN DE GUERRA                               */}
      {/* =================================================================== */}
      {selectedWarSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181920] border-2 border-[#c8a45c] rounded-3xl max-w-xl w-full p-6 text-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-cinzel uppercase text-amber-400 block">
                  Resumen de Guerra • {selectedWarSummary.date}
                </span>
                <h3 className="font-cinzel font-black text-lg text-[#f5e4be]">
                  {selectedWarSummary.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWarSummary(null)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div>
                <strong className="text-amber-300">Rondas Totales:</strong>{' '}
                {selectedWarSummary.roundsCount}
              </div>
              <div>
                <strong className="text-amber-300">Participantes:</strong>{' '}
                {(selectedWarSummary.participants || []).join(', ') || 'Ninguno'}
              </div>
              <div className="p-3 rounded-xl bg-[#13151d] border border-stone-800">
                <strong className="text-stone-400 block mb-1">Notas del Encuentro:</strong>
                {selectedWarSummary.notes}
              </div>
              {selectedWarSummary.logEvents && selectedWarSummary.logEvents.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 p-2.5 rounded-xl bg-[#111218] border border-stone-800">
                  {selectedWarSummary.logEvents.map((ev) => (
                    <div key={ev.id} className="text-[11px] text-stone-300">
                      <strong className="text-amber-400">R{ev.round}:</strong> {ev.note}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => {
                  const id = selectedWarSummary.id;
                  onUpdateWorkspace({
                    ...workspace,
                    combatSummaries: (workspace.combatSummaries || []).filter((s) => s.id !== id),
                  });
                  setSelectedWarSummary(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-200 text-xs font-cinzel font-bold cursor-pointer"
              >
                Eliminar Resumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EXISTING MODALS: RESET COMBAT, NPC, MONSTER, LOCATION, LOG, FOLDERS */}
      {/* =================================================================== */}

      {/* RESET COMBAT MODAL */}
      {showResetCombatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border border-amber-600/80 rounded-2xl max-w-md w-full p-5 text-stone-200 shadow-2xl">
            <h3 className="text-lg font-cinzel font-bold text-amber-300 mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              Reiniciar Ronda y Bitácora
            </h3>
            <p className="text-xs text-stone-300 mb-4 leading-relaxed">
              La ronda actual es <strong>Ronda {activeEncounter.round}</strong>. Al reiniciar, la
              ronda vuelve a 1 y se limpia el registro de la bitácora en vivo.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleResetEncounter(false)}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs transition shadow text-left cursor-pointer"
              >
                Reiniciar a Ronda 1 y limpiar bitácora (Mantener combatientes)
              </button>
              <button
                type="button"
                onClick={() => handleResetEncounter(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 font-cinzel font-bold text-xs transition text-left cursor-pointer"
              >
                Limpiar todo el combate (Ronda 1, limpiar bitácora y vaciar combatientes)
              </button>
              <button
                type="button"
                onClick={() => setShowResetCombatModal(false)}
                className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition mt-2 text-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NPC MODAL (ADD / EDIT) */}
      {showNpcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border-2 border-amber-800/80 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 text-stone-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
              <h3 className="text-base font-cinzel font-bold text-amber-300">
                {editingNpcId ? 'Editar NPC' : 'Nuevo NPC'}
              </h3>
              <button
                type="button"
                onClick={handleAiAssistNpc}
                disabled={isGeneratingAi}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                <Sparkles
                  className={`w-3.5 h-3.5 text-purple-400 ${isGeneratingAi ? 'animate-spin' : ''}`}
                />
                <span>{isGeneratingAi ? 'Rellenando...' : 'Completar con IA'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="Nombre del NPC"
                value={npcForm.name || ''}
                onChange={(e) => setNpcForm({ ...npcForm, name: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <input
                type="text"
                placeholder="Raza (ej. Enano, Elfo)"
                value={npcForm.race || ''}
                onChange={(e) => setNpcForm({ ...npcForm, race: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <input
                type="text"
                placeholder="Oficio / Rol (ej. Tabernero)"
                value={npcForm.occupation || ''}
                onChange={(e) => setNpcForm({ ...npcForm, occupation: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <select
                value={npcForm.attitude || 'Neutral'}
                onChange={(e) => setNpcForm({ ...npcForm, attitude: e.target.value as any })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              >
                <option value="Aliado">Aliado</option>
                <option value="Amistoso">Amistoso</option>
                <option value="Neutral">Neutral</option>
                <option value="Desconfiado">Desconfiado</option>
                <option value="Hostil">Hostil</option>
              </select>
              <input
                type="text"
                placeholder="Ubicación o Lugar exacto"
                value={npcForm.location || ''}
                onChange={(e) => setNpcForm({ ...npcForm, location: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <select
                value={npcForm.folder || 'General'}
                onChange={(e) => setNpcForm({ ...npcForm, folder: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              >
                <option value="General">General</option>
                {(workspace.folders || []).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Imagen / PNG del NPC (Archivo o URL) */}
            <div className="mb-2 p-2.5 rounded-lg bg-[#121316] border border-stone-700/80 space-y-1.5">
              <label className="text-[11px] font-cinzel font-bold text-amber-300 uppercase flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Imagen / PNG del NPC (Subir Archivo o URL):</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {npcForm.avatarCustomUrl && (
                  <img
                    src={npcForm.avatarCustomUrl}
                    alt="Retrato NPC"
                    className="w-10 h-10 rounded-lg object-cover border border-amber-500/60 shrink-0"
                  />
                )}
                <label className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 text-amber-200 text-xs font-cinzel font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Archivo PNG / Imagen</span>
                  <input
                    type="file"
                    data-testid="input-npc-modal-file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await compressImageFileToDataUrl(file, 420, 0.82);
                        setNpcForm((prev) => ({
                          ...prev,
                          avatarType: 'custom',
                          avatarCustomUrl: dataUrl,
                        }));
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
                <input
                  type="text"
                  placeholder="O pega URL de imagen (https://...)"
                  value={npcForm.avatarCustomUrl || ''}
                  onChange={(e) =>
                    setNpcForm({
                      ...npcForm,
                      avatarType: e.target.value.trim() ? 'custom' : npcForm.avatarType,
                      avatarCustomUrl: e.target.value,
                    })
                  }
                  className="flex-1 min-w-[160px] bg-[#181920] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-100"
                />
                {npcForm.avatarCustomUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setNpcForm({
                        ...npcForm,
                        avatarType: 'icon',
                        avatarCustomUrl: '',
                      })
                    }
                    className="px-2 py-1 rounded bg-red-950/50 border border-red-800/60 text-red-300 text-[10px] hover:bg-red-900/50 cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <textarea
              placeholder="Descripción física y apariencia..."
              value={npcForm.appearance || ''}
              onChange={(e) => setNpcForm({ ...npcForm, appearance: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 mb-2"
            />
            <textarea
              placeholder="Personalidad y modo de hablar..."
              value={npcForm.personality || ''}
              onChange={(e) => setNpcForm({ ...npcForm, personality: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 mb-2"
            />
            <textarea
              placeholder="Secreto del DM o Gancho de Misión..."
              value={npcForm.secretOrHook || ''}
              onChange={(e) => setNpcForm({ ...npcForm, secretOrHook: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-amber-900/60 rounded-lg px-3 py-2 text-xs text-amber-200 mb-3"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-cinzel font-bold text-stone-400 uppercase block mb-1">
                  1. Notas Privadas del DM:
                </label>
                <textarea
                  value={npcForm.notes || ''}
                  onChange={(e) => setNpcForm({ ...npcForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-cinzel font-bold text-purple-400 uppercase block mb-1">
                  2. Evolución en Campaña:
                </label>
                <textarea
                  value={npcForm.evolution || ''}
                  onChange={(e) => setNpcForm({ ...npcForm, evolution: e.target.value })}
                  rows={2}
                  className="w-full bg-[#121316] border border-purple-900/60 rounded-lg px-3 py-2 text-xs text-purple-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowNpcModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!npcForm.name?.trim()) return;
                  if (editingNpcId) {
                    onUpdateWorkspace({
                      ...workspace,
                      npcs: (workspace.npcs || []).map((n) =>
                        n.id === editingNpcId ? ({ ...n, ...npcForm } as NPCRecord) : n
                      ),
                    });
                  } else {
                    const newNpc: NPCRecord = {
                      id: `npc-${Date.now()}`,
                      name: npcForm.name.trim(),
                      folder: npcForm.folder || 'General',
                      race: npcForm.race || 'Humano',
                      occupation: npcForm.occupation || 'Habitante',
                      attitude: npcForm.attitude || 'Neutral',
                      location: npcForm.location || 'Local',
                      appearance: npcForm.appearance || '',
                      personality: npcForm.personality || '',
                      secretOrHook: npcForm.secretOrHook || '',
                      notes: npcForm.notes || '',
                      evolution: npcForm.evolution || '',
                      avatarType: npcForm.avatarCustomUrl ? 'custom' : (npcForm.avatarType === 'custom' ? 'custom' : 'icon'),
                      avatarCustomUrl: npcForm.avatarCustomUrl || undefined,
                    };
                    onUpdateWorkspace({
                      ...workspace,
                      npcs: [...(workspace.npcs || []), newNpc],
                    });
                  }
                  setShowNpcModal(false);
                }}
                className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                Guardar NPC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MONSTER MODAL (ADD / EDIT) */}
      {showMonsterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border-2 border-amber-800/80 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 text-stone-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
              <h3 className="text-base font-cinzel font-bold text-amber-300">
                {editingMonsterId ? 'Editar Monstruo' : 'Nuevo Monstruo / Criatura'}
              </h3>
              <button
                type="button"
                onClick={handleAiAssistMonster}
                disabled={isGeneratingAi}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                <Sparkles
                  className={`w-3.5 h-3.5 text-purple-400 ${isGeneratingAi ? 'animate-spin' : ''}`}
                />
                <span>{isGeneratingAi ? 'Generando...' : 'Completar con IA'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <input
                type="text"
                placeholder="Nombre (ej. Orco Guerrero)"
                value={monsterForm.name || ''}
                onChange={(e) => setMonsterForm({ ...monsterForm, name: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 col-span-2"
              />
              <input
                type="text"
                placeholder="CR (ej. 1/2, 2)"
                value={monsterForm.cr || ''}
                onChange={(e) => setMonsterForm({ ...monsterForm, cr: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <select
                value={monsterForm.folder || 'General'}
                onChange={(e) => setMonsterForm({ ...monsterForm, folder: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              >
                <option value="General">General</option>
                {(workspace.folders || []).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <input
                type="number"
                placeholder="CA"
                value={monsterForm.ac || 12}
                onChange={(e) =>
                  setMonsterForm({ ...monsterForm, ac: parseInt(e.target.value, 10) || 10 })
                }
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <input
                type="number"
                placeholder="PG Máx"
                value={monsterForm.maxHp || 15}
                onChange={(e) => {
                  const hp = parseInt(e.target.value, 10) || 10;
                  setMonsterForm({ ...monsterForm, maxHp: hp, hp });
                }}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <input
                type="text"
                placeholder="Velocidad (ej. 30 pies)"
                value={monsterForm.speed || ''}
                onChange={(e) => setMonsterForm({ ...monsterForm, speed: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
            </div>

            {/* Monster Image Upload / URL */}
            <div className="p-3 rounded-xl bg-[#13141a] border border-stone-800 mb-3 space-y-2">
              <span className="text-xs font-cinzel font-bold text-amber-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Imagen del Monstruo / Criatura (Opcional):</span>
              </span>
              <div className="flex items-center gap-2.5 flex-wrap">
                {(monsterForm.imageUrl || monsterForm.avatarCustomUrl) && (
                  <div className="relative">
                    <img
                      src={monsterForm.imageUrl || monsterForm.avatarCustomUrl}
                      alt="Monstruo"
                      className="w-12 h-12 rounded-lg object-cover border border-red-500/60"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMonsterForm({
                          ...monsterForm,
                          imageUrl: '',
                          avatarCustomUrl: '',
                        })
                      }
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[9px]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <label className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-amber-200 text-xs font-cinzel font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await compressImageFileToDataUrl(file, 360, 0.82);
                        setMonsterForm((prev) => ({
                          ...prev,
                          imageUrl: dataUrl,
                          avatarCustomUrl: dataUrl,
                          avatarType: 'custom',
                        }));
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={monsterForm.imageUrl || monsterForm.avatarCustomUrl || ''}
                  onChange={(e) =>
                    setMonsterForm({
                      ...monsterForm,
                      imageUrl: e.target.value,
                      avatarCustomUrl: e.target.value,
                      avatarType: e.target.value.trim() ? 'custom' : monsterForm.avatarType,
                    })
                  }
                  placeholder="O pega URL de imagen (https://...)"
                  className="flex-1 min-w-[180px] bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
              </div>
            </div>

            {/* Attacks builder */}
            <div className="bg-[#13141a] border border-stone-800 rounded-xl p-3 mb-3">
              <span className="text-xs font-cinzel font-bold text-amber-300 block mb-2">
                Ataques de la Criatura ({monsterForm.actions?.length || 0})
              </span>
              <div className="space-y-1.5 mb-2">
                {(monsterForm.actions || []).map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#181920] px-3 py-1.5 rounded border border-stone-800 text-xs"
                  >
                    <span>
                      <strong className="text-amber-300">{act.name}</strong> (+{act.toHit} •{' '}
                      {act.damage} {act.damageType})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMonsterForm({
                          ...monsterForm,
                          actions: (monsterForm.actions || []).filter((_, i) => i !== idx),
                        })
                      }
                      className="text-stone-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Ataque (ej. Mordisco)"
                  value={newAttack.name || ''}
                  onChange={(e) => setNewAttack({ ...newAttack, name: e.target.value })}
                  className="bg-[#121316] border border-stone-700 rounded px-2.5 py-1.5 text-xs"
                />
                <input
                  type="number"
                  placeholder="Bono (+4)"
                  value={newAttack.toHit ?? 4}
                  onChange={(e) =>
                    setNewAttack({ ...newAttack, toHit: parseInt(e.target.value, 10) || 0 })
                  }
                  className="bg-[#121316] border border-stone-700 rounded px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Daño (ej. 1d8+2)"
                  value={newAttack.damage || ''}
                  onChange={(e) => setNewAttack({ ...newAttack, damage: e.target.value })}
                  className="bg-[#121316] border border-stone-700 rounded px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newAttack.name?.trim()) return;
                    setMonsterForm({
                      ...monsterForm,
                      actions: [
                        ...(monsterForm.actions || []),
                        {
                          id: `atk-${Date.now()}`,
                          name: newAttack.name.trim(),
                          type: newAttack.type || 'melee',
                          toHit: newAttack.toHit ?? 4,
                          damage: newAttack.damage || '1d6+2',
                          damageType: newAttack.damageType || 'Cortante',
                        },
                      ],
                    });
                    setNewAttack({ name: '', type: 'melee', toHit: 4, damage: '1d6+2' });
                  }}
                  className="px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-cinzel font-bold cursor-pointer"
                >
                  + Añadir Ataque
                </button>
              </div>
            </div>

            <textarea
              placeholder="Notas tácticas y estrategia del DM..."
              value={monsterForm.notes || ''}
              onChange={(e) => setMonsterForm({ ...monsterForm, notes: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 mb-3"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowMonsterModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!monsterForm.name?.trim()) return;
                  if (editingMonsterId) {
                    onUpdateWorkspace({
                      ...workspace,
                      monsters: (workspace.monsters || []).map((m) =>
                        m.id === editingMonsterId ? ({ ...m, ...monsterForm } as MonsterRecord) : m
                      ),
                    });
                  } else {
                    const newMon: MonsterRecord = {
                      id: `mon-${Date.now()}`,
                      name: monsterForm.name.trim(),
                      cr: monsterForm.cr || '1',
                      size: (monsterForm.size as any) || 'Mediano',
                      type: monsterForm.type || 'Monstruosidad',
                      alignment: monsterForm.alignment || 'Neutral',
                      ac: monsterForm.ac || 13,
                      hp: monsterForm.maxHp || 20,
                      maxHp: monsterForm.maxHp || 20,
                      speed: monsterForm.speed || '30 pies',
                      str: monsterForm.str || 14,
                      dex: monsterForm.dex || 12,
                      con: monsterForm.con || 14,
                      int: monsterForm.int || 10,
                      wis: monsterForm.wis || 10,
                      cha: monsterForm.cha || 10,
                      traits: monsterForm.traits || [],
                      actions: monsterForm.actions || [],
                      folder: monsterForm.folder || 'General',
                      notes: monsterForm.notes || '',
                      imageUrl: monsterForm.imageUrl?.trim() || undefined,
                      avatarCustomUrl:
                        monsterForm.imageUrl?.trim() || monsterForm.avatarCustomUrl?.trim() || undefined,
                      avatarType:
                        monsterForm.imageUrl?.trim() || monsterForm.avatarCustomUrl?.trim()
                          ? 'custom'
                          : monsterForm.avatarType,
                    };
                    onUpdateWorkspace({
                      ...workspace,
                      monsters: [...(workspace.monsters || []), newMon],
                    });
                  }
                  setShowMonsterModal(false);
                }}
                className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                Guardar Monstruo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCATION / MAP MODAL (ADD / EDIT) */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border-2 border-amber-800/80 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 text-stone-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
              <h3 className="text-base font-cinzel font-bold text-amber-300">
                {editingLocationId ? 'Editar Mapa / Zona del Atlas' : 'Nueva Zona / Mapa Táctico'}
              </h3>
              <button
                type="button"
                onClick={handleAiAssistLocation}
                disabled={isGeneratingAi}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                <Sparkles
                  className={`w-3.5 h-3.5 text-purple-400 ${isGeneratingAi ? 'animate-spin' : ''}`}
                />
                <span>{isGeneratingAi ? 'Generando...' : 'Completar con IA'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="Nombre de la Zona (ej. Taberna Piso 1)"
                value={locationForm.name || ''}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <input
                type="text"
                placeholder="Tipo (ej. Taberna, Mazmorra)"
                value={locationForm.type || ''}
                onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <select
                value={locationForm.folder || 'General'}
                onChange={(e) => setLocationForm({ ...locationForm, folder: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              >
                <option value="General">General</option>
                {(workspace.folders || []).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3 p-2.5 rounded-lg bg-[#121316] border border-stone-700/80 space-y-1.5">
              <label className="text-[11px] font-cinzel font-bold text-amber-300 uppercase flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Imagen / PNG del Mapa del Lugar (Subir Archivo o URL):</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {locationForm.mapImageUrl && (
                  <img
                    src={locationForm.mapImageUrl}
                    alt="Vista previa mapa"
                    className="w-10 h-10 rounded-lg object-cover border border-amber-500/60 shrink-0"
                  />
                )}
                <label className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 text-amber-200 text-xs font-cinzel font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Archivo PNG / Imagen</span>
                  <input
                    type="file"
                    data-testid="input-location-modal-file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await compressImageFileToDataUrl(file, 1440, 0.85);
                        setLocationForm((prev) => ({ ...prev, mapImageUrl: dataUrl }));
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
                <input
                  type="text"
                  placeholder="URL de Imagen de Mapa (opcional)"
                  value={locationForm.mapImageUrl || ''}
                  onChange={(e) => setLocationForm({ ...locationForm, mapImageUrl: e.target.value })}
                  className="flex-1 min-w-[160px] bg-[#181920] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                {locationForm.mapImageUrl && (
                  <button
                    type="button"
                    onClick={() => setLocationForm({ ...locationForm, mapImageUrl: '' })}
                    className="px-2 py-1 rounded bg-red-950/50 border border-red-800/60 text-red-300 text-[10px] hover:bg-red-900/50 cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <textarea
              placeholder="Descripción ambiental del lugar..."
              value={locationForm.description || ''}
              onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 mb-2"
            />
            <textarea
              placeholder="Secretos y trampas para el DM..."
              value={locationForm.secretsForDm || ''}
              onChange={(e) => setLocationForm({ ...locationForm, secretsForDm: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-amber-900/60 rounded-lg px-3 py-2 text-xs text-amber-200 mb-3"
            />

            {/* Points of Interest Pins */}
            <div className="mb-3">
              <label className="text-xs font-cinzel font-bold text-stone-300 block mb-1">
                Pines de Puntos Clave en el Atlas:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(locationForm.pointsOfInterest || []).map((poi, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700 text-amber-200 text-xs flex items-center gap-1"
                  >
                    📍 {poi}
                    <button
                      type="button"
                      onClick={() =>
                        setLocationForm({
                          ...locationForm,
                          pointsOfInterest: (locationForm.pointsOfInterest || []).filter(
                            (_, idx) => idx !== i
                          ),
                        })
                      }
                      className="text-stone-400 hover:text-white ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. Barra Principal, Sótano..."
                  value={newPoiInput}
                  onChange={(e) => setNewPoiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPoiInput.trim()) {
                      e.preventDefault();
                      setLocationForm({
                        ...locationForm,
                        pointsOfInterest: [
                          ...(locationForm.pointsOfInterest || []),
                          newPoiInput.trim(),
                        ],
                      });
                      setNewPoiInput('');
                    }
                  }}
                  className="flex-1 bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newPoiInput.trim()) return;
                    setLocationForm({
                      ...locationForm,
                      pointsOfInterest: [
                        ...(locationForm.pointsOfInterest || []),
                        newPoiInput.trim(),
                      ],
                    });
                    setNewPoiInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-cinzel font-bold cursor-pointer"
                >
                  + Pin
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!locationForm.name?.trim()) return;
                  if (editingLocationId) {
                    onUpdateWorkspace({
                      ...workspace,
                      locations: (workspace.locations || []).map((l) =>
                        l.id === editingLocationId
                          ? ({ ...l, ...locationForm } as LocationRecord)
                          : l
                      ),
                    });
                  } else {
                    const newLoc: LocationRecord = {
                      id: `loc-${Date.now()}`,
                      name: locationForm.name.trim(),
                      region: locationForm.region || currentPlaceShortName,
                      type: locationForm.type || 'Zona',
                      description: locationForm.description || '',
                      secretsForDm: locationForm.secretsForDm || '',
                      notes: locationForm.notes || '',
                      evolution: locationForm.evolution || '',
                      pointsOfInterest: locationForm.pointsOfInterest || [],
                      mapImageUrl: locationForm.mapImageUrl || '',
                      folder: locationForm.folder || 'General',
                    };
                    onUpdateWorkspace({
                      ...workspace,
                      locations: [...(workspace.locations || []), newLoc],
                    });
                    setProjectedLocationId(newLoc.id);
                  }
                  setShowLocationModal(false);
                }}
                className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                Guardar Zona
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGN LOG MODAL (ADD / EDIT) */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border-2 border-amber-800/80 rounded-2xl max-w-xl w-full p-5 text-stone-200 shadow-2xl">
            <h3 className="text-base font-cinzel font-bold text-amber-300 mb-3">
              {editingLogId ? 'Editar Entrada de Crónica' : 'Nueva Entrada de Crónica'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
              <select
                data-testid="select-chronicle-entry-type"
                value={logForm.entryType || 'session'}
                onChange={(e) =>
                  setLogForm({
                    ...logForm,
                    entryType: e.target.value as ChronicleEntryType,
                  })
                }
                className="bg-[#121316] border border-amber-700/70 rounded-lg px-3 py-2 text-xs font-cinzel font-bold text-amber-200"
              >
                <option value="session">📖 Entrada de Sesión</option>
                <option value="chapter">🏛️ Capítulo</option>
                <option value="summary">📜 Resumen de Sesiones</option>
                <option value="prologue">⏳ Prólogo / Historia Previa</option>
              </select>
              <input
                type="number"
                placeholder="Número #"
                value={logForm.sessionNumber || 1}
                onChange={(e) =>
                  setLogForm({ ...logForm, sessionNumber: parseInt(e.target.value, 10) || 1 })
                }
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <input
                type="text"
                placeholder="Título (ej. Capítulo I: El Despertar)"
                value={logForm.title || ''}
                onChange={(e) => setLogForm({ ...logForm, title: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 sm:col-span-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Fecha en el mundo"
                value={logForm.date || ''}
                onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              />
              <select
                value={logForm.folder || 'General'}
                onChange={(e) => setLogForm({ ...logForm, folder: e.target.value })}
                className="bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              >
                <option value="General">General</option>
                {(workspace.folders || []).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Resumen de lo ocurrido en la sesión..."
              value={logForm.summary || ''}
              onChange={(e) => setLogForm({ ...logForm, summary: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 mb-2"
            />
            <textarea
              placeholder="Texto público para revelar/transmitir a los jugadores..."
              value={logForm.publicNotes || ''}
              onChange={(e) => setLogForm({ ...logForm, publicNotes: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-amber-900/60 rounded-lg px-3 py-2 text-xs text-amber-200 mb-2"
            />
            <textarea
              placeholder="Notas secretas del DM..."
              value={logForm.privateNotes || ''}
              onChange={(e) => setLogForm({ ...logForm, privateNotes: e.target.value })}
              rows={2}
              className="w-full bg-[#121316] border border-red-900/60 rounded-lg px-3 py-2 text-xs text-red-200 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!logForm.title?.trim()) return;
                  if (editingLogId) {
                    onUpdateWorkspace({
                      ...workspace,
                      campaignLogs: (workspace.campaignLogs || []).map((l) =>
                        l.id === editingLogId ? ({ ...l, ...logForm } as CampaignLogEntry) : l
                      ),
                    });
                  } else {
                    const newEntry: CampaignLogEntry = {
                      id: `log-${Date.now()}`,
                      sessionNumber: logForm.sessionNumber || 1,
                      entryType: logForm.entryType || 'session',
                      title: logForm.title.trim(),
                      date: logForm.date || 'Día de Aventura',
                      summary: logForm.summary || '',
                      publicNotes: logForm.publicNotes || '',
                      privateNotes: logForm.privateNotes || '',
                      tags: logForm.tags || ['Aventura'],
                      folder: logForm.folder || 'General',
                    };
                    onUpdateWorkspace({
                      ...workspace,
                      campaignLogs: [newEntry, ...(workspace.campaignLogs || [])],
                    });
                  }
                  setShowLogModal(false);
                }}
                className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-cinzel font-bold transition shadow cursor-pointer"
              >
                Guardar Crónica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE ENTITY FOLDER MODAL */}
      {movingEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border border-amber-700 rounded-2xl max-w-md w-full p-5 text-stone-200 shadow-2xl">
            <h3 className="font-cinzel font-bold text-base text-amber-300 mb-2">
              Mover "{movingEntity.name}" a otro Lugar del Atlas
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto my-3">
              {['General', ...(workspace.folders || [])].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleMoveEntityFolder(f)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                    movingEntity.currentFolder === f
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-[#121316] hover:bg-stone-800 text-stone-300'
                  }`}
                >
                  <span>📍 {f}</span>
                  {movingEntity.currentFolder === f && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMovingEntity(null)}
              className="w-full py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: MAPA CUADRADO (1:1) Y EDITOR DE PUNTOS DE SUB-LUGARES        */}
      {/* =================================================================== */}
      {isAtlasMapModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsAtlasMapModalOpen(false)}
        >
          <div
            data-testid="modal-atlas-square-map"
            className="w-full max-w-4xl rounded-2xl bg-[#14161f] border-2 border-[#c8a45c] p-5 shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c8a45c]/30">
              <div>
                <h3 className="font-cinzel font-black text-base sm:text-lg text-[#f5e4be] uppercase flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#e2c275]" />
                  <span>MAPA CUADRADO (1:1): {currentPlaceShortName}</span>
                </h3>
                <p className="text-xs text-stone-400">
                  Sube tu propio mapa en PNG o JPG para este lugar y haz clic sobre el mapa cuadrado para ubicar dónde están sus sub-lugares.
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-close-square-map"
                onClick={() => setIsAtlasMapModalOpen(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left 7 Cols: Interactive 1:1 Square Map Canvas */}
              <div className="md:col-span-7 flex flex-col items-center">
                <div
                  data-testid="square-map-canvas"
                  onClick={(e) => {
                    if (!selectedPinToMove) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
                    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
                    handleUpdatePinPosition(selectedPinToMove, clickX, clickY);
                  }}
                  className={`relative w-full max-w-[440px] aspect-square rounded-2xl overflow-hidden border-2 border-[#c8a45c] bg-gradient-to-br from-[#2d2418] via-[#211b13] to-[#14110d] shadow-[0_0_30px_rgba(0,0,0,0.9)] ${
                    selectedPinToMove ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  {currentPlaceMapUrl ? (
                    <img
                      src={currentPlaceMapUrl}
                      alt={`Mapa 1:1 de ${currentPlaceShortName}`}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                  ) : null}

                  {/* Square 1:1 Grid Overlay */}
                  <svg
                    viewBox="0 0 400 400"
                    className={`absolute inset-0 w-full h-full pointer-events-none ${
                      currentPlaceMapUrl ? 'opacity-35' : 'opacity-85'
                    }`}
                  >
                    <defs>
                      <pattern id="squareAtlasGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="#e2c275"
                          strokeWidth="0.6"
                          strokeOpacity="0.4"
                        />
                      </pattern>
                    </defs>
                    <rect width="400" height="400" fill="url(#squareAtlasGrid)" />
                    {!currentPlaceMapUrl && (
                      <>
                        <path
                          d="M 40 50 L 180 50 L 180 180 L 40 180 Z M 220 70 L 360 70 L 360 320 L 220 320 Z M 50 230 L 190 230 L 190 350 L 50 350 Z"
                          fill="#1a150f"
                          fillOpacity="0.55"
                          stroke="#e2c275"
                          strokeWidth="1.5"
                          strokeOpacity="0.65"
                        />
                        <path
                          d="M 0 205 Q 110 190, 200 205 T 400 195"
                          fill="none"
                          stroke="#c8a45c"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                          strokeOpacity="0.5"
                        />
                      </>
                    )}
                  </svg>

                  {/* Sub-place Pins on the 1:1 Square Map */}
                  {childFolders.map((subFolder, idx) => {
                    const parts = subFolder.split('/').map((s) => s.trim());
                    const shortLabel = parts[parts.length - 1];
                    const pos = getPinPositionForChildPlace(
                      subFolder,
                      idx,
                      childFolders.length,
                      workspace.atlasPinPositions
                    );
                    const isSelectedForMove = selectedPinToMove === subFolder;
                    return (
                      <button
                        key={subFolder}
                        type="button"
                        data-testid={`square-pin-${shortLabel}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPinToMove(subFolder);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedFolder(subFolder);
                          setIsAtlasMapModalOpen(false);
                        }}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-xl transition cursor-pointer whitespace-nowrap ${
                          isSelectedForMove
                            ? 'bg-amber-500 text-stone-950 border-2 border-white scale-110 ring-4 ring-amber-400/50 z-30'
                            : 'bg-[#171821]/95 hover:bg-amber-950/95 border border-[#c8a45c] text-[#f5e4be] z-20'
                        }`}
                        title="Clic para seleccionar y mover • Doble clic para entrar a este sub-lugar"
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{shortLabel}</span>
                      </button>
                    );
                  })}

                  {/* Bottom helper banner */}
                  <div className="absolute bottom-2 inset-x-2 px-3 py-1.5 rounded-lg bg-black/80 border border-[#c8a45c]/40 text-[11px] text-amber-200 flex items-center justify-between pointer-events-none">
                    <span>
                      {selectedPinToMove
                        ? `🎯 Moviendo: "${selectedPinToMove.split('/').pop()?.trim()}" (Haz clic en cualquier punto del mapa)`
                        : 'Selecciona un sub-lugar a la derecha para ubicar su punto'}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">1:1</span>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Upload PNG/JPG Map + Sub-place Pin Coordinates */}
              <div className="md:col-span-5 space-y-4">
                {/* 1. Subir Mapa PNG/JPG para este lugar y poner en cola */}
                <div className="p-3.5 rounded-xl bg-[#191c28] border border-[#c8a45c]/50 space-y-2.5">
                  <div className="font-cinzel font-bold text-xs text-[#f5e4be] uppercase flex items-center justify-between">
                    <span>1. Carátula de Mapa Principal ({currentPlaceShortName})</span>
                    <span className="text-[10px] text-amber-400">Cuadrado 1:1</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Sube un archivo PNG o JPG para la carátula principal de este lugar o agrega mapas adicionales a esta carpeta más abajo.
                  </p>

                  <label className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-cinzel font-black text-xs flex items-center justify-center gap-2 shadow cursor-pointer transition">
                    <Upload className="w-4 h-4" />
                    <span>Subir Mapa Principal PNG / JPG</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleUploadAtlasMapFile}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={mapCustomUrlInput || currentPlaceMapUrl}
                      onChange={(e) => setMapCustomUrlInput(e.target.value)}
                      placeholder="O pega URL de imagen (https://...)"
                      className="flex-1 bg-[#11131a] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleSetAtlasMapUrl(mapCustomUrlInput)}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-[#c8a45c]/50 text-xs font-cinzel font-bold text-[#f5e4be] cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>

                  {currentPlaceMapUrl && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        data-testid="btn-enqueue-primary-zone-map"
                        onClick={() =>
                          handleAddToVisualQueue({
                            kind: 'map',
                            sourceId: `primary-map-${currentPlaceMapKey}`,
                            title: `Mapa de ${currentPlaceShortName}`,
                            imageUrl: currentPlaceMapUrl,
                            folder: currentPlaceMapKey,
                          })
                        }
                        className="py-1.5 px-2 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/60 text-[11px] font-cinzel font-bold text-amber-200 cursor-pointer"
                      >
                        + Poner en Cola
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAtlasMapUrl('')}
                        className="py-1.5 px-2 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-[11px] text-red-300 cursor-pointer"
                      >
                        Quitar Carátula
                      </button>
                    </div>
                  )}
                </div>

                {/* 1B. Mapas Adicionales de esta Carpeta (Varios Mapas por Lugar) */}
                <div className="p-3.5 rounded-xl bg-[#191c28] border border-[#c8a45c]/50 space-y-2.5">
                  <div className="font-cinzel font-bold text-xs text-[#f5e4be] uppercase flex items-center justify-between">
                    <span>Mapas de {currentPlaceShortName} ({filteredZoneMaps.length})</span>
                    <span className="text-[10px] text-amber-300">Múltiples Carátulas</span>
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="text"
                      data-testid="input-zone-map-title"
                      value={zoneMapTitleInput}
                      onChange={(e) => setZoneMapTitleInput(e.target.value)}
                      placeholder="Nombre del mapa (ej. Mapa de Noche, Nivel Subterráneo...)"
                      className="w-full bg-[#11131a] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-200"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        data-testid="input-zone-map-url"
                        value={zoneMapUrlInput}
                        onChange={(e) => setZoneMapUrlInput(e.target.value)}
                        placeholder="URL del mapa o sube archivo →"
                        className="flex-1 bg-[#11131a] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-200"
                      />
                      <label className="px-2.5 py-1.5 rounded-lg bg-[#242838] hover:bg-[#2f344a] border border-[#c8a45c]/50 text-[#e2c275] text-[11px] font-cinzel font-bold cursor-pointer shrink-0">
                        Subir
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleUploadZoneMapFile}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        data-testid="btn-save-extra-zone-map"
                        onClick={handleSaveNewZoneMap}
                        disabled={!zoneMapUrlInput.trim() && !zoneMapUploadDraftUrl.trim()}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 font-cinzel font-bold text-[11px] cursor-pointer shrink-0"
                      >
                        + Mapa
                      </button>
                    </div>
                  </div>

                  {filteredZoneMaps.length > 0 && (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 pt-1">
                      {filteredZoneMaps.map((zMap) => {
                        const isEditingThisMap = editingZoneMapId === zMap.id;
                        return (
                          <div
                            key={zMap.id}
                            className="p-2 rounded-lg bg-[#12141c] border border-stone-800 space-y-1.5"
                          >
                            {isEditingThisMap ? (
                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  value={editZoneMapDraft.title}
                                  onChange={(e) =>
                                    setEditZoneMapDraft((p) => ({ ...p, title: e.target.value }))
                                  }
                                  placeholder="Título del mapa"
                                  className="w-full bg-stone-950 border border-amber-500/60 rounded px-2 py-1 text-xs text-stone-100"
                                />
                                <input
                                  type="text"
                                  value={editZoneMapDraft.imageUrl}
                                  onChange={(e) =>
                                    setEditZoneMapDraft((p) => ({ ...p, imageUrl: e.target.value }))
                                  }
                                  placeholder="URL de imagen"
                                  className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                                />
                                <input
                                  type="text"
                                  value={editZoneMapDraft.folder}
                                  onChange={(e) =>
                                    setEditZoneMapDraft((p) => ({ ...p, folder: e.target.value }))
                                  }
                                  placeholder="Carpeta / Lugar"
                                  className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-amber-200"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingZoneMapId(null)}
                                    className="px-2 py-1 rounded bg-stone-800 text-[10px] text-stone-300 cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEditedZoneMap}
                                    className="px-2.5 py-1 rounded bg-emerald-600 text-stone-950 font-bold text-[10px] cursor-pointer"
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <img
                                  src={zMap.imageUrl}
                                  alt={zMap.title}
                                  className="w-11 h-11 rounded object-cover border border-stone-700 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-cinzel font-bold text-[#f5e4be] truncate">
                                    {zMap.title}
                                  </div>
                                  <div className="text-[10px] text-stone-400 truncate">
                                    📍 {zMap.folder === 'General' ? 'Mundo' : zMap.folder}
                                  </div>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleSetAtlasMapUrl(zMap.imageUrl)}
                                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-amber-200 cursor-pointer"
                                    >
                                      Usar en Atlas
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`btn-edit-zone-map-${zMap.id}`}
                                      onClick={() => {
                                        setEditingZoneMapId(zMap.id);
                                        setEditZoneMapDraft({
                                          title: zMap.title,
                                          imageUrl: zMap.imageUrl,
                                          folder: zMap.folder,
                                        });
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-200 cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`btn-queue-zone-map-${zMap.id}`}
                                      onClick={() =>
                                        handleAddToVisualQueue({
                                          kind: 'map',
                                          sourceId: zMap.id,
                                          title: zMap.title,
                                          imageUrl: zMap.imageUrl,
                                          folder: zMap.folder,
                                        })
                                      }
                                      className="px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-[10px] text-amber-200 font-bold cursor-pointer"
                                    >
                                      + Poner en Cola
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteZoneMap(zMap.id)}
                                      className="p-0.5 rounded bg-red-950/60 hover:bg-red-900 text-red-300 cursor-pointer ml-auto"
                                      title="Eliminar mapa"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Mover Puntos de Sub-Lugares */}
                <div className="p-3.5 rounded-xl bg-[#191c28] border border-[#c8a45c]/50 space-y-2.5">
                  <div className="font-cinzel font-bold text-xs text-[#f5e4be] uppercase flex items-center justify-between">
                    <span>2. Puntos de Sub-Lugares ({childFolders.length})</span>
                    <Move className="w-3.5 h-3.5 text-amber-400" />
                  </div>

                  {childFolders.length > 0 ? (
                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {childFolders.map((subFolder, idx) => {
                        const shortLabel = subFolder.split('/').pop()?.trim() || subFolder;
                        const pos = getPinPositionForChildPlace(
                          subFolder,
                          idx,
                          childFolders.length,
                          workspace.atlasPinPositions
                        );
                        const isSelected = selectedPinToMove === subFolder;
                        return (
                          <div
                            key={subFolder}
                            onClick={() => setSelectedPinToMove(subFolder)}
                            className={`p-2 rounded-lg border transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-950/60 border-amber-400'
                                : 'bg-[#12141c] border-stone-800 hover:border-stone-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-cinzel font-bold text-[#f5e4be] flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                <span>{shortLabel}</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFolder(subFolder);
                                  setIsAtlasMapModalOpen(false);
                                }}
                                className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                              >
                                Entrar →
                              </button>
                            </div>
                            {isSelected && (
                              <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-stone-300">
                                <label className="flex flex-col gap-0.5">
                                  <span>Horizontal (X: {pos.x}%)</span>
                                  <input
                                    type="range"
                                    min={8}
                                    max={92}
                                    value={pos.x}
                                    onChange={(e) =>
                                      handleUpdatePinPosition(subFolder, Number(e.target.value), pos.y)
                                    }
                                    className="accent-amber-500"
                                  />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span>Vertical (Y: {pos.y}%)</span>
                                  <input
                                    type="range"
                                    min={10}
                                    max={90}
                                    value={pos.y}
                                    onChange={(e) =>
                                      handleUpdatePinPosition(subFolder, pos.x, Number(e.target.value))
                                    }
                                    className="accent-amber-500"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic">
                      No hay sub-lugares directos dentro de {currentPlaceShortName}.
                    </p>
                  )}

                  {/* Quick Add Sub-place inside current place (if depth < 4) */}
                  {currentPlaceDepth < 4 && (
                    <div className="pt-2 border-t border-stone-800 space-y-1.5">
                      <span className="text-[10px] text-stone-400 block">
                        Crear nuevo sub-lugar dentro de {currentPlaceShortName} (Nivel {currentPlaceDepth + 1}/4):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newQuickSubPlaceName}
                          onChange={(e) => setNewQuickSubPlaceName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickCreateSubPlace()}
                          placeholder="Ej. Piso 2, Sótano, Plaza..."
                          className="flex-1 bg-[#11131a] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-200"
                        />
                        <button
                          type="button"
                          data-testid="btn-quick-add-subplace"
                          onClick={() => handleQuickCreateSubPlace()}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-cinzel font-bold text-xs cursor-pointer"
                        >
                          + Crear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ÁLBUM DE FOTOS DEL LUGAR, EDICIÓN Y PONER EN COLA            */}
      {/* =================================================================== */}
      {isAlbumModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsAlbumModalOpen(false)}
        >
          <div
            data-testid="modal-place-album"
            className="w-full max-w-3xl rounded-2xl bg-[#14161f] border-2 border-[#c8a45c] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c8a45c]/30">
              <div>
                <h3 className="font-cinzel font-black text-base sm:text-lg text-[#f5e4be] uppercase flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#e2c275]" />
                  <span>ÁLBUM DEL LUGAR: {currentPlaceShortName}</span>
                </h3>
                <p className="text-xs text-stone-400">
                  {selectedFolder === 'all'
                    ? 'Mostrando todas las fotos del Mundo. Puedes editarlas, ponerlas en cola o mostrarlas en vivo.'
                    : `Mostrando las fotos guardadas en "${selectedFolder}" y sus sub-lugares.`}
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-close-album-modal"
                onClick={() => setIsAlbumModalOpen(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload New Photo to Current Place Album */}
            <div className="p-3.5 rounded-xl bg-[#191c28] border border-[#c8a45c]/50 mb-4 space-y-2.5">
              <div className="font-cinzel font-bold text-xs text-[#f5e4be] uppercase flex items-center justify-between">
                <span>Subir Nueva Foto a: 📍 {currentPlaceShortName}</span>
                <span className="text-[10px] text-amber-300">PNG / JPG</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  data-testid="input-album-photo-title"
                  value={albumTitleInput}
                  onChange={(e) => setAlbumTitleInput(e.target.value)}
                  placeholder="Título de la foto (ej. Barra Principal, Sótano Secreto...)"
                  className="sm:col-span-5 bg-[#11131a] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                <input
                  type="text"
                  data-testid="input-album-photo-url"
                  value={albumUrlInput}
                  onChange={(e) => setAlbumUrlInput(e.target.value)}
                  placeholder="Pega URL de imagen o sube archivo →"
                  className="sm:col-span-4 bg-[#11131a] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                <label className="sm:col-span-3 py-1.5 px-2.5 rounded-lg bg-[#242838] hover:bg-[#2f344a] border border-[#c8a45c]/50 text-[#e2c275] text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Archivo PNG/JPG</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleUploadAlbumPhotoFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  data-testid="btn-save-album-photo"
                  onClick={() => handleSaveNewAlbumPhoto()}
                  disabled={!albumUrlInput.trim() && !albumUploadDraftUrl.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 font-cinzel font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Guardar en el Álbum</span>
                </button>
              </div>
            </div>

            {/* Album Photo Grid Filtered by Current Place */}
            {filteredAlbumPhotos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredAlbumPhotos.map((photo) => {
                  const isLive =
                    workspace.activeLiveVisual?.kind === 'album' &&
                    workspace.activeLiveVisual?.id === photo.id;
                  const isEditingThis = editingAlbumPhotoId === photo.id;
                  return (
                    <div
                      key={photo.id}
                      className={`rounded-xl overflow-hidden border transition flex flex-col justify-between bg-[#181a24] ${
                        isLive ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-[#c8a45c]/50'
                      }`}
                    >
                      <div className="relative h-36 w-full bg-stone-950">
                        <img
                          src={photo.imageUrl}
                          alt={photo.title}
                          className="w-full h-full object-cover"
                        />
                        {isLive && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            EN VIVO
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAlbumPhoto(photo.id)}
                          className="absolute top-2 right-2 p-1 rounded bg-black/70 hover:bg-red-900/80 text-stone-300 hover:text-white cursor-pointer"
                          title="Eliminar foto del álbum"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isEditingThis ? (
                        <div className="p-2.5 space-y-1.5 bg-[#12141c]">
                          <input
                            type="text"
                            data-testid={`input-edit-album-title-${photo.id}`}
                            value={editAlbumDraft.title}
                            onChange={(e) =>
                              setEditAlbumDraft((p) => ({ ...p, title: e.target.value }))
                            }
                            placeholder="Nombre de la foto"
                            className="w-full bg-stone-950 border border-amber-500/60 rounded px-2 py-1 text-xs text-stone-100"
                          />
                          <input
                            type="text"
                            value={editAlbumDraft.imageUrl}
                            onChange={(e) =>
                              setEditAlbumDraft((p) => ({ ...p, imageUrl: e.target.value }))
                            }
                            placeholder="URL de la imagen"
                            className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                          />
                          <input
                            type="text"
                            value={editAlbumDraft.folder}
                            onChange={(e) =>
                              setEditAlbumDraft((p) => ({ ...p, folder: e.target.value }))
                            }
                            placeholder="Lugar / Carpeta"
                            className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-amber-200"
                          />
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingAlbumPhotoId(null)}
                              className="px-2 py-1 rounded bg-stone-800 text-[10px] text-stone-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              data-testid={`btn-save-edit-album-${photo.id}`}
                              onClick={handleSaveEditedAlbumPhoto}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-stone-950 font-bold text-[10px] cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 flex flex-col gap-1.5">
                          <div className="font-cinzel font-bold text-xs text-[#f5e4be] truncate">
                            {photo.title}
                          </div>
                          <div className="text-[10px] text-amber-300/80 truncate">
                            📍 {photo.folder === 'General' ? 'Mundo' : photo.folder}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                            <button
                              type="button"
                              data-testid={`btn-edit-album-photo-${photo.id}`}
                              onClick={() => {
                                setEditingAlbumPhotoId(photo.id);
                                setEditAlbumDraft({
                                  title: photo.title,
                                  imageUrl: photo.imageUrl,
                                  folder: photo.folder,
                                });
                              }}
                              className="py-1 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 font-cinzel font-bold text-[10px] cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              data-testid={`btn-queue-album-photo-${photo.id}`}
                              onClick={() =>
                                handleAddToVisualQueue({
                                  kind: 'album',
                                  sourceId: photo.id,
                                  title: photo.title,
                                  imageUrl: photo.imageUrl,
                                  folder: photo.folder,
                                })
                              }
                              className="py-1 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/60 text-amber-200 font-cinzel font-bold text-[10px] cursor-pointer"
                            >
                              + Poner en Cola
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSetLiveAlbumPhoto(photo)}
                            className={`w-full py-1.5 rounded-lg font-cinzel font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                              isLive
                                ? 'bg-emerald-900/60 border border-emerald-400 text-emerald-200'
                                : 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isLive ? 'Proyectando en Vivo' : 'Mostrar en Vivo'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-[#11131a] border border-stone-800 text-stone-400 text-xs">
                No hay fotos en el álbum de <strong>{currentPlaceShortName}</strong> todavía. ¡Sube la primera arriba!
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: MAPAS TÁCTICOS (CUADRÍCULA, EDICIÓN Y PONER EN COLA)         */}
      {/* =================================================================== */}
      {isTacticalMapsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsTacticalMapsModalOpen(false)}
        >
          <div
            data-testid="modal-tactical-maps"
            className="w-full max-w-3xl rounded-2xl bg-[#14161f] border-2 border-[#c8a45c] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c8a45c]/30">
              <div>
                <h3 className="font-cinzel font-black text-base sm:text-lg text-[#f5e4be] uppercase flex items-center gap-2">
                  <Crosshair className="w-5 h-5 text-red-400" />
                  <span>MAPAS TÁCTICOS: {currentPlaceShortName}</span>
                </h3>
                <p className="text-xs text-stone-400">
                  Prepara tableros tácticos con cuadrícula para mover fichas de personajes y monstruos en vivo, edítalos o ponlos en cola.
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-close-tactical-maps-modal"
                onClick={() => setIsTacticalMapsModalOpen(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Crear nuevo Mapa Táctico */}
            <div className="p-3.5 rounded-xl bg-[#191c28] border border-[#c8a45c]/50 mb-4 space-y-2.5">
              <div className="font-cinzel font-bold text-xs text-[#f5e4be] uppercase flex items-center justify-between">
                <span>Subir Nuevo Mapa Táctico a: 📍 {currentPlaceShortName}</span>
                <span className="text-[10px] text-red-300">Tablero con Cuadrícula</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  data-testid="input-tactical-map-title"
                  value={tacticalTitleInput}
                  onChange={(e) => setTacticalTitleInput(e.target.value)}
                  placeholder="Nombre del Mapa Táctico (ej. Emboscada en el Puente, Sala del Trono...)"
                  className="sm:col-span-5 bg-[#11131a] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                <input
                  type="text"
                  data-testid="input-tactical-map-url"
                  value={tacticalUrlInput}
                  onChange={(e) => setTacticalUrlInput(e.target.value)}
                  placeholder="URL de imagen o sube archivo →"
                  className="sm:col-span-4 bg-[#11131a] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                <label className="sm:col-span-3 py-1.5 px-2.5 rounded-lg bg-[#242838] hover:bg-[#2f344a] border border-[#c8a45c]/50 text-[#e2c275] text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Archivo PNG/JPG</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleUploadTacticalMapFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-3 text-xs text-stone-300">
                  <label className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-400">Columnas:</span>
                    <input
                      type="number"
                      min={4}
                      max={24}
                      value={tacticalColsInput}
                      onChange={(e) => setTacticalColsInput(Number(e.target.value) || 10)}
                      className="w-14 bg-[#11131a] border border-stone-700 rounded px-2 py-1 text-xs text-amber-200"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-400">Filas:</span>
                    <input
                      type="number"
                      min={4}
                      max={24}
                      value={tacticalRowsInput}
                      onChange={(e) => setTacticalRowsInput(Number(e.target.value) || 10)}
                      className="w-14 bg-[#11131a] border border-stone-700 rounded px-2 py-1 text-xs text-amber-200"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  data-testid="btn-save-tactical-map"
                  onClick={handleSaveNewTacticalMap}
                  disabled={!tacticalUrlInput.trim() && !tacticalUploadDraftUrl.trim()}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-cinzel font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Guardar Mapa Táctico</span>
                </button>
              </div>
            </div>

            {/* Lista de Mapas Tácticos */}
            {filteredTacticalMaps.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredTacticalMaps.map((tMap) => {
                  const isLive =
                    workspace.activeLiveVisual?.kind === 'tactical' &&
                    workspace.activeLiveVisual?.id === tMap.id;
                  const isEditingThis = editingTacticalMapId === tMap.id;
                  return (
                    <div
                      key={tMap.id}
                      className={`rounded-xl overflow-hidden border transition flex flex-col justify-between bg-[#181a24] ${
                        isLive ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-red-500/40'
                      }`}
                    >
                      <div className="relative h-36 w-full bg-stone-950">
                        <img
                          src={tMap.mapImageUrl}
                          alt={tMap.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 border border-red-500/50 text-[9px] font-mono text-red-200">
                          {tMap.gridCols || 10}x{tMap.gridRows || 10}
                        </span>
                        {isLive && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            EN VIVO
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteTacticalMap(tMap.id)}
                          className="absolute top-2 right-2 p-1 rounded bg-black/70 hover:bg-red-900/80 text-stone-300 hover:text-white cursor-pointer"
                          title="Eliminar mapa táctico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isEditingThis ? (
                        <div className="p-2.5 space-y-1.5 bg-[#12141c]">
                          <input
                            type="text"
                            data-testid={`input-edit-tactical-title-${tMap.id}`}
                            value={editTacticalDraft.name}
                            onChange={(e) =>
                              setEditTacticalDraft((p) => ({ ...p, name: e.target.value }))
                            }
                            placeholder="Nombre del mapa táctico"
                            className="w-full bg-stone-950 border border-amber-500/60 rounded px-2 py-1 text-xs text-stone-100"
                          />
                          <input
                            type="text"
                            value={editTacticalDraft.mapImageUrl}
                            onChange={(e) =>
                              setEditTacticalDraft((p) => ({ ...p, mapImageUrl: e.target.value }))
                            }
                            placeholder="URL de imagen"
                            className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                          />
                          <input
                            type="text"
                            value={editTacticalDraft.folder}
                            onChange={(e) =>
                              setEditTacticalDraft((p) => ({ ...p, folder: e.target.value }))
                            }
                            placeholder="Carpeta / Lugar"
                            className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-amber-200"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="number"
                              min={4}
                              max={24}
                              value={editTacticalDraft.gridCols}
                              onChange={(e) =>
                                setEditTacticalDraft((p) => ({
                                  ...p,
                                  gridCols: Number(e.target.value) || 10,
                                }))
                              }
                              className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                            />
                            <input
                              type="number"
                              min={4}
                              max={24}
                              value={editTacticalDraft.gridRows}
                              onChange={(e) =>
                                setEditTacticalDraft((p) => ({
                                  ...p,
                                  gridRows: Number(e.target.value) || 10,
                                }))
                              }
                              className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingTacticalMapId(null)}
                              className="px-2 py-1 rounded bg-stone-800 text-[10px] text-stone-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              data-testid={`btn-save-edit-tactical-${tMap.id}`}
                              onClick={handleSaveEditedTacticalMap}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-stone-950 font-bold text-[10px] cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 flex flex-col gap-1.5">
                          <div className="font-cinzel font-bold text-xs text-[#f5e4be] truncate">
                            {tMap.name}
                          </div>
                          <div className="text-[10px] text-amber-300/80 truncate">
                            📍 {tMap.folder === 'General' ? 'Mundo' : tMap.folder}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                            <button
                              type="button"
                              data-testid={`btn-edit-tactical-map-${tMap.id}`}
                              onClick={() => {
                                setEditingTacticalMapId(tMap.id);
                                setEditTacticalDraft({
                                  name: tMap.name,
                                  mapImageUrl: tMap.mapImageUrl || '',
                                  folder: tMap.folder,
                                  gridCols: tMap.gridCols || 10,
                                  gridRows: tMap.gridRows || 10,
                                });
                              }}
                              className="py-1 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 font-cinzel font-bold text-[10px] cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              data-testid={`btn-queue-tactical-map-${tMap.id}`}
                              onClick={() =>
                                handleAddToVisualQueue({
                                  kind: 'tactical',
                                  sourceId: tMap.id,
                                  title: tMap.name,
                                  imageUrl: tMap.mapImageUrl || '',
                                  folder: tMap.folder,
                                })
                              }
                              className="py-1 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/60 text-amber-200 font-cinzel font-bold text-[10px] cursor-pointer"
                            >
                              + Poner en Cola
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleProjectTacticalMap(tMap)}
                            className={`w-full py-1.5 rounded-lg font-cinzel font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                              isLive
                                ? 'bg-emerald-900/60 border border-emerald-400 text-emerald-200'
                                : 'bg-red-700 hover:bg-red-600 text-white'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isLive ? 'Proyectando en Vivo' : 'Mostrar en Vivo'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-[#11131a] border border-stone-800 text-stone-400 text-xs">
                No hay mapas tácticos en <strong>{currentPlaceShortName}</strong> todavía. ¡Sube el primero arriba!
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: VISTA EN VIVO (MAPA EN VIVO / IMAGEN PROYECTADA A LA MESA)   */}
      {/* =================================================================== */}
      {isLivePreviewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsLivePreviewModalOpen(false)}
        >
          <div
            data-testid="modal-live-visual-preview"
            className="w-full max-w-2xl rounded-2xl bg-[#14161f] border-2 border-[#c8a45c] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#c8a45c]/30">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-cinzel font-black text-base text-[#f5e4be] uppercase">
                  PROYECCIÓN EN VIVO: {activeLiveVisualDisplay.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLivePreviewModalOpen(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeLiveVisualDisplay.imageUrl ? (
              <div className="w-full h-72 rounded-xl overflow-hidden border border-[#c8a45c]/60 bg-black mb-3">
                <img
                  src={activeLiveVisualDisplay.imageUrl}
                  alt={activeLiveVisualDisplay.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl border border-stone-800 bg-[#11131a] flex items-center justify-center text-stone-400 text-xs mb-3">
                Sin imagen seleccionada. Elige una foto del Álbum para proyectarla.
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-stone-400">
                📍 Lugar: <strong className="text-amber-300">{activeLiveVisualDisplay.folder}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLivePreviewModalOpen(false);
                    setIsAlbumModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-cinzel font-bold text-xs cursor-pointer"
                >
                  Cambiar Foto desde el Álbum
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOLDER MANAGER MODAL (Explorador Masivo de Carpetas del Mundo) */}
      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
        workspace={workspace}
        onUpdateWorkspace={onUpdateWorkspace}
        onSelectFolder={setSelectedFolder}
      />

      {/* AVATAR CUSTOMIZER MODAL */}
      {avatarCustomizerConfig && (
        <AvatarCustomizerModal
          isOpen={avatarCustomizerConfig.isOpen}
          onClose={() => setAvatarCustomizerConfig(null)}
          title={avatarCustomizerConfig.title}
          category={avatarCustomizerConfig.category}
          currentType={avatarCustomizerConfig.currentType}
          currentCustomUrl={avatarCustomizerConfig.currentCustomUrl}
          currentIconId={avatarCustomizerConfig.currentIconId}
          onSave={avatarCustomizerConfig.onSave}
        />
      )}

      {/* =================================================================== */}
      {/* MODAL: AJUSTES DE LA MESA DEL DM (NOMBRE, CONTRASEÑA, ONLINE/OFFLINE)*/}
      {/* =================================================================== */}
      {isDmTableSettingsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsDmTableSettingsModalOpen(false)}
        >
          <div
            data-testid="modal-dm-table-settings"
            className="w-full max-w-lg rounded-2xl bg-[#14161f] border-2 border-[#c8a45c] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#c8a45c]/30">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#e2c275]" />
                <div>
                  <h3 className="font-cinzel font-black text-base text-[#f5e4be] uppercase">
                    AJUSTES DE LA MESA DEL DM
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Configura el nombre de la mesa, código de sala, contraseña y sincronización en vivo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="btn-close-dm-table-settings"
                onClick={() => setIsDmTableSettingsModalOpen(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Estado Online / Offline */}
              <div className="p-3 rounded-xl bg-[#191c28] border border-stone-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-cinzel font-bold text-[#f5e4be] flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isOnlineSession ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
                      }`}
                    />
                    <span>Estado de Conexión: {isOnlineSession ? 'MESA ONLINE' : 'MODO OFFLINE'}</span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Activa el modo Online para compartir código de sala y proyectar mapas en vivo a tus jugadores.
                  </p>
                </div>
                {onToggleOnlineSession && (
                  <button
                    type="button"
                    data-testid="btn-settings-toggle-online"
                    onClick={onToggleOnlineSession}
                    className={`px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold border transition cursor-pointer shrink-0 ${
                      isOnlineSession
                        ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300 hover:bg-emerald-900'
                        : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-amber-500/60 hover:text-amber-200'
                    }`}
                  >
                    {isOnlineSession ? 'Pasar a Offline' : 'Activar Online'}
                  </button>
                )}
              </div>

              {/* Editar Nombre de la Mesa */}
              <div>
                <label className="block text-[11px] font-cinzel font-bold text-[#e2c275] uppercase mb-1">
                  Nombre de la Mesa / Mundo
                </label>
                <input
                  type="text"
                  data-testid="input-settings-world-name"
                  value={settingsNameDraft}
                  onChange={(e) => setSettingsNameDraft(e.target.value)}
                  placeholder="Ej. Crónicas de Phandalin"
                  className="w-full bg-[#11131a] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none"
                />
              </div>

              {/* Editar Código y Contraseña */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-cinzel font-bold text-[#e2c275] uppercase mb-1">
                    Código de Sala
                  </label>
                  <input
                    type="text"
                    data-testid="input-settings-room-code"
                    value={settingsCodeDraft}
                    onChange={(e) => setSettingsCodeDraft(e.target.value.toUpperCase())}
                    placeholder="Ej. MESA-2025"
                    className="w-full bg-[#11131a] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-amber-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-cinzel font-bold text-[#e2c275] uppercase mb-1">
                    Contraseña de la Mesa
                  </label>
                  <input
                    type="text"
                    data-testid="input-settings-room-password"
                    value={settingsPasswordDraft}
                    onChange={(e) => setSettingsPasswordDraft(e.target.value)}
                    placeholder="Opcional (dejar vacío = sin clave)"
                    className="w-full bg-[#11131a] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none"
                  />
                </div>
              </div>

              {/* Auto-Sync al cambiar de zona */}
              <label className="p-3 rounded-xl bg-[#191c28] border border-stone-800 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-cinzel font-bold text-[#f5e4be]">
                    Cambiar imagen a jugadores automáticamente al cambiar de zona
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Si está desactivado, podrás explorar y editar mapas libremente sin cambiar lo que ven los jugadores hasta que presiones Proyectar.
                  </p>
                </div>
                <input
                  type="checkbox"
                  data-testid="checkbox-settings-auto-sync-zone"
                  checked={Boolean(workspace.autoSyncLiveMapOnZoneChange)}
                  onChange={(e) =>
                    onUpdateWorkspace({
                      ...workspace,
                      autoSyncLiveMapOnZoneChange: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-amber-500 shrink-0"
                />
              </label>

              {/* Estandarte / PNG Personalizado de la Hoja del Dungeon Master */}
              <div
                data-testid="dm-settings-custom-png-section"
                className="p-3.5 rounded-xl bg-[#191c28] border border-amber-500/40 space-y-2"
              >
                <div className="text-xs font-cinzel font-bold text-amber-300 uppercase flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Imagen / PNG Personalizado de la Hoja del Dungeon Master</span>
                </div>
                <p className="text-[11px] text-stone-400">
                  Sube directamente un archivo PNG/imagen desde tu dispositivo o pega un enlace URL para el estandarte y retrato de tu Hoja de Dungeon Master.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {workspace.dmAvatarUrl && (
                    <img
                      src={workspace.dmAvatarUrl}
                      alt="PNG del DM"
                      className="w-11 h-11 rounded-lg object-cover border border-amber-500/60 shrink-0"
                    />
                  )}
                  <label className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-cinzel font-bold text-xs cursor-pointer flex items-center gap-1.5 shrink-0 shadow">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Archivo PNG / Imagen</span>
                    <input
                      type="file"
                      data-testid="input-dm-settings-sheet-png-file"
                      accept="image/png,image/jpeg,image/webp,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageFileToDataUrl(file, 512, 0.85);
                          onUpdateWorkspace({
                            ...workspace,
                            dmAvatarType: 'custom',
                            dmAvatarUrl: dataUrl,
                          });
                        } catch {
                          // ignore
                        }
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    data-testid="input-dm-settings-sheet-png-url"
                    value={workspace.dmAvatarUrl || ''}
                    onChange={(e) =>
                      onUpdateWorkspace({
                        ...workspace,
                        dmAvatarType: e.target.value.trim() ? 'custom' : 'icon',
                        dmAvatarUrl: e.target.value,
                      })
                    }
                    placeholder="O pega URL de imagen PNG (https://...)"
                    className="flex-1 min-w-[180px] bg-[#11131a] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-100"
                  />
                  {workspace.dmAvatarUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateWorkspace({
                          ...workspace,
                          dmAvatarType: 'icon',
                          dmAvatarUrl: undefined,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/60 border border-red-700/50 text-red-200 text-[11px] hover:bg-red-900/50 cursor-pointer"
                    >
                      Restaurar Capucha
                    </button>
                  )}
                </div>
              </div>

              {/* SELECTOR DE SKIN VISUAL DEL DUNGEON MASTER */}
              <div
                data-testid="dm-settings-skin-selector-section"
                className="p-3.5 rounded-xl bg-[#191c28] border border-red-500/40 space-y-2.5"
              >
                <div className="text-xs font-cinzel font-bold text-red-300 uppercase flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-red-400" />
                  <span>Skin Visual de la Pantalla del Dungeon Master</span>
                </div>
                <p className="text-[11px] text-stone-400">
                  Elige la skin visual que se aplicará a tu Pantalla del DM, Atlas, Monitor de Combate y Modo Mapa.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableDmSkins.map((dmSkin) => {
                    const isSelected =
                      (workspace.dmSkinId || onlineDefaultDmSkinId) === dmSkin.id;
                    return (
                      <button
                        key={dmSkin.id}
                        type="button"
                        data-testid={`btn-select-dm-skin-${dmSkin.id}`}
                        onClick={() =>
                          onUpdateWorkspace({
                            ...workspace,
                            dmSkinId: dmSkin.id,
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-red-950/50 border-red-400 text-white shadow'
                            : 'bg-[#12141c] border-stone-800 text-stone-300 hover:border-stone-600'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-cinzel font-bold text-xs truncate">
                            {dmSkin.name}
                          </div>
                          <div className="text-[10px] text-stone-400 truncate">
                            {dmSkin.description || 'Tema de Dungeon Master'}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold shrink-0">
                            Activa
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* APARTADO DE DLCs E INYECCIÓN DE CONTENIDO (SRD 5E & EXPANSIONES) */}
              <div
                data-testid="dm-settings-dlc-section"
                className="p-3.5 rounded-xl bg-[#191c28] border border-amber-500/50 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-xs font-cinzel font-black text-amber-300 uppercase flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-400" />
                      <span>DLCs e Inyección de Contenido en esta Mesa</span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Activa los paquetes DLC que posees en tu cuenta para inyectar sus objetos SRD, monstruos, NPCs, lugares e imágenes en este mundo.
                    </p>
                  </div>
                </div>

                {/* Quick Code Redeemer for DLCs */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    data-testid="input-dm-settings-redeem-dlc"
                    value={dlcRedeemCodeInput}
                    onChange={(e) => setDlcRedeemCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código de DLC (ej. SRD-5E-OFICIAL, NAVIDAD-2026-DLC)"
                    className="flex-1 bg-[#11131a] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-200"
                  />
                  <button
                    type="button"
                    data-testid="btn-dm-settings-redeem-dlc"
                    onClick={handleRedeemDlcInSettings}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-cinzel font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Canjear Código
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableDlcs
                    .filter((dlc) => ownedDlcIds.includes(dlc.id) || dlc.isOfficialSrd)
                    .map((dlc) => {
                      const isActive = installedDlcIds.includes(dlc.id);
                      return (
                        <div
                          key={dlc.id}
                          data-testid={`dm-dlc-row-${dlc.id}`}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                            isActive
                              ? 'bg-emerald-950/35 border-emerald-500/60'
                              : 'bg-[#12141c] border-stone-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-cinzel font-bold text-xs text-[#f5e4be]">
                                {dlc.name}
                              </span>
                              {dlc.isOfficialSrd && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-600/60 text-[9px] font-mono text-amber-300">
                                  SRD 5E Stock
                                </span>
                              )}
                              {dlc.seasonTag && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-600/60 text-[9px] font-mono text-purple-200">
                                  {dlc.seasonTag}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-stone-400 truncate">{dlc.description}</p>
                            {!dlc.hideCreatorCredit &&
                              (dlc.editorCreditName || !dlc.createdByAdmin) && (
                                <div className="text-[10px] font-cinzel text-amber-300 mt-0.5">
                                  ✨ Créditos del Creador:{' '}
                                  <strong>{dlc.editorCreditName || dlc.authorName}</strong>
                                  {dlc.customCreditDescription
                                    ? ` — ${dlc.customCreditDescription}`
                                    : ''}
                                </div>
                              )}
                            <div className="text-[9px] font-mono text-amber-300/90 mt-0.5">
                              Incluye: {(dlc.monsters || []).length} Monstruos • {(dlc.npcs || []).length} NPCs • {(dlc.itemsAndSpells || []).length} Objetos • {(dlc.locations || []).length} Lugares • {(dlc.albumPhotos || []).length} Imágenes
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid={`btn-toggle-dlc-${dlc.id}`}
                            onClick={() => handleToggleWorkspaceDlc(dlc)}
                            className={`px-3 py-1.5 rounded-lg font-cinzel font-bold text-[11px] border transition cursor-pointer shrink-0 ${
                              isActive
                                ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white'
                                : 'bg-stone-800 hover:bg-amber-700 border-stone-600 text-stone-200'
                            }`}
                          >
                            {isActive ? '✓ DLC Activo' : '+ Inyectar DLC'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setIsDmTableSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-cinzel font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="btn-save-dm-table-settings"
                onClick={handleSaveDmTableSettings}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-cinzel font-black text-xs shadow-lg cursor-pointer"
              >
                Guardar Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTED CONNECTED PLAYER TAROT CARD MODAL */}
      {inspectedPartyMember && (
        <div
          data-testid="dm-inspected-player-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setInspectedPartyMemberId(null)}
        >
          <div
            className="relative w-full max-w-[350px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-testid="btn-close-inspected-player-modal"
              onClick={() => setInspectedPartyMemberId(null)}
              className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-stone-900 hover:bg-red-900 border-2 border-[#e2c275] text-[#f5e4be] flex items-center justify-center shadow-xl cursor-pointer"
              title="Cerrar carta del personaje"
            >
              <X className="w-4 h-4" />
            </button>
            <CharacterTarotCard
              member={inspectedPartyMember}
              isOnline={true}
              showDmControls={true}
              onDmAdjustPlayer={onDmAdjustPlayer}
              testId="dm-modal-player-tarot-card"
            />
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                data-testid="btn-sync-inspected-player-to-combat"
                onClick={() => {
                  handleSyncPartyMemberToCombat(inspectedPartyMember);
                  setInspectedPartyMemberId(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-400/70 text-emerald-100 font-cinzel font-bold text-xs shadow-lg cursor-pointer"
              >
                + Añadir a Aliados en Combate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TACTICAL MAP STUDIO MODAL (Moderator / Creator / Admin) */}
      {isTacticalStudioOpen && (
        <TacticalMapStudioModal
          isOpen={isTacticalStudioOpen}
          onClose={() => setIsTacticalStudioOpen(false)}
          initialConfig={
            workspace.activeLiveVisual?.tacticalConfig ||
            workspace.dmPreviewVisual?.tacticalConfig ||
            savedTacticalLocations[0]?.tacticalConfig ||
            createDefaultTacticalMapConfig(
              selectedFolder !== 'all'
                ? `Mapa Táctico - ${currentPlaceShortName}`
                : 'Mapa Táctico - Taberna en Duelo'
            )
          }
          savedTacticalLocations={savedTacticalLocations}
          partyCharacters={partyMembers.map((pm) => ({
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
            hpCurrent: pm.hpCurrent ?? 20,
            hpMax: pm.hpMax ?? 20,
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
          onSaveTacticalMap={handleSaveTacticalMap}
          onProjectLiveToPlayers={handleProjectTacticalMapLive}
        />
      )}
    </div>
  );
};

