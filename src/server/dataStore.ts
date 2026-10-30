import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type {
  Character5e,
  DMWorkspace,
  HostSettings,
  ChangelogEntry,
  AutoBackupConfig,
  ReplacedBackupArchiveSummary,
  PlayerType,
  AppRole,
  ForumPost,
  ForumComment,
  FriendDirectMessage,
  ForumCategory,
  ForumFlair,
  PlayerMessageToDM,
} from '../types/dnd.ts';
import {
  validateUniqueUserIdentity,
  deduplicateUsersIdentity,
  validateUniqueRoomNameAndCode,
  normalizeRoomIdentifier,
} from '../utils/dnd-math.ts';
import { defaultDlcSrd } from './srdDlcData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data_store');
const PERSISTENT_VAULT_DIR = '/tmp/weroll_persistent_vault';
const PERSISTENT_ARCHIVE_DIR = path.join(PERSISTENT_VAULT_DIR, 'replaced_archive');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
try {
  if (!fs.existsSync(PERSISTENT_VAULT_DIR)) {
    fs.mkdirSync(PERSISTENT_VAULT_DIR, { recursive: true });
  }
  if (!fs.existsSync(PERSISTENT_ARCHIVE_DIR)) {
    fs.mkdirSync(PERSISTENT_ARCHIVE_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[WeRoll Vault] Warning creating /tmp vault dir:', err);
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  userTagId?: string;
  avatarUrl?: string;
  friends?: string[];
  incomingFriendRequests?: string[];
  outgoingFriendRequests?: string[];
  password: string;
  role: 'player' | 'dm' | 'both' | 'moderator' | 'creator' | 'admin';
  playerType?: PlayerType; // 'player' | 'dm' | 'both'
  requestedPlayerType?: PlayerType; // 'player' | 'dm' | 'both'
  playerTypeChangeRequested?: boolean;
  appRole?: AppRole; // 'client' | 'moderator' | 'creator' | 'admin'
  canPostInForum?: boolean; // false for regular clients unless granted by mod/admin
  forumPermissionsRequested?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  isGoogleLinked?: boolean;
  googleUid?: string;
  registeredAt: number;
  approvedAt?: number;
  approvedBy?: string;
  lastActiveAt: number;
  totalConnectedMs?: number;
  sessionCount?: number;
  lastSessionStartAt?: number;
  currentActivity?: string;
  ownedDlcIds?: string[];
  ownedSkinIds?: string[];
  passwordResetRequested?: boolean;
  passwordResetRequestedAt?: number;
  passwordResetNote?: string;
}

const SERVER_BOOT_TIMESTAMP = Date.now();
const ONLINE_THRESHOLD_MS = 65_000; // 65s window for real-time online status

export interface FeedbackRecord {
  id: string;
  category: 'bug' | 'suggestion' | 'other';
  description: string;
  userEmail?: string;
  userName?: string;
  createdAt: number;
  status?: 'unread' | 'reviewed';
}

export interface RoomRecord {
  roomCode: string;
  name: string;
  dmEmail: string;
  dmDisplayName: string;
  password?: string;
  worldSheetId?: string;
  createdAt: number;
  lastUpdated: number;
}

export interface PlayerSheetRecord {
  id: string;
  ownerEmail: string;
  name: string;
  character: Character5e;
  updatedAt: number;
}

export interface WorldSheetRecord {
  id: string;
  ownerEmail: string;
  name: string;
  description?: string;
  roomCode: string;
  roomPassword?: string;
  roomMode?: 'online' | 'offline';
  workspace: DMWorkspace;
  updatedAt: number;
}

export interface RotatingBackupSlot {
  timestamp: number;
  reason: 'join' | 'leave' | 'manual';
  snapshot: Character5e;
}

export interface PlayerRotatingBackup {
  characterId: string;
  ownerEmail: string;
  characterName: string;
  // Strictly 2 rotating versions: slot 0 (older) and slot 1 (newer)
  slots: RotatingBackupSlot[];
  lastRotatedAt: number;
}

export interface SyncMetadata {
  isBaseState: boolean;
  revision: number;
  lastModifiedAt: number;
  lastMutationReason: string;
  contentHash: string;
  lastComparisonAt?: number;
  lastComparisonStatus?: string;
  lastCloudSyncAt?: number;
}

export interface ReplacedBackupArchiveEntry extends ReplacedBackupArchiveSummary {
  snapshot: any;
}

// Helpers for reading/writing JSON files safely
function readJSON<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      writeJSON(filename, fallback);
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return fallback;
  }
}

function writeJSON<T>(filename: string, data: T): void {
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
  }
}

// Initial Base Admin Users Seed ("Archivo Base")
const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr-admin-master',
    email: 'admin@weroll.app',
    displayName: 'Administrador Supremo',
    userTagId: 'adm',
    friends: [],
    password: 'admin',
    role: 'admin',
    playerType: 'both',
    appRole: 'admin',
    canPostInForum: true,
    status: 'approved',
    registeredAt: 1700000000000,
    approvedAt: 1700000000000,
    approvedBy: 'SYSTEM',
    lastActiveAt: 1700000000000,
  },
  {
    id: 'usr-admin-deadplanter',
    email: 'deadplanter@gmail.com',
    displayName: 'deadplanter',
    userTagId: 'top',
    friends: [],
    password: 'admin',
    role: 'admin',
    playerType: 'both',
    appRole: 'admin',
    canPostInForum: true,
    status: 'approved',
    registeredAt: 1700000000000,
    approvedAt: 1700000000000,
    approvedBy: 'SYSTEM',
    lastActiveAt: 1700000000000,
  },
];

// Mutation listener callback registered by the cloud sync engine in api.ts
let mutationListener: ((reason: string) => void) | null = null;
let isRestoringOrSyncing = false;

export function registerDataStoreMutationListener(listener: (reason: string) => void) {
  mutationListener = listener;
}

