import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  User,
  Users,
  Dices,
  BookOpen,
  Sparkles,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Folder,
  Radio,
  FileText,
  HelpCircle,
  Settings,
  KeyRound,
  Crown,
  Lock,
  Unlock,
  Flame,
  CheckCircle,
  X,
  Layers,
  ArrowLeft,
  LayoutGrid,
  MessageSquarePlus,
  Bot,
  Database,
  Gift,
  Check,
  Wrench,
  ShieldCheck,
  Palette,
  Compass,
  MapPin,
  MessageSquare,
  Send,
} from 'lucide-react';
import {
  Character5e,
  DMWorkspace,
  DiceRollResult,
  RollMode,
  UserRole,
  HostSettings,
  InventoryItem,
  WorldSheetSummary,
  LiveCombatantMini,
  PendingDmOffer,
  PlayerMessageToDM,
  LiveBroadcastPopup,
  LiveRoomProjection,
  AppSkinRecord,
} from './types/dnd';
import {
  computeLobbyBlockContainerStyle,
  resolveLobbyPageLayout,
} from './utils/lobbyPageLayout';
import {
  loadCharacters,
  saveCharacters,
  loadActiveCharacterId,
  saveActiveCharacterId,
  loadDMWorkspace,
  saveDMWorkspace,
  loadRoomCode,
  saveRoomCode,
  loadUserRole,
  saveUserRole,
  loadHostSettings,
  saveHostSettings,
  loadAuthUser,
  saveAuthUser,
  AuthSessionUser,
  isCharacterUnlocked,
  setCharacterUnlocked,
  isDMUnlocked,
  setDMUnlocked,
  exportBackupData,
  importBackupData,
} from './utils/storage';
import {
  saveCharactersAsync,
  saveSingleCharacterAsync,
  loadCharactersAsync,
  deleteCharacterAsync,
  subscribeToCharacters,
  saveDMWorkspaceAsync,
  loadDMWorkspaceAsync,
  subscribeToDMWorkspace,
  saveUserProfileAsync,
} from './services/firebaseService';
import { LobbyPortalView } from './components/lobby/LobbyPortalView';
import { RoleSelectionModal } from './components/auth/RoleSelectionModal';
import { PasswordPromptModal } from './components/auth/PasswordPromptModal';
import { BrandLogo } from './components/common/BrandLogo';

const CharacterSheetView = React.lazy(() =>
  import('./components/character/CharacterSheetView').then((m) => ({ default: m.CharacterSheetView }))
);
const CharacterCreatorModal = React.lazy(() =>
  import('./components/character/CharacterCreatorModal').then((m) => ({ default: m.CharacterCreatorModal }))
);
const DMScreenView = React.lazy(() =>
  import('./components/dm/DMScreenView').then((m) => ({ default: m.DMScreenView }))
);
const TableMapView = React.lazy(() =>
  import('./components/session/TableMapView').then((m) => ({ default: m.TableMapView }))
);
const DiceRollerModal = React.lazy(() =>
  import('./components/dice/DiceRollerModal').then((m) => ({ default: m.DiceRollerModal }))
);
const RulesCompendiumModal = React.lazy(() =>
  import('./components/rules/RulesCompendiumModal').then((m) => ({ default: m.RulesCompendiumModal }))
);
const ArcaneOracleModal = React.lazy(() =>
  import('./components/ai/ArcaneOracleModal').then((m) => ({ default: m.ArcaneOracleModal }))
);
const LiveRollFeedModal = React.lazy(() =>
  import('./components/session/LiveRollFeedModal').then((m) => ({ default: m.LiveRollFeedModal }))
);
const ChangelogModal = React.lazy(() =>
  import('./components/host/ChangelogModal').then((m) => ({ default: m.ChangelogModal }))
);
const FeedbackModal = React.lazy(() =>
  import('./components/feedback/FeedbackModal').then((m) => ({ default: m.FeedbackModal }))
);
const UserSecurityModal = React.lazy(() =>
  import('./components/auth/UserSecurityModal').then((m) => ({ default: m.UserSecurityModal }))
);
const ModeratorPanelModal = React.lazy(() =>
  import('./components/admin/ModeratorPanelModal').then((m) => ({ default: m.ModeratorPanelModal }))
);
import {
  calculateProficiencyBonus,
  calculatePassivePerception,
  calculateModifier,
  calculateEquippedItemStatBonuses,
  resolveTarotCardAbilityScores,
  filterAlbumPhotosByPlace,
  buildLiveProjectionFromWorkspace as computeLiveProjectionFromWorkspace,
  canAccessArcaneOracle,
  getHeaderRoleButtonsVisibility,
  normalizePlayerSheetItemCategory,
  resolveAuthoritativePlayerHp,
} from './utils/dnd-math';
import {
  enqueueOfflineTableEvent,
  flushOfflineTableEvents,
  evaluateRoomClosureResilience,
} from './utils/offlineEventQueue';
import { SAMPLE_DM_WORKSPACE } from './data/srd';

