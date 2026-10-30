import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  auth,
  isFirebaseAvailable,
  handleFirestoreError,
  OperationType,
} from '../firebase/config';
import type {
  Character5e,
  DMWorkspace,
  HostSettings,
  WorldSheetSummary,
  AppSkinRecord,
  ForumPost,
  ForumComment,
  FriendDirectMessage,
} from '../types/dnd';
import {
  loadCharacters as loadCharactersLocal,
  saveCharacters as saveCharactersLocal,
  loadDMWorkspace as loadDMWorkspaceLocal,
  saveDMWorkspace as saveDMWorkspaceLocal,
  loadHostSettings as loadHostSettingsLocal,
  saveHostSettings as saveHostSettingsLocal,
  loadAuthUser as loadAuthUserLocal,
  saveAuthUser as saveAuthUserLocal,
  AuthSessionUser,
} from '../utils/storage';

/**
 * Service Layer / Adapter entre WeRoll 5E y Firebase Firestore.
 *
 * Características de Resiliencia:
 * 1. Multi-cuenta y GitHub Safe: Si la app se clona o se ejecuta en otra cuenta
 *    de AI Studio donde Firebase aún no está provisionado o no hay sesión de usuario,
 *    opera de forma transparente con el almacenamiento local sin romper la app.
 * 2. Persistencia Asíncrona Dual: Guarda inmediatamente en caché local para respuesta
 *    instantánea y sincroniza en paralelo con Firestore en segundo plano.
 * 3. Escucha en Tiempo Real: Métodos de subscripción (onSnapshot) para sincronizar
 *    personajes, mundos del DM y perfiles entre pestañas y dispositivos.
 */

// ==========================================
// 1. SERVICIO DE PERSONAJES (CHARACTERS)
// ==========================================

export interface FirestoreCharacterDoc {
  id: string;
  ownerId: string;
  name: string;
  level: number;
  race: string;
  class: string;
  currentHp: number;
  maxHp: number;
  data: string; // JSON serializado de Character5e
  createdAt?: string;
  updatedAt: string;
}

/**
 * Guarda una lista de personajes en Firestore y en caché local.
 */
export async function saveCharactersAsync(
  characters: Character5e[],
  currentUser?: AuthSessionUser | null
): Promise<void> {
  // 1. Siempre guardar en caché local primero para cero latencia y tolerancia a fallos
  saveCharactersLocal(characters);

  if (!isFirebaseAvailable()) return;

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) return;

  try {
    const promises = characters.map(async (char) => {
      const cleanLevel = Math.max(1, Math.min(20, Math.floor(char.level || 1)));
      const charDocData: FirestoreCharacterDoc = {
        id: char.id,
        ownerId: currentUid,
        name: (char.name || 'Sin Nombre').slice(0, 100),
        level: cleanLevel,
        race: (char.race || 'Humano').slice(0, 100),
        class: (char.characterClass || 'Guerrero').slice(0, 100),
        currentHp: char.currentHp ?? 10,
        maxHp: char.maxHp ?? 10,
        data: JSON.stringify(char),
        updatedAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'characters', char.id);
      await setDoc(docRef, charDocData, { merge: true });
    });

    await Promise.all(promises);
  } catch (error) {
    console.warn('[FirebaseService] Sincronización en la nube diferida:', error);
  }
}

/**
 * Guarda un solo personaje en Firestore y en caché local.
 */
export async function saveSingleCharacterAsync(
  character: Character5e,
  currentUser?: AuthSessionUser | null
): Promise<void> {
  const currentList = loadCharactersLocal();
  const updatedList = [
    ...currentList.filter((c) => c.id !== character.id),
    character,
  ];
  await saveCharactersAsync(updatedList, currentUser);
}

/**
 * Carga personajes combinando Firestore y la caché local.
 */