export const dataStore = {
  // --- SYNC METADATA & BASE STATE ("ARCHIVO BASE") TRACKING ---
  computeContentHash(data?: {
    users?: any[];
    sheets?: any[];
    worlds?: any[];
    feedback?: any[];
    changelog?: any[];
  }): string {
    try {
      const payload = {
        users: (data?.users ?? this.getUsers()).map((u: any) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          userTagId: u.userTagId || '',
          avatarLen: (u.avatarUrl || '').length,
          friends: Array.isArray(u.friends) ? u.friends : [],
          role: u.role,
          appRole: u.appRole,
          status: u.status,
          password: u.password,
          passwordResetRequested: u.passwordResetRequested,
        })),
        sheets: (data?.sheets ?? this.getPlayerSheets()).map((s: any) => ({
          id: s.id,
          ownerEmail: s.ownerEmail,
          name: s.name,
          updatedAt: s.updatedAt,
          charName: s.character?.name,
          level: s.character?.level,
          hp: s.character?.currentHp,
          invLen: s.character?.inventory?.length || 0,
          spellsLen: s.character?.spells?.length || 0,
          gp: s.character?.currency?.gp || 0,
          avatar: s.character?.avatarUrl || s.character?.avatarCustomUrl || '',
        })),
        worlds: (data?.worlds ?? this.getWorldSheets()).map((w: any) => ({
          id: w.id,
          ownerEmail: w.ownerEmail,
          name: w.name,
          roomCode: w.roomCode,
          updatedAt: w.updatedAt,
          npcsLen: w.workspace?.npcs?.length || 0,
          monstersLen: w.workspace?.monsters?.length || 0,
          itemsLen: w.workspace?.customItemsAndSpells?.length || 0,
          locsLen: w.workspace?.locations?.length || 0,
          logsLen: w.workspace?.campaignLogs?.length || 0,
        })),
        feedback: (data?.feedback ?? this.getFeedback()).map((f: any) => ({
          id: f.id,
          status: f.status,
        })),
        changelogLen: (data?.changelog ?? this.getChangelog()).length,
      };
      return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
    } catch {
      return 'hash-fallback';
    }
  },

  getSyncMetadata(): SyncMetadata {
    const filePath = path.join(DATA_DIR, 'sync_meta.json');
    if (fs.existsSync(filePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SyncMetadata;
        return {
          ...parsed,
          contentHash: parsed.contentHash || this.computeContentHash(),
        };
      } catch (e) {
        console.error('Error reading sync_meta.json:', e);
      }
    }

    // If sync_meta.json does not exist yet, this container just booted with the static "Archivo Base"
    const initialMeta: SyncMetadata = {
      isBaseState: true,
      revision: 0,
      lastModifiedAt: 0,
      lastMutationReason: 'Archivo Base Inicial (Esperando comparación con la nube)',
      contentHash: this.computeContentHash(),
    };
    writeJSON('sync_meta.json', initialMeta);
    return initialMeta;
  },

  saveSyncMetadata(updates: Partial<SyncMetadata>): SyncMetadata {
    const current = this.getSyncMetadata();
    const updated: SyncMetadata = {
      ...current,
      ...updates,
      contentHash: updates.contentHash || this.computeContentHash(),
    };
    writeJSON('sync_meta.json', updated);
    return updated;
  },

  markMutation(reason: string): SyncMetadata {
    if (isRestoringOrSyncing) {
      return this.getSyncMetadata();
    }
    const current = this.getSyncMetadata();
    const now = Date.now();
    const nextMeta = this.saveSyncMetadata({
      isBaseState: false,
      revision: (current.revision || 0) + 1,
      lastModifiedAt: now,
      lastMutationReason: reason,
      contentHash: this.computeContentHash(),
    });

    // Save immediate snapshot to persistent /tmp vault
    this.saveToPersistentVault();

    // Notify cloud sync engine to perform automatic backup to cloud
    if (mutationListener) {
      try {
        mutationListener(reason);
      } catch (err) {
        console.error('[DataStore Mutation Listener Error]:', err);
      }
    }

    return nextMeta;
  },

  // --- PERSISTENT VAULT MIRROR (/tmp) FOR CONTAINER RESTART RESILIENCE ---
  saveToPersistentVault(): void {
    try {
      const backup = this.getFullBackup();
      const targetPath = path.join(PERSISTENT_VAULT_DIR, 'latest_backup.json');
      fs.writeFileSync(targetPath, JSON.stringify(backup, null, 2), 'utf-8');

      // Also persist cloud credentials separately so they survive any workspace reset
      const settings = this.getHostSettings();
      if (settings.autoBackup) {
        const credsPath = path.join(PERSISTENT_VAULT_DIR, 'cloud_credentials.json');
        fs.writeFileSync(credsPath, JSON.stringify(settings.autoBackup, null, 2), 'utf-8');
      }
    } catch (err) {
      // Ignore if /tmp is restricted
    }
  },

  loadFromPersistentVault(): any | null {
    try {
      const targetPath = path.join(PERSISTENT_VAULT_DIR, 'latest_backup.json');
      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading from persistent vault:', err);
    }
    return null;
  },

  loadCloudCredentialsFromPersistentVault(): AutoBackupConfig | null {
    try {
      const credsPath = path.join(PERSISTENT_VAULT_DIR, 'cloud_credentials.json');
      if (fs.existsSync(credsPath)) {
        return JSON.parse(fs.readFileSync(credsPath, 'utf-8')) as AutoBackupConfig;
      }
    } catch {}
    return null;
  },

  // --- PRE-REPLACE ARCHIVE ("APARTADO DE RESPALDOS REEMPLAZADOS") ---
  getReplacedBackupsArchive(): ReplacedBackupArchiveEntry[] {
    const localArchive = readJSON<ReplacedBackupArchiveEntry[]>('replaced_backups_archive.json', []);
    try {
      const persistentArchivePath = path.join(PERSISTENT_VAULT_DIR, 'replaced_backups_archive.json');
      if (fs.existsSync(persistentArchivePath)) {
        const persistentList = JSON.parse(fs.readFileSync(persistentArchivePath, 'utf-8')) as ReplacedBackupArchiveEntry[];
        if (Array.isArray(persistentList) && persistentList.length > localArchive.length) {
          writeJSON('replaced_backups_archive.json', persistentList);
          return persistentList;
        }
      }
    } catch {}
    return localArchive;
  },

  getReplacedBackupsSummaries(): ReplacedBackupArchiveSummary[] {
    return this.getReplacedBackupsArchive().map(({ snapshot, ...summary }) => summary);
  },

  getReplacedBackupById(id: string): ReplacedBackupArchiveEntry | undefined {
    return this.getReplacedBackupsArchive().find((entry) => entry.id === id);
  },

  archiveBackupBeforeReplace(
    localBackupSnapshot: any,
    replacedByTimestamp: number,
    reason: string,
    cloudLocation?: string
  ): ReplacedBackupArchiveEntry {
    const archiveList = this.getReplacedBackupsArchive();
    const now = Date.now();
    const entry: ReplacedBackupArchiveEntry = {
      id: `pre-replace-${now}-${Math.random().toString(36).slice(2, 6)}`,
      archivedAt: now,
      replacedByTimestamp,
      localTimestampBeforeReplace:
        localBackupSnapshot.backupTimestamp ||
        (localBackupSnapshot.exportedAt ? new Date(localBackupSnapshot.exportedAt).getTime() : 0),
      localRevisionBeforeReplace: localBackupSnapshot.revision || 0,
      reason,
      cloudLocation: cloudLocation || 'Bóveda de Reemplazos WeRoll',
      summary: {
        usersCount: Array.isArray(localBackupSnapshot.users) ? localBackupSnapshot.users.length : 0,
        sheetsCount: Array.isArray(localBackupSnapshot.sheets) ? localBackupSnapshot.sheets.length : 0,
        worldsCount: Array.isArray(localBackupSnapshot.worlds) ? localBackupSnapshot.worlds.length : 0,
        feedbackCount: Array.isArray(localBackupSnapshot.feedback) ? localBackupSnapshot.feedback.length : 0,
      },
      snapshot: localBackupSnapshot,
    };

    const updatedList = [entry, ...archiveList].slice(0, 15);
    writeJSON('replaced_backups_archive.json', updatedList);

    try {
      const persistentArchivePath = path.join(PERSISTENT_VAULT_DIR, 'replaced_backups_archive.json');
      fs.writeFileSync(persistentArchivePath, JSON.stringify(updatedList, null, 2), 'utf-8');
      const singleFile = path.join(PERSISTENT_ARCHIVE_DIR, `${entry.id}.json`);
      fs.writeFileSync(singleFile, JSON.stringify(entry, null, 2), 'utf-8');
    } catch {}

    return entry;
  },

  // --- USERS, 3-CHAR TAG IDs & FRIENDS ---
  sanitizeTagId(rawTag?: string, fallbackSeed?: string): string {
    const cleaned = (rawTag || '')
      .replace(/^@+/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 3);
    if (cleaned.length > 0) {
      return cleaned;
    }
    const seed = fallbackSeed || String(Date.now());
    const hash = crypto.createHash('md5').update(seed).digest('hex').slice(0, 3);
    return hash || '123';
  },

  getUsers(): UserAccount[] {
    const users = readJSON<UserAccount[]>('users.json', DEFAULT_USERS);
    if (users.length === 0) {
      writeJSON('users.json', DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    let needsSave = false;
    for (const u of users) {
      if (!u.userTagId) {
        u.userTagId =
          u.id === 'usr-admin-master'
            ? 'adm'
            : u.id === 'usr-admin-deadplanter'
            ? 'top'
            : this.sanitizeTagId('', u.id || u.email);
        needsSave = true;
      }
      if (!Array.isArray(u.friends)) {
        u.friends = [];
        needsSave = true;
      }
      if (!u.playerType) {
        if (u.role === 'dm') u.playerType = 'dm';
        else if (u.role === 'player') u.playerType = 'player';
        else u.playerType = 'both';
        needsSave = true;
      }
      if (!u.appRole) {
        if (u.role === 'admin' || u.email.toLowerCase() === 'admin@weroll.app' || u.email.toLowerCase() === 'deadplanter@gmail.com') {
          u.appRole = 'admin';
        } else if (u.role === 'creator') {
          u.appRole = 'creator';
        } else if (u.role === 'moderator') {
          u.appRole = 'moderator';
        } else {
          u.appRole = 'client';
        }
        needsSave = true;
      }
      if (u.appRole === 'admin' || u.appRole === 'creator' || u.appRole === 'moderator') {
        if (!u.canPostInForum) {
          u.canPostInForum = true;
          needsSave = true;
        }
      } else if (u.canPostInForum === undefined) {
        u.canPostInForum = false;
        needsSave = true;
      }
      if (!Array.isArray(u.ownedDlcIds)) {
        u.ownedDlcIds = ['dlc-srd-5e-oficial'];
        needsSave = true;
      } else if (!u.ownedDlcIds.includes('dlc-srd-5e-oficial')) {
        u.ownedDlcIds.push('dlc-srd-5e-oficial');
        needsSave = true;
      }
      if (!Array.isArray(u.ownedSkinIds)) {
        u.ownedSkinIds =
          u.appRole === 'admin' || u.appRole === 'creator'
            ? ['skin-app-default', 'skin-player-default', 'skin-player-crimson-dragon', 'skin-dm-default', 'skin-dm-obsidian-throne']
            : ['skin-app-default', 'skin-player-default', 'skin-dm-default'];
        needsSave = true;
      }
    }

    // Continuously corroborate that no two users share the same displayName or userTagId
    const deduped = deduplicateUsersIdentity(users);
    if (deduped.changed) {
      needsSave = true;
    }

    if (needsSave) {
      writeJSON('users.json', deduped.users);
    }
    return deduped.users;
  },

  corroborateUniqueUsers(): {
    checkedCount: number;
    fixedConflicts: boolean;
    fixedCount: number;
    users: UserAccount[];
  } {
    const rawUsers = readJSON<UserAccount[]>('users.json', DEFAULT_USERS);
    const deduped = deduplicateUsersIdentity(rawUsers);
    if (deduped.changed) {
      this.saveUsers(
        deduped.users,
        'Corroboración automática de unicidad de Nombre de Usuario e ID (@ID)'
      );
    }
    return {
      checkedCount: deduped.users.length,
      fixedConflicts: deduped.changed,
      fixedCount: deduped.changed ? 1 : 0,
      users: deduped.users,
    };
  },

  saveUsers(users: UserAccount[], mutationReason?: string): void {
    writeJSON('users.json', users);
    if (mutationReason) {
      this.markMutation(mutationReason);
    }
  },

  findUserByEmail(email: string): UserAccount | undefined {
    const users = this.getUsers();
    return users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  },

  createUser(account: Omit<UserAccount, 'id' | 'registeredAt' | 'lastActiveAt'>): UserAccount {
    const users = this.getUsers();
    const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const requestedTag = (account.userTagId || '').replace(/^@+/, '').trim().slice(0, 3);

    // Check uniqueness of displayName and (if explicitly provided) userTagId
    const check = validateUniqueUserIdentity({
      displayName: account.displayName,
      userTagId: requestedTag || undefined,
      existingUsers: users,
    });
    if (!check.valid) {
      throw new Error(check.error || 'El nombre de usuario o el ID ya está en uso.');
    }

    // Generate a guaranteed-unique tag if none provided
    let finalTag = requestedTag || this.sanitizeTagId('', id);
    let attempt = 1;
    while (
      users.some((u) => (u.userTagId || '').trim().toLowerCase() === finalTag.toLowerCase())
    ) {
      finalTag = String(100 + ((attempt * 37) % 899)).slice(0, 3);
      attempt++;
    }

    const newUser: UserAccount = {
      ...account,
      id,
      displayName: account.displayName.trim(),
      userTagId: finalTag,
      friends: Array.isArray(account.friends) ? account.friends : [],
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    users.push(newUser);
    this.saveUsers(
      users,
      `Nueva cuenta creada: ${newUser.displayName}@${newUser.userTagId} (${newUser.email})`
    );
    return newUser;
  },

  updateUserStatus(id: string, status: 'approved' | 'rejected', approvedBy: string): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].status = status;
    users[idx].approvedAt = Date.now();
    users[idx].approvedBy = approvedBy;
    this.saveUsers(
      users,
      `Cuenta ${status === 'approved' ? 'aprobada' : 'rechazada'}: ${users[idx].email}`
    );
    return users[idx];
  },

  updateUserRole(id: string, role: 'player' | 'dm' | 'both' | 'moderator' | 'admin'): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].role = role;
    this.saveUsers(users, `Cambio de rol de usuario (${users[idx].email} -> ${role})`);
    return users[idx];
  },

  updateUserTagId(id: string, rawTagId: string): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const cleaned = (rawTagId || '').replace(/^@+/, '').trim();
    if (!cleaned || cleaned.length > 3) {
      throw new Error('El ID debe tener entre 1 y 3 caracteres como máximo (ej: 123 o top).');
    }

    const check = validateUniqueUserIdentity({
      userTagId: cleaned,
      excludeUserId: id,
      existingUsers: users,
    });
    if (!check.valid) {
      throw new Error(check.error || 'Ese ID ya está en uso por otro usuario.');
    }

    users[idx].userTagId = cleaned;
    this.saveUsers(
      users,
      `ID de usuario actualizado: ${users[idx].displayName}@${cleaned} (${users[idx].email})`
    );
    return users[idx];
  },

  updateUserAvatar(id: string, avatarUrl?: string): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].avatarUrl = avatarUrl ? avatarUrl.trim() : undefined;
    this.saveUsers(
      users,
      `Avatar de jugador actualizado: ${users[idx].displayName}@${users[idx].userTagId || '123'}`
    );
    return users[idx];
  },

  adminUpdateUserAccount(
    id: string,
    updates: {
      email?: string;
      displayName?: string;
      userTagId?: string;
      password?: string;
      role?: UserAccount['role'];
      status?: UserAccount['status'];
    }
  ): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;

    if (updates.email && updates.email.trim()) {
      const normEmail = updates.email.trim().toLowerCase();
      const duplicate = users.find((u, i) => i !== idx && u.email.trim().toLowerCase() === normEmail);
      if (duplicate) {
        throw new Error('Ya existe otro usuario registrado con ese correo electrónico.');
      }
      users[idx].email = normEmail;
    }

    const nextDisplayName =
      updates.displayName && updates.displayName.trim() ? updates.displayName.trim() : undefined;
    const nextTagId =
      updates.userTagId !== undefined
        ? updates.userTagId.replace(/^@+/, '').trim().slice(0, 3) || undefined
        : undefined;

    const identityCheck = validateUniqueUserIdentity({
      displayName: nextDisplayName,
      userTagId: nextTagId,
      excludeUserId: id,
      existingUsers: users,
    });
    if (!identityCheck.valid) {
      throw new Error(identityCheck.error || 'El nombre de usuario o ID ya está en uso.');
    }

    if (nextDisplayName) {
      users[idx].displayName = nextDisplayName;
    }
    if (nextTagId) {
      users[idx].userTagId = nextTagId;
    }
    if (updates.password && updates.password.trim()) {
      users[idx].password = updates.password.trim();
    }
    if (updates.role) {
      users[idx].role = updates.role;
    }
    if ((updates as any).playerType) {
      users[idx].playerType = (updates as any).playerType;
    }
    if ((updates as any).appRole) {
      users[idx].appRole = (updates as any).appRole;
      if (users[idx].appRole === 'admin' || users[idx].appRole === 'creator' || users[idx].appRole === 'moderator') {
        users[idx].canPostInForum = true;
      }
    }
    if ((updates as any).avatarUrl !== undefined) {
      users[idx].avatarUrl = (updates as any).avatarUrl || undefined;
    }
    if ((updates as any).canPostInForum !== undefined) {
      users[idx].canPostInForum = Boolean((updates as any).canPostInForum);
    }
    if (updates.status) {
      users[idx].status = updates.status;
    }

    this.saveUsers(
      users,
      `Usuario editado por Administrador: ${users[idx].displayName}@${users[idx].userTagId} (${users[idx].email})`
    );
    return users[idx];
  },

  deleteUser(id: string): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const removed = users[idx];
    users.splice(idx, 1);

    // Also clean up removed user from all other users' friends lists
    for (const u of users) {
      if (Array.isArray(u.friends) && u.friends.includes(id)) {
        u.friends = u.friends.filter((fId) => fId !== id);
      }
    }

    this.saveUsers(
      users,
      `Cuenta de usuario eliminada por Administrador: ${removed.displayName}@${removed.userTagId || ''} (${removed.email})`
    );
    return removed;
  },

  getFriendsForUser(userId: string) {
    const users = this.getUsers();
    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser) return [];
    const now = Date.now();
    const allMessages = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    const friendIds = Array.isArray(currentUser.friends) ? currentUser.friends : [];
    return friendIds
      .map((fId) => users.find((u) => u.id === fId))
      .filter((u): u is UserAccount => Boolean(u))
      .map((u) => {
        const unreadCount = allMessages.filter(
          (m) => m.fromUserId === u.id && m.toUserId === userId && !m.read
        ).length;
        const friendMessages = allMessages
          .filter(
            (m) =>
              (m.fromUserId === u.id && m.toUserId === userId) ||
              (m.fromUserId === userId && m.toUserId === u.id)
          )
          .sort((a, b) => a.createdAt - b.createdAt);
        const lastMessage = friendMessages[friendMessages.length - 1] || null;
        const isOnline = now - (u.lastActiveAt || 0) <= ONLINE_THRESHOLD_MS;
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          userTagId: u.userTagId || '123',
          fullTag: `${u.displayName}@${u.userTagId || '123'}`,
          avatarUrl: u.avatarUrl,
          role: u.role,
          appRole:
            u.appRole ||
            (u.role === 'admin'
              ? 'admin'
              : u.role === 'creator'
              ? 'creator'
              : u.role === 'moderator'
              ? 'moderator'
              : 'client'),
          status: u.status,
          lastActiveAt: u.lastActiveAt,
          isOnline,
          totalConnectedMs: u.totalConnectedMs || 0,
          sessionCount: u.sessionCount || 1,
          currentActivity: isOnline ? u.currentActivity || 'En el Portal' : 'Desconectado',
          unreadCount,
          lastMessageId: lastMessage?.id || '',
          lastMessageAt: lastMessage?.createdAt || 0,
        };
      });
  },

  getFriendRequestsForUser(userId: string) {
    const users = this.getUsers();
    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser) {
      return { incomingRequests: [], outgoingRequests: [] };
    }
    const incomingIds = Array.isArray(currentUser.incomingFriendRequests)
      ? currentUser.incomingFriendRequests
      : [];
    const outgoingIds = Array.isArray(currentUser.outgoingFriendRequests)
      ? currentUser.outgoingFriendRequests
      : [];

    const mapReqUser = (u: UserAccount) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      userTagId: u.userTagId || '123',
      fullTag: `${u.displayName}@${u.userTagId || '123'}`,
      avatarUrl: u.avatarUrl,
      role: u.role,
      appRole:
        u.appRole ||
        (u.role === 'admin'
          ? 'admin'
          : u.role === 'creator'
          ? 'creator'
          : u.role === 'moderator'
          ? 'moderator'
          : 'client'),
      status: u.status,
      lastActiveAt: u.lastActiveAt,
    });

    const incomingRequests = incomingIds
      .map((rId) => users.find((u) => u.id === rId))
      .filter((u): u is UserAccount => Boolean(u))
      .map(mapReqUser);

    const outgoingRequests = outgoingIds
      .map((tId) => users.find((u) => u.id === tId))
      .filter((u): u is UserAccount => Boolean(u))
      .map(mapReqUser);

    return { incomingRequests, outgoingRequests };
  },

  addFriendByTag(userId: string, friendFullTagInput: string) {
    const users = this.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    if (userIdx === -1) {
      throw new Error('Tu usuario no fue encontrado en el servidor.');
    }

    const raw = (friendFullTagInput || '').trim();
    const atIndex = raw.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === raw.length - 1) {
      throw new Error(
        'Formato inválido. Escribe el nombre de usuario seguido de @ y los 3 caracteres de su ID (ejemplo: usuario1@123 o usuario2@top).'
      );
    }

    const targetName = raw.slice(0, atIndex).trim().toLowerCase();
    const targetTag = raw.slice(atIndex + 1).trim().toLowerCase();

    const targetIdx = users.findIndex(
      (u) =>
        u.displayName.trim().toLowerCase() === targetName &&
        (u.userTagId || '').trim().toLowerCase() === targetTag
    );

    if (targetIdx === -1) {
      throw new Error(
        `No se encontró ningún jugador con el identificador "${raw}". Verifica su nombre de usuario y su ID de 3 caracteres después del @.`
      );
    }

    const targetUser = users[targetIdx];
    if (targetUser.id === userId) {
      throw new Error('No puedes agregarte a ti mismo como amigo.');
    }

    if (!Array.isArray(users[userIdx].friends)) {
      users[userIdx].friends = [];
    }
    if (!Array.isArray(users[targetIdx].friends)) {
      users[targetIdx].friends = [];
    }
    if (users[userIdx].friends!.includes(targetUser.id)) {
      throw new Error(`${targetUser.displayName}@${targetUser.userTagId} ya está en tu lista de amigos.`);
    }

    if (!Array.isArray(users[userIdx].incomingFriendRequests)) {
      users[userIdx].incomingFriendRequests = [];
    }
    if (!Array.isArray(users[userIdx].outgoingFriendRequests)) {
      users[userIdx].outgoingFriendRequests = [];
    }
    if (!Array.isArray(users[targetIdx].incomingFriendRequests)) {
      users[targetIdx].incomingFriendRequests = [];
    }
    if (!Array.isArray(users[targetIdx].outgoingFriendRequests)) {
      users[targetIdx].outgoingFriendRequests = [];
    }

    // If the target user ALREADY sent us a friend request, automatically accept it!
    if (users[userIdx].incomingFriendRequests!.includes(targetUser.id)) {
      users[userIdx].incomingFriendRequests = users[userIdx].incomingFriendRequests!.filter(
        (id) => id !== targetUser.id
      );
      users[targetIdx].outgoingFriendRequests = users[targetIdx].outgoingFriendRequests!.filter(
        (id) => id !== userId
      );
      if (!users[userIdx].friends!.includes(targetUser.id)) {
        users[userIdx].friends!.push(targetUser.id);
      }
      if (!users[targetIdx].friends!.includes(userId)) {
        users[targetIdx].friends!.push(userId);
      }
      this.saveUsers(
        users,
        `Solicitud de amistad aceptada mutuamente entre ${users[userIdx].displayName}@${users[userIdx].userTagId} y ${targetUser.displayName}@${targetUser.userTagId}`
      );
      const reqs = this.getFriendRequestsForUser(userId);
      return {
        requestStatus: 'accepted' as const,
        addedFriend: {
          id: targetUser.id,
          email: targetUser.email,
          displayName: targetUser.displayName,
          userTagId: targetUser.userTagId || '123',
          fullTag: `${targetUser.displayName}@${targetUser.userTagId || '123'}`,
          avatarUrl: targetUser.avatarUrl,
          role: targetUser.role,
          status: targetUser.status,
          lastActiveAt: targetUser.lastActiveAt,
        },
        friends: this.getFriendsForUser(userId),
        ...reqs,
      };
    }

    // Check if we already sent a pending request to this user
    if (users[userIdx].outgoingFriendRequests!.includes(targetUser.id)) {
      throw new Error(
        `Ya enviaste una solicitud de amistad a ${targetUser.displayName}@${targetUser.userTagId}. Espera a que la acepte.`
      );
    }

    // Send a pending friend request to targetUser
    users[userIdx].outgoingFriendRequests!.push(targetUser.id);
    if (!users[targetIdx].incomingFriendRequests!.includes(userId)) {
      users[targetIdx].incomingFriendRequests!.push(userId);
    }

    this.saveUsers(
      users,
      `Solicitud de amistad enviada: ${users[userIdx].displayName}@${users[userIdx].userTagId} solicitó agregar a ${targetUser.displayName}@${targetUser.userTagId}`
    );

    const reqs = this.getFriendRequestsForUser(userId);
    return {
      requestStatus: 'pending' as const,
      addedFriend: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        userTagId: targetUser.userTagId || '123',
        fullTag: `${targetUser.displayName}@${targetUser.userTagId || '123'}`,
        avatarUrl: targetUser.avatarUrl,
        role: targetUser.role,
        status: targetUser.status,
        lastActiveAt: targetUser.lastActiveAt,
      },
      friends: this.getFriendsForUser(userId),
      ...reqs,
    };
  },

  respondToFriendRequest(userId: string, requesterId: string, accept: boolean) {
    const users = this.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    const reqIdx = users.findIndex((u) => u.id === requesterId);

    if (userIdx === -1) {
      throw new Error('Tu usuario no fue encontrado.');
    }
    if (reqIdx === -1) {
      throw new Error('El usuario que envió la solicitud no fue encontrado.');
    }

    const currentUser = users[userIdx];
    const requesterUser = users[reqIdx];

    currentUser.incomingFriendRequests = (currentUser.incomingFriendRequests || []).filter(
      (id) => id !== requesterId
    );
    currentUser.outgoingFriendRequests = (currentUser.outgoingFriendRequests || []).filter(
      (id) => id !== requesterId
    );
    requesterUser.outgoingFriendRequests = (requesterUser.outgoingFriendRequests || []).filter(
      (id) => id !== userId
    );
    requesterUser.incomingFriendRequests = (requesterUser.incomingFriendRequests || []).filter(
      (id) => id !== userId
    );

    if (accept) {
      if (!Array.isArray(currentUser.friends)) currentUser.friends = [];
      if (!Array.isArray(requesterUser.friends)) requesterUser.friends = [];
      if (!currentUser.friends.includes(requesterId)) {
        currentUser.friends.push(requesterId);
      }
      if (!requesterUser.friends.includes(userId)) {
        requesterUser.friends.push(userId);
      }
    }

    this.saveUsers(
      users,
      accept
        ? `Solicitud de amistad aceptada: ${currentUser.displayName}@${currentUser.userTagId} aceptó a ${requesterUser.displayName}@${requesterUser.userTagId}`
        : `Solicitud de amistad rechazada: ${currentUser.displayName}@${currentUser.userTagId} rechazó a ${requesterUser.displayName}@${requesterUser.userTagId}`
    );

    const reqs = this.getFriendRequestsForUser(userId);
    return {
      accepted: accept,
      requester: {
        id: requesterUser.id,
        displayName: requesterUser.displayName,
        userTagId: requesterUser.userTagId || '123',
        fullTag: `${requesterUser.displayName}@${requesterUser.userTagId || '123'}`,
      },
      friends: this.getFriendsForUser(userId),
      ...reqs,
    };
  },

  removeFriend(userId: string, friendId: string) {
    const users = this.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    if (userIdx === -1) {
      throw new Error('Usuario no encontrado.');
    }

    const friendUser = users.find((u) => u.id === friendId);
    users[userIdx].friends = (users[userIdx].friends || []).filter((id) => id !== friendId);
    users[userIdx].incomingFriendRequests = (users[userIdx].incomingFriendRequests || []).filter(
      (id) => id !== friendId
    );
    users[userIdx].outgoingFriendRequests = (users[userIdx].outgoingFriendRequests || []).filter(
      (id) => id !== friendId
    );

    const friendIdx = users.findIndex((u) => u.id === friendId);
    if (friendIdx !== -1) {
      if (Array.isArray(users[friendIdx].friends)) {
        users[friendIdx].friends = users[friendIdx].friends!.filter((id) => id !== userId);
      }
      users[friendIdx].incomingFriendRequests = (users[friendIdx].incomingFriendRequests || []).filter(
        (id) => id !== userId
      );
      users[friendIdx].outgoingFriendRequests = (users[friendIdx].outgoingFriendRequests || []).filter(
        (id) => id !== userId
      );
    }

    this.saveUsers(
      users,
      `Amigo eliminado: ${users[userIdx].displayName}@${users[userIdx].userTagId} eliminó a ${friendUser ? `${friendUser.displayName}@${friendUser.userTagId}` : friendId}`
    );

    const reqs = this.getFriendRequestsForUser(userId);
    return {
      friends: this.getFriendsForUser(userId),
      ...reqs,
    };
  },

  findUserById(id: string): UserAccount | undefined {
    const users = this.getUsers();
    return users.find((u) => u.id === id);
  },

  updateUserPassword(id: string, newPassword: string, clearResetRequest = true): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].password = newPassword.trim();
    if (clearResetRequest) {
      users[idx].passwordResetRequested = false;
      users[idx].passwordResetRequestedAt = undefined;
      users[idx].passwordResetNote = undefined;
    }
    this.saveUsers(users, `Contraseña actualizada para cuenta: ${users[idx].email}`);
    return users[idx];
  },

  requestPasswordReset(email: string, note?: string): boolean {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (idx === -1) return false;
    users[idx].passwordResetRequested = true;
    users[idx].passwordResetRequestedAt = Date.now();
    users[idx].passwordResetNote = note || 'Solicitud de restablecimiento realizada por el usuario.';
    this.saveUsers(users, `Solicitud de reseteo de clave: ${users[idx].email}`);
    return true;
  },

  // --- ROOMS WITH PASSWORDS ---
  getRooms(): Record<string, RoomRecord> {
    return readJSON<Record<string, RoomRecord>>('rooms.json', {});
  },

  saveRooms(rooms: Record<string, RoomRecord>, mutationReason?: string): void {
    writeJSON('rooms.json', rooms);
    if (mutationReason) {
      this.markMutation(mutationReason);
    }
  },

  setRoom(record: RoomRecord): void {
    const rooms = this.getRooms();
    const worlds = this.getWorldSheets();
    const code = normalizeRoomIdentifier(record.roomCode);

    const check = validateUniqueRoomNameAndCode({
      proposedRoomCode: code,
      proposedName: record.name || code,
      excludeWorldId: record.worldSheetId,
      requesterEmail: record.dmEmail,
      existingWorlds: worlds,
      activeRooms: Object.values(rooms) as RoomRecord[],
    });
    if (!check.valid) {
      throw new Error(check.error || 'Ya existe otra sala activa o registrada con ese nombre.');
    }

    rooms[code] = {
      ...record,
      roomCode: code,
      lastUpdated: Date.now(),
    };
    this.saveRooms(rooms, `Sala activa registrada/actualizada: ${code}`);
  },

  getRoom(code: string): RoomRecord | undefined {
    const rooms = this.getRooms();
    return rooms[normalizeRoomIdentifier(code)] || rooms[code.trim().toUpperCase()];
  },

  validateRoomCreation(params: {
    roomCode: string;
    roomName?: string;
    dmEmail?: string;
    worldSheetId?: string;
    activeRooms?: { roomCode: string; name?: string; dmEmail?: string; dmConnected?: boolean; worldSheetId?: string }[];
  }): { valid: boolean; error?: string } {
    const worlds = this.getWorldSheets();
    const persistedRooms = Object.values(this.getRooms()) as RoomRecord[];
    return validateUniqueRoomNameAndCode({
      proposedRoomCode: params.roomCode,
      proposedName: params.roomName || params.roomCode,
      excludeWorldId: params.worldSheetId,
      requesterEmail: params.dmEmail,
      existingWorlds: worlds,
      activeRooms: [...persistedRooms, ...(params.activeRooms || [])],
    });
  },

  // --- PLAYER SHEETS VAULT ---
  getPlayerSheets(): PlayerSheetRecord[] {
    return readJSON<PlayerSheetRecord[]>('sheets.json', []);
  },

  savePlayerSheet(sheet: PlayerSheetRecord, changedFieldsHint?: string[]): void {
    const sheets = this.getPlayerSheets();
    const idx = sheets.findIndex((s) => s.id === sheet.id);
    const isNew = idx === -1;
    const prev = idx >= 0 ? sheets[idx] : undefined;
    const updatedRecord = { ...sheet, updatedAt: Date.now() };
    if (idx >= 0) {
      sheets[idx] = updatedRecord;
    } else {
      sheets.push(updatedRecord);
    }
    writeJSON('sheets.json', sheets);

    // Detect granular changed fields for Delta Sync log
    const detectedFields: string[] = changedFieldsHint ? [...changedFieldsHint] : [];
    if (!changedFieldsHint && prev?.character && sheet.character) {
      if (prev.character.currentHp !== sheet.character.currentHp) detectedFields.push('currentHp');
      if (prev.character.tempHp !== sheet.character.tempHp) detectedFields.push('tempHp');
      if (prev.character.level !== sheet.character.level) detectedFields.push('level');
      if (prev.character.experience !== sheet.character.experience) detectedFields.push('experience');
      if ((prev.character.inventory?.length || 0) !== (sheet.character.inventory?.length || 0)) {
        detectedFields.push('inventory');
      }
      if ((prev.character.spells?.length || 0) !== (sheet.character.spells?.length || 0)) {
        detectedFields.push('spells');
      }
      if (prev.character.avatarCustomUrl !== sheet.character.avatarCustomUrl) {
        detectedFields.push('avatarCustomUrl');
      }
      if (prev.character.playerSkinId !== sheet.character.playerSkinId) {
        detectedFields.push('playerSkinId');
      }
    }
    if (detectedFields.length === 0) {
      detectedFields.push(isNew ? 'create_sheet' : 'sheet_fields');
    }

    this.markMutation(
      isNew
        ? `Nueva Player Sheet creada: ${sheet.name} (${sheet.ownerEmail})`
        : `Delta Player Sheet [${detectedFields.join(', ')}]: ${sheet.name} (${sheet.ownerEmail})`
    );
    this.recordDeltaEntry({
      entityKind: 'sheet',
      entityId: sheet.id,
      entityLabel: `${sheet.name} (${sheet.ownerEmail})`,
      actorEmail: sheet.ownerEmail,
      changedFields: detectedFields,
      payloadSizeKb: Math.max(0.4, Math.round((JSON.stringify(sheet).length / 1024) * 10) / 10),
      summary: isNew
        ? `Creación de ficha "${sheet.name}"`
        : `Actualización incremental de "${sheet.name}" (${detectedFields.join(', ')})`,
    });
  },

  deletePlayerSheet(id: string, ownerEmail?: string): boolean {
    let sheets = this.getPlayerSheets();
    const target = sheets.find((s) => s.id === id);
    const initialLen = sheets.length;
    sheets = sheets.filter((s) => {
      if (s.id !== id) return true;
      if (ownerEmail && s.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) return true;
      return false;
    });
    if (sheets.length < initialLen) {
      writeJSON('sheets.json', sheets);
      this.markMutation(`Player Sheet eliminada: ${target?.name || id}`);
      return true;
    }
    return false;
  },

  // --- WORLD SHEETS VAULT ---
  getWorldSheets(): WorldSheetRecord[] {
    return readJSON<WorldSheetRecord[]>('worlds.json', []);
  },

  saveWorldSheet(world: WorldSheetRecord): void {
    const worlds = this.getWorldSheets();
    const rooms = this.getRooms();
    const idx = worlds.findIndex((w) => w.id === world.id);
    const isNew = idx === -1;

    const normCode = normalizeRoomIdentifier(world.roomCode || world.name || 'MESA-DRAGON');
    const check = validateUniqueRoomNameAndCode({
      proposedRoomCode: normCode,
      proposedName: world.name,
      excludeWorldId: world.id,
      requesterEmail: world.ownerEmail,
      existingWorlds: worlds,
      activeRooms: Object.values(rooms),
    });
    if (!check.valid) {
      throw new Error(check.error || 'Ya existe una sala o mesa registrada con ese nombre.');
    }

    const updatedWorld: WorldSheetRecord = {
      ...world,
      roomCode: normCode,
      updatedAt: Date.now(),
    };

    if (idx >= 0) {
      worlds[idx] = updatedWorld;
    } else {
      worlds.push(updatedWorld);
    }
    writeJSON('worlds.json', worlds);
    this.markMutation(
      isNew
        ? `Nuevo World Sheet (DM) creado: ${updatedWorld.name} (${updatedWorld.ownerEmail})`
        : `Delta World Sheet (DM): ${updatedWorld.name} (${updatedWorld.ownerEmail})`
    );
    this.recordDeltaEntry({
      entityKind: 'world',
      entityId: updatedWorld.id,
      entityLabel: `${updatedWorld.name} [${updatedWorld.roomCode}]`,
      actorEmail: updatedWorld.ownerEmail,
      changedFields: isNew ? ['create_world'] : ['workspace', 'activeAtlasFolder', 'activeLiveVisual'],
      payloadSizeKb: Math.max(0.8, Math.round((JSON.stringify(updatedWorld).length / 1024) * 10) / 10),
      summary: isNew
        ? `Creación de campaña "${updatedWorld.name}"`
        : `Guardado incremental de campaña "${updatedWorld.name}" (${updatedWorld.roomCode})`,
    });
  },

  updateWorldSheet(id: string, updates: Partial<WorldSheetRecord>, ownerEmail?: string): WorldSheetRecord | null {
    const worlds = this.getWorldSheets();
    const rooms = this.getRooms();
    const idx = worlds.findIndex((w) => {
      if (w.id !== id) return false;
      if (ownerEmail && w.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) return false;
      return true;
    });
    if (idx === -1) return null;

    const nextName = updates.name ? updates.name.trim() : worlds[idx].name;
    const nextCode = updates.roomCode
      ? normalizeRoomIdentifier(updates.roomCode)
      : worlds[idx].roomCode;

    if (updates.name || updates.roomCode) {
      const check = validateUniqueRoomNameAndCode({
        proposedRoomCode: nextCode,
        proposedName: nextName,
        excludeWorldId: id,
        requesterEmail: ownerEmail || worlds[idx].ownerEmail,
        existingWorlds: worlds,
        activeRooms: Object.values(rooms),
      });
      if (!check.valid) {
        throw new Error(check.error || 'Ya existe otra sala o mesa con ese nombre o código.');
      }
    }

    worlds[idx] = {
      ...worlds[idx],
      ...updates,
      name: nextName,
      roomCode: nextCode,
      updatedAt: Date.now(),
    };
    writeJSON('worlds.json', worlds);
    this.markMutation(`World Sheet (DM) actualizado: ${worlds[idx].name}`);
    return worlds[idx];
  },

  deleteWorldSheet(id: string, ownerEmail?: string): boolean {
    let worlds = this.getWorldSheets();
    const target = worlds.find((w) => w.id === id);
    const initialLen = worlds.length;
    worlds = worlds.filter((w) => {
      if (w.id !== id) return true;
      if (ownerEmail && w.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) return true;
      return false;
    });
    if (worlds.length < initialLen) {
      writeJSON('worlds.json', worlds);
      this.markMutation(`World Sheet (DM) eliminado: ${target?.name || id}`);
      return true;
    }
    return false;
  },

  // --- ADMIN SHEET & WORLD INJECTION ---
  injectPlayerSheet(userEmail: string, character: Character5e, customName?: string): PlayerSheetRecord {
    const sheetId = character.id || `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record: PlayerSheetRecord = {
      id: sheetId,
      ownerEmail: userEmail.trim().toLowerCase(),
      name: customName?.trim() || character.name || 'Ficha Inyectada',
      character: {
        ...character,
        id: sheetId,
      },
      updatedAt: Date.now(),
    };
    this.savePlayerSheet(record);
    return record;
  },

  injectWorldSheet(
    userEmail: string,
    workspace: DMWorkspace,
    customName?: string,
    roomCode?: string,
    roomPassword?: string
  ): WorldSheetRecord {
    const worldId = `world-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const finalRoomCode = (
      roomCode?.trim() || `MESA-${Math.floor(1000 + Math.random() * 9000)}`
    ).toUpperCase();

    const record: WorldSheetRecord = {
      id: worldId,
      ownerEmail: userEmail.trim().toLowerCase(),
      name: customName?.trim() || 'Mundo Inyectado',
      roomCode: finalRoomCode,
      roomPassword: roomPassword?.trim() || undefined,
      workspace: workspace || {
        npcs: [],
        monsters: [],
        customItems: [],
        customItemsAndSpells: [],
        locations: [],
        campaignLogs: [],
        combatSummaries: [],
        folders: [],
        activeEncounter: {
          id: 'enc-default',
          name: 'Encuentro Inicial',
          round: 1,
          currentTurnIndex: 0,
          combatants: [],
          isActive: false,
          combatNotes: '',
          combatLog: [],
        },
        favoritesSRD: [],
      },
      updatedAt: Date.now(),
    };
    this.saveWorldSheet(record);
    return record;
  },

  // --- COMMUNITY FEEDBACK & SUGGESTIONS ---
  getFeedback(): FeedbackRecord[] {
    return readJSON<FeedbackRecord[]>('feedback.json', []);
  },

  saveFeedback(list: FeedbackRecord[], mutationReason?: string): void {
    writeJSON('feedback.json', list);
    if (mutationReason) {
      this.markMutation(mutationReason);
    }
  },

  addFeedback(item: Omit<FeedbackRecord, 'id' | 'createdAt'>): FeedbackRecord {
    const feedbackList = this.getFeedback();
    const newRecord: FeedbackRecord = {
      ...item,
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      status: 'unread',
    };
    feedbackList.unshift(newRecord); // newest first
    this.saveFeedback(feedbackList, `Nuevo feedback agregado (${newRecord.category})`);
    return newRecord;
  },

  deleteFeedback(id: string): boolean {
    const feedbackList = this.getFeedback();
    const filtered = feedbackList.filter((f) => f.id !== id);
    if (filtered.length !== feedbackList.length) {
      this.saveFeedback(filtered, `Feedback eliminado (${id})`);
      return true;
    }
    return false;
  },

  updateFeedbackStatus(id: string, status: 'unread' | 'reviewed'): boolean {
    const feedbackList = this.getFeedback();
    const item = feedbackList.find((f) => f.id === id);
    if (!item) return false;
    item.status = status;
    this.saveFeedback(feedbackList, `Estado de feedback actualizado (${id} -> ${status})`);
    return true;
  },

  closeRoom(code: string): boolean {
    const rooms = this.getRooms();
    const norm = code.trim().toUpperCase();
    if (rooms[norm]) {
      delete rooms[norm];
      this.saveRooms(rooms, `Sala cerrada: ${norm}`);
      return true;
    }
    return false;
  },

  // --- ROTATING 2-VERSION BACKUPS ---
  getBackups(): Record<string, PlayerRotatingBackup> {
    return readJSON<Record<string, PlayerRotatingBackup>>('backups.json', {});
  },

  addRotatingBackup(character: Character5e, ownerEmail: string, reason: 'join' | 'leave' | 'manual'): void {
    const backups = this.getBackups();
    const charId = character.id;
    let entry = backups[charId];

    if (!entry) {
      entry = {
        characterId: charId,
        ownerEmail: ownerEmail || 'jugador@weroll.app',
        characterName: character.name,
        slots: [],
        lastRotatedAt: Date.now(),
      };
    }

    const newSlot: RotatingBackupSlot = {
      timestamp: Date.now(),
      reason,
      snapshot: JSON.parse(JSON.stringify(character)),
    };

    // Keep strictly up to 2 rotating slots: if 2 exist, shift the older one out
    if (entry.slots.length >= 2) {
      entry.slots.shift();
    }
    entry.slots.push(newSlot);
    entry.characterName = character.name;
    entry.lastRotatedAt = Date.now();

    backups[charId] = entry;
    writeJSON('backups.json', backups);
  },

  // --- FORUM (POSTS & COMMENTS) ---
  getForumPosts(category?: string, roleFilter?: string, query?: string): ForumPost[] {
    const defaultPosts: ForumPost[] = [
      {
        id: 'post-update-150',
        category: 'app-updates',
        title: 'WeRoll 1.5 Beta • Tooltip de Bonificadores en Carta Tarot, Último Dado en Tiempo Real en Modo Mapa, Estabilidad Multijugador de Vida (PG) y Subida Directa de PNG para el DM',
        content: '¡Llega WeRoll 1.5 Beta! En esta actualización incorporamos mejoras clave solicitadas por la comunidad: ahora al acercar el cursor a cualquiera de los puntajes totales de características (FUE, DES, CON, INT, SAB, CAR) en la Carta Tarot de tu personaje, se despliega un tooltip flotante indicando cuántos puntos de bono tienes en esa estadística (por ejemplo, +4 en Fuerza para Valeros del Alba). También corregimos el indicador de "Último dado tirado" en el Modo Mapa para que se actualice siempre con cada nueva tirada del historial sin quedarse congelado, estabilizamos la sincronización de Puntos de Golpe (PG) cuando hay varios jugadores conectados en línea para evitar que la vida suba y baje, y habilitamos la subida directa de archivos PNG e imágenes desde tu dispositivo en la Hoja del Dungeon Master.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1793228400000,
        upvotes: 108,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 8,
        pinned: true,
      },
      {
        id: 'post-update-140',
        category: 'app-updates',
        title: 'WeRoll 1.4 Beta • Barra Superior Unificada en Partida, Modo Mapa Ampliado, Cartas Tarot Miniatura en Mesa, Estadísticas Totales e Imágenes por Ataque',
        content: '¡Llega WeRoll 1.4 Beta! Rediseñamos la experiencia en partida y en el Modo Mapa tanto para el Dungeon Master como para los Jugadores: nueva barra superior unificada con los botones de Regresar y Guardar en la misma posición, Estandarte del DM en vivo con Susurrar al DM y acceso rápido a la Ubicación Actual / Mapa. Además, el lienzo del Modo Mapa ahora cuenta con mayor espacio e incorpora paneles flotantes plegables (Mazos y Libreta del Jugador, Proyección de Zona y Crónicas del DM), las Cartas Tarot de los jugadores se ubican en la barra inferior en versión miniatura conservando todos sus elementos, las cajas de características ahora muestran el puntaje total de cada estadística en lugar de solo el bono, y las armas multi-ataque y objetos permiten asignar una imagen personalizada a cada ataque o acción.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1793055600000,
        upvotes: 96,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 7,
        pinned: false,
      },
      {
        id: 'post-update-130',
        category: 'app-updates',
        title: 'WeRoll 1.3 Beta • Sincronización Anti-Parpadeo, Cola Local contra Micro-Desconexiones, Retratos (x4), Ilustraciones en Cartas y Verificación OTP',
        content: '¡Llega WeRoll 1.3 Beta! Mejoramos la estabilidad y fluidez en partidas prolongadas eliminando el parpadeo de vida (PG) y mapas mediante control de versión monotónico, e incorporamos una Cola Local de Eventos que protege tus tiradas y cambios si sufres una micro-desconexión de internet sin expulsarte al Lobby. Además: galería de hasta 4 retratos descargables e intercambiables en la Player Sheet, imágenes en monstruos, armas, armaduras, objetos, conjuros y habilidades, descripciones y deduplicación en cartas de habilidades, 5 tipos de entradas en el Tomo de Crónicas del DM y verificación OTP para cuentas nuevas.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1792859200000,
        upvotes: 84,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 6,
        pinned: false,
      },
      {
        id: 'post-update-120',
        category: 'app-updates',
        title: 'WeRoll 1.2 Beta • Rediseño del Atlas del DM, Cola en Visuales, Vista DM vs Vista en Vivo con Fichas Tácticas y Delta Sync',
        content: '¡Llega WeRoll 1.2 Beta! Rediseñamos el Atlas del Mundo del DM para hacerlo mucho más limpio e intuitivo: nuevo botón Ajustes junto a Guardar, botones superiores para Álbum, Mapas Tácticos y Mapas (múltiples mapas por zona), botón dentro del mapa para regresar al lugar anterior, Cola en Visuales para preparar el orden de proyección de tu historia y Explorador Masivo de Carpetas en el botón Mundo. Además, en el Modo Mapa el DM ahora puede previsualizar y editar antes de proyectar a los jugadores, consultar su Cola, alternar entre Vista DM y Vista en Vivo, y mover fichas en la cuadrícula táctica, todo respaldado por el motor de Guardado Incremental por Diferencias (Delta Sync).',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1792772800000,
        upvotes: 68,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 5,
        pinned: false,
      },
      {
        id: 'post-update-110',
        category: 'app-updates',
        title: 'WeRoll 1.1 Beta • Modo Mapa en Vivo, Proyección en Tiempo Real y Cartas Tarot 2×2',
        content: '¡Llega WeRoll 1.1 Beta! Esta versión introduce el nuevo Modo Mapa en Vivo con proyección compartida en tiempo real desde la pantalla del DM hacia todos los jugadores (álbum de lugares y mapas del atlas), cuadrícula compacta 2×2 de Cartas de Jugadores en mesa sin desplazamiento vertical, altura refinada estilo Tarot para los Mazos de Juego y El Rincón del Aventurero, límite táctico de 8 monstruos en combate, selector estilo baraja en el creador de personajes y caja de dados multi-tirada (1 a 6 dados).',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1792686400000,
        upvotes: 54,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 4,
        pinned: false,
      },
      {
        id: 'post-update-100',
        category: 'app-updates',
        title: 'WeRoll 1.0 Beta • Rework Visual del Lobby, Pantalla del DM y Modo Online/Offline',
        content: '¡Llega WeRoll 1.0 Beta! Un gran salto visual y funcional: nuevo Lobby ornamentado con marco dorado y avatar de jugador, Modo Online y Offline para World Sheets del DM, rediseño completo de la Pantalla del Dungeon Master y Atlas del Mundo con visualización jerárquica de lugares, avisos pop-up en vivo del Administrador/Moderador en tiempo real y paneles de gestión a pantalla completa.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1792600000000,
        upvotes: 45,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 5,
        pinned: false,
      },
      {
        id: 'post-update-095',
        category: 'app-updates',
        title: 'WeRoll 0.9.5 Alfa • Paneles Dinámicos por Rol, Control Reversible de Publicación y Rediseño Compacto',
        content: '¡Llega la versión 0.9.5 Alfa! Unificación del panel de Amigos en una sola tarjeta funcional con botones rápidos de Copiar ID, Agregar y Actualizar. Restricción estricta para que únicamente los Administradores puedan publicar en "Actualizaciones de la App". Además, control bidireccional de permisos de publicación (Permitido/Negado) e historial de versiones con fechas escalonadas.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1792432800000, // 2026-10-19 18:00
        upvotes: 32,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 3,
        pinned: false,
      },
      {
        id: 'post-update-090',
        category: 'app-updates',
        title: 'WeRoll 0.9 Alfa • Separación de Roles, Nuevo Foro y Mensajes Directos',
        content: '¡Bienvenidos a la versión 0.9 Alfa! En esta entrega dividimos los roles en Tipo de Jugador (DM, Jugador o Ambos) y Rol en la App (Cliente, Moderador y Admin). Además, estrenamos el nuevo Foro WeRoll, panel de moderación simplificado y mensajería a amigos.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1791560700000, // 2026-10-09 15:45
        upvotes: 28,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
        commentsCount: 2,
        pinned: false,
      },
      {
        id: 'post-update-080',
        category: 'app-updates',
        title: 'WeRoll 0.8 Alfa • Mensajes Privados al DM en Sala, Nombres de Salas e IDs Únicos',
        content: 'Llega WeRoll 0.8 Alfa. Incluye mensajes privados de jugadores al DM dentro de la sala, bandeja especial para el DM, validación estricta de nombres y códigos de sala únicos, y edición directa de puntuaciones base de características.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1790594400000, // 2026-09-28 11:20
        upvotes: 21,
        upvoters: ['admin@weroll.app'],
        commentsCount: 1,
        pinned: false,
      },
      {
        id: 'post-update-065',
        category: 'app-updates',
        title: 'WeRoll 0.65 Alfa • Entregas Interactivas en Sala & Razas Personalizadas',
        content: 'Presentamos WeRoll 0.65 Alfa. Compartir objetos, conjuros y habilidades de forma interactiva (aceptar/rechazar) en la mesa, razas personalizadas e imágenes de avatar en las tarjetas de jugadores.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1789488000000, // 2026-09-15 16:00
        upvotes: 19,
        upvoters: ['admin@weroll.app'],
        commentsCount: 0,
        pinned: false,
      },
      {
        id: 'post-update-060',
        category: 'app-updates',
        title: 'WeRoll 0.6 Alfa • Sistema de Amigos (@ID) & Importación/Exportación JSON',
        content: 'Actualización 0.6 Alfa: integración del sistema de amigos mediante etiquetas @ID, descarga y carga de archivos .JSON para fichas y mundos, y sincronización en segundo plano con resguardo de datos.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1788344100000, // 2026-09-02 10:15
        upvotes: 15,
        upvoters: ['admin@weroll.app'],
        commentsCount: 0,
        pinned: false,
      },
      {
        id: 'post-update-050',
        category: 'app-updates',
        title: 'WeRoll 0.5 Alfa • Bóveda de Respaldo del DM & Paneles de Seguridad',
        content: 'En la versión 0.5 Alfa añadimos la Bóveda de Respaldo para DMs, inyección masiva de contenidos y paneles de seguridad para resguardo de claves.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1787409000000, // 2026-08-22 14:30
        upvotes: 14,
        upvoters: ['admin@weroll.app'],
        commentsCount: 0,
        pinned: false,
      },
      {
        id: 'post-update-010',
        category: 'app-updates',
        title: 'WeRoll 0.1 Alfa • Lanzamiento Inicial Companion & DM Suite para D&D 5E',
        content: '¡Lanzamiento oficial de la versión alfa inicial de WeRoll 5E! Herramientas esenciales para DMs, hoja de personaje interactiva de 5E y dados de combate.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'Actualización',
        createdAt: 1786363200000, // 2026-08-10 12:00
        upvotes: 25,
        upvoters: ['admin@weroll.app'],
        commentsCount: 1,
        pinned: false,
      },
      {
        id: 'post-init-2',
        category: 'general',
        title: 'Reglas y etiqueta para convivir en el Foro WeRoll',
        content: 'Recordatorio amistoso: mantengan los debates sobre reglas de 5E de manera constructiva. Para publicar contenido nuevo, recuerden que los moderadores aprueban los permisos para evitar spam. ¡Disfruten de sus aventuras!',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        flair: 'General',
        createdAt: 1792491000000,
        upvotes: 12,
        upvoters: ['admin@weroll.app'],
        commentsCount: 1,
        pinned: false,
      },
      {
        id: 'post-init-3',
        category: 'community',
        title: '¿Cómo balancean los descansos cortos en mazmorras con patrullas activas?',
        content: 'Saludos a todos los DMs y aventureros. Cuando el grupo se atrinchera en una habitación de mazmorra para descansar 1 hora, ¿hacen tiradas de encuentro aleatorio o les permiten recuperar recursos si aseguran la entrada? ¿Qué técnicas usan para mantener la tensión?',
        authorEmail: 'deadplanter@gmail.com',
        authorName: 'deadplanter',
        authorTagId: 'top',
        authorFullTag: 'deadplanter@top',
        authorPlayerType: 'dm',
        authorAppRole: 'admin',
        flair: 'Duda',
        createdAt: 1792492000000,
        upvotes: 24,
        upvoters: ['deadplanter@gmail.com', 'admin@weroll.app'],
        commentsCount: 2,
        pinned: false,
      },
    ];

    let posts = readJSON<ForumPost[]>('forum_posts.json', defaultPosts);
    if (!posts || posts.length === 0) {
      posts = defaultPosts;
      writeJSON('forum_posts.json', posts);
    } else if (!posts.some((p) => p.id === 'post-update-150')) {
      posts = [defaultPosts[0], ...posts.map((p) => (p.pinned ? { ...p, pinned: false } : p))];
      writeJSON('forum_posts.json', posts);
    }

    if (category && category !== 'all') {
      posts = posts.filter((p) => p.category === category);
    }

    if (roleFilter && roleFilter !== 'all') {
      if (roleFilter === 'dm') {
        posts = posts.filter((p) => p.authorPlayerType === 'dm' || p.authorPlayerType === 'both');
      } else if (roleFilter === 'player') {
        posts = posts.filter((p) => p.authorPlayerType === 'player' || p.authorPlayerType === 'both');
      }
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      posts = posts.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.authorFullTag.toLowerCase().includes(q) ||
        (p.flair && p.flair.toLowerCase().includes(q))
      );
    }

    return posts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
  },

  getForumPostWithComments(id: string): { post: ForumPost | null; comments: ForumComment[] } {
    const posts = this.getForumPosts();
    const post = posts.find((p) => p.id === id) || null;
    const defaultComments: ForumComment[] = [
      {
        id: 'comm-1',
        postId: 'post-init-3',
        content: 'En mis mesas suelo tirar 1d6 cada 20 minutos de juego narrativo. Con un 1 hay patrulla.',
        authorEmail: 'admin@weroll.app',
        authorName: 'Administrador Supremo',
        authorTagId: 'adm',
        authorFullTag: 'Administrador Supremo@adm',
        authorPlayerType: 'both',
        authorAppRole: 'admin',
        createdAt: 1792492500000,
        upvotes: 5,
        upvoters: ['deadplanter@gmail.com'],
      },
      {
        id: 'comm-2',
        postId: 'post-init-3',
        content: 'Como jugador, usamos conjuros como Alarma o Truco de la Cuerda para evitar que nos sorprendan.',
        authorEmail: 'jugador@weroll.app',
        authorName: 'Valeros',
        authorTagId: 'val',
        authorFullTag: 'Valeros@val',
        authorPlayerType: 'player',
        authorAppRole: 'client',
        createdAt: 1792493000000,
        upvotes: 8,
        upvoters: ['admin@weroll.app', 'deadplanter@gmail.com'],
      },
    ];
    let allComments = readJSON<ForumComment[]>('forum_comments.json', defaultComments);
    if (!allComments || allComments.length === 0) {
      allComments = defaultComments;
      writeJSON('forum_comments.json', allComments);
    }
    const postComments = allComments.filter((c) => c.postId === id).sort((a, b) => a.createdAt - b.createdAt);
    return { post, comments: postComments };
  },

  createForumPost(postData: Omit<ForumPost, 'id' | 'createdAt' | 'upvotes' | 'commentsCount'>): ForumPost {
    const posts = readJSON<ForumPost[]>('forum_posts.json', []);
    const newPost: ForumPost = {
      ...postData,
      id: `fpost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      upvotes: 1,
      upvoters: [postData.authorEmail],
      commentsCount: 0,
    };
    posts.unshift(newPost);
    writeJSON('forum_posts.json', posts);
    this.markMutation(`Nueva publicación en foro: "${newPost.title}" por ${newPost.authorFullTag}`);
    return newPost;
  },

  updateForumPost(id: string, updates: Partial<ForumPost>): ForumPost | null {
    const posts = readJSON<ForumPost[]>('forum_posts.json', []);
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    posts[idx] = {
      ...posts[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    writeJSON('forum_posts.json', posts);
    this.markMutation(`Publicación de foro actualizada: ${posts[idx].title}`);
    return posts[idx];
  },

  deleteForumPost(id: string): boolean {
    const posts = readJSON<ForumPost[]>('forum_posts.json', []);
    const filtered = posts.filter((p) => p.id !== id);
    if (filtered.length !== posts.length) {
      writeJSON('forum_posts.json', filtered);
      const comments = readJSON<ForumComment[]>('forum_comments.json', []);
      const remainingComments = comments.filter((c) => c.postId !== id);
      writeJSON('forum_comments.json', remainingComments);
      this.markMutation(`Publicación de foro eliminada: ${id}`);
      return true;
    }
    return false;
  },

  upvoteForumPost(postId: string, userEmail: string): { upvotes: number; userUpvoted: boolean } {
    const posts = readJSON<ForumPost[]>('forum_posts.json', []);
    const post = posts.find((p) => p.id === postId);
    if (!post) throw new Error('Publicación no encontrada');
    const upvoters = Array.isArray(post.upvoters) ? post.upvoters : [];
    const normEmail = userEmail.trim().toLowerCase();
    const hasUpvoted = upvoters.includes(normEmail);

    if (hasUpvoted) {
      post.upvoters = upvoters.filter((e) => e !== normEmail);
      post.upvotes = Math.max(0, (post.upvotes || 1) - 1);
    } else {
      post.upvoters = [...upvoters, normEmail];
      post.upvotes = (post.upvotes || 0) + 1;
    }
    writeJSON('forum_posts.json', posts);
    return { upvotes: post.upvotes, userUpvoted: !hasUpvoted };
  },

  addForumComment(commentData: Omit<ForumComment, 'id' | 'createdAt' | 'upvotes'>): ForumComment {
    const comments = readJSON<ForumComment[]>('forum_comments.json', []);
    const newComment: ForumComment = {
      ...commentData,
      id: `fcomm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      upvotes: 1,
      upvoters: [commentData.authorEmail],
    };
    comments.push(newComment);
    writeJSON('forum_comments.json', comments);

    const posts = readJSON<ForumPost[]>('forum_posts.json', []);
    const post = posts.find((p) => p.id === commentData.postId);
    if (post) {
      post.commentsCount = (post.commentsCount || 0) + 1;
      writeJSON('forum_posts.json', posts);
    }
    this.markMutation(`Comentario en foro agregado al post ${commentData.postId}`);
    return newComment;
  },

  deleteForumComment(id: string): boolean {
    const comments = readJSON<ForumComment[]>('forum_comments.json', []);
    const target = comments.find((c) => c.id === id);
    if (!target) return false;
    const filtered = comments.filter((c) => c.id !== id);
    writeJSON('forum_comments.json', filtered);

    const posts = readJSON<ForumPost[]>('forum_posts.json', []);
    const post = posts.find((p) => p.id === target.postId);
    if (post) {
      post.commentsCount = Math.max(0, (post.commentsCount || 1) - 1);
      writeJSON('forum_posts.json', posts);
    }
    this.markMutation(`Comentario en foro eliminado: ${id}`);
    return true;
  },

  upvoteForumComment(commentId: string, userEmail: string): { upvotes: number; userUpvoted: boolean } {
    const comments = readJSON<ForumComment[]>('forum_comments.json', []);
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comentario no encontrado');
    const upvoters = Array.isArray(comment.upvoters) ? comment.upvoters : [];
    const normEmail = userEmail.trim().toLowerCase();
    const hasUpvoted = upvoters.includes(normEmail);

    if (hasUpvoted) {
      comment.upvoters = upvoters.filter((e) => e !== normEmail);
      comment.upvotes = Math.max(0, (comment.upvotes || 1) - 1);
    } else {
      comment.upvoters = [...upvoters, normEmail];
      comment.upvotes = (comment.upvotes || 0) + 1;
    }
    writeJSON('forum_comments.json', comments);
    return { upvotes: comment.upvotes, userUpvoted: !hasUpvoted };
  },

  // --- FRIEND DIRECT MESSAGING ---
  getFriendDirectMessages(user1Id: string, user2Id: string): FriendDirectMessage[] {
    const all = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    return all
      .filter(
        (m) =>
          (m.fromUserId === user1Id && m.toUserId === user2Id) ||
          (m.fromUserId === user2Id && m.toUserId === user1Id)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  getAllUserDirectMessages(userId: string): FriendDirectMessage[] {
    const all = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    return all
      .filter((m) => m.fromUserId === userId || m.toUserId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  sendFriendDirectMessage(params: Omit<FriendDirectMessage, 'id' | 'createdAt' | 'read'>): FriendDirectMessage {
    const all = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    const newMsg: FriendDirectMessage = {
      ...params,
      id: `fdm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      read: false,
    };
    all.push(newMsg);
    writeJSON('friend_messages.json', all);
    this.markMutation(`Mensaje directo entre amigos: de ${newMsg.fromFullTag} a ${newMsg.toFullTag}`);
    return newMsg;
  },

  markFriendDirectMessagesAsRead(toUserId: string, fromUserId: string): boolean {
    const all = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    let changed = false;
    for (const m of all) {
      if (m.toUserId === toUserId && m.fromUserId === fromUserId && !m.read) {
        m.read = true;
        changed = true;
      }
    }
    if (changed) {
      writeJSON('friend_messages.json', all);
    }
    return changed;
  },

  getFriendMessageSignal(user1Id: string, user2Id?: string): {
    lastMessageId: string;
    lastMessageAt: number;
    unreadCount: number;
  } {
    const all = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    const relevant = user2Id
      ? all.filter(
          (m) =>
            (m.fromUserId === user1Id && m.toUserId === user2Id) ||
            (m.fromUserId === user2Id && m.toUserId === user1Id)
        )
      : all.filter((m) => m.fromUserId === user1Id || m.toUserId === user1Id);
    relevant.sort((a, b) => a.createdAt - b.createdAt);
    const last = relevant[relevant.length - 1];
    const unreadCount = all.filter(
      (m) => m.toUserId === user1Id && (!user2Id || m.fromUserId === user2Id) && !m.read
    ).length;
    return {
      lastMessageId: last?.id || '',
      lastMessageAt: last?.createdAt || 0,
      unreadCount,
    };
  },

  // --- REAL-TIME USER PRESENCE HEARTBEAT & SERVER STATS ---
  recordUserPresenceHeartbeat(params: {
    userId?: string;
    email?: string;
    activity?: string;
    isLogin?: boolean;
  }): UserAccount | null {
    const users = this.getUsers();
    const normEmail = (params.email || '').trim().toLowerCase();
    const idx = users.findIndex(
      (u) =>
        (params.userId && u.id === params.userId) ||
        (normEmail && u.email.toLowerCase() === normEmail)
    );
    if (idx === -1) return null;

    const now = Date.now();
    const user = users[idx];
    const prevLastActive = user.lastActiveAt || 0;
    const elapsedSinceLast = now - prevLastActive;

    // If active within the last 90 seconds, accumulate connected duration
    if (prevLastActive > 0 && elapsedSinceLast > 0 && elapsedSinceLast <= 90_000) {
      user.totalConnectedMs = (user.totalConnectedMs || 0) + elapsedSinceLast;
    } else {
      // Starting a new connection session
      user.sessionCount = (user.sessionCount || 0) + 1;
      user.lastSessionStartAt = now;
      // Minimum baseline of 1 min per session for historical accounts
      if (!user.totalConnectedMs) {
        user.totalConnectedMs = 60_000;
      }
      // Record hourly connection bucket
      try {
        const stats = readJSON<{
          hourlyBuckets: Record<string, number>;
          recentSessions: {
            userId: string;
            displayName: string;
            fullTag: string;
            timestamp: number;
            activity: string;
          }[];
        }>('server_stats.json', { hourlyBuckets: {}, recentSessions: [] });
        const hourKey = String(new Date(now).getHours()).padStart(2, '0');
        stats.hourlyBuckets[hourKey] = (stats.hourlyBuckets[hourKey] || 0) + 1;
        stats.recentSessions = [
          {
            userId: user.id,
            displayName: user.displayName,
            fullTag: `${user.displayName}@${user.userTagId || '123'}`,
            timestamp: now,
            activity: params.activity || (params.isLogin ? 'Inicio de Sesión' : 'Conexión Activa'),
          },
          ...(Array.isArray(stats.recentSessions) ? stats.recentSessions : []),
        ].slice(0, 60);
        writeJSON('server_stats.json', stats);
      } catch {}
    }

    user.lastActiveAt = now;
    if (params.activity) {
      user.currentActivity = params.activity;
    } else if (!user.currentActivity) {
      user.currentActivity = 'En el Portal';
    }

    users[idx] = user;
    writeJSON('users.json', users);
    return user;
  },

  getServerStatistics(activeLiveSessionsCount = 0) {
    const now = Date.now();
    const users = this.getUsers();
    const sheets = this.getPlayerSheets();
    const worlds = this.getWorldSheets();
    const rooms = this.getRooms();
    const forumPosts = readJSON<ForumPost[]>('forum_posts.json', []);
    const friendMessages = readJSON<FriendDirectMessage[]>('friend_messages.json', []);
    const feedback = this.getFeedback();
    const statsFile = readJSON<{
      hourlyBuckets: Record<string, number>;
      recentSessions: {
        userId: string;
        displayName: string;
        fullTag: string;
        timestamp: number;
        activity: string;
      }[];
    }>('server_stats.json', { hourlyBuckets: {}, recentSessions: [] });

    // Build 24h connection distribution (combining recorded buckets + user lastActiveAt hours)
    const hourlyCounts: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const key = String(h).padStart(2, '0');
      hourlyCounts[h] += Number(statsFile.hourlyBuckets?.[key] || 0);
    }
    for (const u of users) {
      if (u.lastActiveAt) {
        const h = new Date(u.lastActiveAt).getHours();
        if (h >= 0 && h < 24 && hourlyCounts[h] === 0) {
          hourlyCounts[h] += 1;
        }
      }
    }

    const hourlyActivityMap = hourlyCounts.map((count, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      count,
    }));

    const userStats = users
      .map((u) => {
        const isOnline = now - (u.lastActiveAt || 0) <= ONLINE_THRESHOLD_MS;
        const userChars = sheets.filter(
          (s) => (s.ownerEmail || '').toLowerCase() === u.email.toLowerCase()
        ).length;
        const userWorlds = worlds.filter(
          (w) => (w.ownerEmail || '').toLowerCase() === u.email.toLowerCase()
        ).length;
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          userTagId: u.userTagId || '123',
          fullTag: `${u.displayName}@${u.userTagId || '123'}`,
          avatarUrl: u.avatarUrl,
          role: u.role,
          playerType:
            u.playerType || (u.role === 'dm' ? 'dm' : u.role === 'player' ? 'player' : 'both'),
          appRole:
            u.appRole ||
            (u.role === 'admin'
              ? 'admin'
              : u.role === 'creator'
              ? 'creator'
              : u.role === 'moderator'
              ? 'moderator'
              : 'client'),
          status: u.status,
          isOnline,
          lastActiveAt: u.lastActiveAt || u.registeredAt,
          lastSessionStartAt: u.lastSessionStartAt || u.lastActiveAt || u.registeredAt,
          totalConnectedMs: u.totalConnectedMs || (isOnline ? 120_000 : 60_000),
          sessionCount: u.sessionCount || 1,
          currentActivity: isOnline ? u.currentActivity || 'En el Portal' : 'Desconectado',
          charactersCount: userChars,
          worldsCount: userWorlds,
        };
      })
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
      });

    const onlineUsersCount = userStats.filter((u) => u.isOnline).length;
    const activeTodayCount = userStats.filter(
      (u) => now - (u.lastActiveAt || 0) <= 24 * 60 * 60 * 1000
    ).length;

    return {
      serverStartedAt: SERVER_BOOT_TIMESTAMP,
      uptimeMs: Math.max(1000, now - SERVER_BOOT_TIMESTAMP),
      onlineUsersCount,
      activeTodayCount,
      totalRegisteredUsers: users.length,
      approvedUsersCount: users.filter((u) => u.status === 'approved').length,
      pendingUsersCount: users.filter((u) => u.status === 'pending').length,
      totalSheetsCount: sheets.length,
      totalWorldsCount: worlds.length,
      totalRoomsCount: Math.max(Object.keys(rooms).length, activeLiveSessionsCount),
      totalForumPostsCount: forumPosts.length,
      totalFriendMessagesCount: friendMessages.length,
      unreadFeedbackCount: feedback.filter((f) => f.status !== 'reviewed').length,
      hourlyActivityMap,
      recentSessions: (statsFile.recentSessions || []).slice(0, 20),
      userStats,
    };
  },

  // --- DM / DUNGEON MASTER PRIVATE MESSAGES VAULT ---
  getDmMessages(): PlayerMessageToDM[] {
    const fromFile = readJSON<PlayerMessageToDM[]>('dm_messages.json', []);
    const worlds = this.getWorldSheets();
    const map = new Map<string, PlayerMessageToDM>();
    for (const m of fromFile) {
      if (m && m.id) map.set(m.id, m);
    }
    for (const w of worlds) {
      if (Array.isArray(w.workspace?.playerMessages)) {
        for (const m of w.workspace.playerMessages) {
          if (m && m.id && !map.has(m.id)) map.set(m.id, m);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  },

  saveDmMessage(msg: PlayerMessageToDM): void {
    const list = this.getDmMessages();
    const idx = list.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
      list[idx] = msg;
    } else {
      list.unshift(msg);
    }
    writeJSON('dm_messages.json', list.slice(0, 500));
    this.markMutation(`Mensaje privado al DM: ${msg.characterName || 'Personaje'} (${msg.playerName || 'Jugador'})`);
  },

  markDmMessageRead(messageId: string): void {
    const list = this.getDmMessages();
    const target = list.find((m) => m.id === messageId);
    if (target) {
      target.readByDm = true;
      writeJSON('dm_messages.json', list);
    }
  },

  deleteDmMessage(messageId: string): void {
    let list = this.getDmMessages();
    const initialLen = list.length;
    list = list.filter((m) => m.id !== messageId);
    if (list.length < initialLen) {
      writeJSON('dm_messages.json', list);
      this.markMutation(`Mensaje para DM eliminado: ${messageId}`);
    }
  },

  // --- FORUM PERMISSION MANAGEMENT (MODERATOR / ADMIN) ---
  setUserForumPostingPermission(userId: string, allowed: boolean): UserAccount | null {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return null;
    user.canPostInForum = allowed;
    user.forumPermissionsRequested = false;
    this.saveUsers(
      users,
      `Permiso de publicación en foro ${allowed ? 'concedido' : 'revocado'} para ${user.displayName}@${user.userTagId}`
    );
    return user;
  },

  requestForumPostingPermission(userId: string): boolean {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return false;
    user.forumPermissionsRequested = true;
    this.saveUsers(users, `Solicitud de permiso de foro por ${user.displayName}@${user.userTagId}`);
    return true;
  },

  // --- TABLE ROLE (PLAYER TYPE) CHANGE REQUEST & MODERATOR APPROVAL ---
  requestPlayerTypeChange(userId: string, requestedPlayerType: PlayerType): UserAccount | null {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return null;
    user.requestedPlayerType = requestedPlayerType;
    user.playerTypeChangeRequested = true;
    this.saveUsers(
      users,
      `Solicitud de cambio de Rol de Mesa (${requestedPlayerType}) por ${user.displayName}@${user.userTagId}`
    );
    return user;
  },

  resolvePlayerTypeChangeRequest(
    userId: string,
    approved: boolean,
    overridePlayerType?: PlayerType
  ): UserAccount | null {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return null;

    if (approved) {
      const nextType: PlayerType =
        overridePlayerType ||
        user.requestedPlayerType ||
        user.playerType ||
        'both';
      user.playerType = nextType;
      const appRole =
        user.appRole ||
        (user.role === 'admin'
          ? 'admin'
          : user.role === 'creator'
          ? 'creator'
          : user.role === 'moderator'
          ? 'moderator'
          : 'client');
      if (appRole === 'client') {
        user.role = nextType;
      }
    }

    user.playerTypeChangeRequested = false;
    user.requestedPlayerType = undefined;

    this.saveUsers(
      users,
      `Solicitud de Rol de Mesa ${approved ? 'aprobada' : 'rechazada'} para ${user.displayName}@${user.userTagId}`
    );
    return user;
  },

  // --- PERSISTENT HOST SETTINGS & CHANGELOG ---
  getHostSettings(): HostSettings {
    const v15BetaEntry: ChangelogEntry = {
      version: '1.5 Beta',
      date: '2026-10-28',
      title: 'WeRoll 1.5 Beta • Tooltip de Bonificadores en Carta Tarot, Sincronización Exacta del Último Dado en Modo Mapa, Estabilidad Multijugador de Vida (PG) y Subida Directa de PNG para el DM',
      changes: [
        'Tooltip Flotante de Bono en Estadísticas de la Carta Tarot: Al acercar el cursor sobre cualquiera de las 6 puntuaciones totales (FUE, DES, CON, INT, SAB, CAR) en la tarjeta del personaje, aparece una pestaña flotante (tooltip) mostrando el bonificador exacto de esa característica (por ejemplo, +4 para 18 de Fuerza en Valeros del Alba).',
        'Actualización Continua del Último Dado Tirado en Modo Mapa: Corrección del indicador superior "Último dado tirado" y de las insignias de tirada en las tarjetas de jugador dentro del Modo Mapa para que siempre reflejen la tirada más reciente del historial sin quedarse congelados en tiradas pasadas.',
        'Estabilización de Puntos de Golpe (PG) con Múltiples Jugadores en Línea: Nuevo control de marca de tiempo monotónica (hpUpdatedAt) entre cliente y servidor que evita que los latidos de conexión sobrescriban cambios recientes de vida o provoquen que la barra de vida suba y baje.',
        'Subida Directa de Archivos PNG e Imágenes en la Hoja del Dungeon Master: Ahora el Dungeon Master puede subir archivos PNG/imágenes directamente desde su dispositivo (además de enlaces URL) tanto en los ajustes de su Hoja de DM como en lugares, NPCs, objetos, ataques y acciones.',
      ],
    };

    const v14BetaEntry: ChangelogEntry = {
      version: '1.4 Beta',
      date: '2026-10-26',
      title: 'WeRoll 1.4 Beta • Barra Superior Unificada en Partida, Modo Mapa Ampliado con Paneles Plegables, Cartas Tarot Miniatura en Mesa, Estadísticas Totales e Imágenes por Ataque',
      changes: [
        'Barra Superior Unificada en Hoja y Modo Mapa (DM y Jugadores): Reubicación de los botones Regresar al Lobby / Regresar a Hoja y Guardar en la barra superior junto al Estandarte del Dungeon Master (con mensajes en vivo, historial de tiradas y Susurrar al DM) y el botón de Ubicación Actual / Mapa.',
        'Modo Mapa de Mayor Espacio con Paneles Flotantes Plegables: Ampliación del lienzo principal del mapa e integración de ventanas superpuestas plegables (Minimizar / Expandir) para los Mazos y la Libreta del Jugador, así como Proyección de Zona y Crónicas para el DM.',
        'Cartas Tarot de Jugadores en Miniatura en la Parte Inferior del Mapa: Nueva barra inferior en el Modo Mapa (para DM y Jugadores) que muestra las Cartas Tarot completas a escala miniatura conservando todos sus elementos sin restar espacio al mapa.',
        'Puntuaciones Totales de Características en la Carta Tarot: Las 6 cajas de estadísticas (FUE, DES, CON, INT, SAB, CAR) de la Carta Tarot ahora muestran el valor total de cada característica en lugar de solo el modificador.',
        'Ilustraciones Individuales por Ataque y por Acción: Soporte para asignar imágenes independientes a cada ataque de un arma multi-ataque y a cada acción de un objeto, reflejándose directamente en sus cartas del mazo de Ataques y Acciones.',
      ],
    };

    const v13BetaEntry: ChangelogEntry = {
      version: '1.3 Beta',
      date: '2026-10-24',
      title: 'WeRoll 1.3 Beta • Sincronización Anti-Parpadeo en Vivo, Cola Local contra Micro-Desconexiones, Retratos Descargables (x4), Ilustraciones en Cartas y Verificación OTP',
      changes: [
        'Sincronización Anti-Parpadeo de Vida (PG) y Mapas en Sesiones Largas: Nuevo control monotónico de versión y bloqueo optimista al modificar Puntos de Golpe, monedas de oro o cambiar el mapa proyectado por el DM, eliminando el parpadeo entre valores antiguos y nuevos.',
        'Cola Local de Eventos contra Micro-Desconexiones: Almacenamiento local inmediato de tiradas de dados y cambios de ficha durante cortes momentáneos de red, evitando expulsiones accidentales al Lobby y sincronizando automáticamente al recuperar la conexión.',
        'Verificación de Correo con Código OTP (Nuevos Registros): Validación de correo electrónico mediante código de 6 dígitos para cuentas de nuevo registro (las cuentas ya registradas continúan iniciando sesión de forma directa).',
        'Galería de hasta 4 Retratos Descargables por Personaje: En la Player Sheet puedes guardar hasta 4 imágenes de retrato por personaje, alternar cuál está activa con un clic y descargarlas en tu dispositivo.',
        'Ilustraciones en Monstruos, Armas, Armaduras, Objetos, Conjuros y Habilidades: Soporte para adjuntar imágenes personalizadas a cada criatura del bestiario, arma, armadura, objeto común, conjuro o habilidad, mostrándose en sus cartas del Mazo de Juego.',
        'Deduplicación de Habilidades en Modo Mapa y Descripciones Editables: Eliminación de cartas duplicadas de habilidades al entrar al mapa y campo de descripción detallado en cada carta de habilidad.',
        'Tomo de Crónicas del DM con 5 Categorías: Clasificación de entradas por Capítulo, Historia de Personaje, Misión Principal, Misión Secundaria y Acontecimiento Importante con filtrado rápido.',
        'Permisos del Sabio Arcano y Señalización de Mapas Tácticos: Acceso optimizado por rol para consultas del Sabio Arcano e indicador de Mapas Tácticos en fase de desarrollo.',
      ],
    };

    const v12BetaEntry: ChangelogEntry = {
      version: '1.2 Beta',
      date: '2026-10-23',
      title: 'WeRoll 1.2 Beta • Rediseño Intuitivo del Atlas del DM, Cola de Visuales, Explorador de Carpetas, Vista DM vs Vista en Vivo con Fichas Tácticas y Delta Sync',
      changes: [
        'Encabezado Limpio del Atlas y Botón "Ajustes" junto a "Guardar": Reubicación del nombre de la mesa, contraseña, código de sala y modo Online/Offline dentro del nuevo botón Ajustes junto al botón Guardar en la parte inferior de la pantalla del DM.',
        'Botones Superiores de Visuales (Álbum, Mapas Tácticos y Mapas): Acceso rápido en la esquina superior derecha del Atlas para gestionar fotos del álbum, mapas tácticos y múltiples mapas por carpeta/zona.',
        'Navegación Jerárquica con Botón "Regresar a [Lugar Anterior]": Botón integrado en la esquina superior izquierda dentro del lienzo del mapa para subir inmediatamente al continente o carpeta padre.',
        'Cola en Visuales + Edición Individual: Cada imagen, mapa de zona y mapa táctico cuenta con botones para Editar (nombre, imagen y carpeta) y Poner en Cola, mostrando debajo del mapa la lista ordenada lista para proyectar o tachar (✕).',
        'Explorador Masivo de Carpetas en "Mundo": Al pulsar el botón Mundo se abre un gestor tipo carpetas con todos los lugares, sublugares, mapas, mapas tácticos, fotos del álbum, PNJs y monstruos para edición masiva.',
        'Modo Mapa del DM (Previsualización antes de Proyectar, Pestaña "Ver Cola" y Vista DM vs Vista en Vivo): El DM puede previsualizar y editar cualquier mapa o mapa táctico sin cambiar la pantalla de los jugadores hasta pulsar Proyectar, alternar entre Vista DM y Vista en Vivo, y mover fichas de personajes y monstruos sobre la cuadrícula táctica.',
        'Guardado Incremental por Diferencias (Delta Sync) y Caché Local: Sincronización ultraligera por campos modificados, separación de activos pesados y panel de arquitectura técnica en Administración.',
      ],
    };

    const v11BetaEntry: ChangelogEntry = {
      version: '1.1 Beta',
      date: '2026-10-22',
      title: 'WeRoll 1.1 Beta • Modo Mapa en Vivo & Proyección Compartida, Cartas Tarot 2×2 en Mesa, Rediseño de Mazos y Límite de Combate',
      changes: [
        'Modo Mapa en Vivo & Proyección Compartida: Botón de acceso al mapa en sala en vivo para DM y jugadores, permitiendo al DM proyectar instantáneamente fotos del álbum y mapas del atlas con actualización inmediata en el mapa de todos los jugadores.',
        'Cuadrícula Compacta 2×2 en Cartas de Jugadores (Modo Mapa): Visualización simultánea de al menos 4 cartas Tarot de compañeros en mesa sin necesidad de desplazarse verticalmente, aprovechando el ancho extendido de pantalla (1920px).',
        'Rediseño Equilibrado de Mazos de Juego: Proporción estilo Tarot clásica (altura intermedia 240px) para las cartas de acciones, habilidades y conjuros, equilibrando la geometría con El Rincón del Aventurero.',
        'Iconografía Simbólica y Tooltips de Alineamiento: Insignia visual con código cromático (bueno/neutral/malvado) y figuras simbólicas (espiral, balanza, orbe) con mensaje emergente explicativo al pasar el cursor.',
        'Selector Estilo Baraja en el Creador de Personajes: Alternancia fluida entre fichas creadas con flechas de navegación izquierda/derecha sin saturar la vista.',
        'Control Táctico de Encuentros (Máximo 8 Enemigos): Tope estricto de hasta 8 monstruos simultáneos en el gestor de combate del DM, con panel dedicado de aliados conectados.',
        'Caja de Dados Multi-Tirada (1 a 6 dados): Selector de cantidad de dados poliédricos estándar (d4, d6, d8, d10, d12, d20, d100) en el visor de mesa y pantalla del DM.',
      ],
    };

    const v10BetaEntry: ChangelogEntry = {
      version: '1.0 Beta',
      date: '2026-10-21',
      title: 'WeRoll 1.0 Beta • Rework Visual del Lobby y Pantalla del DM, Modo Online/Offline y Avisos en Vivo',
      changes: [
        'Rework Visual Completo del Lobby: Nuevo diseño refinado con marco dorado ornamentado, avatar circular de perfil de jugador, insignias dinámicas de rol y acceso directo a seguridad de cuenta.',
        'Modo Online y Offline para World Sheets: Opción para que el DM abra sus mesas en Modo Online (para conexión en vivo de jugadores) o Modo Offline (para diseñar, preparar y editar campañas en privado sin abrir sala pública).',
        'Rework Visual de la Pantalla del DM y Atlas del Mundo: Navegación jerárquica de ubicaciones geográficas y lugares, filtrado visual temático de PNJs, monstruos y objetos, y visualización táctica en vivo.',
        'Avisos Pop-up en Vivo del Administrador / Moderador: Transmisión instantánea de comunicados importantes en tiempo real para todos los usuarios activos en el lobby y en partidas.',
        'Imagen de Perfil de Jugador Personalizada: Sube tu propia foto o retrato de jugador (independiente de las fichas de personaje), visible en el banner del Lobby y en la lista de Amigos.',
        'Aviso Oficial Reorganizado sobre el Foro: Reubicación compacta del comunicado oficial del administrador directamente sobre el Foro WeRoll para mayor claridad visual.',
        'Paneles de Administración y Moderación a Pantalla Completa: Vistas dedicadas y fluidas para la gestión de usuarios, roles, bóvedas de respaldo y moderación de contenido comunitario.',
      ],
    };

    const v095Entry: ChangelogEntry = {
      version: '0.9.5 Alfa',
      date: '2026-10-20',
      title: 'WeRoll 0.9.5 Alfa • Compresión Inteligente de Avatares, Respaldo Maestro Total Ampliado & Paneles Duales para Administradores',
      changes: [
        'Compresión y Escalado Automático de Avatares: Optimización avanzada en cliente y servidor (max 512x512, WebP/JPEG ~40-80 KB) para garantizar que las fotos y retratos de personajes se guarden con fluidez en LocalStorage y se sincronicen sin errores en la bóveda y respaldos maestros.',
        'Respaldo Maestro Total y en la Nube Ampliado: Inclusión exhaustiva de mensajes entre amigos (friendMessages), mensajes privados al DM (dmMessages), foro comunitario y comentarios en los respaldos maestros JSON y sincronización automática continua.',
        'Acceso Dual para Administradores (Admin + Moderación): El rol de Administrador ahora visualiza y accede simultáneamente al botón y panel de Administración General y al Panel de Moderación Comunitaria desde la barra superior y el lobby.',
        'Unificación de Sección de Amigos y Rediseño Compacto: Consolidación de Amigos, Agregar Amigo y Usuario@ID con botones directos para Copiar ID, Agregar y Actualizar, adaptado con diseño responsivo impecable.',
      ],
    };

    const v09Entry: ChangelogEntry = {
      version: '0.9 Alfa',
      date: '2026-10-09',
      title: 'WeRoll 0.9 Alfa • Separación de Roles (Tipo de Jugador & Rol en App), Nuevo Foro WeRoll, Panel de Moderación y Mensajería a Amigos',
      changes: [
        'Separación de Roles en Dos Dimensiones: Asignación independiente de "Rol de Tipo de Jugador" (Dungeon Master únicamente, Jugador únicamente o DM y Jugador) y "Rol en la Aplicación" (Cliente, Moderador o Administrador).',
        'Nuevo Rol de Moderador y Panel Simplificado: El Moderador cuenta con un panel específico para aprobar nuevos registros, autorizar o restringir permisos de publicación en el foro y moderar contenido, sin acceso a contraseñas ni bóvedas de respaldo.',
        'Nuevo Foro WeRoll (~2/3 de la Pantalla): Sistema de foro con tres secciones: Actualizaciones de la App, Foro General y Foro Comunitario (con filtrado por Todos los mensajes, Solo DMs y Solo Jugadores, votos positivos, flairs y comentarios).',
        'Permisos de Publicación en el Foro: Por seguridad comunitaria, los jugadores clientes requieren aprobación de un moderador o admin para publicar, garantizando un espacio libre de spam.',
        'Mensajería Directa entre Amigos: Envía y recibe mensajes privados directamente desde la sección de Amigos con historial de conversación y marcas de lectura.',
        'Rediseño Elegante del Lobby: Eliminación del tirador de dados en el lobby (ahora exclusivo de las mesas en vivo) y botones discretos superiores de utilidades (Manual, Oráculo, Feedback/Panel de Admin y Acceso a Seguridad & Contraseña).',
        'Respaldo Total en la Nube y Exportación JSON: Cada publicación, comentario, mensaje entre amigos y rol se sincroniza automáticamente con la nube y el Respaldo Maestro JSON.',
      ],
    };

    const v08Entry: ChangelogEntry = {
      version: '0.8 Alfa',
      date: '2026-09-28',
      title: 'WeRoll 0.8 Alfa • Mensajes Privados al DM en Sala, Nombres de Salas e IDs Únicos, Player Sheet Remasterizada & Edición de Rasgos/Estadísticas',
      changes: [
        'Mensajes Privados del Jugador al DM en Sala: botón discreto de mensaje en la barra superior de jugadores conectados para enviar mensajes privados al DM con título y descripción.',
        'Bandeja "Mensajes de Jugadores" para el DM: nueva pestaña junto a Diario y Crónicas en la pantalla del DM donde se reciben los mensajes con nombre del personaje, nombre del jugador, su @ID, título y descripción.',
        'Sistema de Nombres y Códigos de Sala Únicos entre DMs: impide crear o renombrar salas/mesas con un nombre o código que ya esté registrado por otro DM para evitar confusiones.',
        'Corroboración Continua de Unicidad de Usuario e ID (@ID): validación estricta y verificación automática constante para garantizar que ningún usuario comparta el mismo nombre de usuario o ID.',
        'Edición Directa de Puntuaciones Base, Rasgos y Trasfondo: modifica tus puntuaciones de estadísticas base (FUE, DES, CON, INT, SAB, CAR), rasgos de personalidad, ideales, vínculos, defectos, rasgos especiales/dotes e historia del personaje con autoguardado en la nube.',
        'Remasterización de Player Sheet (Inventario de 3 Tipos, Armas Multi-Ataque, XP Editable, Habilidades en Español y Diario del Jugador): clasificación en Objetos Comunes, Armas y Armaduras; ataques automáticos en Combate al equipar un arma; creador de armas multi-ataque por pestañas para el DM; indicador de XP editable; habilidades personalizables en español y nueva 6ª pestaña "Diario del Jugador".',
      ],
    };

    const v065Entry: ChangelogEntry = {
      version: '0.65 Alfa',
      date: '2026-09-15',
      title: 'WeRoll 0.65 Alfa • Entregas Interactivas en Sala, Razas Personalizadas, Fotos en Mesa & Edición de Nivel/Clase/Alineamiento',
      changes: [
        'Compartir Objetos, Conjuros y Habilidades exclusivamente en la Misma Sala: el DM ahora solo puede compartir elementos con jugadores que estén conectados activamente dentro de su misma sala (roomCode).',
        'Notificación Interactiva al Jugador (Aceptar / Rechazar): al compartir un objeto, conjuro o habilidad, el jugador recibe una ventana de confirmación en tiempo real para aceptar o rechazar el elemento.',
        'Sincronización Instantánea en la Player Sheet y Aviso al DM: al aceptar o rechazar el elemento compartido, se actualiza la ficha del jugador y el DM recibe una notificación inmediata con la respuesta.',
        'Raza Personalizada al Crear o Modificar Personaje: ahora puedes elegir la opción "✨ Raza Personalizada" (además de Humano, Elfo, Enano, etc.) tanto en el Creador de Personaje como al editar tu Player Sheet para escribir cualquier raza propia.',
        'Modificación Directa de Nivel (1 a 20), Clase y Alineamiento: controles rápidos (- / + y selector de Nivel 1-20) directamente en el encabezado de la Player Sheet, en el creador y en el editor de identidad.',
        'Foto / Retrato del Personaje en las Tarjetas de la Mesa en Vivo: las tarjetas de jugadores conectados en la mesa ahora muestran la foto o avatar del personaje junto al nombre del personaje, nombre del jugador, estado en línea y estadísticas.',
      ],
    };

    const v06Entry: ChangelogEntry = {
      version: '0.6 Alfa',
      date: '2026-09-02',
      title: 'WeRoll 0.6 Alfa • Sistema de Amigos (@ID), Importación/Exportación Local & Respaldo Continuo Inteligente',
      changes: [
        'Apartado de Amigos en el Lobby: agrega y elimina amigos fácilmente ingresando su identificador único con formato nombre@ID (ej. usuario1@123 o usuario2@top).',
        'Identificador Personalizado (@ID de hasta 3 caracteres): configurable al crear tu cuenta y editable en cualquier momento desde Seguridad & Contraseña, junto con visualización y botón para copiar tu Usuario@ID.',
        'Importación y Exportación Local (.JSON): botón de descarga directa al lado de cada Player Sheet y cada World Sheet, y botones de importación local junto a "Crear Nuevo Personaje" y "Crear World Sheet".',
        'Respaldo Automático en Cada Cambio y Comparación Continua (Archivo Base vs. Nube): cada cambio en cuentas, roles, amigos, fichas, mundos, bloc de notas o feedback dispara un respaldo en la nube y resguarda versiones anteriores antes de cualquier reemplazo.',
        'Gestión Avanzada de Usuarios para el Administrador: visualización de @IDs y amigos, botón para agregar usuarios registrados/de prueba directamente, edición de correo/usuario/ID y borrado de cuentas.',
      ],
    };

    const v05Entry: ChangelogEntry = {
      version: '0.5 Alfa',
      date: '2026-08-22',
      title: 'WeRoll 0.5 Alfa • Bóveda de Respaldo del DM, Inyección Maestro & Seguridad',
      changes: [
        'Bóveda de Respaldo para DMs: Resguardo de campañas, personajes y fichas con sincronización global.',
        'Paneles de Seguridad y Reseteo: Gestión de contraseñas de DM, moderadores y usuarios.',
      ],
    };

    const v01Entry: ChangelogEntry = {
      version: '0.1 Alfa',
      date: '2026-08-10',
      title: 'WeRoll 0.1 Alfa • Lanzamiento Inicial Companion & DM Suite',
      changes: [
        'Lanzamiento oficial de la versión alfa inicial de WeRoll 5E.',
        'Autenticación por roles independientes: Jugador, Dungeon Master y Moderador.',
      ],
    };

    const defaultSettings: HostSettings = {
      headerTitle: 'WeRoll',
      headerSubtitle: 'Companion & DM Suite v1.5 Beta',
      headerLogoIcon: 'shield',
      aiModel: 'gemini-flash-lite-latest',
      moderatorPassword: 'admin',
      dmPassword: '',
      oracleWelcomeMessage:
        'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?',
      rejectionCustomMessage:
        'Lo lamentamos, por el momento no puedes acceder a WeRoll. Manda mensaje a soporte@weroll.app si quieres una revisión manual de tu caso.',
      adminGreeting: {
        enabled: true,
        title: 'Comunicado del Administrador',
        message:
          '¡Bienvenido a WeRoll 5E v1.5 Beta! Ahora puedes ver el tooltip del bono al acercar el cursor a tus estadísticas en la Carta Tarot, disfrutar de tiradas y vida (PG) sincronizadas sin saltos en partidas multijugador y subir archivos PNG directamente en tu Hoja de Dungeon Master.',
        type: 'info',
        updatedAt: Date.now(),
      },
      developerNotice: {
        enabled: true,
        title: 'WeRoll • Novedades v1.5 Beta',
        content:
          '¡Versión 1.5 Beta disponible! Tooltips de bonificadores (+Bono) al pasar el cursor sobre las estadísticas en la Carta Tarot, sincronización en tiempo real del Último Dado Tirado en Modo Mapa, estabilización de Puntos de Golpe (PG) con múltiples jugadores en línea y subida directa de archivos PNG/Imagen en la Hoja del Dungeon Master.',
        version: '1.5 Beta',
      },
      developerAnnouncement: {
        enabled: true,
        title: 'WeRoll • Novedades v1.5 Beta',
        content:
          '¡Versión 1.5 Beta disponible! Tooltips de bonificadores (+Bono) al pasar el cursor sobre las estadísticas en la Carta Tarot, sincronización en tiempo real del Último Dado Tirado en Modo Mapa, estabilización de Puntos de Golpe (PG) con múltiples jugadores en línea y subida directa de archivos PNG/Imagen en la Hoja del Dungeon Master.',
        version: '1.5 Beta',
      },
      changelog: [
        v15BetaEntry,
        v14BetaEntry,
        v13BetaEntry,
        v12BetaEntry,
        v11BetaEntry,
        v10BetaEntry,
        v095Entry,
        v09Entry,
        v08Entry,
        v065Entry,
        v06Entry,
        v05Entry,
        v01Entry,
      ],
    };

    const current = readJSON<Partial<HostSettings>>('settings.json', defaultSettings);
    const savedCreds = this.loadCloudCredentialsFromPersistentVault();

    // Merge saved cloud credentials if settings.json lost them on container restart
    const hasCurrentAb = current.autoBackup !== undefined;
    const mergedAutoBackup: AutoBackupConfig | undefined =
      current.autoBackup || savedCreds
        ? {
            enabled: current.autoBackup?.enabled ?? savedCreds?.enabled ?? false,
            backupOnEveryChange:
              current.autoBackup?.backupOnEveryChange ?? savedCreds?.backupOnEveryChange ?? false,
            continuousComparison:
              current.autoBackup?.continuousComparison ?? savedCreds?.continuousComparison ?? false,
            frequencyHours: current.autoBackup?.frequencyHours || savedCreds?.frequencyHours || 24,
            destination: current.autoBackup?.destination || savedCreds?.destination || 'drive',
            githubToken: hasCurrentAb
              ? (current.autoBackup?.githubToken ?? '')
              : (savedCreds?.githubToken || ''),
            githubRepo: hasCurrentAb
              ? (current.autoBackup?.githubRepo ?? '')
              : (savedCreds?.githubRepo || ''),
            githubPath: hasCurrentAb
              ? (current.autoBackup?.githubPath ?? 'backups/weroll-backup-latest.json')
              : (savedCreds?.githubPath || 'backups/weroll-backup-latest.json'),
            githubArchivePath: hasCurrentAb
              ? (current.autoBackup?.githubArchivePath ?? 'backups/replaced-archive')
              : (savedCreds?.githubArchivePath || 'backups/replaced-archive'),
            driveFolderId: hasCurrentAb
              ? (current.autoBackup?.driveFolderId ?? '')
              : (savedCreds?.driveFolderId || ''),
            driveArchiveFolderId: hasCurrentAb
              ? (current.autoBackup?.driveArchiveFolderId ?? '')
              : (savedCreds?.driveArchiveFolderId || ''),
            driveAccessToken: hasCurrentAb
              ? (current.autoBackup?.driveAccessToken ?? '')
              : (savedCreds?.driveAccessToken || ''),
            driveAccountEmail: hasCurrentAb
              ? (current.autoBackup?.driveAccountEmail ?? '')
              : (savedCreds?.driveAccountEmail || ''),
            webhookUrl: hasCurrentAb
              ? (current.autoBackup?.webhookUrl ?? '')
              : (savedCreds?.webhookUrl || ''),
            lastBackupAt: current.autoBackup?.lastBackupAt || savedCreds?.lastBackupAt,
            lastBackupStatus: current.autoBackup?.lastBackupStatus || savedCreds?.lastBackupStatus,
            lastBackupMessage: current.autoBackup?.lastBackupMessage || savedCreds?.lastBackupMessage,
            lastComparisonAt: current.autoBackup?.lastComparisonAt || savedCreds?.lastComparisonAt,
            lastComparisonStatus:
              current.autoBackup?.lastComparisonStatus || savedCreds?.lastComparisonStatus,
            history: current.autoBackup?.history || savedCreds?.history || [],
          }
        : undefined;

    let finalChangelog =
      current.changelog && current.changelog.length > 0
        ? [...current.changelog]
        : [...(defaultSettings.changelog || [])];

    // Ensure v0.6 Alfa, v0.65 Alfa and v0.8 Alfa are present in the changelog even if settings.json was created on an older version
    const hasV06 = finalChangelog.some(
      (entry) => entry.version && entry.version.toLowerCase() === '0.6 alfa'
    );
    if (!hasV06) {
      finalChangelog = [v06Entry, ...finalChangelog];
    }

    const v065Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('0.65')
    );
    if (v065Idx === -1) {
      finalChangelog = [v065Entry, ...finalChangelog];
    } else if ((finalChangelog[v065Idx].changes || []).length < 6) {
      finalChangelog[v065Idx] = v065Entry;
    }

    const v08Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('0.8')
    );
    if (v08Idx === -1) {
      finalChangelog = [v08Entry, ...finalChangelog];
    } else {
      finalChangelog[v08Idx] = v08Entry;
    }

    const v10Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('1.0')
    );
    if (v10Idx === -1) {
      finalChangelog = [v10BetaEntry, ...finalChangelog];
    } else {
      finalChangelog[v10Idx] = v10BetaEntry;
    }

    const v11Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('1.1')
    );
    if (v11Idx === -1) {
      finalChangelog = [v11BetaEntry, ...finalChangelog];
    } else {
      finalChangelog[v11Idx] = v11BetaEntry;
    }

    const v12Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('1.2')
    );
    if (v12Idx === -1) {
      finalChangelog = [v12BetaEntry, ...finalChangelog];
    } else {
      finalChangelog[v12Idx] = v12BetaEntry;
    }

    const v13Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('1.3')
    );
    if (v13Idx === -1) {
      finalChangelog = [v13BetaEntry, ...finalChangelog];
    } else {
      finalChangelog[v13Idx] = v13BetaEntry;
    }

    const v14Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('1.4')
    );
    if (v14Idx === -1) {
      finalChangelog = [v14BetaEntry, ...finalChangelog];
    } else {
      finalChangelog[v14Idx] = v14BetaEntry;
    }

    const v15Idx = finalChangelog.findIndex(
      (entry) => entry.version && entry.version.toLowerCase().includes('1.5')
    );
    if (v15Idx === -1) {
      finalChangelog = [v15BetaEntry, ...finalChangelog];
    } else {
      finalChangelog[v15Idx] = v15BetaEntry;
    }

    const finalHeaderSubtitle =
      !current.headerSubtitle ||
      /v0\.(1|2|3|4|5|6|65|8|9|95)\b/i.test(current.headerSubtitle) ||
      current.headerSubtitle.includes('0.9') ||
      current.headerSubtitle.includes('1.0') ||
      current.headerSubtitle.includes('1.1') ||
      current.headerSubtitle.includes('1.2') ||
      current.headerSubtitle.includes('1.3') ||
      current.headerSubtitle.includes('1.4')
        ? defaultSettings.headerSubtitle
        : current.headerSubtitle;

    const merged: HostSettings = {
      ...defaultSettings,
      ...current,
      headerSubtitle: finalHeaderSubtitle,
      ...(mergedAutoBackup ? { autoBackup: mergedAutoBackup } : {}),
      developerNotice: {
        ...defaultSettings.developerNotice!,
        ...(current.developerNotice || {}),
        version: '1.5 Beta',
        title: 'WeRoll • Novedades v1.5 Beta',
        content: defaultSettings.developerNotice!.content,
      },
      developerAnnouncement: {
        enabled: true,
        version: '1.5 Beta',
        title: 'WeRoll • Novedades v1.5 Beta',
        content: defaultSettings.developerNotice!.content,
      },
      adminGreeting: current.adminGreeting
        ? {
            ...defaultSettings.adminGreeting!,
            ...current.adminGreeting,
            message:
              current.adminGreeting.message &&
              (current.adminGreeting.message.includes('0.9') ||
                current.adminGreeting.message.includes('1.0') ||
                current.adminGreeting.message.includes('1.1') ||
                current.adminGreeting.message.includes('1.2') ||
                current.adminGreeting.message.includes('1.3') ||
                current.adminGreeting.message.includes('1.4'))
                ? defaultSettings.adminGreeting!.message
                : current.adminGreeting.message,
          }
        : defaultSettings.adminGreeting,
      changelog: finalChangelog,
    };
    return merged;
  },

  saveHostSettings(
    settings: Partial<HostSettings>,
    options?: { silentSync?: boolean; mutationReason?: string }
  ): HostSettings {
    const current = this.getHostSettings();
    const merged: HostSettings = {
      ...current,
      ...settings,
      developerNotice: {
        ...current.developerNotice!,
        ...(settings.developerNotice || {}),
      },
      adminGreeting: settings.adminGreeting
        ? {
            ...(current.adminGreeting || {
              enabled: true,
              title: 'Comunicado del Administrador',
              message: '',
              type: 'info',
            }),
            ...settings.adminGreeting,
          }
        : current.adminGreeting,
      changelog: settings.changelog !== undefined ? settings.changelog : current.changelog,
    };

    writeJSON('settings.json', merged);

    if (merged.autoBackup) {
      try {
        const credsPath = path.join(PERSISTENT_VAULT_DIR, 'cloud_credentials.json');
        fs.writeFileSync(credsPath, JSON.stringify(merged.autoBackup, null, 2), 'utf-8');
      } catch {}
    }

    // Synchronize moderator user password in users.json
    if (merged.moderatorPassword && merged.moderatorPassword.trim()) {
      const newPass = merged.moderatorPassword.trim();
      const users = this.getUsers();
      let changed = false;
      for (const u of users) {
        if (u.role === 'moderator' || u.role === 'admin' || u.email.toLowerCase() === 'admin@weroll.app') {
          if (u.password !== newPass) {
            u.password = newPass;
            changed = true;
          }
        }
      }
      if (changed) {
        writeJSON('users.json', users);
      }
    }

    if (!options?.silentSync) {
      this.markMutation(options?.mutationReason || 'Ajustes del Panel de Administrador actualizados');
    } else {
      this.saveToPersistentVault();
    }

    return merged;
  },

  unlinkGithub(): HostSettings {
    // 1. Remove old credentials from persistent vault first
    try {
      const credsPath = path.join(PERSISTENT_VAULT_DIR, 'cloud_credentials.json');
      if (fs.existsSync(credsPath)) {
        fs.unlinkSync(credsPath);
      }
    } catch {}

    // 2. Read raw settings.json and strip all GitHub config
    const rawSettings = readJSON<any>('settings.json', {});
    const currentAb = rawSettings.autoBackup || {
      enabled: false,
      backupOnEveryChange: false,
      continuousComparison: false,
      frequencyHours: 24,
      destination: 'drive',
    };

    const updatedAutoBackup: AutoBackupConfig = {
      ...currentAb,
      destination: currentAb.destination === 'github' ? 'drive' : currentAb.destination,
      githubToken: '',
      githubRepo: '',
      githubPath: '',
      githubArchivePath: '',
      lastBackupStatus: undefined,
      lastBackupMessage: 'Cuenta y repositorio de GitHub desvinculados exitosamente.',
      history: (currentAb.history || []).filter((h: any) => h.destination !== 'github').slice(0, 15),
    };

    rawSettings.autoBackup = updatedAutoBackup;
    writeJSON('settings.json', rawSettings);

    // 3. Save clean credentials to persistent vault without any GitHub info
    try {
      const credsPath = path.join(PERSISTENT_VAULT_DIR, 'cloud_credentials.json');
      fs.writeFileSync(credsPath, JSON.stringify(updatedAutoBackup, null, 2), 'utf-8');
    } catch {}

    return this.getHostSettings();
  },

  // --- CHANGELOG / UPDATES BLOG CRUD ---
  getChangelog(): ChangelogEntry[] {
    const settings = this.getHostSettings();
    return settings.changelog || [];
  },

  addChangelogEntry(entry: ChangelogEntry): ChangelogEntry[] {
    const settings = this.getHostSettings();
    const list = settings.changelog || [];
    list.unshift(entry);
    settings.changelog = list;
    this.saveHostSettings(settings, {
      mutationReason: `Nueva nota de versión en Bloc de Notas: v${entry.version} (${entry.title})`,
    });
    return list;
  },

  updateChangelogEntry(index: number, updated: ChangelogEntry): ChangelogEntry[] | null {
    const settings = this.getHostSettings();
    const list = settings.changelog || [];
    if (index < 0 || index >= list.length) return null;
    list[index] = updated;
    settings.changelog = list;
    this.saveHostSettings(settings, {
      mutationReason: `Nota de versión actualizada en Bloc de Notas: v${updated.version}`,
    });
    return list;
  },

  deleteChangelogEntry(index: number): ChangelogEntry[] | null {
    const settings = this.getHostSettings();
    const list = settings.changelog || [];
    if (index < 0 || index >= list.length) return null;
    const removed = list[index];
    list.splice(index, 1);
    settings.changelog = list;
    this.saveHostSettings(settings, {
      mutationReason: `Nota de versión eliminada del Bloc de Notas: v${removed?.version || index}`,
    });
    return list;
  },

  // --- FULL DATABASE BACKUP EXPORT & RESTORE ---
  getFullBackup(): any {
    const syncMeta = this.getSyncMetadata();
    const backupTimestamp = syncMeta.lastModifiedAt || Date.now();
    const rawSettings = this.getHostSettings();
    const sanitizedSettings = {
      ...rawSettings,
      autoBackup: rawSettings.autoBackup
        ? {
            ...rawSettings.autoBackup,
            githubToken: '',
            driveAccessToken: '',
          }
        : undefined,
    };
    return {
      exportedAt: new Date(backupTimestamp).toISOString(),
      backupTimestamp,
      revision: syncMeta.revision || 0,
      isBaseState: syncMeta.isBaseState,
      lastMutationReason: syncMeta.lastMutationReason,
      contentHash: syncMeta.contentHash,
      platform: 'WeRoll 5E',
      schemaVersion: 2,
      appVersion: '0.5 ALFA',
      users: this.getUsers(),
      rooms: this.getRooms(),
      sheets: this.getPlayerSheets(),
      worlds: this.getWorldSheets(),
      backups: this.getBackups(),
      settings: sanitizedSettings,
      feedback: this.getFeedback(),
      forumPosts: this.getForumPosts(),
      forumComments: readJSON<ForumComment[]>('forum_comments.json', []),
      friendMessages: readJSON<FriendDirectMessage[]>('friend_messages.json', []),
      dmMessages: this.getDmMessages(),
      creatorStudio: this.getCreatorStudioVault(),
    };
  },

  restoreBackup(
    payload: any,
    options?: {
      fromCloudSync?: boolean;
      replaceAll?: boolean;
      remoteTimestamp?: number;
      remoteRevision?: number;
      isManualImport?: boolean;
    }
  ): {
    success: boolean;
    type: string;
    count: number;
    details?: any;
    message: string;
    revision?: number;
    timestamp?: number;
    latestBackup?: any;
    syncMetadata?: SyncMetadata;
  } {
    if (!payload || typeof payload !== 'object') {
      throw new Error('El archivo proporcionado no contiene un JSON válido.');
    }

    // Case 1: Full Master Database Backup Export
    if (
      payload.users ||
      payload.sheets ||
      payload.worlds ||
      payload.backups ||
      payload.settings ||
      payload.feedback ||
      payload.schemaVersion === 2
    ) {
      isRestoringOrSyncing = true;
      try {
        let restoredUsersCount = 0;
        let restoredSheetsCount = 0;
        let restoredWorldsCount = 0;
        let restoredBackupsCount = 0;
        let restoredFeedbackCount = 0;
        let restoredSettings = false;

        const isManual = !options?.fromCloudSync || Boolean(options?.isManualImport);
        const shouldReplaceCleanly = isManual || Boolean(options?.replaceAll) || this.getSyncMetadata().isBaseState;

        // 1. Restore Users (including passwords, roles, statuses, requests)
        if (Array.isArray(payload.users)) {
          const baseUsers: UserAccount[] = shouldReplaceCleanly ? [...DEFAULT_USERS] : this.getUsers();
          for (const u of payload.users) {
            if (u && (u.id || u.email)) {
              const idx = baseUsers.findIndex(
                (item) =>
                  (u.id && item.id === u.id) ||
                  (u.email && item.email.toLowerCase() === u.email.toLowerCase())
              );
              if (idx >= 0) {
                baseUsers[idx] = { ...baseUsers[idx], ...u };
              } else {
                baseUsers.push(u);
              }
              restoredUsersCount++;
            }
          }
          writeJSON('users.json', baseUsers);
        }

        // 2. Restore Player Sheets
        if (Array.isArray(payload.sheets)) {
          if (shouldReplaceCleanly) {
            const validSheets = payload.sheets.filter((s: any) => s && s.id && s.character);
            restoredSheetsCount = validSheets.length;
            writeJSON('sheets.json', validSheets);
          } else {
            const currentSheets = this.getPlayerSheets();
            for (const s of payload.sheets) {
              if (s && s.id && s.character) {
                const idx = currentSheets.findIndex((item) => item.id === s.id);
                if (idx >= 0) currentSheets[idx] = s;
                else currentSheets.push(s);
                restoredSheetsCount++;
              }
            }
            writeJSON('sheets.json', currentSheets);
          }
        }

        // 3. Restore DM World Sheets
        if (Array.isArray(payload.worlds)) {
          if (shouldReplaceCleanly) {
            const validWorlds = payload.worlds.filter((w: any) => w && w.id && w.workspace);
            restoredWorldsCount = validWorlds.length;
            writeJSON('worlds.json', validWorlds);
          } else {
            const currentWorlds = this.getWorldSheets();
            for (const w of payload.worlds) {
              if (w && w.id && w.workspace) {
                const idx = currentWorlds.findIndex((item) => item.id === w.id);
                if (idx >= 0) currentWorlds[idx] = w;
                else currentWorlds.push(w);
                restoredWorldsCount++;
              }
            }
            writeJSON('worlds.json', currentWorlds);
          }
        }

        // 4. Restore Rotating Backups
        if (payload.backups && typeof payload.backups === 'object') {
          const currentBackups = shouldReplaceCleanly ? {} : this.getBackups();
          Object.assign(currentBackups, payload.backups);
          restoredBackupsCount = Object.keys(payload.backups).length;
          writeJSON('backups.json', currentBackups);
        }

        // 5. Restore Feedback & Suggestions
        if (Array.isArray(payload.feedback)) {
          if (shouldReplaceCleanly) {
            const validFb = payload.feedback.filter((fb: any) => fb && fb.id);
            restoredFeedbackCount = validFb.length;
            writeJSON('feedback.json', validFb);
          } else {
            const currentFeedback = this.getFeedback();
            for (const fb of payload.feedback) {
              if (fb && fb.id) {
                const idx = currentFeedback.findIndex((item) => item.id === fb.id);
                if (idx >= 0) currentFeedback[idx] = fb;
                else currentFeedback.push(fb);
                restoredFeedbackCount++;
              }
            }
            writeJSON('feedback.json', currentFeedback);
          }
        }

        // 6. Restore Settings (preserve existing cloud tokens if incoming backup had empty tokens)
        if (payload.settings && typeof payload.settings === 'object') {
          const currentSettings = this.getHostSettings();
          const incomingAutoBackup = payload.settings.autoBackup || {};
          const currentAutoBackup = currentSettings.autoBackup || {};
          const mergedSettings: HostSettings = {
            ...currentSettings,
            ...payload.settings,
            autoBackup: {
              ...currentAutoBackup,
              ...incomingAutoBackup,
              githubToken: incomingAutoBackup.githubToken || currentAutoBackup.githubToken || '',
              githubRepo: incomingAutoBackup.githubRepo || currentAutoBackup.githubRepo || '',
              driveAccessToken:
                incomingAutoBackup.driveAccessToken || currentAutoBackup.driveAccessToken || '',
              driveFolderId: incomingAutoBackup.driveFolderId || currentAutoBackup.driveFolderId || '',
              webhookUrl: incomingAutoBackup.webhookUrl || currentAutoBackup.webhookUrl || '',
            },
          };
          this.saveHostSettings(mergedSettings, { silentSync: true });
          restoredSettings = true;
        }

        // 7. Restore Game Rooms
        if (payload.rooms && typeof payload.rooms === 'object' && !Array.isArray(payload.rooms)) {
          const currentRooms = shouldReplaceCleanly ? {} : this.getRooms();
          Object.assign(currentRooms, payload.rooms);
          writeJSON('rooms.json', currentRooms);
        }

        // 8. Restore Forum Posts & Comments
        if (Array.isArray(payload.forumPosts)) {
          writeJSON('forum_posts.json', payload.forumPosts);
        } else if (shouldReplaceCleanly) {
          writeJSON('forum_posts.json', []);
        }

        if (Array.isArray(payload.forumComments)) {
          writeJSON('forum_comments.json', payload.forumComments);
        } else if (shouldReplaceCleanly) {
          writeJSON('forum_comments.json', []);
        }

        // 9. Restore Friend Direct Messages
        if (Array.isArray(payload.friendMessages)) {
          writeJSON('friend_messages.json', payload.friendMessages);
        } else if (shouldReplaceCleanly) {
          writeJSON('friend_messages.json', []);
        }

        // 10. Restore DM / Dungeon Master Private Messages
        if (Array.isArray(payload.dmMessages)) {
          writeJSON('dm_messages.json', payload.dmMessages);
        } else if (shouldReplaceCleanly) {
          writeJSON('dm_messages.json', []);
        }

        // 11. Restore Creator Studio Vault (DLCs & Skins)
        if (payload.creatorStudio && typeof payload.creatorStudio === 'object') {
          writeJSON('creator_studio_vault.json', payload.creatorStudio);
        }

        const curMeta = this.getSyncMetadata();
        const persistentBackup = this.loadFromPersistentVault();

        let incomingTs: number;
        let incomingRev: number;

        if (isManual) {
          // USER MANUAL IMPORT / RESTORATION:
          // Must ALWAYS be established as the newest, most current version across the entire system.
          // Even if the imported JSON was created in the past or has an older revision,
          // the act of importing it establishes it as the active latest state.
          // We guarantee incomingTs is strictly greater than current time, existing metadata timestamp,
          // persistent vault timestamp, payload's original timestamp, and any remote cloud timestamp.
          const maxPriorTs = Math.max(
            Date.now(),
            curMeta.lastModifiedAt || 0,
            persistentBackup?.backupTimestamp || 0,
            options?.remoteTimestamp || 0,
            payload.backupTimestamp || 0,
            payload.exportedAt ? new Date(payload.exportedAt).getTime() : 0
          );
          incomingTs = maxPriorTs + 2000;

          const maxPriorRev = Math.max(
            1,
            curMeta.revision || 0,
            persistentBackup?.revision || 0,
            payload.revision || 0,
            options?.remoteRevision || 0
          );
          incomingRev = maxPriorRev + 1;
        } else {
          // Cloud sync from a known remote source that was verified to be newer
          incomingTs =
            options?.remoteTimestamp ||
            payload.backupTimestamp ||
            (payload.exportedAt ? new Date(payload.exportedAt).getTime() : Date.now());
          incomingRev =
            options?.remoteRevision ??
            payload.revision ??
            Math.max(1, (curMeta.revision || 0) + 1);
        }

        const updatedMeta = this.saveSyncMetadata({
          isBaseState: false,
          revision: incomingRev,
          lastModifiedAt: incomingTs,
          lastMutationReason: isManual
            ? 'Importación manual de Respaldo Total (sobrescrito y establecido como la versión más actual)'
            : 'Sincronizado desde la versión más actual en la nube',
          contentHash: this.computeContentHash(),
          lastCloudSyncAt: incomingTs,
          lastComparisonAt: incomingTs,
          lastComparisonStatus: isManual
            ? `Respaldo Total importado manualmente y fijado como la versión más reciente activa (Rev #${incomingRev}).`
            : `Sincronizado con versión en la nube (Rev #${incomingRev}).`,
        });

        this.saveToPersistentVault();

        return {
          success: true,
          type: 'full_database',
          count: restoredUsersCount + restoredSheetsCount + restoredWorldsCount,
          details: {
            users: restoredUsersCount,
            sheets: restoredSheetsCount,
            worlds: restoredWorldsCount,
            backups: restoredBackupsCount,
            feedback: restoredFeedbackCount,
            settings: restoredSettings,
          },
          revision: incomingRev,
          timestamp: incomingTs,
          syncMetadata: updatedMeta,
          latestBackup: this.getFullBackup(),
          message: `¡Respaldo Maestro Restaurado con Éxito! Se sobrescribió el estado y se estableció como la versión más actual (Rev #${incomingRev}). Se actualizaron ${restoredUsersCount} cuentas de usuario (con contraseñas y roles), ${restoredSheetsCount} fichas de jugador, ${restoredWorldsCount} World Sheets, ${restoredBackupsCount} respaldos rotativos, ${restoredFeedbackCount} reportes de feedback y la configuración total del servidor.`,
        };
      } finally {
        isRestoringOrSyncing = false;
        // If manual restore, trigger cloud backup push so cloud also gets the manually restored state
        if (!options?.fromCloudSync && mutationListener) {
          mutationListener('Restauración manual de Respaldo Maestro');
        }
      }
    }

    // Case 2: Single Player Sheet
    if (payload.character && payload.character.id && payload.character.name) {
      this.savePlayerSheet({
        id: payload.id || payload.character.id,
        ownerEmail: payload.ownerEmail || 'jugador@weroll.app',
        name: payload.name || payload.character.name,
        character: payload.character,
        updatedAt: Date.now(),
      });
      return {
        success: true,
        type: 'player_sheet',
        count: 1,
        message: `Ficha de personaje "${payload.character.name}" restaurada con éxito en la bóveda.`,
      };
    }

    // Case 3: Raw Character5e object
    if (payload.name && payload.characterClass && (payload.currentHp !== undefined || payload.abilities)) {
      const charId = payload.id || `char-${Date.now()}`;
      this.savePlayerSheet({
        id: charId,
        ownerEmail: payload.ownerEmail || 'jugador@weroll.app',
        name: payload.name,
        character: { ...payload, id: charId },
        updatedAt: Date.now(),
      });
      return {
        success: true,
        type: 'player_sheet',
        count: 1,
        message: `Ficha de personaje "${payload.name}" importada exitosamente a la bóveda.`,
      };
    }

    // Case 4: Single World Sheet
    if (payload.workspace && (payload.name || payload.roomCode)) {
      const worldId = payload.id || `world-${Date.now()}`;
      this.saveWorldSheet({
        id: worldId,
        ownerEmail: payload.ownerEmail || 'dm@weroll.app',
        name: payload.name || 'Campaña Restaurada',
        description: payload.description,
        roomCode: (payload.roomCode || 'MESA-RESTAURADA').toUpperCase(),
        roomPassword: payload.roomPassword,
        workspace: payload.workspace,
        updatedAt: Date.now(),
      });
      return {
        success: true,
        type: 'world_sheet',
        count: 1,
        message: `World Sheet "${payload.name || 'Campaña Restaurada'}" restaurado con éxito en la bóveda.`,
      };
    }

    throw new Error(
      'El formato JSON no corresponde a un respaldo válido de WeRoll (Respaldo Total, Ficha de Jugador o World Sheet).'
    );
  },

  // =========================================================================
  // DELTA SYNC ENGINE, SEPARATED ASSETS INDEX & WRITE-BEHIND QUEUE INSPECTOR
  // =========================================================================
  recordDeltaEntry(entry: {
    entityKind:
      | 'sheet'
      | 'world'
      | 'user'
      | 'settings'
      | 'creator_skin_player'
      | 'creator_skin_dm'
      | 'creator_dlc'
      | 'creator_skin_app';
    entityId: string;
    entityLabel: string;
    actorEmail?: string;
    changedFields: string[];
    payloadSizeKb: number;
    summary: string;
  }): any {
    const syncMeta = this.getSyncMetadata();
    const list = readJSON<any[]>('delta_sync_log.json', []);
    const record = {
      id: `delta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      revision: syncMeta.revision || 1,
      timestamp: Date.now(),
      entityKind: entry.entityKind,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      actorEmail: entry.actorEmail || 'sistema@weroll.app',
      changedFields: entry.changedFields,
      payloadSizeKb: entry.payloadSizeKb,
      summary: entry.summary,
    };
    list.unshift(record);
    writeJSON('delta_sync_log.json', list.slice(0, 120));
    return record;
  },

  getDeltaSyncLog(sinceRevision?: number): any[] {
    const list = readJSON<any[]>('delta_sync_log.json', []);
    if (list.length === 0) {
      // Seed initial baseline entries from current vault so Admin can inspect immediately
      const syncMeta = this.getSyncMetadata();
      const sheets = this.getPlayerSheets();
      const worlds = this.getWorldSheets();
      const seeded: any[] = [];
      for (const s of sheets.slice(0, 5)) {
        seeded.push({
          id: `delta-seed-sheet-${s.id}`,
          revision: syncMeta.revision || 1,
          timestamp: s.updatedAt || Date.now() - 180_000,
          entityKind: 'sheet',
          entityId: s.id,
          entityLabel: `${s.name} (${s.ownerEmail})`,
          actorEmail: s.ownerEmail,
          changedFields: ['currentHp', 'inventory', 'experience'],
          payloadSizeKb: Math.max(0.5, Math.round((JSON.stringify(s).length / 1024) * 10) / 10),
          summary: ` Estado incremental sincronizado de ficha "${s.name}"`,
        });
      }
      for (const w of worlds.slice(0, 5)) {
        seeded.push({
          id: `delta-seed-world-${w.id}`,
          revision: syncMeta.revision || 1,
          timestamp: w.updatedAt || Date.now() - 120_000,
          entityKind: 'world',
          entityId: w.id,
          entityLabel: `${w.name} [${w.roomCode}]`,
          actorEmail: w.ownerEmail,
          changedFields: ['activeAtlasFolder', 'activeLiveVisual', 'npcs'],
          payloadSizeKb: Math.max(1.2, Math.round((JSON.stringify(w).length / 1024) * 10) / 10),
          summary: `Estado incremental sincronizado de campaña "${w.name}"`,
        });
      }
      seeded.push({
        id: 'delta-seed-creator-schema',
        revision: syncMeta.revision || 1,
        timestamp: Date.now() - 60_000,
        entityKind: 'creator_skin_app',
        entityId: 'app-skin-default-original',
        entityLabel: 'Skin de la Página: Diseño Clásico Original WeRoll',
        actorEmail: 'admin@weroll.app',
        changedFields: ['headerBannerBg', 'lobbyBgAccent', 'buttonPrimaryGradient'],
        payloadSizeKb: 0.8,
        summary: 'Esquema base de 4 apartados del Estudio de Creador registrado en Delta Sync',
      });
      writeJSON('delta_sync_log.json', seeded);
      if (sinceRevision !== undefined) {
        return seeded.filter((d) => d.revision > sinceRevision);
      }
      return seeded;
    }
    if (sinceRevision !== undefined) {
      return list.filter((d) => d.revision > sinceRevision);
    }
    return list;
  },

  applyIncrementalDelta(params: {
    entityKind:
      | 'sheet'
      | 'world'
      | 'user'
      | 'settings'
      | 'creator_skin_player'
      | 'creator_skin_dm'
      | 'creator_dlc'
      | 'creator_skin_app';
    entityId: string;
    ownerEmail?: string;
    patch: Record<string, any>;
    changedFields?: string[];
  }): {
    success: boolean;
    revision: number;
    deltaRecord: any;
    updatedEntity?: any;
  } {
    const { entityKind, entityId, ownerEmail, patch } = params;
    const changedFields =
      params.changedFields && params.changedFields.length > 0
        ? params.changedFields
        : Object.keys(patch || {});

    if (entityKind === 'sheet') {
      const sheets = this.getPlayerSheets();
      const idx = sheets.findIndex((s) => s.id === entityId);
      if (idx >= 0) {
        const current = sheets[idx];
        const mergedChar = patch.character
          ? { ...current.character, ...patch.character }
          : { ...current.character, ...patch };
        const updatedSheet: PlayerSheetRecord = {
          ...current,
          name: mergedChar.name || current.name,
          character: mergedChar,
          updatedAt: Date.now(),
        };
        this.savePlayerSheet(updatedSheet, changedFields);
        const syncMeta = this.getSyncMetadata();
        const latestDelta = this.getDeltaSyncLog()[0];
        return {
          success: true,
          revision: syncMeta.revision || 1,
          deltaRecord: latestDelta,
          updatedEntity: updatedSheet,
        };
      }
    }

    if (entityKind === 'world') {
      const worlds = this.getWorldSheets();
      const idx = worlds.findIndex((w) => w.id === entityId);
      if (idx >= 0) {
        const current = worlds[idx];
        const mergedWorkspace = patch.workspace
          ? { ...current.workspace, ...patch.workspace }
          : { ...current.workspace, ...patch };
        const updatedWorld: WorldSheetRecord = {
          ...current,
          name: patch.name || current.name,
          workspace: mergedWorkspace,
          updatedAt: Date.now(),
        };
        this.saveWorldSheet(updatedWorld);
        const syncMeta = this.getSyncMetadata();
        const latestDelta = this.getDeltaSyncLog()[0];
        return {
          success: true,
          revision: syncMeta.revision || 1,
          deltaRecord: latestDelta,
          updatedEntity: updatedWorld,
        };
      }
    }

    // Creator Studio 4 modules or general entity delta
    const creatorStore = readJSON<Record<string, any>>('creator_studio_vault.json', {
      creator_skin_player: [],
      creator_skin_dm: [],
      creator_dlc: [],
      creator_skin_app: [],
    });
    if (
      entityKind === 'creator_skin_player' ||
      entityKind === 'creator_skin_dm' ||
      entityKind === 'creator_dlc' ||
      entityKind === 'creator_skin_app'
    ) {
      const list: any[] = Array.isArray(creatorStore[entityKind]) ? creatorStore[entityKind] : [];
      const existingIdx = list.findIndex((item) => item.id === entityId);
      const updatedItem = {
        ...(existingIdx >= 0 ? list[existingIdx] : { id: entityId }),
        ...patch,
        id: entityId,
        updatedAt: Date.now(),
      };
      if (existingIdx >= 0) {
        list[existingIdx] = updatedItem;
      } else {
        list.push(updatedItem);
      }
      creatorStore[entityKind] = list;
      writeJSON('creator_studio_vault.json', creatorStore);
    }

    this.markMutation(`Delta incremental [${entityKind}] en ${entityId}: ${changedFields.join(', ')}`);
    const deltaRecord = this.recordDeltaEntry({
      entityKind,
      entityId,
      entityLabel: patch.name || patch.title || entityId,
      actorEmail: ownerEmail || 'sistema@weroll.app',
      changedFields,
      payloadSizeKb: Math.max(0.2, Math.round((JSON.stringify(patch || {}).length / 1024) * 10) / 10),
      summary: `Delta aplicado en ${entityKind} (${entityId}): ${changedFields.join(', ')}`,
    });
    const syncMeta = this.getSyncMetadata();
    return {
      success: true,
      revision: syncMeta.revision || 1,
      deltaRecord,
      updatedEntity: patch,
    };
  },

  getSeparatedAssetsCatalog(): {
    totalAssetsCount: number;
    totalSizeKb: number;
    assets: Array<{
      assetId: string;
      hash: string;
      category: 'atlas_map' | 'album_photo' | 'character_avatar' | 'dm_avatar' | 'user_avatar';
      ownerEntityId: string;
      ownerLabel: string;
      title: string;
      mimeType: string;
      sizeKb: number;
      updatedAt: number;
    }>;
  } {
    const assets: Array<{
      assetId: string;
      hash: string;
      category: 'atlas_map' | 'album_photo' | 'character_avatar' | 'dm_avatar' | 'user_avatar';
      ownerEntityId: string;
      ownerLabel: string;
      title: string;
      mimeType: string;
      sizeKb: number;
      updatedAt: number;
    }> = [];

    const computeShortHash = (raw: string) =>
      crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);

    const detectMime = (raw: string) => {
      const m = /^data:([^;]+);base64,/i.exec(raw || '');
      return m ? m[1] : raw.startsWith('http') ? 'image/url-remote' : 'image/webp';
    };

    // 1. Inspect Player Sheets avatars
    for (const s of this.getPlayerSheets()) {
      const url = s.character?.avatarCustomUrl || s.character?.avatarUrl;
      if (url && url.length > 5) {
        const sizeKb = Math.max(0.5, Math.round((url.length / 1024) * 10) / 10);
        assets.push({
          assetId: `asset-char-${s.id}`,
          hash: computeShortHash(url),
          category: 'character_avatar',
          ownerEntityId: s.id,
          ownerLabel: `Ficha: ${s.name} (${s.ownerEmail})`,
          title: `Avatar de ${s.name}`,
          mimeType: detectMime(url),
          sizeKb,
          updatedAt: s.updatedAt || Date.now(),
        });
      }
    }

    // 2. Inspect World Sheets (Atlas Maps, Album Photos, DM Avatar)
    for (const w of this.getWorldSheets()) {
      const ws = w.workspace;
      if (!ws) continue;
      if (ws.dmAvatarUrl && ws.dmAvatarUrl.length > 5) {
        assets.push({
          assetId: `asset-dm-${w.id}`,
          hash: computeShortHash(ws.dmAvatarUrl),
          category: 'dm_avatar',
          ownerEntityId: w.id,
          ownerLabel: `Campaña: ${w.name}`,
          title: `Retrato DM (${w.name})`,
          mimeType: detectMime(ws.dmAvatarUrl),
          sizeKb: Math.max(0.5, Math.round((ws.dmAvatarUrl.length / 1024) * 10) / 10),
          updatedAt: w.updatedAt || Date.now(),
        });
      }
      if (ws.atlasMaps && typeof ws.atlasMaps === 'object') {
        for (const [zoneKey, mapData] of Object.entries(ws.atlasMaps)) {
          if (typeof mapData === 'string' && mapData.length > 5) {
            assets.push({
              assetId: `asset-map-${w.id}-${ computeShortHash(zoneKey) }`,
              hash: computeShortHash(mapData),
              category: 'atlas_map',
              ownerEntityId: w.id,
              ownerLabel: `Campaña: ${w.name}`,
              title: `Mapa de Zona: ${zoneKey === 'all' ? 'Mundo Completo' : zoneKey}`,
              mimeType: detectMime(mapData),
              sizeKb: Math.max(0.8, Math.round((mapData.length / 1024) * 10) / 10),
              updatedAt: w.updatedAt || Date.now(),
            });
          }
        }
      }
      if (Array.isArray(ws.placeAlbumPhotos)) {
        for (const photo of ws.placeAlbumPhotos) {
          if (photo && photo.imageUrl && photo.imageUrl.length > 5) {
            assets.push({
              assetId: `asset-photo-${w.id}-${photo.id}`,
              hash: computeShortHash(photo.imageUrl),
              category: 'album_photo',
              ownerEntityId: w.id,
              ownerLabel: `Campaña: ${w.name} (${photo.folder || 'all'})`,
              title: `Foto Álbum: ${photo.title}`,
              mimeType: detectMime(photo.imageUrl),
              sizeKb: Math.max(0.6, Math.round((photo.imageUrl.length / 1024) * 10) / 10),
              updatedAt: photo.createdAt || w.updatedAt || Date.now(),
            });
          }
        }
      }
    }

    // 3. Inspect User Profile Avatars
    for (const u of this.getUsers()) {
      if (u.avatarUrl && u.avatarUrl.length > 5) {
        assets.push({
          assetId: `asset-user-${u.id}`,
          hash: computeShortHash(u.avatarUrl),
          category: 'user_avatar',
          ownerEntityId: u.id,
          ownerLabel: `Usuario: ${u.displayName}@${u.userTagId}`,
          title: `Foto de Perfil (${u.displayName})`,
          mimeType: detectMime(u.avatarUrl),
          sizeKb: Math.max(0.5, Math.round((u.avatarUrl.length / 1024) * 10) / 10),
          updatedAt: u.lastActiveAt || u.registeredAt || Date.now(),
        });
      }
    }

    const totalSizeKb = Math.round(assets.reduce((acc, a) => acc + a.sizeKb, 0) * 10) / 10;
    return {
      totalAssetsCount: assets.length,
      totalSizeKb,
      assets: assets.sort((a, b) => b.updatedAt - a.updatedAt),
    };
  },

  getCreatorStudioVault(): {
    creator_dlc: any[];
    creator_skin_app: any[];
    creator_skin_player: any[];
    creator_skin_dm: any[];
  } {
    // Rich default SRD compendium imported from ./srdDlcData.ts

    const defaultDlcSeasonal = {
      id: 'dlc-invierno-helado-2026',
      name: 'Crónicas del Solsticio Helado 2026',
      version: '1.0 Temporada',
      authorTag: 'Administrador Supremo@adm',
      description: 'Expansión de temporada limitada (Diciembre 2026): añade monstruos de escarcha, armas rúnicas invernales y el Santuario del Hielo Eterno.',
      seasonTag: 'Navidad 2026',
      claimCode: 'NAVIDAD-DLC-2026',
      availableFrom: '2026-12-01',
      availableUntil: '2026-12-31',
      isOfficialSrd: false,
      isFreeForAll: false,
      counts: {
        maps: 2,
        albums: 2,
        monsters: 3,
        itemsAndWeapons: 4,
        stories: 2,
        npcs: 2,
      },
      contentPayload: {
        folders: ['Valle del Viento Helado / Santuario Escarchado'],
        locations: [
          {
            id: 'dlc-win-loc-1',
            name: 'Santuario del Solsticio Helado',
            region: 'Valle del Viento Helado',
            type: 'Templo',
            status: 'Congelado por magia ancestral',
            description: 'Un templo de hielo cristalino que solo emerge durante las ventiscas de diciembre.',
            folder: 'Valle del Viento Helado / Santuario Escarchado',
          },
        ],
        monsters: [
          {
            id: 'dlc-win-mon-1',
            name: 'Gólem de Escarcha Rúnica',
            size: 'Grande',
            type: 'Constructo',
            alignment: 'Neutral',
            cr: '5',
            ac: 17,
            hp: 85,
            maxHp: 85,
            speed: '30 pies',
            str: 20,
            dex: 9,
            con: 18,
            int: 6,
            wis: 10,
            cha: 5,
            folder: 'Valle del Viento Helado / Santuario Escarchado',
            traits: [{ name: 'Aura Gélida', description: 'Ralentiza 10 pies a enemigos a 5 pies.' }],
            actions: [
              { id: 'atk-ice', name: 'Puño Glaciar', type: 'melee', toHit: 8, damage: '2d10+5', damageType: 'Frío' },
            ],
          },
        ],
        itemsAndSpells: [
          {
            id: 'dlc-win-item-1',
            name: 'Mandoble de la Estrella Polar',
            kind: 'item',
            itemGroup: 'weapon',
            rarity: 'Muy Raro',
            category: 'Arma',
            whoHasIt: 'Altar del Solsticio',
            whereFound: 'Santuario del Solsticio Helado',
            description: 'Hoja forjada en hielo estelar que otorga +2 a Fuerza e inflige daño de frío adicional.',
            weight: 6,
            folder: 'Valle del Viento Helado / Santuario Escarchado',
            statModifiers: [{ id: 'sm-str-2', stat: 'str', value: 2, label: 'Vigor Polar' }],
            weaponAttacks: [
              {
                id: 'wa-polar',
                name: 'Tajo Boreal',
                description: 'Estallido de escarcha al impactar',
                dice: '2d6',
                bonus: 2,
                damageType: 'Frío',
                attackType: 'melee',
                range: '5 pies',
              },
            ],
          },
        ],
        campaignLogs: [
          {
            id: 'dlc-win-log-1',
            sessionNumber: 1,
            entryType: 'chapter',
            title: 'Capítulo I: La Campana de Escarcha',
            date: 'Solsticio de Invierno',
            summary: 'Las campanas del templo sumergido resuenan a través de la ventisca.',
            publicNotes: 'Una aurora boreal ilumina el sendero hacia el glaciar.',
            privateNotes: 'El Gólem despierta si alguien toca el cáliz sin pronunciar el juramento.',
            tags: ['Invierno 2026', 'Capítulo'],
            folder: 'Valle del Viento Helado / Santuario Escarchado',
            dlcSourceId: 'dlc-invierno-helado-2026',
          },
        ],
      },
      updatedAt: 1792772800000,
    };

    const defaultAppSkins = [
      {
        id: 'skin-app-default',
        name: 'Skin Online Default (Clásico Dorado WeRoll)',
        seasonTag: 'Original Online',
        authorTag: 'Administrador Supremo@adm',
        description:
          'Diseño clásico oficial de WeRoll con tonos obsidiana, marcos dorados imperiales y acentos ámbar. Es la skin online base para todas las cuentas nuevas.',
        isDefault: true,
        isOnlineActive: true,
        themeTokens: {
          headerBannerBg: 'linear-gradient(180deg, rgba(17,13,10,0.98) 0%, rgba(11,9,7,0.96) 100%)',
          headerTitleColor: '#fde68a',
          headerTitleScale: 'md',
          buttonScale: 'md',
          lobbyBgAccent: 'radial-gradient(ellipse at top, rgba(120,53,15,0.18), rgba(9,9,11,0.98) 70%)',
          forumAccentColor: '#f59e0b',
          forumPanelBg: 'rgba(18, 15, 12, 0.94)',
          charactersSectionBg: 'rgba(18, 14, 11, 0.92)',
          friendsSectionBg: 'rgba(18, 15, 12, 0.94)',
          buttonPrimaryGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          borderOrnamentColor: 'rgba(217, 119, 6, 0.38)',
        },
        updatedAt: 1792772800000,
      },
    ];

    const defaultPlayerSkins = [
      {
        id: 'skin-player-default',
        name: 'Skin Default (Sincronizada con Skin Online)',
        authorTag: 'WeRoll@adm',
        description: 'Usa automáticamente la apariencia de la Skin Online activa de la aplicación.',
        seasonTag: 'Default',
        isDefault: true,
        sheetTheme: {
          primaryBorderColor: '#d97706',
          accentColor: '#f59e0b',
          cardFrameStyle: 'imperial-gold',
          headerGradient: 'linear-gradient(180deg, rgba(24,19,15,0.96), rgba(14,12,10,0.98))',
          titleColor: '#fde68a',
        },
        tarotCardDesign: {
          glowColor: 'rgba(245, 158, 11, 0.35)',
          badgeStyle: 'amber-gold',
          cardBgGradient: 'linear-gradient(180deg, #1b1510 0%, #0f0c09 100%)',
        },
        updatedAt: 1792772800000,
      },
    ];

    const defaultDmSkins = [
      {
        id: 'skin-dm-default',
        name: 'Skin DM Default (Sincronizada con Skin Online)',
        authorTag: 'WeRoll@adm',
        description: 'Estética imperial estándar sincronizada con la Skin Online activa.',
        seasonTag: 'Default',
        isDefault: true,
        worldSheetTheme: {
          panelBgColor: '#120f0c',
          borderGoldTone: '#d97706',
          mapHudFrameStyle: 'imperial-atlas',
          headerGradient: 'linear-gradient(180deg, rgba(24,19,15,0.96), rgba(12,10,8,0.98))',
          accentColor: '#f59e0b',
        },
        updatedAt: 1792772800000,
      },
    ];

    const raw = readJSON<Record<string, any>>('creator_studio_vault.json', {
      creator_dlc: [defaultDlcSrd, defaultDlcSeasonal],
      creator_skin_app: defaultAppSkins,
      creator_skin_player: defaultPlayerSkins,
      creator_skin_dm: defaultDmSkins,
    });

    let changed = false;

    // Prune legacy test skins so only single default or user-created custom skins exist
    const legacySkinIds = new Set([
      'skin-app-navidad-2026',
      'skin-app-sangre-carmesi',
      'skin-player-crimson-dragon',
      'skin-player-frost-2026',
      'skin-dm-obsidian-throne',
    ]);

    if (Array.isArray(raw.creator_skin_app)) {
      const before = raw.creator_skin_app.length;
      raw.creator_skin_app = raw.creator_skin_app.filter((s: any) => !legacySkinIds.has(s.id));
      if (raw.creator_skin_app.length !== before) changed = true;
    }
    if (Array.isArray(raw.creator_skin_player)) {
      const before = raw.creator_skin_player.length;
      raw.creator_skin_player = raw.creator_skin_player.filter((s: any) => !legacySkinIds.has(s.id));
      if (raw.creator_skin_player.length !== before) changed = true;
    }
    if (Array.isArray(raw.creator_skin_dm)) {
      const before = raw.creator_skin_dm.length;
      raw.creator_skin_dm = raw.creator_skin_dm.filter((s: any) => !legacySkinIds.has(s.id));
      if (raw.creator_skin_dm.length !== before) changed = true;
    }

    if (!Array.isArray(raw.creator_dlc) || raw.creator_dlc.length === 0) {
      raw.creator_dlc = [defaultDlcSrd, defaultDlcSeasonal];
      changed = true;
    } else {
      const srdIdx = raw.creator_dlc.findIndex((d: any) => d.id === 'dlc-srd-5e-oficial');
      if (srdIdx >= 0) {
        if ((raw.creator_dlc[srdIdx].contentPayload?.monsters?.length || 0) < 15) {
          raw.creator_dlc[srdIdx] = defaultDlcSrd;
          changed = true;
        }
      } else {
        raw.creator_dlc.unshift(defaultDlcSrd);
        changed = true;
      }
    }

    if (!Array.isArray(raw.creator_skin_app) || raw.creator_skin_app.length === 0) {
      raw.creator_skin_app = defaultAppSkins;
      changed = true;
    } else if (!raw.creator_skin_app.some((s: any) => s.id === 'skin-app-default')) {
      raw.creator_skin_app.unshift(defaultAppSkins[0]);
      changed = true;
    }

    if (!Array.isArray(raw.creator_skin_player) || raw.creator_skin_player.length === 0) {
      raw.creator_skin_player = defaultPlayerSkins;
      changed = true;
    } else if (!raw.creator_skin_player.some((s: any) => s.id === 'skin-player-default')) {
      raw.creator_skin_player.unshift(defaultPlayerSkins[0]);
      changed = true;
    }

    if (!Array.isArray(raw.creator_skin_dm) || raw.creator_skin_dm.length === 0) {
      raw.creator_skin_dm = defaultDmSkins;
      changed = true;
    } else if (!raw.creator_skin_dm.some((s: any) => s.id === 'skin-dm-default')) {
      raw.creator_skin_dm.unshift(defaultDmSkins[0]);
      changed = true;
    }

    // Ensure active online skins for Lobby (app), Player, and DM are marked
    const settings = this.getHostSettings();
    const activeLobbyId = settings.activeOnlineLobbySkinId || settings.activeAppSkinId || 'skin-app-default';
    const activePlayerId = settings.activeOnlinePlayerSkinId || 'skin-player-default';
    const activeDmId = settings.activeOnlineDmSkinId || 'skin-dm-default';

    let foundOnlineLobby = false;
    for (const s of raw.creator_skin_app) {
      s.scope = 'app';
      s.target = 'app';
      s.reviewStatus = s.reviewStatus || 'approved';
      if (s.createdByAdmin === undefined) s.createdByAdmin = true;
      if (s.hideCreatorCredit === undefined) s.hideCreatorCredit = !s.editorCreditName;
      if (s.id === activeLobbyId) {
        s.isOnlineActive = true;
        s.isOnlineDefault = true;
        foundOnlineLobby = true;
      } else {
        s.isOnlineActive = false;
        s.isOnlineDefault = false;
      }
    }
    if (!foundOnlineLobby && raw.creator_skin_app[0]) {
      raw.creator_skin_app[0].isOnlineActive = true;
      raw.creator_skin_app[0].isOnlineDefault = true;
    }

    let foundOnlinePlayer = false;
    for (const s of raw.creator_skin_player) {
      s.scope = 'player';
      s.target = 'player';
      s.reviewStatus = s.reviewStatus || 'approved';
      if (s.createdByAdmin === undefined) s.createdByAdmin = true;
      if (s.hideCreatorCredit === undefined) s.hideCreatorCredit = !s.editorCreditName;
      // Ensure themeTokens exists alongside sheetTheme/tarotCardDesign for the unified visual editor
      if (!s.themeTokens) {
        s.themeTokens = {
          headerBannerBg: s.sheetTheme?.headerGradient || 'linear-gradient(180deg, rgba(24,19,15,0.96), rgba(14,12,10,0.98))',
          headerTitleColor: s.sheetTheme?.titleColor || '#fde68a',
          forumAccentColor: s.sheetTheme?.accentColor || '#f59e0b',
          borderOrnamentColor: s.sheetTheme?.primaryBorderColor || '#d97706',
          sheetIconScale: 'md',
          sheetFontFamily: 'cinzel',
          sheetPortraitSize: 'md',
          sheetBgColor: '#12100e',
          sheetStatBoxBg: '#191512',
          sheetStatBoxBorder: s.sheetTheme?.primaryBorderColor || '#d97706',
          sheetStatBoxStyle: 'ornate',
          sheetHpBarBg: '#291515',
          sheetHpBarFill: '#10b981',
          sheetHpBarStyle: 'classic',
          deckTarotCardBg: s.tarotCardDesign?.cardBgGradient || '#171310',
          deckTarotCardBorder: s.sheetTheme?.primaryBorderColor || '#d97706',
          deckTarotHeaderBg: '#241c14',
          adventurerCornerBg: '#161310',
          adventurerCornerBorder: s.sheetTheme?.primaryBorderColor || '#b45309',
          mapModeFrameBg: '#0c0a09',
          mapModeFrameBorder: s.sheetTheme?.primaryBorderColor || '#d97706',
          mapModeCardBg: '#181411',
          mapModeButtonBg: s.sheetTheme?.accentColor || '#d97706',
          mapModeButtonText: '#ffffff',
          mapModeDmHoodBg: '#1c1510',
          mapModeDmHoodBorder: s.sheetTheme?.primaryBorderColor || '#f59e0b',
          mapModeDmHoodAccent: s.sheetTheme?.titleColor || '#fde68a',
          tarotGlowColor: s.tarotCardDesign?.glowColor || 'rgba(245, 158, 11, 0.35)',
          tarotBorderColor: s.sheetTheme?.primaryBorderColor || '#d97706',
          tarotHeaderGradient: s.sheetTheme?.headerGradient || 'linear-gradient(180deg, #1b1510 0%, #0f0c09 100%)',
          tarotBadgeBg: '#78350f',
          tarotBadgeText: '#fde68a',
        };
      }
      if (s.id === activePlayerId) {
        s.isOnlineActive = true;
        s.isOnlineDefault = true;
        foundOnlinePlayer = true;
      } else {
        s.isOnlineActive = false;
        s.isOnlineDefault = false;
      }
    }
    if (!foundOnlinePlayer && raw.creator_skin_player[0]) {
      raw.creator_skin_player[0].isOnlineActive = true;
      raw.creator_skin_player[0].isOnlineDefault = true;
    }

    let foundOnlineDm = false;
    for (const s of raw.creator_skin_dm) {
      s.scope = 'dm';
      s.target = 'dm';
      s.reviewStatus = s.reviewStatus || 'approved';
      if (s.createdByAdmin === undefined) s.createdByAdmin = true;
      if (s.hideCreatorCredit === undefined) s.hideCreatorCredit = !s.editorCreditName;
      if (!s.themeTokens) {
        s.themeTokens = {
          headerBannerBg: s.worldSheetTheme?.headerGradient || 'linear-gradient(180deg, rgba(24,19,15,0.96), rgba(12,10,8,0.98))',
          headerTitleColor: '#fde68a',
          forumAccentColor: s.worldSheetTheme?.accentColor || '#f59e0b',
          forumPanelBg: s.worldSheetTheme?.panelBgColor || '#120f0c',
          borderOrnamentColor: s.worldSheetTheme?.borderGoldTone || '#d97706',
        };
      }
      if (s.id === activeDmId) {
        s.isOnlineActive = true;
        s.isOnlineDefault = true;
        foundOnlineDm = true;
      } else {
        s.isOnlineActive = false;
        s.isOnlineDefault = false;
      }
    }
    if (!foundOnlineDm && raw.creator_skin_dm[0]) {
      raw.creator_skin_dm[0].isOnlineActive = true;
      raw.creator_skin_dm[0].isOnlineDefault = true;
    }

    for (const d of raw.creator_dlc) {
      d.reviewStatus = d.reviewStatus || 'approved';
      if (d.createdByAdmin === undefined) d.createdByAdmin = true;
      if (d.hideCreatorCredit === undefined) d.hideCreatorCredit = Boolean(d.isOfficialSrd) && !d.editorCreditName;
      if (!d.monsters && d.contentPayload?.monsters) d.monsters = d.contentPayload.monsters;
      if (!d.npcs && d.contentPayload?.npcs) d.npcs = d.contentPayload.npcs;
      if (!d.itemsAndSpells && d.contentPayload?.itemsAndSpells) d.itemsAndSpells = d.contentPayload.itemsAndSpells;
      if (!d.locations && d.contentPayload?.locations) d.locations = d.contentPayload.locations;
      if (!d.placeAlbumPhotos && d.contentPayload?.albumPhotos) d.placeAlbumPhotos = d.contentPayload.albumPhotos;
      if (!d.campaignLogs && d.contentPayload?.campaignLogs) d.campaignLogs = d.contentPayload.campaignLogs;
    }

    if (changed) {
      writeJSON('creator_studio_vault.json', raw);
    }

    return {
      creator_dlc: raw.creator_dlc,
      creator_skin_app: raw.creator_skin_app,
      creator_skin_player: raw.creator_skin_player,
      creator_skin_dm: raw.creator_skin_dm,
    };
  },

  getCreatorStudioCatalog(userEmail?: string) {
    const vault = this.getCreatorStudioVault();
    const onlineAppSkin =
      vault.creator_skin_app.find((s: any) => s.isOnlineActive) ||
      vault.creator_skin_app.find((s: any) => s.isDefault) ||
      vault.creator_skin_app[0];
    const onlinePlayerSkin =
      vault.creator_skin_player.find((s: any) => s.isOnlineActive) ||
      vault.creator_skin_player.find((s: any) => s.isDefault) ||
      vault.creator_skin_player[0];
    const onlineDmSkin =
      vault.creator_skin_dm.find((s: any) => s.isOnlineActive) ||
      vault.creator_skin_dm.find((s: any) => s.isDefault) ||
      vault.creator_skin_dm[0];

    let ownedDlcIds = ['dlc-srd-5e-oficial'];
    let ownedSkinIds = ['skin-player-default', 'skin-dm-default'];

    const appSkinIdSet = new Set(vault.creator_skin_app.map((s: any) => s.id));
    const legacySkinIds = new Set([
      'skin-app-default',
      'skin-app-navidad-2026',
      'skin-app-sangre-carmesi',
      'skin-player-crimson-dragon',
      'skin-player-frost-2026',
      'skin-dm-obsidian-throne',
    ]);

    const allUsers = this.getUsers();
    const accountEntitlements: Record<
      string,
      {
        userId: string;
        email: string;
        displayName: string;
        fullTag: string;
        appRole: string;
        ownedDlcIds: string[];
        ownedSkinIds: string[];
      }
    > = {};

    for (const u of allUsers) {
      const uEmail = u.email.trim().toLowerCase();
      const uDlcs = Array.from(new Set(['dlc-srd-5e-oficial', ...(u.ownedDlcIds || [])]));
      const uSkins = Array.from(
        new Set([
          'skin-player-default',
          'skin-dm-default',
          ...(u.ownedSkinIds || []).filter(
            (id: string) => !appSkinIdSet.has(id) && !legacySkinIds.has(id)
          ),
        ])
      );
      accountEntitlements[uEmail] = {
        userId: u.id,
        email: u.email,
        displayName: u.displayName,
        fullTag: `${u.displayName}@${u.userTagId || '123'}`,
        appRole: u.appRole || 'client',
        ownedDlcIds: uDlcs,
        ownedSkinIds: uSkins,
      };
      if (userEmail && uEmail === userEmail.trim().toLowerCase()) {
        ownedDlcIds = uDlcs;
        ownedSkinIds = uSkins;
      }
    }

    const unifiedSkins = [
      ...vault.creator_skin_app.map((s: any) => ({ ...s, scope: 'app', target: 'app' })),
      ...vault.creator_skin_player.map((s: any) => ({ ...s, scope: 'player', target: 'player' })),
      ...vault.creator_skin_dm.map((s: any) => ({ ...s, scope: 'dm', target: 'dm' })),
    ];

    const pendingReviews = [
      ...vault.creator_dlc
        .filter((d: any) => d.reviewStatus === 'pending_review' || Boolean(d.pendingDraft))
        .map((d: any) => ({ kind: 'creator_dlc' as const, item: d })),
      ...vault.creator_skin_app
        .filter((s: any) => s.reviewStatus === 'pending_review' || Boolean(s.pendingDraft))
        .map((s: any) => ({ kind: 'creator_skin_app' as const, item: s })),
      ...vault.creator_skin_player
        .filter((s: any) => s.reviewStatus === 'pending_review' || Boolean(s.pendingDraft))
        .map((s: any) => ({ kind: 'creator_skin_player' as const, item: s })),
      ...vault.creator_skin_dm
        .filter((s: any) => s.reviewStatus === 'pending_review' || Boolean(s.pendingDraft))
        .map((s: any) => ({ kind: 'creator_skin_dm' as const, item: s })),
    ];

    return {
      dlcs: vault.creator_dlc,
      skins: unifiedSkins,
      appSkins: vault.creator_skin_app,
      playerSkins: vault.creator_skin_player,
      dmSkins: vault.creator_skin_dm,
      activeOnlineAppSkinId: onlineAppSkin?.id || 'skin-app-default',
      activeOnlineLobbySkinId: onlineAppSkin?.id || 'skin-app-default',
      activeOnlinePlayerSkinId: onlinePlayerSkin?.id || 'skin-player-default',
      activeOnlineDmSkinId: onlineDmSkin?.id || 'skin-dm-default',
      onlineAppSkin,
      onlinePlayerSkin,
      onlineDmSkin,
      ownedDlcIds,
      ownedSkinIds,
      accountEntitlements,
      pendingReviews,
    };
  },

  saveCreatorStudioItem(
    kind: 'creator_dlc' | 'creator_skin_app' | 'creator_skin_player' | 'creator_skin_dm',
    item: Record<string, any>,
    actorEmail?: string
  ) {
    const vault = this.getCreatorStudioVault();
    const list = Array.isArray(vault[kind]) ? [...vault[kind]] : [];
    const itemId = item.id || `${kind.replace('creator_', '')}-${Date.now()}`;
    const existingIdx = list.findIndex((x: any) => x.id === itemId);
    const existingItem = existingIdx >= 0 ? list[existingIdx] : null;

    const actorUser = actorEmail ? this.findUserByEmail(actorEmail) : undefined;
    const isAdmin =
      !actorEmail ||
      actorEmail.trim().toLowerCase() === 'admin@weroll.app' ||
      actorEmail.trim().toLowerCase() === 'deadplanter@gmail.com' ||
      actorUser?.appRole === 'admin' ||
      actorUser?.role === 'admin';

    // Ownership enforcement: Non-admin creators can only edit their own items
    if (!isAdmin && existingItem) {
      const ownerEmail = (existingItem.authorEmail || '').trim().toLowerCase();
      const ownerTag = (existingItem.authorTag || '').trim().toLowerCase();
      const actorTag = actorUser ? `${actorUser.displayName}@${actorUser.userTagId || '123'}`.toLowerCase() : '';
      const normActor = (actorEmail || '').trim().toLowerCase();
      if (
        existingItem.isDefault ||
        existingItem.isOfficialSrd ||
        (ownerEmail && ownerEmail !== normActor) ||
        (!ownerEmail && ownerTag && actorTag && ownerTag !== actorTag)
      ) {
        throw new Error(
          'Solo el creador original de este paquete/skin o un Administrador puede editarlo.'
        );
      }
    }

    const now = Date.now();
    const scope =
      kind === 'creator_skin_app'
        ? 'app'
        : kind === 'creator_skin_player'
        ? 'player'
        : kind === 'creator_skin_dm'
        ? 'dm'
        : undefined;

    // Normalize DLC contentPayload & top-level arrays so both World Sheet and Creator Studio read them
    let normalizedExtra: Record<string, any> = {};
    if (kind === 'creator_dlc') {
      const monsters = item.monsters || item.contentPayload?.monsters || existingItem?.monsters || [];
      const npcs = item.npcs || item.contentPayload?.npcs || existingItem?.npcs || [];
      const itemsAndSpells =
        item.itemsAndSpells || item.contentPayload?.itemsAndSpells || existingItem?.itemsAndSpells || [];
      const locations = item.locations || item.contentPayload?.locations || existingItem?.locations || [];
      const albumPhotos =
        item.placeAlbumPhotos ||
        item.albumPhotos ||
        item.contentPayload?.albumPhotos ||
        existingItem?.placeAlbumPhotos ||
        [];
      const campaignLogs =
        item.campaignLogs || item.contentPayload?.campaignLogs || existingItem?.campaignLogs || [];
      const folders = item.contentPayload?.folders || existingItem?.contentPayload?.folders || ['DLC / General'];

      normalizedExtra = {
        monsters,
        npcs,
        itemsAndSpells,
        locations,
        placeAlbumPhotos: albumPhotos,
        albumPhotos,
        campaignLogs,
        counts: {
          maps: locations.length,
          albums: albumPhotos.length,
          monsters: monsters.length,
          itemsAndWeapons: itemsAndSpells.length,
          stories: campaignLogs.length,
          npcs: npcs.length,
        },
        contentPayload: {
          ...(existingItem?.contentPayload || {}),
          ...(item.contentPayload || {}),
          monsters,
          npcs,
          itemsAndSpells,
          locations,
          albumPhotos,
          campaignLogs,
          folders,
        },
      };
    } else if (kind === 'creator_skin_player') {
      const tt = item.themeTokens || existingItem?.themeTokens || {};
      normalizedExtra = {
        scope: 'player',
        target: 'player',
        sheetTheme: {
          ...(existingItem?.sheetTheme || {}),
          ...(item.sheetTheme || {}),
          primaryBorderColor: tt.sheetStatBoxBorder || tt.borderOrnamentColor || item.sheetTheme?.primaryBorderColor || '#d97706',
          accentColor: tt.forumAccentColor || item.sheetTheme?.accentColor || '#f59e0b',
          cardFrameStyle: tt.sheetStatBoxStyle || item.sheetTheme?.cardFrameStyle || 'imperial-gold',
          headerGradient: tt.headerBannerBg || item.sheetTheme?.headerGradient || 'linear-gradient(180deg, rgba(24,19,15,0.96), rgba(14,12,10,0.98))',
          titleColor: tt.headerTitleColor || item.sheetTheme?.titleColor || '#fde68a',
          backgroundTextureUrl: tt.sheetBgTextureUrl || item.sheetTheme?.backgroundTextureUrl,
        },
        tarotCardDesign: {
          ...(existingItem?.tarotCardDesign || {}),
          ...(item.tarotCardDesign || {}),
          glowColor: tt.tarotGlowColor || item.tarotCardDesign?.glowColor || 'rgba(245, 158, 11, 0.35)',
          badgeStyle: item.tarotCardDesign?.badgeStyle || 'amber-gold',
          cardBgGradient: tt.deckTarotCardBg || item.tarotCardDesign?.cardBgGradient || 'linear-gradient(180deg, #1b1510 0%, #0f0c09 100%)',
        },
      };
    } else if (kind === 'creator_skin_dm') {
      const tt = item.themeTokens || existingItem?.themeTokens || {};
      normalizedExtra = {
        scope: 'dm',
        target: 'dm',
        worldSheetTheme: {
          ...(existingItem?.worldSheetTheme || {}),
          ...(item.worldSheetTheme || {}),
          panelBgColor: tt.forumPanelBg || item.worldSheetTheme?.panelBgColor || '#120f0c',
          borderGoldTone: tt.borderOrnamentColor || item.worldSheetTheme?.borderGoldTone || '#d97706',
          mapHudFrameStyle: item.worldSheetTheme?.mapHudFrameStyle || 'imperial-atlas',
          headerGradient: tt.headerBannerBg || item.worldSheetTheme?.headerGradient,
          accentColor: tt.forumAccentColor || item.worldSheetTheme?.accentColor || '#f59e0b',
        },
      };
    } else if (kind === 'creator_skin_app') {
      normalizedExtra = {
        scope: 'app',
        target: 'app',
      };
    }

    let updatedItem: Record<string, any>;

    // Review Queue Logic: If a non-admin Creator creates or edits, require Admin review!
    if (!isAdmin) {
      const proposedPayload = {
        ...(existingItem || {}),
        ...item,
        ...normalizedExtra,
        id: itemId,
        authorEmail: existingItem?.authorEmail || actorUser?.email || actorEmail,
        authorName: existingItem?.authorName || actorUser?.displayName || item.authorName || 'Creador',
        authorTag:
          existingItem?.authorTag ||
          (actorUser ? `${actorUser.displayName}@${actorUser.userTagId || '123'}` : item.authorTag || 'Creador'),
        createdByAdmin: false,
        hideCreatorCredit: false,
        editorCreditName:
          item.editorCreditName ||
          existingItem?.editorCreditName ||
          (actorUser ? `${actorUser.displayName}@${actorUser.userTagId || '123'}` : 'Creador de Contenido'),
        customCreditDescription: item.customCreditDescription || item.description || existingItem?.description || '',
        updatedAt: now,
      };

      if (existingItem && existingItem.reviewStatus === 'approved') {
        // Keep live item intact for current users while storing the new update in pendingDraft for Admin review
        updatedItem = {
          ...existingItem,
          reviewStatus: 'pending_review',
          submittedByEmail: actorEmail,
          submittedByName: actorUser?.displayName || actorEmail,
          submittedAt: now,
          pendingDraft: proposedPayload,
          updatedAt: now,
        };
      } else {
        updatedItem = {
          ...proposedPayload,
          reviewStatus: 'pending_review',
          submittedByEmail: actorEmail,
          submittedByName: actorUser?.displayName || actorEmail,
          submittedAt: now,
        };
      }
    } else {
      const hasCustomEditorCredit = Boolean((item.editorCreditName || '').trim());
      updatedItem = {
        ...(existingItem || {}),
        ...item,
        ...normalizedExtra,
        id: itemId,
        ...(scope ? { scope, target: scope } : {}),
        authorEmail: item.authorEmail || existingItem?.authorEmail || actorEmail || 'admin@weroll.app',
        authorName: item.authorName || existingItem?.authorName || actorUser?.displayName || 'Administrador Supremo',
        authorTag:
          item.authorTag ||
          existingItem?.authorTag ||
          (actorUser ? `${actorUser.displayName}@${actorUser.userTagId || 'adm'}` : 'Administrador Supremo@adm'),
        createdByAdmin: existingItem?.createdByAdmin !== undefined ? existingItem.createdByAdmin : true,
        hideCreatorCredit:
          item.hideCreatorCredit !== undefined
            ? Boolean(item.hideCreatorCredit)
            : !hasCustomEditorCredit,
        editorCreditName: (item.editorCreditName || '').trim() || existingItem?.editorCreditName || undefined,
        customCreditDescription:
          (item.customCreditDescription || '').trim() || existingItem?.customCreditDescription || undefined,
        reviewStatus: 'approved',
        pendingDraft: undefined,
        reviewedByEmail: actorEmail || 'admin@weroll.app',
        reviewedAt: now,
        updatedAt: now,
      };
    }

    if (existingIdx >= 0) {
      list[existingIdx] = updatedItem;
    } else {
      list.push(updatedItem);
    }

    vault[kind] = list;
    writeJSON('creator_studio_vault.json', vault);

    // Automatically grant ownership to creator/admin who created it
    if (actorEmail) {
      const user = this.findUserByEmail(actorEmail);
      if (user) {
        if (kind === 'creator_dlc') {
          user.ownedDlcIds = Array.from(new Set([...(user.ownedDlcIds || []), itemId]));
        } else {
          user.ownedSkinIds = Array.from(new Set([...(user.ownedSkinIds || []), itemId]));
        }
        const allUsers = this.getUsers();
        const uIdx = allUsers.findIndex((u) => u.id === user.id);
        if (uIdx >= 0) {
          allUsers[uIdx] = user;
          writeJSON('users.json', allUsers);
        }
      }
    }

    // If an Admin updated an existing approved DLC or Skin, notify all accounts that own it
    if (isAdmin && existingIdx >= 0) {
      this.notifyEntitlementOwnersOfUpdate({
        itemId,
        itemName: updatedItem.name || itemId,
        itemType: kind === 'creator_dlc' ? 'dlc' : 'skin',
        summary: `Se ha publicado una actualización para "${updatedItem.name || itemId}".`,
      });
    }

    this.markMutation(`Creator Studio [${kind}] guardado: ${updatedItem.name || itemId}`);
    this.recordDeltaEntry({
      entityKind: kind,
      entityId: itemId,
      entityLabel: updatedItem.name || itemId,
      actorEmail: actorEmail || 'admin@weroll.app',
      changedFields: Object.keys(item),
      payloadSizeKb: Math.max(0.4, Math.round((JSON.stringify(updatedItem).length / 1024) * 10) / 10),
      summary: `Guardado en Panel de Creador (${kind}): "${updatedItem.name || itemId}"`,
    });

    return updatedItem;
  },

  reviewCreatorStudioItem(params: {
    kind: 'creator_dlc' | 'creator_skin_app' | 'creator_skin_player' | 'creator_skin_dm';
    id: string;
    decision: 'approve' | 'reject';
    reviewNotes?: string;
    adminEmail?: string;
  }) {
    const vault = this.getCreatorStudioVault();
    const list = Array.isArray(vault[params.kind]) ? [...vault[params.kind]] : [];
    const idx = list.findIndex((x: any) => x.id === params.id);
    if (idx === -1) {
      throw new Error('No se encontró el paquete o skin en la cola de revisión.');
    }

    const current = list[idx];
    const now = Date.now();

    if (params.decision === 'approve') {
      const merged = current.pendingDraft
        ? {
            ...current,
            ...current.pendingDraft,
            pendingDraft: undefined,
            reviewStatus: 'approved',
            reviewNotes: params.reviewNotes || 'Aprobado y verificado por Administración.',
            reviewedByEmail: params.adminEmail || 'admin@weroll.app',
            reviewedAt: now,
            updatedAt: now,
          }
        : {
            ...current,
            reviewStatus: 'approved',
            reviewNotes: params.reviewNotes || 'Aprobado y verificado por Administración.',
            reviewedByEmail: params.adminEmail || 'admin@weroll.app',
            reviewedAt: now,
            updatedAt: now,
          };

      list[idx] = merged;
      vault[params.kind] = list;
      writeJSON('creator_studio_vault.json', vault);

      this.notifyEntitlementOwnersOfUpdate({
        itemId: merged.id,
        itemName: merged.name || merged.id,
        itemType: params.kind === 'creator_dlc' ? 'dlc' : 'skin',
        summary: `El Administrador ha revisado y aprobado la última versión de "${merged.name}". ¡Ya está activa en tu cuenta!`,
      });

      this.markMutation(`Revisión aprobada en Creator Studio [${params.kind}]: ${merged.name}`);
      return merged;
    } else {
      const rejected = {
        ...current,
        pendingDraft: undefined,
        reviewStatus: current.pendingDraft ? 'approved' : 'rejected',
        reviewNotes: params.reviewNotes || 'Revisión rechazada por el Administrador.',
        reviewedByEmail: params.adminEmail || 'admin@weroll.app',
        reviewedAt: now,
        updatedAt: now,
      };
      list[idx] = rejected;
      vault[params.kind] = list;
      writeJSON('creator_studio_vault.json', vault);
      this.markMutation(`Revisión rechazada en Creator Studio [${params.kind}]: ${current.name}`);
      return rejected;
    }
  },

  notifyEntitlementOwnersOfUpdate(params: {
    itemId: string;
    itemName: string;
    itemType: 'dlc' | 'skin';
    summary: string;
  }) {
    try {
      const allUsers = this.getUsers();
      const adminUser =
        allUsers.find((u) => u.email.toLowerCase() === 'admin@weroll.app') || allUsers[0];
      if (!adminUser) return;

      for (const u of allUsers) {
        const ownsItem =
          params.itemType === 'dlc'
            ? (u.ownedDlcIds || []).includes(params.itemId)
            : (u.ownedSkinIds || []).includes(params.itemId);
        if (ownsItem && u.id !== adminUser.id) {
          this.sendFriendDirectMessage({
            fromUserId: adminUser.id,
            fromDisplayName: adminUser.displayName,
            fromUserTagId: adminUser.userTagId || 'adm',
            fromFullTag: `${adminUser.displayName}@${adminUser.userTagId || 'adm'}`,
            fromEmail: adminUser.email,
            toUserId: u.id,
            toDisplayName: u.displayName,
            toUserTagId: u.userTagId || '123',
            toFullTag: `${u.displayName}@${u.userTagId || '123'}`,
            toEmail: u.email,
            content: `📦 [Actualización de ${params.itemType === 'dlc' ? 'DLC' : 'Skin'}: ${params.itemName}] ${params.summary}`,
          });
        }
      }
    } catch {
      // Non-blocking notification
    }
  },

  deleteCreatorStudioItem(
    kind: 'creator_dlc' | 'creator_skin_app' | 'creator_skin_player' | 'creator_skin_dm',
    id: string,
    actorEmail?: string
  ): boolean {
    if (
      id === 'dlc-srd-5e-oficial' ||
      id === 'skin-app-default' ||
      id === 'skin-player-default' ||
      id === 'skin-dm-default'
    ) {
      throw new Error('No se puede eliminar el paquete o skin base por defecto del sistema.');
    }
    const vault = this.getCreatorStudioVault();
    const list = Array.isArray(vault[kind]) ? vault[kind] : [];
    const target = list.find((x: any) => x.id === id);
    if (!target) return false;

    const actorUser = actorEmail ? this.findUserByEmail(actorEmail) : undefined;
    const isAdmin =
      !actorEmail ||
      actorEmail.trim().toLowerCase() === 'admin@weroll.app' ||
      actorEmail.trim().toLowerCase() === 'deadplanter@gmail.com' ||
      actorUser?.appRole === 'admin' ||
      actorUser?.role === 'admin';

    if (!isAdmin) {
      const ownerEmail = (target.authorEmail || '').trim().toLowerCase();
      if (ownerEmail && ownerEmail !== (actorEmail || '').trim().toLowerCase()) {
        throw new Error('Solo el creador original o un Administrador puede eliminar este elemento.');
      }
    }

    const filtered = list.filter((x: any) => x.id !== id);
    vault[kind] = filtered;
    writeJSON('creator_studio_vault.json', vault);

    const settings = this.getHostSettings();
    if (kind === 'creator_skin_app' && (settings.activeAppSkinId === id || settings.activeOnlineLobbySkinId === id)) {
      this.saveHostSettings(
        { activeAppSkinId: 'skin-app-default', activeOnlineLobbySkinId: 'skin-app-default' },
        { silentSync: true }
      );
    } else if (kind === 'creator_skin_player' && settings.activeOnlinePlayerSkinId === id) {
      this.saveHostSettings({ activeOnlinePlayerSkinId: 'skin-player-default' }, { silentSync: true });
    } else if (kind === 'creator_skin_dm' && settings.activeOnlineDmSkinId === id) {
      this.saveHostSettings({ activeOnlineDmSkinId: 'skin-dm-default' }, { silentSync: true });
    }

    this.markMutation(`Elemento eliminado de Creator Studio [${kind}]: ${id} por ${actorEmail || 'Admin'}`);
    return true;
  },

  setActiveOnlineAppSkin(
    skinId: string,
    actorEmail?: string,
    scopeOverride?: 'app' | 'player' | 'dm'
  ) {
    const vault = this.getCreatorStudioVault();
    const inApp = vault.creator_skin_app.find((s: any) => s.id === skinId);
    const inPlayer = vault.creator_skin_player.find((s: any) => s.id === skinId);
    const inDm = vault.creator_skin_dm.find((s: any) => s.id === skinId);

    const resolvedScope: 'app' | 'player' | 'dm' =
      scopeOverride || (inPlayer ? 'player' : inDm ? 'dm' : 'app');

    if (resolvedScope === 'player') {
      const target = inPlayer || inApp;
      if (!target) throw new Error('La Skin de Jugador seleccionada no existe.');
      for (const s of vault.creator_skin_player) {
        s.isOnlineActive = s.id === skinId;
        s.isOnlineDefault = s.id === skinId;
      }
      writeJSON('creator_studio_vault.json', vault);
      this.saveHostSettings(
        { activeOnlinePlayerSkinId: skinId },
        { mutationReason: `Skin Online de Jugador cambiada a "${target.name}" por ${actorEmail || 'Admin'}` }
      );
      return target;
    }

    if (resolvedScope === 'dm') {
      const target = inDm || inApp;
      if (!target) throw new Error('La Skin de Dungeon Master seleccionada no existe.');
      for (const s of vault.creator_skin_dm) {
        s.isOnlineActive = s.id === skinId;
        s.isOnlineDefault = s.id === skinId;
      }
      writeJSON('creator_studio_vault.json', vault);
      this.saveHostSettings(
        { activeOnlineDmSkinId: skinId },
        { mutationReason: `Skin Online de DM cambiada a "${target.name}" por ${actorEmail || 'Admin'}` }
      );
      return target;
    }

    const target = inApp;
    if (!target) {
      throw new Error('La Skin de Lobby/App seleccionada no existe.');
    }
    for (const s of vault.creator_skin_app) {
      s.isOnlineActive = s.id === skinId;
      s.isOnlineDefault = s.id === skinId;
    }
    writeJSON('creator_studio_vault.json', vault);
    this.saveHostSettings(
      { activeAppSkinId: skinId, activeOnlineLobbySkinId: skinId },
      { mutationReason: `Skin Online del Lobby cambiada a "${target.name}" por ${actorEmail || 'Admin'}` }
    );
    return target;
  },

  promoteAppSkinToTarget(params: {
    appSkinId: string;
    targetKind: 'creator_skin_player' | 'creator_skin_dm';
    customName?: string;
    claimCode?: string;
    seasonTag?: string;
    availableFrom?: string;
    availableUntil?: string;
    editorCreditName?: string;
    customCreditDescription?: string;
    hideCreatorCredit?: boolean;
    actorEmail?: string;
  }) {
    const vault = this.getCreatorStudioVault();
    const allSkins = [
      ...vault.creator_skin_app,
      ...vault.creator_skin_player,
      ...vault.creator_skin_dm,
    ];
    const sourceSkin = allSkins.find((s: any) => s.id === params.appSkinId);
    if (!sourceSkin) {
      throw new Error('No se encontró la Skin de origen.');
    }

    const tokens = sourceSkin.themeTokens || {};
    const newId = `${params.targetKind === 'creator_skin_player' ? 'skin-player' : 'skin-dm'}-${Date.now()}`;
    const finalName =
      (params.customName || '').trim() ||
      `${sourceSkin.name} (${params.targetKind === 'creator_skin_player' ? 'Edición Jugador' : 'Edición DM'})`;
    const customCredit = (params.editorCreditName || '').trim();
    const customDesc =
      (params.customCreditDescription || '').trim() ||
      sourceSkin.customCreditDescription ||
      sourceSkin.description;

    if (params.targetKind === 'creator_skin_player') {
      const newPlayerSkin = {
        id: newId,
        name: finalName,
        scope: 'player',
        target: 'player',
        authorTag: customCredit || sourceSkin.authorTag || 'Administrador Supremo@adm',
        authorName: customCredit || sourceSkin.authorName || 'Administrador Supremo',
        editorCreditName: customCredit || undefined,
        customCreditDescription: customDesc,
        hideCreatorCredit: params.hideCreatorCredit !== undefined ? params.hideCreatorCredit : !customCredit,
        createdByAdmin: true,
        reviewStatus: 'approved',
        description: customDesc || `Convertida desde "${sourceSkin.name}". Estiliza la Player Sheet, el Modo Mapa y la Carta Tarot del personaje.`,
        seasonTag: params.seasonTag || sourceSkin.seasonTag || 'Especial',
        claimCode: (params.claimCode || '').trim() || `SKIN-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        availableFrom: params.availableFrom || sourceSkin.availableFrom,
        availableUntil: params.availableUntil || sourceSkin.availableUntil,
        isDefault: false,
        isAcquirable: true,
        themeTokens: { ...tokens },
        sheetTheme: {
          primaryBorderColor: tokens.sheetStatBoxBorder || tokens.forumAccentColor || '#f59e0b',
          accentColor: tokens.forumAccentColor || '#f59e0b',
          cardFrameStyle: tokens.sheetStatBoxStyle || 'promoted-app-skin',
          headerGradient: tokens.headerBannerBg || 'linear-gradient(180deg, rgba(24,19,15,0.96), rgba(14,12,10,0.98))',
          titleColor: tokens.headerTitleColor || '#fde68a',
        },
        tarotCardDesign: {
          glowColor: tokens.tarotGlowColor || tokens.borderOrnamentColor || 'rgba(245, 158, 11, 0.45)',
          badgeStyle: 'custom-season',
          cardBgGradient: tokens.deckTarotCardBg || tokens.charactersSectionBg || 'linear-gradient(180deg, #1b1510 0%, #0f0c09 100%)',
        },
        updatedAt: Date.now(),
      };
      return this.saveCreatorStudioItem('creator_skin_player', newPlayerSkin, params.actorEmail);
    } else {
      const newDmSkin = {
        id: newId,
        name: finalName,
        scope: 'dm',
        target: 'dm',
        authorTag: customCredit || sourceSkin.authorTag || 'Administrador Supremo@adm',
        authorName: customCredit || sourceSkin.authorName || 'Administrador Supremo',
        editorCreditName: customCredit || undefined,
        customCreditDescription: customDesc,
        hideCreatorCredit: params.hideCreatorCredit !== undefined ? params.hideCreatorCredit : !customCredit,
        createdByAdmin: true,
        reviewStatus: 'approved',
        description: customDesc || `Convertida desde "${sourceSkin.name}". Personaliza el World Sheet del Dungeon Master.`,
        seasonTag: params.seasonTag || sourceSkin.seasonTag || 'Especial',
        claimCode: (params.claimCode || '').trim() || `DMSKIN-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        availableFrom: params.availableFrom || sourceSkin.availableFrom,
        availableUntil: params.availableUntil || sourceSkin.availableUntil,
        isDefault: false,
        isAcquirable: true,
        themeTokens: { ...tokens },
        worldSheetTheme: {
          panelBgColor: tokens.forumPanelBg || '#120f0c',
          borderGoldTone: tokens.forumAccentColor || '#d97706',
          mapHudFrameStyle: 'promoted-dm-skin',
          headerGradient: tokens.headerBannerBg,
          accentColor: tokens.forumAccentColor || '#f59e0b',
        },
        updatedAt: Date.now(),
      };
      return this.saveCreatorStudioItem('creator_skin_dm', newDmSkin, params.actorEmail);
    }
  },

  grantOrRevokeEntitlement(params: {
    targetEmail: string;
    itemId: string;
    itemType: 'dlc' | 'skin';
    action: 'grant' | 'revoke';
    actorEmail?: string;
  }) {
    const users = this.getUsers();
    const normEmail = (params.targetEmail || '').trim().toLowerCase();
    const idx = users.findIndex((u) => u.email.trim().toLowerCase() === normEmail);
    if (idx === -1) {
      throw new Error(`No se encontró ninguna cuenta registrada con el correo "${params.targetEmail}".`);
    }

    const user = users[idx];
    if (params.itemType === 'dlc') {
      const list = new Set(['dlc-srd-5e-oficial', ...(user.ownedDlcIds || [])]);
      if (params.action === 'grant') list.add(params.itemId);
      else if (params.itemId !== 'dlc-srd-5e-oficial') list.delete(params.itemId);
      user.ownedDlcIds = Array.from(list);
    } else {
      const list = new Set(['skin-app-default', 'skin-player-default', 'skin-dm-default', ...(user.ownedSkinIds || [])]);
      if (params.action === 'grant') list.add(params.itemId);
      else if (!['skin-app-default', 'skin-player-default', 'skin-dm-default'].includes(params.itemId)) {
        list.delete(params.itemId);
      }
      user.ownedSkinIds = Array.from(list);
    }

    users[idx] = user;
    this.saveUsers(
      users,
      `Licencia en la nube (${params.itemType.toUpperCase()} ${params.itemId}) ${params.action === 'grant' ? 'otorgada a' : 'revocada de'} ${user.email}`
    );
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      ownedDlcIds: user.ownedDlcIds,
      ownedSkinIds: user.ownedSkinIds,
    };
  },

  claimEntitlementByCode(params: { userEmail: string; code: string }) {
    const normEmail = (params.userEmail || '').trim().toLowerCase();
    const cleanCode = (params.code || '').trim().toUpperCase();
    if (!normEmail || !cleanCode) {
      throw new Error('Debes iniciar sesión e ingresar un código de activación válido.');
    }

    const users = this.getUsers();
    const uIdx = users.findIndex((u) => u.email.trim().toLowerCase() === normEmail);
    if (uIdx === -1) {
      throw new Error('Tu cuenta de usuario no fue encontrada en el servidor.');
    }

    const vault = this.getCreatorStudioVault();
    const matchedDlc = vault.creator_dlc.find(
      (d: any) =>
        d.reviewStatus !== 'rejected' &&
        ((d.claimCode || '').trim().toUpperCase() === cleanCode ||
          (d.acquisitionCode || '').trim().toUpperCase() === cleanCode ||
          d.id.toUpperCase() === cleanCode)
    );
    const matchedSkin = [
      ...vault.creator_skin_player,
      ...vault.creator_skin_dm,
      ...vault.creator_skin_app,
    ].find(
      (s: any) =>
        s.reviewStatus !== 'rejected' &&
        ((s.claimCode || '').trim().toUpperCase() === cleanCode ||
          (s.acquisitionCode || '').trim().toUpperCase() === cleanCode ||
          s.id.toUpperCase() === cleanCode)
    );

    if (!matchedDlc && !matchedSkin) {
      throw new Error(`El código "${cleanCode}" no corresponde a ningún DLC o Skin activa.`);
    }

    const targetItem = matchedDlc || matchedSkin;
    const nowIso = new Date().toISOString().slice(0, 10);
    if (targetItem.availableUntil && nowIso > targetItem.availableUntil) {
      throw new Error(
        `La ventana de temporada para "${targetItem.name}" expiró el ${targetItem.availableUntil}. Solo un Administrador puede otorgarla manualmente.`
      );
    }

    if (matchedDlc) {
      return {
        itemType: 'dlc' as const,
        item: matchedDlc,
        ...this.grantOrRevokeEntitlement({
          targetEmail: normEmail,
          itemId: matchedDlc.id,
          itemType: 'dlc',
          action: 'grant',
        }),
      };
    } else {
      return {
        itemType: 'skin' as const,
        item: matchedSkin,
        ...this.grantOrRevokeEntitlement({
          targetEmail: normEmail,
          itemId: matchedSkin.id,
          itemType: 'skin',
          action: 'grant',
        }),
      };
    }
  },

  // --- OTP EMAIL VERIFICATION FOR NEW REGISTRATIONS ONLY ---
  generateRegistrationOtp(email: string): {
    email: string;
    alreadyRegistered: boolean;
    code?: string;
    expiresAt?: number;
  } {
    const normEmail = (email || '').trim().toLowerCase();
    if (!normEmail || !normEmail.includes('@')) {
      throw new Error('Ingresa un correo electrónico válido para enviar el código OTP.');
    }

    // Existing registered accounts are ALREADY verified and never need OTP
    const existingUser = this.findUserByEmail(normEmail);
    if (existingUser) {
      return {
        email: normEmail,
        alreadyRegistered: true,
      };
    }

    const otpStore = readJSON<
      Record<
        string,
        {
          email: string;
          code: string;
          createdAt: number;
          expiresAt: number;
          verified: boolean;
        }
      >
    >('otp_verifications.json', {});

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes

    otpStore[normEmail] = {
      email: normEmail,
      code,
      createdAt: now,
      expiresAt,
      verified: false,
    };

    writeJSON('otp_verifications.json', otpStore);
    return {
      email: normEmail,
      alreadyRegistered: false,
      code,
      expiresAt,
    };
  },

  verifyRegistrationOtp(email: string, code: string): {
    verified: boolean;
    alreadyRegistered?: boolean;
  } {
    const normEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (this.findUserByEmail(normEmail)) {
      return { verified: true, alreadyRegistered: true };
    }

    const otpStore = readJSON<
      Record<
        string,
        {
          email: string;
          code: string;
          createdAt: number;
          expiresAt: number;
          verified: boolean;
        }
      >
    >('otp_verifications.json', {});

    const entry = otpStore[normEmail];
    if (!entry) {
      throw new Error('No se encontró un código OTP activo para este correo. Solicita uno nuevo.');
    }
    if (Date.now() > entry.expiresAt) {
      throw new Error('El código OTP ha expirado. Solicita un nuevo código de 6 dígitos.');
    }
    if (entry.code !== cleanCode) {
      throw new Error('El código OTP de 6 dígitos ingresado no es correcto.');
    }

    entry.verified = true;
    otpStore[normEmail] = entry;
    writeJSON('otp_verifications.json', otpStore);
    return { verified: true };
  },

  getOtpArchitectureSummary() {
    const users = this.getUsers();
    const otpStore = readJSON<Record<string, any>>('otp_verifications.json', {});
    const entries = Object.values(otpStore);
    return {
      mode: 'Verificación OTP de 6 dígitos exclusiva para nuevos registros (cuentas existentes exentas)',
      existingExemptAccountsCount: users.length,
      totalOtpsIssued: entries.length,
      verifiedNewEmailsCount: entries.filter((e: any) => e.verified).length,
      ttlMinutes: 15,
    };
  },

  getCreatorStudioArchitecturePreview(): {
    modules: Array<{
      id: string;
      deltaKey: string;
      title: string;
      subtitle: string;
      targetScreens: string[];
      sampleFields: string[];
      itemsCount: number;
    }>;
  } {
    const creatorStore = this.getCreatorStudioVault();
    return {
      modules: [
        {
          id: 'player_skin',
          deltaKey: 'creator_skin_player',
          title: '1. Diseño de Skin de Jugador (Sheet + Modo Mapa + Carta Tarot)',
          subtitle: 'Personaliza tamaños de iconos, fondos, cajas de características, fuente, barra de vida, Mazos de Juego, Rincón del Aventurero, Modo Mapa y Carta Tarot.',
          targetScreens: ['Player Sheet (Completa)', 'Modo Mapa de Jugador', 'Carta Tarot (Lobby & Mesa)'],
          sampleFields: ['themeTokens.sheetIconScale', 'themeTokens.sheetHpBarStyle', 'themeTokens.mapModeDmHoodBg', 'themeTokens.tarotGlowColor'],
          itemsCount: (creatorStore.creator_skin_player || []).length || 1,
        },
        {
          id: 'dm_skin',
          deltaKey: 'creator_skin_dm',
          title: '2. Diseño de Skin de DM (Pantalla de DM)',
          subtitle: 'Personaliza el World Sheet del Dungeon Master y la interfaz visual cuando el DM entra al Modo Mapa en Vivo.',
          targetScreens: ['Pantalla del DM (World Sheet)', 'Modo Mapa en Vivo (HUD del DM)'],
          sampleFields: ['dmSkinId', 'worldSheetTheme.panelBgColor', 'worldSheetTheme.borderGoldTone', 'worldSheetTheme.mapHudFrameStyle'],
          itemsCount: (creatorStore.creator_skin_dm || []).length || 1,
        },
        {
          id: 'dlc_pack',
          deltaKey: 'creator_dlc',
          title: '3. Paquetes de DLC (Expansiones Inyectables con Revisión Admin)',
          subtitle: 'Paquetes modulares con flujo de aprobación administrativa que inyectan mapas, álbumes, monstruos, armas/objetos, PNJs e historias en un World Sheet.',
          targetScreens: ['Atlas del Mundo', 'Álbum de Fotos', 'Bestiario DM', 'Armería & Tesoros', 'Diario & Crónicas'],
          sampleFields: ['installedDlcIds', 'reviewStatus', 'pendingDraft', 'monsters[]', 'itemsAndSpells[]', 'campaignLogs[]'],
          itemsCount: (creatorStore.creator_dlc || []).length || 1,
        },
        {
          id: 'app_skin',
          deltaKey: 'creator_skin_app',
          title: '4. 3 Skins Online Default (Lobby, Jugador y Dungeon Master)',
          subtitle: 'Control de las 3 skins online activas por defecto para toda la comunidad, duplicación, edición profunda y conversión a skins permanentes con créditos personalizables.',
          targetScreens: ['Skin Online del Lobby', 'Skin Online del Jugador', 'Skin Online del Dungeon Master'],
          sampleFields: ['activeOnlineLobbySkinId', 'activeOnlinePlayerSkinId', 'activeOnlineDmSkinId', 'editorCreditName'],
          itemsCount: (creatorStore.creator_skin_app || []).length || 3,
        },
      ],
    };
  },
};