export default function App() {
  // Authentication & Session
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(() => loadAuthUser());
  const [userRole, setUserRole] = useState<UserRole>(() => loadUserRole() || authUser?.role || 'player');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isModeratorModalOpen, setIsModeratorModalOpen] = useState<boolean>(false);
  const [activeLobbyPage, setActiveLobbyPage] = useState<'portal' | 'admin' | 'creator' | 'moderator'>('portal');

  // App View Architecture: 'lobby' is the primary portal (supports ?view=player-solo | player-session or ?autostart=1)
  const [appView, setAppView] = useState<'lobby' | 'player-session' | 'player-solo' | 'dm-session'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'player-solo' || viewParam === 'player-session' || viewParam === 'dm-session') {
        return viewParam;
      }
      if (params.get('autostart') === '1') {
        return 'player-solo';
      }
    }
    return 'lobby';
  });

  // Host Settings & Live Admin Broadcast Pop-up (only triggers for pop-ups sent while user is online)
  const [hostSettings, setHostSettings] = useState<HostSettings>(() => loadHostSettings());
  const [isChangelogOpen, setIsChangelogOpen] = useState<boolean>(false);
  const [dismissedDevNotice, setDismissedDevNotice] = useState<boolean>(false);
  const appMountTimeRef = useRef<number>(Date.now());
  const seenLivePopupIdsRef = useRef<Set<string>>(new Set());
  const [activeLiveAdminPopup, setActiveLiveAdminPopup] = useState<LiveBroadcastPopup | null>(null);

  // Persistence State
  const [characters, setCharacters] = useState<Character5e[]>(() => loadCharacters());
  const [activeCharId, setActiveCharId] = useState<string>(() => loadActiveCharacterId());
  const [dmWorkspace, setDmWorkspace] = useState<DMWorkspace>(() => loadDMWorkspace());
  const [roomCode, setRoomCode] = useState<string>(() => loadRoomCode() || 'MESA-DRAGON');
  const [worldSheets, setWorldSheets] = useState<WorldSheetSummary[]>([]);
  const [activeWorld, setActiveWorld] = useState<WorldSheetSummary | null>(null);
  const [vaultSyncRevision, setVaultSyncRevision] = useState<number>(0);
  const lastSeenServerVaultRevRef = useRef<number>(-1);

  // Password Prompt Modal State
  const [passwordModalConfig, setPasswordModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    expectedPassword?: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onSuccess: () => {},
  });

  // Active Character
  const activeCharacter = characters.find((c) => c.id === activeCharId) || characters[0];

  // Modals & Creator Online Skin
  const [isCreatorOpen, setIsCreatorOpen] = useState<boolean>(false);
  const [isCompendiumOpen, setIsCompendiumOpen] = useState<boolean>(false);
  const [isOracleOpen, setIsOracleOpen] = useState<boolean>(false);
  const [oracleInitialPrompt, setOracleInitialPrompt] = useState<string>('');
  const [oracleClientBlockedNotice, setOracleClientBlockedNotice] = useState<string>('');
  const [isRollFeedOpen, setIsRollFeedOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [onlineAppSkin, setOnlineAppSkin] = useState<AppSkinRecord | null>(null);

  // Optimistic mutation lock & debounce refs to prevent HP/Map flickering and 15-30 min table lag
  const lastLocalPlayerMutationAtRef = useRef<number>(0);
  const lastLocalDmMutationAtRef = useRef<number>(0);
  const playerVaultSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveClosedPollsRef = useRef<number>(0);
  const [reconnectingNotice, setReconnectingNotice] = useState<string>('');

  const effectiveAppRole =
    authUser?.appRole ||
    (authUser?.role === 'admin' || userRole === 'admin'
      ? 'admin'
      : authUser?.role === 'creator' || userRole === 'creator'
      ? 'creator'
      : authUser?.role === 'moderator' || userRole === 'moderator'
      ? 'moderator'
      : 'client');
  const canUseArcaneOracle = canAccessArcaneOracle(effectiveAppRole);
  const headerRoleVisibility = getHeaderRoleButtonsVisibility(effectiveAppRole);

  // App Total Backup Restore
  const appRestoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAppRestoring, setIsAppRestoring] = useState<boolean>(false);
  const [appRestoreMsg, setAppRestoreMsg] = useState<string>('');

  const handleAppRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAppRestoring(true);
    setAppRestoreMsg('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/vault/restore-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restaurar respaldo.');
      setAppRestoreMsg(data.message || '¡Respaldo Maestro Restaurado con Éxito!');

      // Immediately save the newly restored state into local mirror snapshot so sync comparison respects it as newest
      if (data.latestBackup) {
        try {
          localStorage.setItem('weroll_cloud_mirror_snapshot_v2', JSON.stringify(data.latestBackup));
        } catch {}
      }

      if (data.latestBackup?.settings) {
        setHostSettings(data.latestBackup.settings);
        saveHostSettings(data.latestBackup.settings);
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'SETTINGS_UPDATED',
            payload: data.latestBackup.settings,
          });
        }
      } else {
        fetch('/api/settings')
          .then((r) => r.json())
          .then((d) => {
            if (d) setHostSettings(d);
          })
          .catch(() => {});
      }
      fetchWorldSheets();
      setVaultSyncRevision((r) => r + 1);
    } catch (err: any) {
      alert('Error al restaurar respaldo: ' + err.message);
    } finally {
      setIsAppRestoring(false);
      if (e.target) e.target.value = '';
    }
  };

  // Dice Roller State
  const [isRollerOpen, setIsRollerOpen] = useState<boolean>(false);
  const [rollerTitle, setRollerTitle] = useState<string>('Tirada General');
  const [rollerMod, setRollerMod] = useState<number>(0);
  const [rollerSides, setRollerSides] = useState<number>(20);
  const [rollerMode, setRollerMode] = useState<RollMode>('normal');
  const [recentRoll, setRecentRoll] = useState<DiceRollResult | null>(null);

  // Multiplayer Live Session State
  const [partyMembers, setPartyMembers] = useState<any[]>([]);
  const [rollFeed, setRollFeed] = useState<DiceRollResult[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<{ title: string; content: string } | null>(null);
  const [roomPlayerMessages, setRoomPlayerMessages] = useState<PlayerMessageToDM[]>([]);
  const [serverDmConnected, setServerDmConnected] = useState<boolean>(false);
  const [serverDmLiveMessage, setServerDmLiveMessage] = useState<string>('');
  const [serverDmLastRoll, setServerDmLastRoll] = useState<DiceRollResult | undefined>(undefined);
  const [roomClosedAlert, setRoomClosedAlert] = useState<string>('');
  const [showCombatantsOnTable, setShowCombatantsOnTable] = useState<boolean>(false);
  const [liveCombatants, setLiveCombatants] = useState<LiveCombatantMini[]>([]);
  const [isSessionMapViewOpen, setIsSessionMapViewOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('map') === '1';
    }
    return false;
  });
  const [liveProjection, setLiveProjection] = useState<LiveRoomProjection | undefined>(undefined);
  const lastSeenDmModifiedAtRef = useRef<number>(0);

  // Unified Top Session Bar DM Message & Player Whisper Modal State
  const [topDmMessageInput, setTopDmMessageInput] = useState<string>('');
  const [topDmMessageSentToast, setTopDmMessageSentToast] = useState<boolean>(false);
  const [isTopWhisperModalOpen, setIsTopWhisperModalOpen] = useState<boolean>(false);
  const [topWhisperTitle, setTopWhisperTitle] = useState<string>('');
  const [topWhisperBody, setTopWhisperBody] = useState<string>('');
  const [topWhisperStatus, setTopWhisperStatus] = useState<string>('');

  // DM -> Player Share Offer Notifications & Resolutions
  const [pendingPlayerOffers, setPendingPlayerOffers] = useState<PendingDmOffer[]>([]);
  const [isRespondingOffer, setIsRespondingOffer] = useState<boolean>(false);
  const [playerOfferFeedback, setPlayerOfferFeedback] = useState<string>('');
  const [dmOfferNotifications, setDmOfferNotifications] = useState<
    { id: string; offerId: string; accepted: boolean; message: string; timestamp: number }[]
  >([]);
  const seenResolvedOffersRef = useRef<Set<string>>(new Set());

  // Refs to always access freshest state inside intervals and async callbacks without stale closures
  const activeCharacterRef = useRef<Character5e | undefined>(activeCharacter);
  useEffect(() => {
    activeCharacterRef.current = activeCharacter;
  }, [activeCharacter]);

  const recentRollRef = useRef<DiceRollResult | null>(recentRoll);
  useEffect(() => {
    recentRollRef.current = recentRoll;
  }, [recentRoll]);

  const appViewRef = useRef(appView);
  useEffect(() => {
    appViewRef.current = appView;
  }, [appView]);

  const roomCodeRef = useRef(roomCode);
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  const dmWorkspaceRef = useRef<DMWorkspace>(dmWorkspace);
  useEffect(() => {
    dmWorkspaceRef.current = dmWorkspace;
  }, [dmWorkspace]);

  // Broadcast channel for instantaneous cross-tab communication
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('dnd_5e_session_channel');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'NEW_ROLL') {
          setRecentRoll(payload);
          setRollFeed((prev) => [...prev, payload]);
        } else if (type === 'ANNOUNCEMENT') {
          setActiveAnnouncement(payload);
        } else if (type === 'DM_LIVE_MESSAGE') {
          setServerDmLiveMessage(payload);
        } else if (type === 'COMBATANTS_UPDATE') {
          setShowCombatantsOnTable(payload.showCombatantsOnTable);
          setLiveCombatants(payload.liveCombatants || []);
          if (payload.liveProjection) {
            setLiveProjection(payload.liveProjection);
          }
        } else if (type === 'SETTINGS_UPDATED') {
          setHostSettings(payload);
          saveHostSettings(payload);
          if (
            payload?.liveBroadcastPopup?.id &&
            payload.liveBroadcastPopup.sentAt >= appMountTimeRef.current - 5000 &&
            !seenLivePopupIdsRef.current.has(payload.liveBroadcastPopup.id)
          ) {
            seenLivePopupIdsRef.current.add(payload.liveBroadcastPopup.id);
            setActiveLiveAdminPopup(payload.liveBroadcastPopup);
          }
        } else if (type === 'LIVE_ADMIN_POPUP' && payload?.id) {
          if (!seenLivePopupIdsRef.current.has(payload.id)) {
            seenLivePopupIdsRef.current.add(payload.id);
            setActiveLiveAdminPopup(payload);
          }
        } else if (type === 'DM_OFFER_CREATED' && payload) {
          const offer = payload as PendingDmOffer;
          if (
            appViewRef.current === 'player-session' &&
            offer.roomCode === (roomCodeRef.current || '').trim().toUpperCase() &&
            offer.targetCharacterId === activeCharacterRef.current?.id &&
            offer.status === 'pending'
          ) {
            setPendingPlayerOffers((prev) =>
              prev.some((o) => o.id === offer.id) ? prev : [...prev, offer]
            );
          }
        } else if (type === 'DM_OFFER_RESPONDED' && payload) {
          const offer = payload as PendingDmOffer;
          if (
            appViewRef.current === 'dm-session' &&
            offer.roomCode === (roomCodeRef.current || '').trim().toUpperCase() &&
            (offer.status === 'accepted' || offer.status === 'declined') &&
            !seenResolvedOffersRef.current.has(offer.id)
          ) {
            seenResolvedOffersRef.current.add(offer.id);
            const kindLabel =
              offer.kind === 'spell'
                ? 'el conjuro'
                : offer.kind === 'ability'
                ? 'la habilidad'
                : 'el objeto';
            const accepted = offer.status === 'accepted';
            const msg = accepted
              ? `✅ ¡${offer.targetCharacterName} (${offer.targetPlayerName || 'Jugador'}) ACEPTÓ recibir ${kindLabel} "${offer.title}"! Ya se encuentra en su ficha.`
              : `❌ ${offer.targetCharacterName} (${offer.targetPlayerName || 'Jugador'}) RECHAZÓ recibir ${kindLabel} "${offer.title}".`;
            setDmOfferNotifications((prev) => [
              {
                id: `dm-notif-${Date.now()}-${offer.id}`,
                offerId: offer.id,
                accepted,
                message: msg,
                timestamp: Date.now(),
              },
              ...prev,
            ]);
            fetch(
              `/api/session/room/${encodeURIComponent(offer.roomCode)}/offer/${encodeURIComponent(offer.id)}/ack-dm`,
              { method: 'POST' }
            ).catch(() => {});
          }
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Live synchronize host settings across all instances, browsers & computers
  useEffect(() => {
    let isMounted = true;
    const syncHostSettings = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch('/api/settings');
        if (res.ok && isMounted) {
          const fresh: HostSettings = await res.json();
          if (fresh && typeof fresh === 'object') {
            if (
              fresh.liveBroadcastPopup?.id &&
              fresh.liveBroadcastPopup.sentAt >= appMountTimeRef.current - 5000 &&
              !seenLivePopupIdsRef.current.has(fresh.liveBroadcastPopup.id)
            ) {
              seenLivePopupIdsRef.current.add(fresh.liveBroadcastPopup.id);
              setActiveLiveAdminPopup(fresh.liveBroadcastPopup);
            }
            setHostSettings((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(fresh)) {
                saveHostSettings(fresh);
                return fresh;
              }
              return prev;
            });
          }
        }
      } catch (err) {}
    };

    const initTimer = setTimeout(syncHostSettings, 1200);
    const interval = setInterval(syncHostSettings, 30000);
    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  // Fetch active online App Skin from Creator Studio catalog
  useEffect(() => {
    let isMounted = true;
    const fetchActiveSkin = async () => {
      try {
        const res = await fetch('/api/creator/catalog');
        if (res.ok && isMounted) {
          const data = await res.json();
          const cat = data?.catalog;
          if (cat && Array.isArray(cat.appSkins)) {
            const active =
              cat.appSkins.find((s: AppSkinRecord) => s.id === cat.activeOnlineAppSkinId) ||
              cat.appSkins.find((s: AppSkinRecord) => s.isOnlineActive) ||
              cat.appSkins[0];
            if (active) setOnlineAppSkin(active);
          }
        }
      } catch {}
    };
    const initTimer = setTimeout(fetchActiveSkin, 900);
    return () => {
      isMounted = false;
      clearTimeout(initTimer);
    };
  }, []);

  // Continuous Cloud & Mirror Backup Comparison (Archivo Base vs Latest Backup & Pre-Replace Archiving)
  useEffect(() => {
    let isMounted = true;
    const MIRROR_STORAGE_KEY = 'weroll_cloud_mirror_snapshot_v2';

    const runContinuousBackupComparison = async () => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      // Pause heavy full-vault JSON mirror comparison during active real-time table combat to prevent 15-30 min GC lag
      if (appViewRef.current === 'player-session' || appViewRef.current === 'dm-session') {
        return;
      }
      try {
        let mirrorObj: any = null;
        try {
          const rawMirror = localStorage.getItem(MIRROR_STORAGE_KEY);
          if (rawMirror) {
            mirrorObj = JSON.parse(rawMirror);
          }
        } catch {}

        const clientTimestamp =
          mirrorObj?.backupTimestamp ||
          (mirrorObj?.exportedAt ? new Date(mirrorObj.exportedAt).getTime() : 0);
        const clientRevision = mirrorObj?.revision || 0;
        const clientHash = mirrorObj?.contentHash || '';
        const savedSettings = loadHostSettings();
        const clientAb = savedSettings?.autoBackup
          ? {
              ...savedSettings.autoBackup,
              githubToken: '',
              githubRepo: '',
            }
          : undefined;

        const checkRes = await fetch('/api/vault/sync-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientTimestamp,
            clientRevision,
            clientHash,
            clientAutoBackupConfig: clientAb,
          }),
        });

        if (!checkRes.ok || !isMounted) return;
        const checkData = await checkRes.json();

        // Case A: Server is on Archivo Base or older backup than our Mirror -> Send full mirror snapshot so server archives older state and restores newest!
        if (checkData.action === 'REQUEST_CLIENT_MIRROR_UPLOAD' && mirrorObj) {
          const uploadRes = await fetch('/api/vault/sync-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientTimestamp,
              clientRevision,
              clientHash,
              clientAutoBackupConfig: clientAb,
              clientMirrorSnapshot: mirrorObj,
            }),
          });
          if (uploadRes.ok && isMounted) {
            fetchWorldSheets();
            setVaultSyncRevision((r) => r + 1);
          }
        }
        // Case B: Server has a newer backup (from a mutation or cloud recovery) -> Save to our local mirror!
        else if (checkData.action === 'UPDATE_CLIENT_MIRROR' && checkData.latestBackup) {
          const hadPreviousMirror = Boolean(mirrorObj);
          try {
            localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(checkData.latestBackup));
          } catch {}
          if (isMounted && hadPreviousMirror) {
            fetchWorldSheets();
            setVaultSyncRevision((r) => r + 1);
          }
        }
      } catch (err) {
        // Silent network retry on next interval
      }
    };

    const initTimer = setTimeout(runContinuousBackupComparison, 6000);
    const compareInterval = setInterval(runContinuousBackupComparison, 45000);
    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      clearInterval(compareInterval);
    };
  }, [authUser?.email]);

  // Real-time User Presence Heartbeat & Automatic Vault Revision Sync for ANY logged-in user
  useEffect(() => {
    if (!authUser?.id && !authUser?.email) return;
    let isMounted = true;

    const sendUserPresence = async () => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const currentView = appViewRef.current;
        const currentRoom = roomCodeRef.current;
        const activity =
          currentView === 'dm-session'
            ? `Dirigiendo Sala (${currentRoom})`
            : currentView === 'player-session'
            ? `Jugando en Sala (${currentRoom})`
            : currentView === 'player-solo'
            ? 'Modo Solitario'
            : 'En el Portal';

        const res = await fetch('/api/users/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authUser.id,
            email: authUser.email,
            activity,
          }),
        });
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (typeof data.vaultRevision === 'number') {
          if (lastSeenServerVaultRevRef.current === -1) {
            // Initialize baseline revision on first heartbeat without triggering redundant cascade
            lastSeenServerVaultRevRef.current = data.vaultRevision;
          } else if (data.vaultRevision !== lastSeenServerVaultRevRef.current) {
            lastSeenServerVaultRevRef.current = data.vaultRevision;
            fetchWorldSheets();
            setVaultSyncRevision((r) => r + 1);
          }
        }
      } catch {}
    };

    const initTimer = setTimeout(sendUserPresence, 2500);
    const hbInterval = setInterval(sendUserPresence, 30000);
    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      clearInterval(hbInterval);
    };
  }, [authUser?.id, authUser?.email, appView, roomCode]);

  // Send player heartbeat to room server
  const sendPlayerHeartbeat = async (char?: Character5e) => {
    const target = char || activeCharacterRef.current;
    if (!target) return;
    try {
      const prof = calculateProficiencyBonus(target.level);
      const equippedBonuses = target.inventory
        ? calculateEquippedItemStatBonuses(target.inventory)
        : null;
      const totalAbilities = resolveTarotCardAbilityScores(target, null);
      const pp = calculatePassivePerception(
        totalAbilities.wis.totalScore,
        target.skills.perception,
        prof
      );

      const resolvedPlayerName = target.playerName || authUser?.displayName || 'Jugador';
      const resolvedTagId = (authUser?.userTagId || '123').replace(/^@+/, '').trim() || '123';

      await fetch(`/api/session/room/${roomCode}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: target.id,
          characterName: target.name,
          playerName: resolvedPlayerName,
          playerTagId: resolvedTagId,
          playerFullTag: `${resolvedPlayerName}@${resolvedTagId}`,
          playerEmail: authUser?.email,
          avatarType: target.avatarType,
          avatarCustomUrl: target.avatarCustomUrl,
          avatarIcon: target.avatarIcon,
          avatarUrl: target.avatarUrl,
          currentHp: target.currentHp,
          maxHp: target.maxHp + (equippedBonuses?.maxHp ?? 0),
          ac: target.armorClass + (equippedBonuses?.ac ?? 0),
          passivePerception: pp,
          level: target.level,
          experience: target.experience ?? target.xp ?? 0,
          alignment: target.alignment,
          speed: (target.speed ?? 30) + (equippedBonuses?.speed ?? 0),
          initiative: (target.initiativeBonus ?? 0) + (equippedBonuses?.initiative ?? 0),
          race: target.race,
          characterClass: `${target.race} ${target.characterClass}`,
          lastRoll: recentRollRef.current || recentRoll,
          hpUpdatedAt: lastLocalPlayerMutationAtRef.current || undefined,
          abilities: {
            str: totalAbilities.str.totalScore,
            dex: totalAbilities.dex.totalScore,
            con: totalAbilities.con.totalScore,
            int: totalAbilities.int.totalScore,
            wis: totalAbilities.wis.totalScore,
            cha: totalAbilities.cha.totalScore,
          },
          currency: target.currency,
        }),
      });
    } catch (e) {}
  };

  // Helper to build LiveRoomProjection from DMWorkspace
  const buildLiveProjectionFromWorkspace = (targetWs: DMWorkspace): LiveRoomProjection => {
    return computeLiveProjectionFromWorkspace(targetWs, activeWorld?.name);
  };

  // Send DM heartbeat & active combatants to room server
  const sendDmHeartbeat = async (ws?: DMWorkspace) => {
    const targetWs = ws || dmWorkspaceRef.current;
    if (!targetWs) return;

    try {
      const shouldBroadcast = Boolean(targetWs.activeEncounter?.broadcastEnemiesToTable);
      const combatantsMini: LiveCombatantMini[] = (targetWs.activeEncounter?.combatants || []).map((c) => {
        const matchedMonster = (targetWs.monsters || []).find(
          (m) => m.name.toLowerCase() === c.name.toLowerCase()
        );
        return {
          id: c.id,
          name: c.name,
          hp: c.hp,
          maxHp: c.maxHp,
          ac: c.ac,
          passivePerception: c.passivePerception ?? 10,
          faction: c.faction || (c.isPlayer ? 'ally' : 'enemy'),
          isPlayer: Boolean(c.isPlayer),
          conditions: c.conditions || [],
          levelOrCr: matchedMonster?.cr ? `CR ${matchedMonster.cr}` : 'Niv 1',
          initiative: c.initiative,
          speed: matchedMonster?.speed || '30 ft.',
          avatarType: c.avatarType || matchedMonster?.avatarType,
          avatarCustomUrl: c.avatarCustomUrl || matchedMonster?.avatarCustomUrl,
          avatarIcon: c.avatarIcon || matchedMonster?.avatarIcon,
        };
      });
      const projection = buildLiveProjectionFromWorkspace(targetWs);

      await fetch(`/api/session/room/${roomCode}/dm-heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmLiveMessage: targetWs.dmLiveMessage || '',
          dmConnected: true,
          showCombatantsOnTable: shouldBroadcast,
          liveCombatants: combatantsMini,
          liveProjection: projection,
        }),
      });
    } catch (e) {}
  };

  // DM directly adjusts a player's HP or Gold in the active room
  const handleDmAdjustPlayer = async (
    characterId: string,
    updates: { hpDelta?: number; setHp?: number; gpDelta?: number }
  ) => {
    // Optimistic update on partyMembers
    setPartyMembers((prev) =>
      prev.map((m) => {
        if (m.characterId !== characterId) return m;
        const maxHp = Number(m.maxHp ?? 10);
        let nextHp = Number(m.currentHp ?? 10);
        if (typeof updates.setHp === 'number') {
          nextHp = Math.max(0, Math.min(maxHp, updates.setHp));
        } else if (typeof updates.hpDelta === 'number') {
          nextHp = Math.max(0, Math.min(maxHp, nextHp + updates.hpDelta));
        }
        const prevGp = Number(m.currency?.gp ?? 0);
        const nextGp =
          typeof updates.gpDelta === 'number' ? Math.max(0, prevGp + updates.gpDelta) : prevGp;
        return {
          ...m,
          currentHp: nextHp,
          currency: {
            ...(m.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
            gp: nextGp,
          },
          dmModifiedAt: Date.now(),
        };
      })
    );

    try {
      const res = await fetch(
        `/api/session/room/${encodeURIComponent(roomCode)}/dm-adjust-player`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId, ...updates }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.party)) {
          setPartyMembers(data.party);
        }
      }
    } catch {}
  };

  // Fetch world sheets for the authenticated DM
  const fetchWorldSheets = async () => {
    if (!authUser?.email) return;
    try {
      const res = await fetch(`/api/vault/worlds?ownerEmail=${encodeURIComponent(authUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.worlds)) {
          setWorldSheets(data.worlds);
        }
      }
    } catch (err) {
      console.error('Error fetching world sheets:', err);
    }
  };

  useEffect(() => {
    if (authUser && authUser.status === 'approved') {
      fetchWorldSheets();

      // Sincronización asíncrona de personajes desde Firestore
      loadCharactersAsync(authUser)
        .then((cloudChars) => {
          if (cloudChars && cloudChars.length > 0) {
            setCharacters(cloudChars);
          }
        })
        .catch(() => {});

      // Suscripción reactiva en tiempo real a cambios en Firestore
      const unsubscribe = subscribeToCharacters((updatedChars) => {
        if (updatedChars && updatedChars.length > 0) {
          setCharacters(updatedChars);
        }
      }, authUser);

      return () => {
        unsubscribe();
      };
    }
  }, [authUser?.id, authUser?.email, authUser?.status]);

  // Poll room server state & heartbeat active character / DM (Only when inside active online session)
  useEffect(() => {
    if (appView !== 'player-session' && appView !== 'dm-session') {
      return;
    }
    if (appView === 'dm-session' && activeWorld?.roomMode === 'offline') {
      return;
    }

    let isMounted = true;
    let isSyncing = false;

    const syncSession = async () => {
      if (isSyncing) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      isSyncing = true;
      try {
        // Send player heartbeat if player session
        if (appView === 'player-session') {
          await sendPlayerHeartbeat(activeCharacterRef.current);
        }

        // Send DM heartbeat if DM session (online mode)
        if (appView === 'dm-session' && activeWorld?.roomMode !== 'offline') {
          await sendDmHeartbeat(dmWorkspaceRef.current);
        }

        // Fetch full room state
        const res = await fetch(`/api/session/room/${roomCode}`);
        if (!isMounted) return;

        const isPreviewSessionUrl =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('view') === 'player-session';

        if (res.status === 404) {
          const data = await res.json().catch(() => ({}));
          if (appView === 'player-session' && !isPreviewSessionUrl) {
            const evalRes = evaluateRoomClosureResilience({
              responseStatus: 404,
              responseClosed: Boolean(data.closed),
              explicitlyClosedByDm: Boolean(data.explicitlyClosedByDm),
              consecutiveClosedCount: consecutiveClosedPollsRef.current,
              isPreviewSessionUrl,
            });
            consecutiveClosedPollsRef.current = evalRes.nextConsecutiveClosedCount;
            if (evalRes.shouldReturnToLobby) {
              setReconnectingNotice('');
              setRoomClosedAlert(data.error || 'La mesa ha sido cerrada por el Dungeon Master.');
              setAppView('lobby');
              return;
            } else if (evalRes.showReconnectingNotice) {
              setReconnectingNotice('Reconectando con la mesa...');
              return;
            }
          }
        }

        if (res.ok) {
          const data = await res.json();
          if (appView === 'player-session' && !isPreviewSessionUrl) {
            const evalRes = evaluateRoomClosureResilience({
              responseStatus: 200,
              responseClosed: Boolean(data.closed),
              explicitlyClosedByDm: Boolean(data.explicitlyClosedByDm),
              consecutiveClosedCount: consecutiveClosedPollsRef.current,
              isPreviewSessionUrl,
            });
            consecutiveClosedPollsRef.current = evalRes.nextConsecutiveClosedCount;
            if (evalRes.shouldReturnToLobby) {
              setReconnectingNotice('');
              setRoomClosedAlert(data.error || 'El Dungeon Master ha cerrado la mesa.');
              setAppView('lobby');
              return;
            } else if (evalRes.showReconnectingNotice) {
              setReconnectingNotice('Reconectando con la mesa...');
              return;
            }
          }

          setReconnectingNotice('');
          // Flush any locally queued events from a previous micro-disconnection
          flushOfflineTableEvents(roomCode).catch(() => {});

          const recentlyMutatedDmLocally =
            Date.now() - lastLocalDmMutationAtRef.current < 3500;

          if (Array.isArray(data.party)) {
            if (appView === 'player-session' && activeCharacterRef.current) {
              const currentChar = activeCharacterRef.current;
              const myEntry = data.party.find(
                (p: any) => p.characterId === currentChar.id
              );

              if (myEntry) {
                const hpRes = resolveAuthoritativePlayerHp({
                  localCurrentHp: currentChar.currentHp,
                  localHpUpdatedAt: lastLocalPlayerMutationAtRef.current,
                  serverCurrentHp: myEntry.currentHp,
                  serverHpUpdatedAt: myEntry.hpUpdatedAt,
                  serverDmModifiedAt: myEntry.dmModifiedAt,
                  lastSeenDmModifiedAt: lastSeenDmModifiedAtRef.current,
                });

                lastSeenDmModifiedAtRef.current = hpRes.nextLastSeenDmModifiedAt;

                if (hpRes.shouldApplyServerToLocal) {
                  lastLocalPlayerMutationAtRef.current = hpRes.effectiveHpUpdatedAt;
                  const updatedChar: Character5e = {
                    ...currentChar,
                    currentHp: hpRes.currentHp,
                    currency: myEntry.currency || currentChar.currency,
                  };
                  activeCharacterRef.current = updatedChar;
                  setCharacters((prev) => {
                    const next = prev.map((c) => (c.id === updatedChar.id ? updatedChar : c));
                    saveCharacters(next);
                    return next;
                  });
                }
              }
            }

            setPartyMembers(
              data.party.map((m: any) => {
                if (
                  appView === 'player-session' &&
                  activeCharacterRef.current &&
                  m.characterId === activeCharacterRef.current.id
                ) {
                  const charNow = activeCharacterRef.current;
                  const eqBonuses = charNow.inventory
                    ? calculateEquippedItemStatBonuses(charNow.inventory)
                    : null;
                  return {
                    ...m,
                    currentHp: charNow.currentHp,
                    maxHp: charNow.maxHp + (eqBonuses?.maxHp ?? 0),
                    currency: charNow.currency,
                  };
                }
                return m;
              })
            );
          }
          if (Array.isArray(data.rollFeed)) {
            setRollFeed(data.rollFeed.slice(-35));
          }
          setServerDmConnected(Boolean(data.dmConnected));
          setServerDmLiveMessage(data.dmLiveMessage || '');
          if (data.dmLastRoll) {
            setServerDmLastRoll(data.dmLastRoll);
          }
          if (!recentlyMutatedDmLocally) {
            if (data.showCombatantsOnTable !== undefined) {
              setShowCombatantsOnTable(Boolean(data.showCombatantsOnTable));
            }
            if (Array.isArray(data.liveCombatants)) {
              setLiveCombatants(data.liveCombatants);
            }
            if (data.liveProjection) {
              setLiveProjection(data.liveProjection);
            }
          }
          if (Array.isArray(data.playerMessages)) {
            setRoomPlayerMessages(data.playerMessages);
          }

          // Process DM -> Player share offers & resolutions
          if (Array.isArray(data.pendingOffers)) {
            const offers: PendingDmOffer[] = data.pendingOffers;

            if (appView === 'player-session' && activeCharacterRef.current) {
              const myCharId = activeCharacterRef.current.id;
              const myCharName = (activeCharacterRef.current.name || '').trim().toLowerCase();
              const myPending = offers.filter(
                (o) =>
                  o.status === 'pending' &&
                  (o.targetCharacterId === myCharId ||
                    (myCharName &&
                      String(o.targetCharacterName || '').trim().toLowerCase() === myCharName))
              );
              setPendingPlayerOffers(myPending);
            }

            if (appView === 'dm-session') {
              const newlyResolved = offers.filter(
                (o) =>
                  (o.status === 'accepted' || o.status === 'declined') &&
                  !o.dmNotified &&
                  !seenResolvedOffersRef.current.has(o.id)
              );

              if (newlyResolved.length > 0) {
                const newNotifs: {
                  id: string;
                  offerId: string;
                  accepted: boolean;
                  message: string;
                  timestamp: number;
                }[] = [];

                for (const o of newlyResolved) {
                  seenResolvedOffersRef.current.add(o.id);
                  const kindLabel =
                    o.kind === 'spell'
                      ? 'el conjuro'
                      : o.kind === 'ability'
                      ? 'la habilidad'
                      : 'el objeto';
                  const accepted = o.status === 'accepted';
                  const msg = accepted
                    ? `✅ ¡${o.targetCharacterName} (${o.targetPlayerName || 'Jugador'}) ACEPTÓ recibir ${kindLabel} "${o.title}"! Ya se encuentra en su ficha.`
                    : `❌ ${o.targetCharacterName} (${o.targetPlayerName || 'Jugador'}) RECHAZÓ recibir ${kindLabel} "${o.title}".`;
                  newNotifs.push({
                    id: `dm-notif-${Date.now()}-${o.id}`,
                    offerId: o.id,
                    accepted,
                    message: msg,
                    timestamp: Date.now(),
                  });

                  fetch(
                    `/api/session/room/${encodeURIComponent(roomCode)}/offer/${encodeURIComponent(o.id)}/ack-dm`,
                    { method: 'POST' }
                  ).catch(() => {});
                }

                setDmOfferNotifications((prev) => [...newNotifs, ...prev]);
              }
            }
          }
        }
      } catch (err) {
        // Offline handling
      } finally {
        isSyncing = false;
      }
    };

    syncSession();
    const interval = setInterval(syncSession, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [appView, roomCode, activeWorld?.roomMode]);

  // Auth / Role Selection Callback
  const handleSelectRole = (role: UserRole, user?: AuthSessionUser) => {
    setUserRole(role);
    saveUserRole(role);
    if (user) {
      setAuthUser(user);
      saveAuthUser(user);
    }
    setIsRoleModalOpen(false);
    setAppView('lobby');
  };

  const handleLogout = () => {
    setAuthUser(null);
    saveAuthUser(null);
    saveUserRole(null);
    setAppView('lobby');
  };

  const handleRefreshAuthStatus = async () => {
    if (!authUser?.email) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch(`/api/auth/me?email=${encodeURIComponent(authUser.email)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status) {
          const updated: AuthSessionUser = {
            id: data.id,
            email: data.email,
            displayName: data.displayName,
            userTagId: data.userTagId || authUser.userTagId || '123',
            fullTag: data.fullTag || `${data.displayName}@${data.userTagId || '123'}`,
            avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : authUser.avatarUrl,
            friends: Array.isArray(data.friends) ? data.friends : authUser.friends || [],
            role: data.role || authUser.role,
            appRole: data.appRole || authUser.appRole,
            playerType: data.playerType || authUser.playerType,
            requestedPlayerType: data.requestedPlayerType,
            playerTypeChangeRequested: Boolean(data.playerTypeChangeRequested),
            status: data.status,
          };
          setAuthUser((prev) => {
            if (prev && JSON.stringify(prev) === JSON.stringify(updated)) {
              return prev;
            }
            saveAuthUser(updated);
            return updated;
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!authUser?.email) return;
    const initTimer = setTimeout(handleRefreshAuthStatus, 3500);
    const interval = setInterval(handleRefreshAuthStatus, 30000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [authUser?.email]);

  // Launch Player Sheet into active table
  const handleSelectCharacterToPlay = (character: Character5e, code: string) => {
    const scopedId =
      character.id === 'char-1' && authUser?.id
        ? `char-1-${authUser.id}`
        : character.id;
    const readyChar: Character5e =
      scopedId !== character.id ? { ...character, id: scopedId } : character;

    setCharacters((prev) => {
      const filtered = prev.filter((c) => c.id !== character.id && c.id !== readyChar.id);
      const next = [...filtered, readyChar];
      saveCharacters(next);
      return next;
    });
    activeCharacterRef.current = readyChar;
    setActiveCharId(readyChar.id);
    saveActiveCharacterId(readyChar.id);
    setRoomCode(code);
    saveRoomCode(code);
    setAppView('player-session');
  };

  // Open Player Sheet in solo / editing mode from lobby
  const handleEditCharacterSolo = (character: Character5e) => {
    setCharacters((prev) => {
      const exists = prev.some((c) => c.id === character.id);
      const next = exists ? prev.map((c) => (c.id === character.id ? character : c)) : [...prev, character];
      saveCharacters(next);
      return next;
    });
    activeCharacterRef.current = character;
    setActiveCharId(character.id);
    saveActiveCharacterId(character.id);
    setAppView('player-solo');
  };

  // Player responds (Accept or Decline) to a DM shared Item, Spell, or Ability offer
  const handleRespondToDmOffer = async (offer: PendingDmOffer, decision: 'accepted' | 'declined') => {
    if (!activeCharacterRef.current) return;
    setIsRespondingOffer(true);
    try {
      const currentChar = activeCharacterRef.current;
      const normRoom = (roomCode || 'MESA-PRINCIPAL').trim().toUpperCase();

      const res = await fetch(
        `/api/session/room/${encodeURIComponent(normRoom)}/offer/${encodeURIComponent(offer.id)}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            character: currentChar,
          }),
        }
      );

      const data = await res.json();

      if (decision === 'accepted') {
        // Immediately apply the received item, spell, or ability to the player's active character state
        const updatedChar: Character5e = {
          ...currentChar,
          inventory: [...(currentChar.inventory || [])],
          spells: [...(currentChar.spells || [])],
          featuresAndTraits: [...(currentChar.featuresAndTraits || [])],
          customSkills: [...(currentChar.customSkills || [])],
        };

        if (offer.kind === 'item' && offer.item) {
          const normClass = normalizePlayerSheetItemCategory({
            category: offer.item.category || offer.category,
            itemGroup: offer.item.itemGroup,
            name: offer.item.name || offer.title,
            weaponAttacks: offer.item.weaponAttacks,
          });
          const normalizedItem: InventoryItem = {
            ...offer.item,
            category: normClass.category,
            itemGroup: normClass.itemGroup,
            weaponAttacks: normClass.itemGroup === 'weapon' ? offer.item.weaponAttacks : undefined,
          };
          if (!updatedChar.inventory.some((i) => i.id === normalizedItem.id)) {
            updatedChar.inventory.push(normalizedItem);
          }
        } else if (offer.kind === 'spell' && offer.spell) {
          if (!updatedChar.spells.some((s) => s.id === offer.spell!.id)) {
            updatedChar.spells.push(offer.spell);
          }
        } else if (offer.kind === 'ability' && offer.ability) {
          if (!updatedChar.featuresAndTraits.some((f) => f.id === offer.ability!.id)) {
            updatedChar.featuresAndTraits.push(offer.ability);
          }
          if (!updatedChar.customSkills!.some((cs) => cs.id === offer.ability!.id || cs.name === offer.ability!.name)) {
            updatedChar.customSkills!.push({
              id: offer.ability.id || `cskill-${Date.now()}`,
              name: offer.ability.name,
              ability: offer.ability.abilityStat || 'int',
              proficiency: 'proficient',
              description: offer.ability.description || 'Habilidad otorgada por el Dungeon Master.',
            });
          }
        }

        handleUpdateCharacter(updatedChar);

        // Also sync to vault immediately
        if (authUser?.email) {
          fetch('/api/vault/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              character: updatedChar,
              ownerEmail: authUser.email,
              reason: 'manual',
            }),
          }).catch(() => {});
        }

        const kindText =
          offer.kind === 'spell'
            ? 'el conjuro'
            : offer.kind === 'ability'
            ? 'la habilidad'
            : 'el objeto';
        setPlayerOfferFeedback(
          `🎁 ¡Has aceptado y recibido ${kindText} "${offer.title}" en la hoja de ${updatedChar.name}!`
        );
      } else {
        setPlayerOfferFeedback(`Has rechazado recibir "${offer.title}" del Dungeon Master.`);
      }

      setTimeout(() => setPlayerOfferFeedback(''), 6000);

      // Remove from pending offers
      setPendingPlayerOffers((prev) => prev.filter((o) => o.id !== offer.id));

      // Notify DM instantaneously if on same browser
      if (broadcastChannelRef.current && data?.offer) {
        broadcastChannelRef.current.postMessage({
          type: 'DM_OFFER_RESPONDED',
          payload: data.offer,
        });
      }
    } catch (e) {
      console.error('Error responding to DM offer:', e);
    } finally {
      setIsRespondingOffer(false);
    }
  };

  // Delete Character
  const handleDeleteCharacter = async (charId: string): Promise<boolean> => {
    deleteCharacterAsync(charId, authUser).catch(() => {});
    if (!authUser?.email) return false;
    try {
      const res = await fetch(`/api/vault/sheets/${charId}?ownerEmail=${encodeURIComponent(authUser.email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== charId));
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  // Save Character to Cloud Vault & Firestore
  const handlePlayerSaveToCloud = async () => {
    if (activeCharacter) {
      saveCharactersAsync(characters, authUser).catch(() => {});
    }
    if (activeCharacter && authUser?.email) {
      try {
        await fetch('/api/vault/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: activeCharacter,
            ownerEmail: authUser.email,
            reason: 'manual',
          }),
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Player leaves table and returns to lobby
  const handlePlayerReturnToLobby = async () => {
    if (activeCharacter && authUser?.email) {
      await handlePlayerSaveToCloud();
      try {
        await fetch(`/api/session/room/${roomCode}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: activeCharacter.id,
            character: activeCharacter,
            ownerEmail: authUser.email,
          }),
        });
      } catch (e) {}
    }
    setIsSessionMapViewOpen(false);
    setAppView('lobby');
  };

  // Create World Sheet (Clean slate starting from zero)
  const handleCreateWorldSheet = async (config: {
    name: string;
    roomCode: string;
    roomPassword?: string;
    roomMode?: 'online' | 'offline';
  }) => {
    if (!authUser?.email) return;

    const newWorld: WorldSheetSummary = {
      id: `world-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerEmail: authUser.email,
      name: config.name,
      roomCode: config.roomCode,
      roomPassword: config.roomPassword,
      roomMode: config.roomMode || 'online',
      lastPlayed: Date.now(),
      workspace: {
        ...SAMPLE_DM_WORKSPACE,
        npcs: [],
        monsters: [],
        locations: [],
        campaignLogs: [],
        combatSummaries: [],
        customItemsAndSpells: [],
        folders: ['General', 'Campaña'],
        activeEncounter: {
          id: `enc-${Date.now()}`,
          name: 'Combate',
          round: 1,
          currentTurnIndex: 0,
          combatants: [],
          isActive: false,
          combatNotes: '',
          combatLog: [],
        },
      },
    };

    const res = await fetch('/api/vault/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ world: newWorld }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al guardar World Sheet.');
    }

    setWorldSheets((prev) => [...prev, newWorld]);
  };

  // Update World Sheet Config (Name, RoomCode, Password, RoomMode)
  const handleUpdateWorldSheetConfig = async (
    worldId: string,
    updates: { name: string; roomCode: string; roomPassword?: string; roomMode?: 'online' | 'offline' }
  ) => {
    if (!authUser?.email) return;
    const res = await fetch(`/api/vault/worlds/${worldId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, ownerEmail: authUser.email }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Ya existe una mesa con ese nombre creada por otro Dungeon Master.');
    }
    setWorldSheets((prev) =>
      prev.map((w) => (w.id === worldId ? { ...w, ...updates } : w))
    );
    setActiveWorld((prev) => (prev && prev.id === worldId ? { ...prev, ...updates } : prev));
  };

  // Delete World Sheet
  const handleDeleteWorldSheet = async (worldId: string) => {
    if (!authUser?.email) return;
    try {
      const res = await fetch(`/api/vault/worlds/${worldId}?ownerEmail=${encodeURIComponent(authUser.email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWorldSheets((prev) => prev.filter((w) => w.id !== worldId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // DM Opens World Sheet -> Room becomes ACTIVE on server if online, or opens in solo/offline mode if offline
  const handleOpenWorldSheet = async (world: WorldSheetSummary) => {
    const mode = world.roomMode || 'online';
    if (mode === 'online') {
      try {
        const res = await fetch('/api/rooms/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: world.roomCode,
            name: world.name,
            dmEmail: authUser?.email || 'dm@weroll.app',
            dmDisplayName: authUser?.displayName || 'Dungeon Master',
            password: world.roomPassword,
            worldSheetId: world.id,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setRoomClosedAlert(
            errData.error ||
              `No se pudo abrir la sala "${world.roomCode}" porque ya existe una mesa con ese nombre creada por otro Dungeon Master.`
          );
          return;
        }
      } catch (e) {
        console.error('Error activating room:', e);
      }
    } else {
      // Ensure room is closed on server when opening in Offline edit mode
      try {
        await fetch('/api/rooms/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: world.roomCode }),
        });
      } catch {}
    }

    setActiveWorld({ ...world, roomMode: mode });
    setDmWorkspace(world.workspace);
    setRoomPlayerMessages(Array.isArray(world.workspace?.playerMessages) ? world.workspace.playerMessages : []);
    setRoomCode(world.roomCode);
    saveRoomCode(world.roomCode);
    setIsSessionMapViewOpen(false);
    setAppView('dm-session');
  };

  // Toggle Online/Offline Mode while inside DM Screen
  const handleToggleDmOfflineMode = async (offline: boolean) => {
    if (!activeWorld) return;
    const nextMode: 'online' | 'offline' = offline ? 'offline' : 'online';
    const updatedWorld: WorldSheetSummary = { ...activeWorld, roomMode: nextMode };
    setActiveWorld(updatedWorld);
    setWorldSheets((prev) => prev.map((w) => (w.id === activeWorld.id ? updatedWorld : w)));

    if (authUser?.email) {
      fetch(`/api/vault/worlds/${activeWorld.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeWorld.name,
          roomCode: activeWorld.roomCode,
          roomPassword: activeWorld.roomPassword,
          roomMode: nextMode,
          ownerEmail: authUser.email,
        }),
      }).catch(() => {});
    }

    if (offline) {
      try {
        await fetch('/api/rooms/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: activeWorld.roomCode }),
        });
      } catch {}
    } else {
      try {
        await fetch('/api/rooms/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: activeWorld.roomCode,
            name: activeWorld.name,
            dmEmail: authUser?.email || 'dm@weroll.app',
            dmDisplayName: authUser?.displayName || 'Dungeon Master',
            password: activeWorld.roomPassword,
            worldSheetId: activeWorld.id,
          }),
        });
      } catch {}
    }
  };

  // DM Saves World Sheet to Cloud Vault
  const handleDmSaveToCloud = async () => {
    if (activeWorld) {
      saveDMWorkspaceAsync(dmWorkspace, authUser, activeWorld.id).catch(() => {});
    }
    if (activeWorld && authUser?.email) {
      try {
        await fetch('/api/vault/worlds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            world: {
              ...activeWorld,
              workspace: dmWorkspace,
              lastPlayed: Date.now(),
            },
          }),
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // DM Saves World Sheet and Closes Room (Table ceases to exist!)
  const handleDmSaveAndReturnToLobby = async () => {
    await handleDmSaveToCloud();

    // Close room on server
    try {
      await fetch('/api/rooms/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode }),
      });
    } catch (e) {
      console.error('Error closing room:', e);
    }

    setIsSessionMapViewOpen(false);
    setAppView('lobby');
    fetchWorldSheets();
  };

  // Character updates
  const handleUpdateCharacter = (updated: Character5e) => {
    lastLocalPlayerMutationAtRef.current = Date.now();
    activeCharacterRef.current = updated;
    const newChars = characters.some((c) => c.id === updated.id)
      ? characters.map((c) => (c.id === updated.id ? updated : c))
      : [...characters, updated];
    setCharacters(newChars);
    saveCharacters(newChars);
    saveCharactersAsync(newChars, authUser).catch(() => {});

    if (authUser?.email) {
      if (playerVaultSaveTimeoutRef.current) {
        clearTimeout(playerVaultSaveTimeoutRef.current);
      }
      const saveDelay = appView === 'player-session' ? 1200 : 250;
      playerVaultSaveTimeoutRef.current = setTimeout(() => {
        fetch('/api/vault/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: activeCharacterRef.current || updated,
            ownerEmail: authUser.email,
            reason: 'manual',
          }),
        }).catch(() => {});
      }, saveDelay);
    }

    if (appView === 'player-session') {
      const prof = calculateProficiencyBonus(updated.level);
      const equippedBonuses = updated.inventory
        ? calculateEquippedItemStatBonuses(updated.inventory)
        : null;
      const totalAbilities = resolveTarotCardAbilityScores(updated, null);
      const pp = calculatePassivePerception(
        totalAbilities.wis.totalScore,
        updated.skills.perception,
        prof
      );

      // Optimistic update of local player card so HP, stats, race/class and coins refresh INSTANTLY
      setPartyMembers((prev) =>
        prev.map((m) =>
          m.characterId === updated.id
            ? {
                ...m,
                characterName: updated.name,
                playerName: updated.playerName,
                avatarType: updated.avatarType,
                avatarCustomUrl: updated.avatarCustomUrl,
                avatarIcon: updated.avatarIcon,
                avatarUrl: updated.avatarUrl,
                level: updated.level,
                experience: updated.experience ?? updated.xp ?? 0,
                alignment: updated.alignment,
                speed: (updated.speed ?? 30) + (equippedBonuses?.speed ?? 0),
                initiative: (updated.initiativeBonus ?? 0) + (equippedBonuses?.initiative ?? 0),
                race: updated.race,
                characterClass: `${updated.race} ${updated.characterClass}`,
                currentHp: updated.currentHp,
                maxHp: updated.maxHp + (equippedBonuses?.maxHp ?? 0),
                ac: updated.armorClass + (equippedBonuses?.ac ?? 0),
                passivePerception: pp,
                hpUpdatedAt: lastLocalPlayerMutationAtRef.current,
                abilities: {
                  str: totalAbilities.str.totalScore,
                  dex: totalAbilities.dex.totalScore,
                  con: totalAbilities.con.totalScore,
                  int: totalAbilities.int.totalScore,
                  wis: totalAbilities.wis.totalScore,
                  cha: totalAbilities.cha.totalScore,
                },
                currency: updated.currency,
              }
            : m
        )
      );

      // Immediate heartbeat push to server
      sendPlayerHeartbeat(updated);
    }
  };

  // Handle dice rolls
  const handleTriggerRoll = (title: string, modifier: number, diceType: number = 20) => {
    setRollerTitle(title);
    setRollerMod(modifier);
    setRollerSides(diceType);
    setRollerMode('normal');
    setIsRollerOpen(true);
  };

  const handleRollComplete = async (result: DiceRollResult) => {
    setRecentRoll(result);
    setRollFeed((prev) => [...prev, result]);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'NEW_ROLL',
        payload: result,
      });
    }

    try {
      const isDmRoll = appView === 'dm-session';
      const res = await fetch(
        `/api/session/room/${roomCode}/roll?isDm=${isDmRoll}&characterId=${activeCharacter?.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
        }
      );
      if (!res.ok) throw new Error('Roll sync failed');
    } catch (e) {
      enqueueOfflineTableEvent({
        roomCode,
        type: 'ROLL',
        characterId: activeCharacter?.id,
        characterName: activeCharacter?.name,
        playerName: activeCharacter?.playerName,
        payload: { roll: result },
      });
    }
  };

  const handleBroadcastAnnouncement = (title: string, content: string) => {
    const ann = { title, content };
    setActiveAnnouncement(ann);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'ANNOUNCEMENT',
        payload: ann,
      });
    }
  };

  const handleOpenAIOracle = (initialPrompt?: string) => {
    if (!canUseArcaneOracle) {
      setOracleClientBlockedNotice(
        '🔒 Sabio Arcano se encuentra en desarrollo (Disponible próximamente para clientes).'
      );
      setTimeout(() => setOracleClientBlockedNotice(''), 4500);
      return;
    }
    if (initialPrompt) setOracleInitialPrompt(initialPrompt);
    setIsOracleOpen(true);
  };

  const handleSaveHostSettings = async (newSettings: HostSettings) => {
    setHostSettings(newSettings);
    saveHostSettings(newSettings);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) {
          setHostSettings(data.settings);
          saveHostSettings(data.settings);
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'SETTINGS_UPDATED',
        payload: newSettings,
      });
    }
  };

  const hasCustomAppLayout = Boolean(onlineAppSkin?.themeTokens?.lobbyPageLayout);
  const liveAppLayout = resolveLobbyPageLayout(onlineAppSkin?.themeTokens);

  return (
    <div
      style={
        onlineAppSkin?.themeTokens?.appBgColor
          ? { backgroundColor: onlineAppSkin.themeTokens.appBgColor }
          : undefined
      }
      className={`min-h-screen relative ${onlineAppSkin?.themeTokens?.appBgGradient || 'bg-[#101115]'} text-[#e2d9cc] flex flex-col font-sans selection:bg-amber-700 selection:text-white`}
    >
      {/* Optional Global Wallpaper & Custom Overlay from Lobby Page Builder */}
      {liveAppLayout.wallpaperUrl && (
        <div
          style={{
            backgroundImage: `url("${liveAppLayout.wallpaperUrl}")`,
            opacity: liveAppLayout.wallpaperOpacity ?? 0.35,
          }}
          className="fixed inset-0 bg-cover bg-center pointer-events-none z-0"
        />
      )}
      {liveAppLayout.customOverlayUrl && (
        <div
          style={{
            backgroundImage: `url("${liveAppLayout.customOverlayUrl}")`,
            opacity: liveAppLayout.customOverlayOpacity ?? 0.5,
          }}
          className="fixed inset-0 bg-repeat bg-center pointer-events-none z-10"
        />
      )}

      {/* =================================================================== */}
      {/* TOP COMPACT APPLICATION HEADER                                      */}
      {/* =================================================================== */}
      <header
        style={
          hasCustomAppLayout
            ? computeLobbyBlockContainerStyle(liveAppLayout.blocks.top_header)
            : undefined
        }
        className={`sticky top-0 z-40 ${onlineAppSkin?.themeTokens?.topHeaderBg || 'bg-[#12131a]/95'} backdrop-blur-md border-b ${onlineAppSkin?.themeTokens?.topHeaderBorder || 'border-[#c8a45c]/40'} shadow-xl`}
      >
        <div className="max-w-[1920px] mx-auto px-2.5 sm:px-4 min-h-[60px] py-1.5 flex items-center justify-between gap-2 flex-wrap xl:flex-nowrap">
          {/* Left: Branding + Version + Session Return/Save Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setIsSessionMapViewOpen(false);
                setAppView('lobby');
              }}
              className="flex items-center gap-2 text-left group transition cursor-pointer shrink-0"
            >
              <BrandLogo hostSettings={hostSettings} size="md" className="group-hover:scale-105 transition" />
              <span
                style={
                  hasCustomAppLayout && liveAppLayout.blocks.top_header?.titleColor
                    ? {
                        color: liveAppLayout.blocks.top_header.titleColor,
                        fontSize: liveAppLayout.blocks.top_header.titleFontSizePx
                          ? `${liveAppLayout.blocks.top_header.titleFontSizePx}px`
                          : undefined,
                      }
                    : undefined
                }
                className={`font-cinzel font-black ${
                  appView === 'lobby' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
                } ${onlineAppSkin?.themeTokens?.titleColor || 'text-[#f5e4be]'} tracking-wider uppercase leading-none group-hover:text-amber-300 transition`}
              >
                {(hasCustomAppLayout && liveAppLayout.blocks.top_header?.titleText) ||
                  onlineAppSkin?.themeTokens?.headerBrandText ||
                  hostSettings.headerTitle ||
                  'WEROLL'}
              </span>
            </button>

            {/* Version & Updates Button right next to Title */}
            <button
              type="button"
              onClick={() => setIsChangelogOpen(true)}
              className="px-2 py-0.5 rounded-full bg-[#1b1d28] hover:bg-[#252836] border border-[#c8a45c]/50 text-[#e2c275] text-[10px] font-cinzel font-bold flex items-center gap-1 transition shadow cursor-pointer shrink-0"
              title="Ver historial de versiones y novedades"
            >
              <span>v{hostSettings.changelog?.[0]?.version || '1.4 Beta'}</span>
              <span className="w-3.5 h-3.5 rounded-full bg-[#c8a45c]/25 border border-[#e2c275] text-[#f5e4be] flex items-center justify-center text-[9px] font-black">
                ?
              </span>
            </button>
            {reconnectingNotice && (
              <span className="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/60 text-amber-300 text-[10px] font-cinzel font-bold animate-pulse">
                ⚡ {reconnectingNotice}
              </span>
            )}

            {/* Unified Return & Save Buttons in Top Bar when inside Sheet, DM Screen, or Map Mode */}
            {appView !== 'lobby' && (
              <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-[#c8a45c]/30">
                {isSessionMapViewOpen ? (
                  <button
                    type="button"
                    data-testid="btn-map-return-sheet"
                    onClick={() => setIsSessionMapViewOpen(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#23201c] to-[#191714] hover:from-[#302b25] border border-[#c8a45c]/75 text-[#f5e4be] font-cinzel font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap"
                    title={
                      appView === 'dm-session'
                        ? 'Regresar a World Sheet'
                        : 'Regresar a Hoja de Personaje'
                    }
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#e2c275] shrink-0" />
                    <span>
                      {appView === 'dm-session'
                        ? 'Regresar a World Sheet'
                        : 'Regresar a Hoja de Personaje'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={
                      appView === 'dm-session' ? 'btn-dm-return-lobby' : 'btn-player-return-lobby'
                    }
                    onClick={
                      appView === 'dm-session'
                        ? handleDmSaveAndReturnToLobby
                        : handlePlayerReturnToLobby
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-[#1b1d28] hover:bg-[#252836] text-[#f5e4be] font-cinzel font-bold text-[10px] uppercase tracking-wider transition flex items-center gap-1.5 border border-[#c8a45c]/65 shadow cursor-pointer whitespace-nowrap"
                    title="Regresar al Lobby"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#e2c275] shrink-0" />
                    <span>Regresar al Lobby</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid={
                    appView === 'dm-session' ? 'btn-dm-save-cloud' : 'btn-map-save-cloud'
                  }
                  onClick={
                    appView === 'dm-session' ? handleDmSaveToCloud : handlePlayerSaveToCloud
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-emerald-950 hover:from-emerald-900 hover:to-emerald-800 text-emerald-100 font-cinzel font-bold text-[10px] uppercase tracking-wider transition flex items-center gap-1.5 border border-emerald-400/75 shadow cursor-pointer whitespace-nowrap"
                  title="Guardar en la Nube"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>Guardar</span>
                </button>
              </div>
            )}
          </div>

          {/* Center: Unified Dungeon Master Banner + Ubicación Actual / Mapa Button (in both Sheet & Map Mode) */}
          {appView !== 'lobby' && (
            <div
              data-testid="top-session-unified-bar"
              className="flex-1 flex items-center justify-center gap-2 min-w-0"
            >
              {/* Estandarte del Dungeon Master */}
              <div className="flex-1 max-w-2xl bg-gradient-to-r from-[#1c1528] via-[#15121f] to-[#1c1528] border border-[#c8a45c]/75 rounded-xl px-2.5 py-1 flex items-center justify-between gap-2 shadow-lg min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    data-testid="dm-purple-banner-flag"
                    className="w-8 h-8 rounded-lg bg-gradient-to-b from-purple-700 via-purple-900 to-[#241038] border border-[#e2c275] flex flex-col items-center justify-center shrink-0 shadow"
                    title="Estandarte del Dungeon Master"
                  >
                    <Crown className="w-4 h-4 text-[#f5e4be]" />
                  </div>

                  {appView === 'dm-session' ? (
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <span className="font-cinzel font-black text-[10px] text-[#f5e4be] uppercase tracking-wider hidden sm:inline shrink-0">
                        DM:
                      </span>
                      <input
                        type="text"
                        value={topDmMessageInput}
                        onChange={(e) => setTopDmMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const msg =
                              topDmMessageInput.trim() ||
                              dmWorkspace.dmLiveMessage ||
                              '¡Aventureros en posición!';
                            const updated = { ...dmWorkspace, dmLiveMessage: msg };
                            lastLocalDmMutationAtRef.current = Date.now();
                            dmWorkspaceRef.current = updated;
                            setDmWorkspace(updated);
                            saveDMWorkspace(updated);
                            setServerDmLiveMessage(msg);
                            if (broadcastChannelRef.current) {
                              broadcastChannelRef.current.postMessage({
                                type: 'DM_LIVE_MESSAGE',
                                payload: msg,
                              });
                            }
                            sendDmHeartbeat(updated);
                            setTopDmMessageSentToast(true);
                            setTimeout(() => setTopDmMessageSentToast(false), 2000);
                          }
                        }}
                        placeholder={
                          dmWorkspace.dmLiveMessage ||
                          'Escribe mensaje en vivo para la sala...'
                        }
                        className="flex-1 min-w-[120px] bg-[#0e1017] border border-stone-700 focus:border-[#c8a45c] rounded-lg px-2.5 py-1 text-xs text-stone-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        data-testid="btn-send-dm-live-message"
                        onClick={() => {
                          const msg =
                            topDmMessageInput.trim() ||
                            dmWorkspace.dmLiveMessage ||
                            '¡Aventureros en posición!';
                          const updated = { ...dmWorkspace, dmLiveMessage: msg };
                          lastLocalDmMutationAtRef.current = Date.now();
                          dmWorkspaceRef.current = updated;
                          setDmWorkspace(updated);
                          saveDMWorkspace(updated);
                          setServerDmLiveMessage(msg);
                          if (broadcastChannelRef.current) {
                            broadcastChannelRef.current.postMessage({
                              type: 'DM_LIVE_MESSAGE',
                              payload: msg,
                            });
                          }
                          sendDmHeartbeat(updated);
                          setTopDmMessageSentToast(true);
                          setTimeout(() => setTopDmMessageSentToast(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 border border-emerald-400/80 text-white font-cinzel font-bold text-[10px] flex items-center gap-1 cursor-pointer shrink-0 shadow"
                      >
                        <Send className="w-3 h-3" />
                        <span>{topDmMessageSentToast ? '¡Enviado!' : 'Enviar'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-cinzel font-black text-[10px] text-[#f5e4be] uppercase tracking-wider">
                          DUNGEON MASTER
                        </span>
                        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Mesa: {roomCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-100/95 truncate">
                        {serverDmLiveMessage ||
                          dmWorkspace.dmLiveMessage ||
                          'El Dungeon Master observa la mesa en silencio...'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsRollFeedOpen(true)}
                    className="px-2 py-1 rounded-lg bg-black/55 hover:bg-black/80 border border-purple-400/40 text-purple-200 font-cinzel font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    title="Ver historial de tiradas de la sala"
                  >
                    <Dices className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden md:inline">Tiradas ({rollFeed.length})</span>
                  </button>

                  {appView !== 'dm-session' && (
                    <button
                      type="button"
                      onClick={() => setIsTopWhisperModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-purple-800/85 hover:bg-purple-700 border border-purple-400/60 text-white font-cinzel font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      title="Susurrar mensaje privado al Dungeon Master"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Susurrar al DM</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Botón de Ubicación Actual / Mapa (Same Position in Sheet and Map Mode) */}
              {(() => {
                const rawFolder =
                  appView === 'dm-session'
                    ? dmWorkspace.activeAtlasFolder ||
                      dmWorkspace.activeLiveVisual?.folder ||
                      'all'
                    : liveProjection?.locationFolder || 'all';
                const shortLocation =
                  rawFolder === 'all'
                    ? activeWorld?.name || 'Mundo Completo'
                    : rawFolder.split('/').pop()?.trim() || rawFolder;
                const visualTitle =
                  appView === 'dm-session'
                    ? dmWorkspace.activeLiveVisual?.title || shortLocation
                    : liveProjection?.visualTitle ||
                      liveProjection?.locationName ||
                      shortLocation;

                return (
                  <button
                    type="button"
                    data-testid={
                      isSessionMapViewOpen
                        ? 'map-current-location-box'
                        : appView === 'dm-session'
                        ? 'btn-dm-live-map'
                        : 'btn-player-open-map'
                    }
                    onClick={() => setIsSessionMapViewOpen((prev) => !prev)}
                    className={`px-3 py-1 rounded-xl border-2 transition flex items-center gap-2 shrink-0 cursor-pointer shadow-lg ${
                      isSessionMapViewOpen
                        ? 'bg-gradient-to-b from-amber-950/90 to-[#181410] border-[#f5e4be] ring-1 ring-amber-400/40'
                        : 'bg-gradient-to-b from-[#231e17] to-[#14161f] hover:from-[#2e261c] border-[#e2c275]'
                    }`}
                    title={
                      isSessionMapViewOpen
                        ? 'Ubicación Actual en Mapa (Clic para volver a Hoja)'
                        : 'Ir a Modo Mapa de la Mesa'
                    }
                  >
                    <Compass className="w-4 h-4 text-amber-300 shrink-0" />
                    <div className="text-left min-w-0 max-w-[165px]">
                      <div className="font-cinzel font-black text-[10px] text-[#f5e4be] uppercase truncate leading-tight">
                        {isSessionMapViewOpen ? `📍 ${shortLocation}` : `MAPA • ${shortLocation}`}
                      </div>
                      <div className="text-[9px] text-emerald-300 truncate leading-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
                        <span className="truncate">Viendo: {visualTitle}</span>
                      </div>
                    </div>
                  </button>
                );
              })()}
            </div>
          )}

          {/* Right: Utilities (Full icon+text in Lobby, Compact icon-only with logos & colors in Sheet/Map Mode) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Manual SRD 5E */}
            <button
              type="button"
              onClick={() => setIsCompendiumOpen(true)}
              className={
                appView === 'lobby'
                  ? 'px-3 py-1.5 rounded-xl bg-[#181a24] hover:bg-[#222533] border border-[#c8a45c]/45 text-[#f5e4be] transition flex flex-col items-center justify-center gap-0.5 min-w-[68px] cursor-pointer shadow-sm'
                  : 'w-8 h-8 rounded-lg bg-[#181a24] hover:bg-[#222533] border border-[#c8a45c]/60 text-[#e2c275] transition flex items-center justify-center cursor-pointer shadow-sm'
              }
              title="Manual SRD 5E"
              aria-label="Manual SRD 5E"
            >
              <BookOpen className="w-4 h-4 text-[#e2c275]" />
              {appView === 'lobby' && (
                <span className="text-[10px] font-cinzel font-bold leading-none">
                  {onlineAppSkin?.themeTokens?.compendiumButtonLabel || 'Manual'}
                </span>
              )}
            </button>

            {/* Sabio Arcano */}
            <button
              type="button"
              data-testid="btn-header-arcane-oracle"
              aria-disabled={!canUseArcaneOracle}
              onClick={() => {
                if (!canUseArcaneOracle) {
                  setOracleClientBlockedNotice(
                    '🔒 Sabio Arcano se encuentra en desarrollo (Disponible próximamente para clientes).'
                  );
                  setTimeout(() => setOracleClientBlockedNotice(''), 4500);
                  return;
                }
                setOracleInitialPrompt('');
                setIsOracleOpen(true);
              }}
              className={
                appView === 'lobby'
                  ? `relative px-3 py-1.5 rounded-xl border transition flex flex-col items-center justify-center gap-0.5 min-w-[92px] shadow-sm ${
                      canUseArcaneOracle
                        ? 'bg-[#181a24] hover:bg-[#222533] border-[#c8a45c]/45 text-[#f5e4be] cursor-pointer'
                        : 'bg-stone-900/80 border-stone-700/80 text-stone-500 opacity-65 cursor-not-allowed'
                    }`
                  : `relative w-8 h-8 rounded-lg border transition flex items-center justify-center shadow-sm ${
                      canUseArcaneOracle
                        ? 'bg-[#181a24] hover:bg-[#222533] border-[#c8a45c]/60 text-[#e2c275] cursor-pointer'
                        : 'bg-stone-900/80 border-stone-700/80 text-stone-500 opacity-65 cursor-not-allowed'
                    }`
              }
              title={
                canUseArcaneOracle
                  ? 'Sabio Arcano'
                  : 'Sabio Arcano (En desarrollo - Solo Moderadores, Creadores y Administradores)'
              }
              aria-label="Sabio Arcano"
            >
              <Sparkles className={`w-4 h-4 ${canUseArcaneOracle ? 'text-[#e2c275]' : 'text-stone-500'}`} />
              {appView === 'lobby' && (
                <>
                  <span className="text-[10px] font-cinzel font-bold leading-none whitespace-nowrap">
                    {onlineAppSkin?.themeTokens?.oracleButtonLabel || 'Sabio Arcano'}
                  </span>
                  {!canUseArcaneOracle && (
                    <span className="text-[8px] font-cinzel font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-stone-800 border border-stone-600 text-amber-400/90 leading-tight mt-0.5">
                      En desarrollo
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Configuración de cuenta */}
            <button
              type="button"
              onClick={() => {
                if (authUser) {
                  setIsSecurityModalOpen(true);
                } else {
                  setIsRoleModalOpen(true);
                }
              }}
              className={
                appView === 'lobby'
                  ? 'px-3 py-1.5 rounded-xl bg-[#181a24] hover:bg-[#222533] border border-[#c8a45c]/45 text-[#f5e4be] transition flex flex-col items-center justify-center gap-0.5 min-w-[96px] cursor-pointer shadow-sm'
                  : 'w-8 h-8 rounded-lg bg-[#181a24] hover:bg-[#222533] border border-[#c8a45c]/60 text-[#e2c275] transition flex items-center justify-center cursor-pointer shadow-sm'
              }
              title="Configuración de cuenta, @ID y seguridad"
              aria-label="Configuración de cuenta"
            >
              <Settings className="w-4 h-4 text-[#e2c275]" />
              {appView === 'lobby' && (
                <span className="text-[10px] font-cinzel font-bold leading-none whitespace-nowrap">
                  Configuración de cuenta
                </span>
              )}
            </button>

            {/* Role-Dependent Action Buttons: Admin, Creador de Contenido, Moderación or Feedback */}
            {headerRoleVisibility.showAdminButton && (
              <button
                type="button"
                data-testid="btn-header-admin"
                onClick={() => {
                  setIsSessionMapViewOpen(false);
                  setAppView('lobby');
                  setActiveLobbyPage('admin');
                }}
                className={
                  appView === 'lobby'
                    ? 'px-3 py-1.5 rounded-xl bg-gradient-to-b from-blue-800/90 to-blue-950 hover:from-blue-700 border border-blue-400/70 text-blue-100 transition flex flex-col items-center justify-center gap-0.5 min-w-[68px] cursor-pointer shadow-md'
                    : 'w-8 h-8 rounded-lg bg-gradient-to-b from-blue-800/90 to-blue-950 hover:from-blue-700 border border-blue-400/75 text-blue-100 transition flex items-center justify-center cursor-pointer shadow-md'
                }
                title="Panel de Administrador"
                aria-label="Admin"
              >
                <Shield className="w-4 h-4 text-blue-200" />
                {appView === 'lobby' && (
                  <span className="text-[10px] font-cinzel font-bold leading-none">Admin</span>
                )}
              </button>
            )}

            {headerRoleVisibility.showCreatorButton && (
              <button
                type="button"
                data-testid="btn-header-creator"
                onClick={() => {
                  setIsSessionMapViewOpen(false);
                  setAppView('lobby');
                  setActiveLobbyPage('creator');
                }}
                className={
                  appView === 'lobby'
                    ? 'px-3 py-1.5 rounded-xl bg-gradient-to-b from-amber-700/90 to-amber-950 hover:from-amber-600 border border-amber-400/70 text-amber-100 transition flex flex-col items-center justify-center gap-0.5 min-w-[94px] cursor-pointer shadow-md'
                    : 'w-8 h-8 rounded-lg bg-gradient-to-b from-amber-700/90 to-amber-950 hover:from-amber-600 border border-amber-400/75 text-amber-100 transition flex items-center justify-center cursor-pointer shadow-md'
                }
                title="Panel de Creador de Contenido (DLCs y Skins)"
                aria-label="Creador de Contenido"
              >
                <Palette className="w-4 h-4 text-amber-200" />
                {appView === 'lobby' && (
                  <span className="text-[10px] font-cinzel font-bold leading-none whitespace-nowrap">
                    Creador de Contenido
                  </span>
                )}
              </button>
            )}

            {headerRoleVisibility.showModerationButton && (
              <button
                type="button"
                data-testid="btn-header-moderator"
                onClick={() => {
                  setIsSessionMapViewOpen(false);
                  setAppView('lobby');
                  setActiveLobbyPage('moderator');
                }}
                className={
                  appView === 'lobby'
                    ? 'px-3 py-1.5 rounded-xl bg-gradient-to-b from-purple-800/90 to-purple-950 hover:from-purple-700 border border-purple-400/70 text-purple-100 transition flex flex-col items-center justify-center gap-0.5 min-w-[74px] cursor-pointer shadow-md'
                    : 'w-8 h-8 rounded-lg bg-gradient-to-b from-purple-800/90 to-purple-950 hover:from-purple-700 border border-purple-400/75 text-purple-100 transition flex items-center justify-center cursor-pointer shadow-md'
                }
                title="Panel de Moderación"
                aria-label="Moderación"
              >
                <ShieldCheck className="w-4 h-4 text-purple-200" />
                {appView === 'lobby' && (
                  <span className="text-[10px] font-cinzel font-bold leading-none">Moderación</span>
                )}
              </button>
            )}

            {headerRoleVisibility.showFeedbackButton && (
              <button
                type="button"
                data-testid="btn-header-feedback"
                onClick={() => setIsFeedbackOpen(true)}
                className={
                  appView === 'lobby'
                    ? 'px-3 py-1.5 rounded-xl bg-gradient-to-b from-purple-800/90 to-purple-950 hover:from-purple-700 border border-purple-400/70 text-purple-100 transition flex flex-col items-center justify-center gap-0.5 min-w-[74px] cursor-pointer shadow-md'
                    : 'w-8 h-8 rounded-lg bg-gradient-to-b from-purple-800/90 to-purple-950 hover:from-purple-700 border border-purple-400/75 text-purple-100 transition flex items-center justify-center cursor-pointer shadow-md'
                }
                title="Enviar Feedback o Sugerencia"
                aria-label="Feedback"
              >
                <MessageSquarePlus className="w-4 h-4 text-purple-200" />
                {appView === 'lobby' && (
                  <span className="text-[10px] font-cinzel font-bold leading-none">Feedback</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Client Blocked Notice Banner when clicking Sabio Arcano as a Client */}
        {oracleClientBlockedNotice && (
          <div
            data-testid="oracle-client-blocked-banner"
            className="bg-amber-950/95 border-t border-amber-500/60 px-4 py-2 text-center text-xs font-cinzel font-bold text-amber-200 flex items-center justify-center gap-2 animate-in fade-in"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{oracleClientBlockedNotice}</span>
            <button
              type="button"
              onClick={() => setOracleClientBlockedNotice('')}
              className="ml-2 text-amber-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* Top Bar Player Whisper to DM Modal */}
      {isTopWhisperModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#161822] border-2 border-purple-500/80 p-5 text-stone-200 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="font-cinzel font-black text-sm text-[#f5e4be] uppercase">
                  Susurrar al Dungeon Master
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTopWhisperModalOpen(false)}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={topWhisperTitle}
              onChange={(e) => setTopWhisperTitle(e.target.value)}
              placeholder="Asunto del susurro (ej. Acción Secreta)..."
              className="w-full bg-[#0f1118] border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
            />
            <textarea
              rows={3}
              value={topWhisperBody}
              onChange={(e) => setTopWhisperBody(e.target.value)}
              placeholder="Escribe tu mensaje privado para el DM..."
              className="w-full bg-[#0f1118] border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 resize-none"
            />
            {topWhisperStatus && (
              <p className="text-xs font-cinzel font-bold text-emerald-400">{topWhisperStatus}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsTopWhisperModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-stone-800 text-xs font-cinzel font-bold text-stone-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!topWhisperBody.trim()) return;
                  const pName = activeCharacter?.playerName || authUser?.displayName || 'Jugador';
                  const pTag = (authUser?.userTagId || '123').replace(/^@+/, '').trim() || '123';
                  try {
                    const res = await fetch(
                      `/api/session/room/${encodeURIComponent(roomCode)}/player-message`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          characterId: activeCharacter?.id || 'char-live',
                          characterName: activeCharacter?.name || 'Aventurero',
                          playerName: pName,
                          playerTagId: pTag,
                          playerFullTag: `${pName}@${pTag}`,
                          playerEmail: authUser?.email,
                          title: topWhisperTitle.trim() || 'Susurro de Jugador',
                          description: topWhisperBody.trim(),
                        }),
                      }
                    );
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setTopWhisperStatus('¡Susurro enviado al Dungeon Master!');
                      setTopWhisperTitle('');
                      setTopWhisperBody('');
                      setTimeout(() => {
                        setTopWhisperStatus('');
                        setIsTopWhisperModalOpen(false);
                      }, 1200);
                    } else {
                      setTopWhisperStatus(data.error || 'Error al enviar el susurro.');
                    }
                  } catch {
                    setTopWhisperStatus('Error de conexión con la sala.');
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-cinzel font-bold cursor-pointer"
              >
                Enviar Susurro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MAIN CONTENT AREA (Extended Viewport - Anti Slop Layout)            */}
      {/* =================================================================== */}
      <main
        className={`w-full ${
          isSessionMapViewOpen
            ? 'max-w-[1920px] px-1.5 sm:px-3'
            : 'max-w-[1650px] px-3 sm:px-5'
        } mx-auto ${appView === 'lobby' ? 'py-4 space-y-5' : 'py-2 space-y-2'} flex-1`}
      >
        {/* Room Closed Notification Alert */}
        {roomClosedAlert && (
          <div className="bg-red-950/80 border border-red-700 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-900/60 border border-red-600 flex items-center justify-center text-red-200 shrink-0">
                <X className="w-4 h-4" />
              </div>
              <p className="text-xs text-red-200 font-cinzel font-bold leading-relaxed">
                {roomClosedAlert}
              </p>
            </div>
            <button
              onClick={() => setRoomClosedAlert('')}
              className="p-1 rounded text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Developer Announcement Banner (Configured in Admin Settings) */}
        {(hostSettings.developerAnnouncement?.enabled || (hostSettings.developerAnnouncement as any)?.active) &&
          hostSettings.developerAnnouncement?.content &&
          !dismissedDevNotice && (
            <div className="bg-gradient-to-r from-amber-950/80 via-stone-900 to-amber-950/80 border border-amber-600/50 rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-cinzel font-bold text-sm text-amber-300">
                    {hostSettings.developerAnnouncement.title || 'Anuncio del Desarrollador'}
                  </h4>
                  <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">
                    {hostSettings.developerAnnouncement.content}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDismissedDevNotice(true)}
                className="text-stone-400 hover:text-stone-200 p-1"
                title="Cerrar anuncio"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        {/* 1. LOBBY VIEW (Primary Portal) */}
        {appView === 'lobby' && (
          <LobbyPortalView
            authUser={authUser}
            hostSettings={hostSettings}
            onLogout={handleLogout}
            onOpenAuthModal={() => setIsRoleModalOpen(true)}
            onOpenChangelog={() => setIsChangelogOpen(true)}
            onSelectCharacterToPlay={handleSelectCharacterToPlay}
            onEditCharacterSolo={handleEditCharacterSolo}
            onDeleteCharacter={handleDeleteCharacter}
            onCreateNewCharacter={() => setIsCreatorOpen(true)}
            onImportCharacter={(importedChar) => {
              const updatedList = [...characters.filter((c) => c.id !== importedChar.id), importedChar];
              setCharacters(updatedList);
              saveCharacters(updatedList);
              saveCharactersAsync(updatedList, authUser).catch(() => {});
              setActiveCharId(importedChar.id);
              saveActiveCharacterId(importedChar.id);
            }}
            worldSheets={worldSheets}
            onOpenWorldSheet={handleOpenWorldSheet}
            onCreateWorldSheet={handleCreateWorldSheet}
            onImportWorldSheet={(importedWorld) => {
              setWorldSheets((prev) => [...prev.filter((w) => w.id !== importedWorld.id), importedWorld]);
            }}
            onUpdateWorldSheetConfig={handleUpdateWorldSheetConfig}
            onDeleteWorldSheet={handleDeleteWorldSheet}
            onSaveHostSettings={handleSaveHostSettings}
            onRefreshAuthStatus={handleRefreshAuthStatus}
            charactersCount={characters.length}
            localCharacters={characters}
            vaultSyncRevision={vaultSyncRevision}
            onOpenCompendium={() => setIsCompendiumOpen(true)}
            onOpenOracle={(prompt) => {
              setOracleInitialPrompt(prompt || '');
              setIsOracleOpen(true);
            }}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
            onOpenAdminPanel={() => setActiveLobbyPage('admin')}
            onOpenModeratorPanel={() => setActiveLobbyPage('moderator')}
            isAdminModalOpen={isAdminModalOpen}
            onCloseAdminModal={() => setIsAdminModalOpen(false)}
            activeLobbyPage={activeLobbyPage}
            onChangeLobbyPage={setActiveLobbyPage}
            onlineAppSkin={onlineAppSkin}
            onCreatorCatalogUpdated={(cat) => {
              if (cat && Array.isArray(cat.appSkins)) {
                const active =
                  cat.appSkins.find((s: AppSkinRecord) => s.id === cat.activeOnlineAppSkinId) ||
                  cat.appSkins.find((s: AppSkinRecord) => s.isOnlineActive) ||
                  cat.appSkins[0];
                if (active) setOnlineAppSkin(active);
              }
            }}
          />
        )}

        {/* 2. ACTIVE SESSION: Integrated directly inside CharacterSheetView (Table Mode) and DMScreenView */}

        {/* DM OFFER RESOLUTION NOTIFICATIONS (Shown to DM when a player Accepts or Declines a shared item/spell/ability) */}
        {appView === 'dm-session' && dmOfferNotifications.length > 0 && (
          <div className="space-y-2">
            {dmOfferNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2 ${
                  notif.accepted
                    ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-100'
                    : 'bg-red-950/90 border-red-600/80 text-red-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      notif.accepted
                        ? 'bg-emerald-900/70 border-emerald-400 text-emerald-200'
                        : 'bg-red-900/70 border-red-400 text-red-200'
                    }`}
                  >
                    {notif.accepted ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-cinzel uppercase tracking-wider font-bold block opacity-80">
                      Respuesta del Jugador en Sala ({roomCode})
                    </span>
                    <p className="text-xs sm:text-sm font-cinzel font-bold">{notif.message}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setDmOfferNotifications((prev) => prev.filter((n) => n.id !== notif.id))
                  }
                  className="p-1.5 rounded-lg hover:bg-black/30 text-stone-300 hover:text-white transition"
                  title="Cerrar notificación"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PLAYER OFFER FEEDBACK TOAST */}
        {appView === 'player-session' && playerOfferFeedback && (
          <div className="p-4 rounded-2xl bg-amber-950/90 border border-amber-500/80 text-amber-100 shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-cinzel font-bold">{playerOfferFeedback}</span>
            </div>
            <button
              onClick={() => setPlayerOfferFeedback('')}
              className="p-1 rounded hover:bg-black/30 text-amber-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PLAYER INCOMING DM SHARE OFFER MODAL (Accept or Decline Item / Spell / Ability) */}
        {appView === 'player-session' && pendingPlayerOffers.length > 0 && activeCharacter && (
          <div
            data-testid="player-incoming-dm-offer-modal"
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
            role="dialog"
            aria-modal="true"
          >
            {(() => {
              const offer = pendingPlayerOffers[0];
              const kindBadge =
                offer.kind === 'spell'
                  ? 'Conjuro Mágico'
                  : offer.kind === 'ability'
                  ? 'Habilidad / Rasgo'
                  : 'Objeto / Equipo';
              return (
                <div className="relative w-full max-w-md bg-[#181920] border-2 border-amber-500 rounded-3xl shadow-2xl p-6 text-stone-200 space-y-4">
                  <div className="flex items-center gap-3 border-b border-stone-800 pb-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-500 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
                      <Gift className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                      <span className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-amber-400 block">
                        Notificación del Dungeon Master • Sala {roomCode}
                      </span>
                      <h3 className="font-cinzel font-black text-base text-stone-100">
                        El DM está compartiendo {offer.kind === 'spell' ? 'un Conjuro' : offer.kind === 'ability' ? 'una Habilidad' : 'un Objeto'}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#121316] border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-cinzel font-bold text-amber-300 text-sm sm:text-base">
                        {offer.title}
                      </h4>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-300 font-bold uppercase">
                        {kindBadge} {offer.rarity ? `• ${offer.rarity}` : ''}
                      </span>
                    </div>
                    {offer.category && (
                      <div className="text-[11px] text-stone-400 font-mono">
                        Categoría: {offer.category}
                      </div>
                    )}
                    {offer.description && (
                      <p className="text-xs text-stone-300 whitespace-pre-line leading-relaxed pt-1 border-t border-stone-800/80">
                        {offer.description}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-center text-stone-300 font-cinzel">
                    ¿Deseas recibir <strong className="text-amber-300">"{offer.title}"</strong> en la ficha de{' '}
                    <strong className="text-stone-100">{activeCharacter.name}</strong>?
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isRespondingOffer}
                      onClick={() => handleRespondToDmOffer(offer, 'declined')}
                      className="py-2.5 px-4 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 font-cinzel font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span>No, Rechazar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRespondingOffer}
                      onClick={() => handleRespondToDmOffer(offer, 'accepted')}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Sí, Recibir</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 3. TABLE MAP VIEW (Inside Active Session or Solo for Player or DM) */}
        <React.Suspense fallback={null}>
        {appView !== 'lobby' && isSessionMapViewOpen && (
          <TableMapView
            mode={appView === 'dm-session' ? 'dm' : 'player'}
            roomCode={roomCode}
            worldName={activeWorld?.name}
            currentUserRole={authUser?.role || 'client'}
            character={activeCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            workspace={dmWorkspace}
            onUpdateWorkspace={(updated) => {
              lastLocalDmMutationAtRef.current = Date.now();
              dmWorkspaceRef.current = updated;
              setDmWorkspace(updated);
              saveDMWorkspace(updated);

              const shouldBroadcast = Boolean(updated.activeEncounter?.broadcastEnemiesToTable);
              setShowCombatantsOnTable(shouldBroadcast);

              const combatantsMini: LiveCombatantMini[] = (updated.activeEncounter?.combatants || []).map((c) => {
                const matchedMonster = (updated.monsters || []).find(
                  (m) => m.name.toLowerCase() === c.name.toLowerCase()
                );
                return {
                  id: c.id,
                  name: c.name,
                  hp: c.hp,
                  maxHp: c.maxHp,
                  ac: c.ac,
                  passivePerception: c.passivePerception ?? 10,
                  faction: c.faction || (c.isPlayer ? 'ally' : 'enemy'),
                  isPlayer: Boolean(c.isPlayer),
                  conditions: c.conditions || [],
                  levelOrCr: matchedMonster?.cr ? `CR ${matchedMonster.cr}` : 'Niv 1',
                  initiative: c.initiative,
                  speed: matchedMonster?.speed || '30 ft.',
                  avatarType: c.avatarType || matchedMonster?.avatarType,
                  avatarCustomUrl: c.avatarCustomUrl || matchedMonster?.avatarCustomUrl,
                  avatarIcon: c.avatarIcon || matchedMonster?.avatarIcon,
                };
              });
              setLiveCombatants(combatantsMini);
              const proj = buildLiveProjectionFromWorkspace(updated);
              setLiveProjection(proj);

              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'COMBATANTS_UPDATE',
                  payload: {
                    showCombatantsOnTable: shouldBroadcast,
                    liveCombatants: combatantsMini,
                    liveProjection: proj,
                  },
                });
              }

              sendDmHeartbeat(updated);
            }}
            partyMembers={partyMembers}
            dmConnected={appView === 'dm-session' ? true : serverDmConnected}
            dmLiveMessage={appView === 'dm-session' ? dmWorkspace.dmLiveMessage || serverDmLiveMessage : serverDmLiveMessage}
            onUpdateDmLiveMessage={(msg) => {
              setServerDmLiveMessage(msg);
              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'DM_LIVE_MESSAGE',
                  payload: msg,
                });
              }
            }}
            showCombatantsOnTable={showCombatantsOnTable}
            liveCombatants={liveCombatants}
            liveProjection={
              appView === 'dm-session'
                ? buildLiveProjectionFromWorkspace(dmWorkspace)
                : liveProjection
            }
            rollFeed={rollFeed}
            onRollComplete={handleRollComplete}
            onTriggerRoll={handleTriggerRoll}
            onOpenRollFeed={() => setIsRollFeedOpen(true)}
            onReturnToSheet={() => setIsSessionMapViewOpen(false)}
            onSaveToCloud={
              appView === 'dm-session' ? handleDmSaveToCloud : handlePlayerSaveToCloud
            }
            onDmAdjustPlayer={handleDmAdjustPlayer}
            onSendPlayerMessageToDM={async (title, description) => {
              const pName = activeCharacter?.playerName || authUser?.displayName || 'Jugador';
              const pTag = (authUser?.userTagId || '123').replace(/^@+/, '').trim() || '123';
              try {
                const res = await fetch(
                  `/api/session/room/${encodeURIComponent(roomCode)}/player-message`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      characterId: activeCharacter?.id || 'char-live',
                      characterName: activeCharacter?.name || 'Aventurero',
                      playerName: pName,
                      playerTagId: pTag,
                      playerFullTag: `${pName}@${pTag}`,
                      playerEmail: authUser?.email,
                      title,
                      description,
                    }),
                  }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  return { ok: false, error: data.error || 'Error al enviar el mensaje al DM.' };
                }
                if (Array.isArray(data.playerMessages)) {
                  setRoomPlayerMessages(data.playerMessages);
                }
                return {
                  ok: true,
                  message: data.message || '¡Mensaje privado enviado al Dungeon Master!',
                };
              } catch {
                return { ok: false, error: 'Error de conexión con la sala.' };
              }
            }}
          />
        )}

        {/* 3B. PLAYER SHEET (Active Session or Solo Edit) */}
        {(appView === 'player-session' || appView === 'player-solo') &&
          !isSessionMapViewOpen &&
          activeCharacter && (
          <CharacterSheetView
            character={activeCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onTriggerRoll={handleTriggerRoll}
            isInActiveRoom={appView === 'player-session'}
            roomCode={roomCode}
            onReturnToLobby={handlePlayerReturnToLobby}
            onSaveToCloud={handlePlayerSaveToCloud}
            partyMembers={partyMembers}
            dmConnected={serverDmConnected}
            dmLiveMessage={serverDmLiveMessage}
            showCombatantsOnTable={showCombatantsOnTable}
            liveCombatants={liveCombatants}
            activeAnnouncement={activeAnnouncement}
            onDismissAnnouncement={() => setActiveAnnouncement(null)}
            onOpenRollFeed={() => setIsRollFeedOpen(true)}
            rollFeed={rollFeed}
            onOpenTableMapView={() => setIsSessionMapViewOpen(true)}
            activeLocationName={liveProjection?.locationName}
            onSendPlayerMessageToDM={async (title, description) => {
              const pName = activeCharacter?.playerName || authUser?.displayName || 'Jugador';
              const pTag = (authUser?.userTagId || '123').replace(/^@+/, '').trim() || '123';
              try {
                const res = await fetch(
                  `/api/session/room/${encodeURIComponent(roomCode)}/player-message`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      characterId: activeCharacter?.id || 'char-live',
                      characterName: activeCharacter?.name || 'Aventurero',
                      playerName: pName,
                      playerTagId: pTag,
                      playerFullTag: `${pName}@${pTag}`,
                      playerEmail: authUser?.email,
                      title,
                      description,
                    }),
                  }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  return { ok: false, error: data.error || 'Error al enviar el mensaje al DM.' };
                }
                if (Array.isArray(data.playerMessages)) {
                  setRoomPlayerMessages(data.playerMessages);
                }
                return {
                  ok: true,
                  message: data.message || '¡Mensaje privado enviado al Dungeon Master!',
                };
              } catch {
                return { ok: false, error: 'Error de conexión con la sala.' };
              }
            }}
            isLocked={!isCharacterUnlocked(activeCharacter.id, activeCharacter.password)}
            onUnlockRequest={() => {
              setPasswordModalConfig({
                isOpen: true,
                title: `Desbloquear ${activeCharacter.name}`,
                description: 'Esta ficha de personaje está protegida por contraseña.',
                expectedPassword: activeCharacter.password,
                onSuccess: () => setCharacterUnlocked(activeCharacter.id),
              });
            }}
          />
        )}

        {/* 4. DUNGEON MASTER SCREEN (Active Session) */}
        {appView === 'dm-session' && !isSessionMapViewOpen && (
          <DMScreenView
            workspace={dmWorkspace}
            onUpdateWorkspace={(updated) => {
              lastLocalDmMutationAtRef.current = Date.now();
              dmWorkspaceRef.current = updated;
              setDmWorkspace(updated);
              saveDMWorkspace(updated);

              const shouldBroadcast = Boolean(updated.activeEncounter?.broadcastEnemiesToTable);
              setShowCombatantsOnTable(shouldBroadcast);

              const combatantsMini: LiveCombatantMini[] = (updated.activeEncounter?.combatants || []).map((c) => {
                const matchedMonster = (updated.monsters || []).find(
                  (m) => m.name.toLowerCase() === c.name.toLowerCase()
                );
                return {
                  id: c.id,
                  name: c.name,
                  hp: c.hp,
                  maxHp: c.maxHp,
                  ac: c.ac,
                  passivePerception: c.passivePerception ?? 10,
                  faction: c.faction || (c.isPlayer ? 'ally' : 'enemy'),
                  isPlayer: Boolean(c.isPlayer),
                  conditions: c.conditions || [],
                  levelOrCr: matchedMonster?.cr ? `CR ${matchedMonster.cr}` : 'Niv 1',
                  initiative: c.initiative,
                  speed: matchedMonster?.speed || '30 ft.',
                  avatarType: c.avatarType || matchedMonster?.avatarType,
                  avatarCustomUrl: c.avatarCustomUrl || matchedMonster?.avatarCustomUrl,
                  avatarIcon: c.avatarIcon || matchedMonster?.avatarIcon,
                };
              });
              setLiveCombatants(combatantsMini);
              const proj = buildLiveProjectionFromWorkspace(updated);
              setLiveProjection(proj);

              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'COMBATANTS_UPDATE',
                  payload: {
                    showCombatantsOnTable: shouldBroadcast,
                    liveCombatants: combatantsMini,
                    liveProjection: proj,
                  },
                });
              }

              sendDmHeartbeat(updated);
            }}
            worldName={activeWorld?.name}
            roomCode={roomCode}
            roomPassword={activeWorld?.roomPassword}
            partyMembers={partyMembers}
            playerMessages={roomPlayerMessages}
            onMarkPlayerMessageRead={(messageId) => {
              setRoomPlayerMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, readByDm: true } : m))
              );
              fetch(
                `/api/session/room/${encodeURIComponent(roomCode)}/player-message/${encodeURIComponent(messageId)}/read`,
                { method: 'POST' }
              ).catch(() => {});
            }}
            onDeletePlayerMessage={(messageId) => {
              setRoomPlayerMessages((prev) => prev.filter((m) => m.id !== messageId));
              fetch(
                `/api/session/room/${encodeURIComponent(roomCode)}/player-message/${encodeURIComponent(messageId)}`,
                { method: 'DELETE' }
              ).catch(() => {});
            }}
            onSaveAndReturnToLobby={handleDmSaveAndReturnToLobby}
            onSaveToCloud={handleDmSaveToCloud}
            onTriggerRoll={handleTriggerRoll}
            onBroadcastAnnouncement={handleBroadcastAnnouncement}
            onOpenAIOracle={handleOpenAIOracle}
            onOpenRollFeed={() => setIsRollFeedOpen(true)}
            recentRollsCount={rollFeed.length}
            onUpdateDmLiveMessage={(msg) => {
              setServerDmLiveMessage(msg);
              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'DM_LIVE_MESSAGE',
                  payload: msg,
                });
              }
            }}
            isOfflineMode={activeWorld?.roomMode === 'offline'}
            onToggleOfflineMode={handleToggleDmOfflineMode}
            isOnlineSession={activeWorld?.roomMode !== 'offline'}
            onToggleOnlineSession={() =>
              handleToggleDmOfflineMode(activeWorld?.roomMode !== 'offline')
            }
            onUpdateTableSettings={(updates) => {
              if (activeWorld) {
                setRoomCode(updates.roomCode);
                saveRoomCode(updates.roomCode);
                setActiveWorld((prev) => (prev ? { ...prev, ...updates } : prev));
                setWorldSheets((prev) =>
                  prev.map((w) => (w.id === activeWorld.id ? { ...w, ...updates } : w))
                );
                handleUpdateWorldSheetConfig(activeWorld.id, {
                  ...updates,
                  roomMode: activeWorld.roomMode,
                }).catch(() => {});
              }
            }}
            onOpenTableMapView={() => setIsSessionMapViewOpen(true)}
            onDmAdjustPlayer={handleDmAdjustPlayer}
            currentUserRole={effectiveAppRole}
            currentUserEmail={authUser?.email}
          />
        )}
        </React.Suspense>
      </main>

      {/* Persistent AI Assistant Reference & Total Backup Banner (Admin/Moderator Only) */}
      {(authUser?.role === 'moderator' || authUser?.role === 'admin' || userRole === 'moderator' || userRole === 'admin') && (
        <footer className="max-w-7xl mx-auto px-4 pb-8 w-full">
          <div className="bg-[#121316] border border-stone-800/90 rounded-2xl p-4 shadow-xl text-stone-300">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner">
                  <Bot className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-cinzel font-bold text-xs text-cyan-300 flex items-center gap-2">
                    <span>Asistente de Desarrollo WeRoll AI</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-200 border border-cyan-700 font-mono">
                      Sincronización Total Activa
                    </span>
                  </h4>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                    Cualquier modificación en la web (logo personalizado de la marca, avatares/iconos de personajes, NPCs, monstruos, objetos, World Sheets, contraseñas, roles, sugerencias y ajustes del servidor) está resguardada en la base de datos y 100% garantizada dentro del <strong>Respaldo Total JSON</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <input
                  type="file"
                  ref={appRestoreFileInputRef}
                  onChange={handleAppRestoreBackup}
                  accept=".json,application/json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => appRestoreFileInputRef.current?.click()}
                  disabled={isAppRestoring}
                  className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Importa y restaura un archivo JSON de respaldo total"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isAppRestoring ? 'Restaurando...' : 'Importar Respaldo Total'}</span>
                </button>

                <a
                  href="/api/vault/backup-all"
                  download
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-1.5"
                  title="Descarga el archivo JSON completo de la base de datos"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Respaldo Total</span>
                </a>
              </div>
            </div>

            {appRestoreMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-950 border border-emerald-600 text-emerald-200 text-xs flex items-center justify-between">
                <span>{appRestoreMsg}</span>
                <button onClick={() => setAppRestoreMsg('')} className="p-1 text-emerald-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* =================================================================== */}
      {/* GLOBAL MODALS                                                       */}
      {/* =================================================================== */}
      <React.Suspense fallback={null}>

      {/* Character Creator Modal */}
      {isCreatorOpen && (
        <CharacterCreatorModal
          isOpen={isCreatorOpen}
          onClose={() => setIsCreatorOpen(false)}
          onCharacterCreated={async (newChar) => {
            const charWithOwner = {
              ...newChar,
              ownerEmail: authUser?.email || 'jugador@weroll.app',
            };

            // Save to server vault
            if (authUser?.email) {
              try {
                await fetch('/api/vault/sheets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    character: charWithOwner,
                    ownerEmail: authUser.email,
                  }),
                });
              } catch (e) {
                console.error(e);
              }
            }

            const updatedList = [...characters, charWithOwner];
            setCharacters(updatedList);
            saveCharacters(updatedList);
            setActiveCharId(charWithOwner.id);
            saveActiveCharacterId(charWithOwner.id);
            setIsCreatorOpen(false);
          }}
        />
      )}

      {/* Role Selection / Login / Register Modal */}
      {isRoleModalOpen && (
        <RoleSelectionModal
          isOpen={isRoleModalOpen}
          canClose={Boolean(authUser)}
          onClose={() => setIsRoleModalOpen(false)}
          dmPasswordExpected={hostSettings.dmPassword || ''}
          moderatorPasswordExpected={hostSettings.moderatorPassword || 'admin'}
          hostSettings={hostSettings}
          onSelectRole={handleSelectRole}
        />
      )}

      {/* Password Prompt Modal */}
      {passwordModalConfig.isOpen && (
        <PasswordPromptModal
          isOpen={passwordModalConfig.isOpen}
          title={passwordModalConfig.title}
          description={passwordModalConfig.description}
          expectedPassword={passwordModalConfig.expectedPassword}
          onClose={() => setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }))}
          onSuccess={() => {
            passwordModalConfig.onSuccess();
            setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }));
          }}
        />
      )}

      {/* Changelog Modal */}
      {isChangelogOpen && (
        <ChangelogModal
          isOpen={isChangelogOpen}
          onClose={() => setIsChangelogOpen(false)}
          changelog={hostSettings.changelog || []}
          currentVersion={hostSettings.headerSubtitle?.replace(/[^0-9.]/g, '') ? `${hostSettings.headerSubtitle.replace(/[^0-9.]/g, '')} Beta` : '1.4 Beta'}
        />
      )}

      {/* Rules Compendium Modal */}
      {isCompendiumOpen && (
        <RulesCompendiumModal
          isOpen={isCompendiumOpen}
          onClose={() => setIsCompendiumOpen(false)}
          onAskOracle={(topic) => {
            setIsCompendiumOpen(false);
            handleOpenAIOracle(topic);
          }}
        />
      )}

      {/* Arcane Oracle (Gemini Flash) */}
      {isOracleOpen && (
        <ArcaneOracleModal
          isOpen={isOracleOpen}
          onClose={() => setIsOracleOpen(false)}
          initialPrompt={oracleInitialPrompt}
          characterContext={appView !== 'dm-session' ? activeCharacter : undefined}
          dmContext={appView === 'dm-session' ? dmWorkspace : undefined}
          welcomeMessage={hostSettings.oracleWelcomeMessage}
          customApiKey={hostSettings.apiKeyOverride}
          customModel={hostSettings.aiModel}
        />
      )}

      {/* Live Dice Roll Feed Modal */}
      {isRollFeedOpen && (
        <LiveRollFeedModal
          isOpen={isRollFeedOpen}
          onClose={() => setIsRollFeedOpen(false)}
          rolls={rollFeed}
        />
      )}

      {/* Full Dice Roller Modal */}
      {isRollerOpen && (
        <DiceRollerModal
          isOpen={isRollerOpen}
          onClose={() => setIsRollerOpen(false)}
          initialRollTitle={rollerTitle}
          initialModifier={rollerMod}
          initialDiceType={rollerSides}
          initialMode={rollerMode}
          rollerName={
            appView === 'dm-session'
              ? 'Dungeon Master'
              : activeCharacter
              ? `${activeCharacter.name} (${activeCharacter.playerName})`
              : authUser?.displayName || 'Aventurero'
          }
          onRollComplete={handleRollComplete}
        />
      )}

      {/* Community Feedback Modal */}
      {isFeedbackOpen && (
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          authUser={authUser}
        />
      )}

      {/* User Security & Password Modal */}
      {isSecurityModalOpen && authUser && (
        <UserSecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          authUser={authUser}
          onRefreshAuthStatus={handleRefreshAuthStatus}
        />
      )}

      {/* Moderator Panel Modal */}
      {isModeratorModalOpen && authUser && (
        <ModeratorPanelModal
          isOpen={isModeratorModalOpen}
          onClose={() => setIsModeratorModalOpen(false)}
          authUser={authUser}
          onSwitchToAdminPanel={() => {
            setIsModeratorModalOpen(false);
            setAppView('lobby');
            setActiveLobbyPage('admin');
          }}
        />
      )}
      </React.Suspense>

      {/* LIVE BROADCAST POP-UP MODAL FROM ADMIN / CREATOR / MODERATOR */}
      {activeLiveAdminPopup && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          role="dialog"
          aria-modal="true"
          data-testid="live-admin-popup-modal"
        >
          <div className="relative w-full max-w-lg bg-gradient-to-b from-[#1e152a] via-[#15121e] to-[#110f18] border-2 border-[#c8a45c] rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] p-6 text-stone-100 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#c8a45c]/30 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/90 border-2 border-[#c8a45c] flex items-center justify-center text-[#f3d382] shadow-lg shrink-0">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-cinzel font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-900/60 border border-amber-500/60 text-amber-200">
                      Aviso en Vivo del {activeLiveAdminPopup.senderRole || 'Administrador'}
                    </span>
                    <span className="text-[11px] text-purple-300 font-cinzel font-bold">
                      Por: {activeLiveAdminPopup.senderName}
                    </span>
                  </div>
                  <h3 className="font-cinzel font-black text-lg text-[#f5e4be] mt-1">
                    {activeLiveAdminPopup.title || 'Aviso del Administrador'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLiveAdminPopup(null)}
                className="p-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-white transition cursor-pointer"
                title="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#0e0d14]/90 border border-[#c8a45c]/30 text-sm text-stone-200 leading-relaxed whitespace-pre-line font-sans shadow-inner">
              {activeLiveAdminPopup.message}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-stone-400 font-mono">
                Enviado a las {new Date(activeLiveAdminPopup.sentAt).toLocaleTimeString()}
              </span>
              <button
                type="button"
                onClick={() => setActiveLiveAdminPopup(null)}
                data-testid="btn-dismiss-live-popup"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-cinzel font-black text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