export async function loadCharactersAsync(
  currentUser?: AuthSessionUser | null
): Promise<Character5e[]> {
  const localChars = loadCharactersLocal();

  if (!isFirebaseAvailable()) return localChars;

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) return localChars;

  try {
    const q = query(
      collection(db, 'characters'),
      where('ownerId', '==', currentUid)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Si en Firestore está vacío pero tenemos locales, subimos los locales
      if (localChars.length > 0) {
        saveCharactersAsync(localChars, currentUser).catch(() => {});
      }
      return localChars;
    }

    const firestoreChars: Character5e[] = [];
    snapshot.forEach((docSnap) => {
      const raw = docSnap.data() as FirestoreCharacterDoc;
      if (raw.data) {
        try {
          const parsed = JSON.parse(raw.data);
          firestoreChars.push(parsed);
        } catch {}
      }
    });

    if (firestoreChars.length > 0) {
      saveCharactersLocal(firestoreChars);
      return firestoreChars;
    }
    return localChars;
  } catch (error) {
    console.warn('[FirebaseService] Error leyendo personajes en Firestore; usando copia local:', error);
    return localChars;
  }
}

/**
 * Elimina un personaje en Firestore y en caché local.
 */
export async function deleteCharacterAsync(
  characterId: string,
  currentUser?: AuthSessionUser | null
): Promise<void> {
  const currentList = loadCharactersLocal();
  const filtered = currentList.filter((c) => c.id !== characterId);
  saveCharactersLocal(filtered);

  if (!isFirebaseAvailable()) return;

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) return;

  try {
    const docRef = doc(db, 'characters', characterId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('[FirebaseService] Error al eliminar personaje en Firestore:', error);
  }
}

/**
 * Escucha cambios en tiempo real en los personajes del usuario.
 */
export function subscribeToCharacters(
  onUpdate: (characters: Character5e[]) => void,
  currentUser?: AuthSessionUser | null
): Unsubscribe {
  if (!isFirebaseAvailable()) {
    return () => {};
  }

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) {
    return () => {};
  }

  const q = query(
    collection(db, 'characters'),
    where('ownerId', '==', currentUid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chars: Character5e[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as FirestoreCharacterDoc;
        if (d.data) {
          try {
            chars.push(JSON.parse(d.data));
          } catch {}
        }
      });
      if (chars.length > 0) {
        saveCharactersLocal(chars);
        onUpdate(chars);
      }
    },
    (err) => {
      console.warn('[FirebaseService] Listener de personajes cerrado o sin permisos:', err.message);
    }
  );
}

// ==========================================
// 2. SERVICIO DEL DUNGEON MASTER & MUNDOS
// ==========================================

export interface FirestoreCampaignDoc {
  id: string;
  dmUserId: string;
  title: string;
  description: string;
  data: string; // JSON serializado de DMWorkspace
  createdAt?: string;
  updatedAt: string;
}

/**
 * Guarda el espacio de trabajo del DM en Firestore y en local.
 */
export async function saveDMWorkspaceAsync(
  workspace: DMWorkspace,
  currentUser?: AuthSessionUser | null,
  worldId?: string
): Promise<void> {
  saveDMWorkspaceLocal(workspace);

  if (!isFirebaseAvailable()) return;

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) return;

  const campaignId = worldId || `dm_${currentUid}`;

  try {
    const campaignData: FirestoreCampaignDoc = {
      id: campaignId,
      dmUserId: currentUid,
      title: (workspace.dmName || 'Mundo de Campaña').slice(0, 150),
      description: (workspace.currentQuest || 'Aventura Activa').slice(0, 4000),
      data: JSON.stringify(workspace),
      updatedAt: new Date().toISOString(),
    };

    const docRef = doc(db, 'campaigns', campaignId);
    await setDoc(docRef, campaignData, { merge: true });
  } catch (error) {
    console.warn('[FirebaseService] Sincronización del DM en Firestore diferida:', error);
  }
}

/**
 * Carga el espacio de trabajo del DM combinando Firestore y local.
 */
export async function loadDMWorkspaceAsync(
  currentUser?: AuthSessionUser | null,
  worldId?: string
): Promise<DMWorkspace> {
  const localWs = loadDMWorkspaceLocal();

  if (!isFirebaseAvailable()) return localWs;

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) return localWs;

  const campaignId = worldId || `dm_${currentUid}`;

  try {
    const docRef = doc(db, 'campaigns', campaignId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const cDoc = snap.data() as FirestoreCampaignDoc;
      if (cDoc.data) {
        const parsed = JSON.parse(cDoc.data);
        saveDMWorkspaceLocal(parsed);
        return parsed;
      }
    }
    return localWs;
  } catch (error) {
    console.warn('[FirebaseService] Error cargando DM Workspace de Firestore:', error);
    return localWs;
  }
}

/**
 * Escucha cambios en tiempo real en la campaña del DM.
 */
export function subscribeToDMWorkspace(
  worldId: string,
  onUpdate: (workspace: DMWorkspace) => void,
  currentUser?: AuthSessionUser | null
): Unsubscribe {
  if (!isFirebaseAvailable()) return () => {};

  const currentUid = auth?.currentUser?.uid || currentUser?.id;
  if (!currentUid) return () => {};

  const campaignId = worldId || `dm_${currentUid}`;
  const docRef = doc(db, 'campaigns', campaignId);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const cDoc = snap.data() as FirestoreCampaignDoc;
        if (cDoc.data) {
          try {
            const parsed = JSON.parse(cDoc.data);
            saveDMWorkspaceLocal(parsed);
            onUpdate(parsed);
          } catch {}
        }
      }
    },
    (err) => {
      console.warn('[FirebaseService] Listener de campaña cerrado:', err.message);
    }
  );
}

// ==========================================
// 3. SERVICIO DE PERFIL DE USUARIO
// ==========================================

export interface FirestoreUserDoc {
  id: string;
  email: string;
  displayName: string;
  role: 'player' | 'dm' | 'moderator';
  playerType?: 'player' | 'dm' | 'both';
  userTagId?: string;
  avatarUrl?: string;
  status?: 'pending' | 'approved' | 'rejected';
  isGoogleLinked?: boolean;
  createdAt?: string;
  updatedAt: string;
}

/**
 * Guarda el perfil del usuario en Firestore y en caché local.
 */
export async function saveUserProfileAsync(user: AuthSessionUser): Promise<void> {
  saveAuthUserLocal(user);

  if (!isFirebaseAvailable()) return;

  const uid = auth?.currentUser?.uid || user.id;
  if (!uid) return;

  try {
    const mappedRole =
      user.role === 'admin'
        ? 'moderator'
        : user.role === 'creator'
        ? 'dm'
        : (user.role as 'player' | 'dm' | 'moderator');

    const userDoc: FirestoreUserDoc = {
      id: uid,
      email: user.email,
      displayName: user.displayName.slice(0, 100),
      role: mappedRole,
      playerType: user.playerType || 'player',
      userTagId: (user.userTagId || '123').slice(0, 10),
      avatarUrl: (user.avatarUrl || '').slice(0, 2048),
      status: user.status || 'approved',
      isGoogleLinked: Boolean(user.isGoogleLinked),
      updatedAt: new Date().toISOString(),
    };

    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, userDoc, { merge: true });
  } catch (error) {
    console.warn('[FirebaseService] Error guardando perfil de usuario en Firestore:', error);
  }
}

/**
 * Carga el perfil del usuario desde Firestore si está disponible.
 */
export async function loadUserProfileAsync(userId: string): Promise<FirestoreUserDoc | null> {
  if (!isFirebaseAvailable() || !userId) return null;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUserDoc;
    }
    return null;
  } catch (error) {
    console.warn('[FirebaseService] Error cargando perfil de usuario en Firestore:', error);
    return null;
  }
}

// ==========================================
// 4. SERVICIO DE SKINS VISUALES (SKINS)
// ==========================================

export interface FirestoreSkinDoc {
  id: string;
  name: string;
  target?: string;
  scope?: string;
  authorId?: string;
  authorName?: string;
  data: string; // JSON serializado de AppSkinRecord
  createdAt?: string;
  updatedAt: string;
}

/**
 * Guarda una lista de skins en Firestore y en caché.
 */
export async function saveSkinsAsync(
  skins: AppSkinRecord[],
  currentUser?: AuthSessionUser | null
): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const promises = skins.map(async (skin) => {
      const skinDocData: FirestoreSkinDoc = {
        id: skin.id,
        name: (skin.name || 'Skin Personalizada').slice(0, 100),
        target: skin.target || skin.scope || 'player',
        scope: skin.scope || skin.target || 'player',
        authorId: currentUser?.id || skin.authorEmail || 'system',
        authorName: skin.authorName || currentUser?.displayName || 'Creador',
        data: JSON.stringify(skin),
        updatedAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'skins', skin.id);
      await setDoc(docRef, skinDocData, { merge: true });
    });

    await Promise.all(promises);
  } catch (error) {
    console.warn('[FirebaseService] Sincronización de skins en Firestore diferida:', error);
  }
}

/**
 * Carga skins desde Firestore.
 */
export async function loadSkinsAsync(
  currentUser?: AuthSessionUser | null
): Promise<AppSkinRecord[]> {
  if (!isFirebaseAvailable()) return [];

  try {
    const snapshot = await getDocs(collection(db, 'skins'));
    const loadedSkins: AppSkinRecord[] = [];
    snapshot.forEach((snap) => {
      const raw = snap.data() as FirestoreSkinDoc;
      if (raw.data) {
        try {
          loadedSkins.push(JSON.parse(raw.data));
        } catch {}
      }
    });
    return loadedSkins;
  } catch (error) {
    console.warn('[FirebaseService] Error leyendo skins de Firestore:', error);
    return [];
  }
}

/**
 * Escucha cambios en tiempo real en las skins de Firestore.
 */
export function subscribeToSkins(
  onUpdate: (skins: AppSkinRecord[]) => void,
  currentUser?: AuthSessionUser | null
): Unsubscribe {
  if (!isFirebaseAvailable()) return () => {};

  return onSnapshot(
    collection(db, 'skins'),
    (snapshot) => {
      const skins: AppSkinRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as FirestoreSkinDoc;
        if (d.data) {
          try {
            skins.push(JSON.parse(d.data));
          } catch {}
        }
      });
      if (skins.length > 0) {
        onUpdate(skins);
      }
    },
    (err) => {
      console.warn('[FirebaseService] Listener de skins cerrado:', err.message);
    }
  );
}

// ==========================================
// 5. SERVICIO DEL FORO WEROLL (POSTS & COMENTARIOS)
// ==========================================

export interface FirestoreForumPostDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  title: string;
  content: string;
  category: string;
  flair?: string;
  upvotes: number;
  commentsCount: number;
  pinned?: boolean;
  data: string; // JSON serializado de ForumPost
  createdAt?: string;
  updatedAt: string;
}

/**
 * Guarda publicaciones del foro en Firestore.
 */
export async function saveForumPostsAsync(posts: ForumPost[]): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const promises = posts.map(async (p) => {
      const postDoc: FirestoreForumPostDoc = {
        id: p.id,
        authorId: p.authorEmail || 'anon',
        authorName: (p.authorName || 'Aventurero').slice(0, 100),
        authorEmail: p.authorEmail || '',
        title: (p.title || 'Publicación').slice(0, 200),
        content: (p.content || '').slice(0, 10000),
        category: p.category || 'general',
        flair: p.flair,
        upvotes: p.upvotes || 0,
        commentsCount: p.commentsCount || 0,
        pinned: Boolean(p.pinned),
        data: JSON.stringify(p),
        updatedAt: new Date().toISOString(),
      };
      const docRef = doc(db, 'forumPosts', p.id);
      await setDoc(docRef, postDoc, { merge: true });
    });

    await Promise.all(promises);
  } catch (error) {
    console.warn('[FirebaseService] Error guardando foro en Firestore:', error);
  }
}

/**
 * Carga publicaciones del foro desde Firestore.
 */
export async function loadForumPostsAsync(): Promise<ForumPost[]> {
  if (!isFirebaseAvailable()) return [];

  try {
    const snap = await getDocs(collection(db, 'forumPosts'));
    const posts: ForumPost[] = [];
    snap.forEach((docSnap) => {
      const raw = docSnap.data() as FirestoreForumPostDoc;
      if (raw.data) {
        try {
          posts.push(JSON.parse(raw.data));
        } catch {}
      }
    });
    return posts;
  } catch (error) {
    console.warn('[FirebaseService] Error leyendo posts del foro en Firestore:', error);
    return [];
  }
}

/**
 * Escucha cambios en tiempo real en los posts del foro.
 */
export function subscribeToForumPosts(onUpdate: (posts: ForumPost[]) => void): Unsubscribe {
  if (!isFirebaseAvailable()) return () => {};

  return onSnapshot(
    collection(db, 'forumPosts'),
    (snap) => {
      const posts: ForumPost[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as FirestoreForumPostDoc;
        if (d.data) {
          try {
            posts.push(JSON.parse(d.data));
          } catch {}
        }
      });
      if (posts.length > 0) {
        onUpdate(posts);
      }
    },
    (err) => {
      console.warn('[FirebaseService] Listener de foro cerrado:', err.message);
    }
  );
}

/**
 * Guarda comentarios de foro en Firestore.
 */
export async function saveForumCommentsAsync(comments: ForumComment[]): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const promises = comments.map(async (c) => {
      const docRef = doc(db, 'forumComments', c.id);
      await setDoc(
        docRef,
        {
          id: c.id,
          postId: c.postId,
          authorId: c.authorEmail || 'anon',
          authorName: (c.authorName || 'Aventurero').slice(0, 100),
          authorEmail: c.authorEmail || '',
          content: (c.content || '').slice(0, 3000),
          upvotes: c.upvotes || 0,
          createdAt: new Date(c.createdAt || Date.now()).toISOString(),
        },
        { merge: true }
      );
    });
    await Promise.all(promises);
  } catch (error) {
    console.warn('[FirebaseService] Error guardando comentarios en Firestore:', error);
  }
}

/**
 * Carga comentarios de foro desde Firestore.
 */
export async function loadForumCommentsAsync(postId?: string): Promise<ForumComment[]> {
  if (!isFirebaseAvailable()) return [];

  try {
    const q = postId
      ? query(collection(db, 'forumComments'), where('postId', '==', postId))
      : collection(db, 'forumComments');
    const snap = await getDocs(q);
    const comments: ForumComment[] = [];
    snap.forEach((docSnap) => {
      const raw = docSnap.data();
      comments.push({
        id: raw.id || docSnap.id,
        postId: raw.postId,
        authorEmail: raw.authorEmail || '',
        authorName: raw.authorName || 'Aventurero',
        authorTagId: raw.authorTagId || '123',
        authorFullTag: `${raw.authorName || 'Aventurero'}@${raw.authorTagId || '123'}`,
        authorPlayerType: raw.authorPlayerType || 'player',
        authorAppRole: raw.authorAppRole || 'client',
        content: raw.content || '',
        createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
        upvotes: raw.upvotes || 0,
        upvoters: raw.upvoters || [],
      });
    });
    return comments;
  } catch (error) {
    console.warn('[FirebaseService] Error leyendo comentarios de Firestore:', error);
    return [];
  }
}

// ==========================================
// 6. SERVICIO DE MENSAJERÍA DIRECTA DE AMIGOS
// ==========================================

export async function saveFriendMessagesAsync(
  messages: FriendDirectMessage[],
  currentUser?: AuthSessionUser | null
): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const promises = messages.map(async (m) => {
      const docRef = doc(db, 'friendMessages', m.id);
      await setDoc(
        docRef,
        {
          id: m.id,
          fromUserId: m.fromUserId,
          fromDisplayName: (m.fromDisplayName || 'Amigo').slice(0, 100),
          toUserId: m.toUserId,
          toDisplayName: (m.toDisplayName || 'Amigo').slice(0, 100),
          content: (m.content || '').slice(0, 2000),
          read: Boolean(m.read),
          createdAt: new Date(m.createdAt || Date.now()).toISOString(),
        },
        { merge: true }
      );
    });
    await Promise.all(promises);
  } catch (error) {
    console.warn('[FirebaseService] Error guardando mensajes directos en Firestore:', error);
  }
}

export async function loadFriendMessagesAsync(
  currentUser?: AuthSessionUser | null
): Promise<FriendDirectMessage[]> {
  if (!isFirebaseAvailable()) return [];

  const uid = auth?.currentUser?.uid || currentUser?.id;
  if (!uid) return [];

  try {
    // Read messages where user is sender or receiver
    const qFrom = query(collection(db, 'friendMessages'), where('fromUserId', '==', uid));
    const qTo = query(collection(db, 'friendMessages'), where('toUserId', '==', uid));

    const [snapFrom, snapTo] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
    const map = new Map<string, FriendDirectMessage>();

    const parseMsg = (docSnap: any) => {
      const raw = docSnap.data();
      return {
        id: raw.id || docSnap.id,
        fromUserId: raw.fromUserId,
        fromDisplayName: raw.fromDisplayName || 'Amigo',
        fromUserTagId: raw.fromUserTagId || '123',
        fromFullTag: `${raw.fromDisplayName || 'Amigo'}@${raw.fromUserTagId || '123'}`,
        fromEmail: raw.fromEmail || '',
        toUserId: raw.toUserId,
        toDisplayName: raw.toDisplayName || 'Amigo',
        toUserTagId: raw.toUserTagId || '123',
        toFullTag: `${raw.toDisplayName || 'Amigo'}@${raw.toUserTagId || '123'}`,
        toEmail: raw.toEmail || '',
        content: raw.content || '',
        createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
        read: Boolean(raw.read),
      };
    };

    snapFrom.forEach((d) => map.set(d.id, parseMsg(d)));
    snapTo.forEach((d) => map.set(d.id, parseMsg(d)));

    return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.warn('[FirebaseService] Error leyendo mensajes de Firestore:', error);
    return [];
  }
}

export function subscribeToFriendMessages(
  onUpdate: (messages: FriendDirectMessage[]) => void,
  currentUser?: AuthSessionUser | null
): Unsubscribe {
  if (!isFirebaseAvailable()) return () => {};

  const uid = auth?.currentUser?.uid || currentUser?.id;
  if (!uid) return () => {};

  const qTo = query(collection(db, 'friendMessages'), where('toUserId', '==', uid));

  return onSnapshot(
    qTo,
    (snap) => {
      const msgs: FriendDirectMessage[] = [];
      snap.forEach((docSnap) => {
        const raw = docSnap.data();
        msgs.push({
          id: raw.id || docSnap.id,
          fromUserId: raw.fromUserId,
          fromDisplayName: raw.fromDisplayName || 'Amigo',
          fromUserTagId: raw.fromUserTagId || '123',
          fromFullTag: `${raw.fromDisplayName || 'Amigo'}@${raw.fromUserTagId || '123'}`,
          fromEmail: raw.fromEmail || '',
          toUserId: raw.toUserId,
          toDisplayName: raw.toDisplayName || 'Amigo',
          toUserTagId: raw.toUserTagId || '123',
          toFullTag: `${raw.toDisplayName || 'Amigo'}@${raw.toUserTagId || '123'}`,
          toEmail: raw.toEmail || '',
          content: raw.content || '',
          createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
          read: Boolean(raw.read),
        });
      });
      if (msgs.length > 0) {
        onUpdate(msgs);
      }
    },
    (err) => {
      console.warn('[FirebaseService] Listener de mensajes de amigos cerrado:', err.message);
    }
  );
}

// ==========================================
// 7. SERVICIO DE RESPALDO MAESTRO UNIFICADO (MASTER DATA)
// ==========================================

export async function saveMasterDataSnapshotAsync(snapshotPayload: any): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const docRef = doc(db, 'masterData', 'global');
    const docData = {
      id: 'global',
      version: '2.0',
      exportDate: new Date().toISOString(),
      data: JSON.stringify(snapshotPayload),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, docData, { merge: true });
  } catch (error) {
    console.warn('[FirebaseService] Error guardando snapshot maestro en Firestore:', error);
  }
}

export async function loadMasterDataSnapshotAsync(): Promise<any | null> {
  if (!isFirebaseAvailable()) return null;

  try {
    const docRef = doc(db, 'masterData', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const raw = snap.data();
      if (raw.data) {
        return JSON.parse(raw.data);
      }
    }
    return null;
  } catch (error) {
    console.warn('[FirebaseService] Error cargando snapshot maestro de Firestore:', error);
    return null;
  }
}

// ==========================================
// 8. SERVICIO DE AJUSTES DEL SERVIDOR / HOST
// ==========================================

export async function saveHostSettingsAsync(settings: HostSettings): Promise<void> {
  saveHostSettingsLocal(settings);
}

export async function loadHostSettingsAsync(): Promise<HostSettings> {
  return loadHostSettingsLocal();
}

