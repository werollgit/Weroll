import type { Character5e, DMWorkspace, HostSettings, UserRole, PlayerType, AppRole } from '../types/dnd.ts';
import { SAMPLE_CHARACTER, SAMPLE_DM_WORKSPACE } from '../data/srd.ts';

const STORAGE_KEYS = {
  CHARACTERS: 'dnd_5e_characters_v2',
  ACTIVE_CHAR_ID: 'dnd_5e_active_character_id_v2',
  DM_WORKSPACE: 'dnd_5e_dm_workspace_v2',
  ROOM_CODE: 'dnd_5e_room_code_v2',
  HOST_SETTINGS: 'dnd_5e_host_settings_v2',
  UNLOCKED_CHARS: 'dnd_5e_unlocked_chars_session',
  DM_UNLOCKED: 'dnd_5e_dm_unlocked_session',
  USER_ROLE: 'dnd_5e_user_role_v1',
  AUTH_USER: 'dnd_5e_auth_user_v2',
  ACTIVE_WORLD_ID: 'dnd_5e_active_world_id_v2',
};

export const DEFAULT_HOST_SETTINGS: HostSettings = {
  apiKeyOverride: '',
  aiModel: 'gemini-2.5-flash',
  dmPassword: '',
  moderatorPassword: 'admin',
  headerTitle: 'WeRoll',
  headerSubtitle: 'Companion & DM Suite v1.5 Beta',
  headerLogoIcon: 'shield',
  developerNotice: {
    enabled: true,
    title: 'WeRoll • Novedades v1.5 Beta',
    content: '¡Versión 1.5 Beta disponible! Tooltips de bonificadores (+Bono) al pasar el cursor sobre las estadísticas en la Carta Tarot, sincronización en tiempo real del Último Dado Tirado en Modo Mapa, estabilización de Puntos de Golpe (PG) con múltiples jugadores en línea y subida directa de archivos PNG/Imagen en la Hoja del Dungeon Master.',
    version: '1.5 Beta',
  },
  developerAnnouncement: {
    enabled: true,
    title: 'WeRoll • Novedades v1.5 Beta',
    content: '¡Versión 1.5 Beta disponible! Tooltips de bonificadores (+Bono) al pasar el cursor sobre las estadísticas en la Carta Tarot, sincronización en tiempo real del Último Dado Tirado en Modo Mapa, estabilización de Puntos de Golpe (PG) con múltiples jugadores en línea y subida directa de archivos PNG/Imagen en la Hoja del Dungeon Master.',
    version: '1.5 Beta',
  },
  adminGreeting: {
    enabled: true,
    title: 'Comunicado del Administrador',
    message: '¡Bienvenido a WeRoll 5E v1.5 Beta! Ahora puedes ver el tooltip del bono al acercar el cursor a tus estadísticas en la Carta Tarot, disfrutar de tiradas y vida (PG) sincronizadas sin saltos en partidas multijugador y subir archivos PNG directamente en tu Hoja de Dungeon Master.',
    type: 'info',
    updatedAt: Date.now(),
  },
  oracleWelcomeMessage: 'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?',
  changelog: [
    {
      version: '1.5 Beta',
      date: '2026-10-28',
      title: 'WeRoll 1.5 Beta • Tooltip de Bonificadores en Carta Tarot, Sincronización Exacta del Último Dado en Modo Mapa, Estabilidad Multijugador de Vida (PG) y Subida Directa de PNG para el DM',
      changes: [
        'Tooltip Flotante de Bono en Estadísticas de la Carta Tarot: Al acercar el cursor sobre cualquiera de las 6 puntuaciones totales (FUE, DES, CON, INT, SAB, CAR) en la tarjeta del personaje, aparece una pestaña flotante (tooltip) mostrando el bonificador exacto de esa característica (por ejemplo, +4 para 18 de Fuerza en Valeros del Alba).',
        'Actualización Continua del Último Dado Tirado en Modo Mapa: Corrección del indicador superior "Último dado tirado" y de las insignias de tirada en las tarjetas de jugador dentro del Modo Mapa para que siempre reflejen la tirada más reciente del historial sin quedarse congelados en tiradas pasadas.',
        'Estabilización de Puntos de Golpe (PG) con Múltiples Jugadores en Línea: Nuevo control de marca de tiempo monotónica (hpUpdatedAt) entre cliente y servidor que evita que los latidos de conexión sobrescriban cambios recientes de vida o provoquen que la barra de vida suba y baje.',
        'Subida Directa de Archivos PNG e Imágenes en la Hoja del Dungeon Master: Ahora el Dungeon Master puede subir archivos PNG/imágenes directamente desde su dispositivo (además de enlaces URL) tanto en los ajustes de su Hoja de DM como en lugares, NPCs, objetos, ataques y acciones.',
      ],
    },
    {
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
    },
    {
      version: '1.3 Beta',
      date: '2026-10-24',
      title: 'WeRoll 1.3 Beta • Sincronización Anti-Flicker, Cola de Eventos Local Anti-Microdesconexiones, Validación OTP, Galería de 4 Retratos y Cartas Ilustradas',
      changes: [
        'Sincronización Optimista Anti-Flicker y Estabilidad en Sesiones Prolongadas: Eliminación del parpadeo al ajustar puntos de vida (HP), oro o cambiar mapas en vivo, junto con limpieza automática de memoria tras 15–30 minutos de partida.',
        'Cola de Eventos Local y Escudo Anti-Microdesconexiones: Las tiradas de dados, cambios de vida y acciones se respaldan localmente ante microdesconexiones de red y se sincronizan al reconectar, evitando que los jugadores sean devueltos al Lobby por fallos transitorios.',
        'Validación de Correo con Código OTP para Nuevos Registros: Verificación de correo mediante código OTP de 6 dígitos para cuentas nuevas, manteniendo exentas y verificadas todas las cuentas ya registradas.',
        'Deduplicación y Descripciones en Cartas de Habilidades: Eliminación de cartas duplicadas al entrar al Modo Mapa y soporte completo para agregar descripciones detalladas a cada habilidad.',
        'Ilustraciones en Monstruos, Objetos, Armas, Armaduras, Conjuros y Habilidades: Soporte para adjuntar o enlazar imágenes personalizadas con deduplicación SHA-256.',
        'Galería de hasta 4 Retratos Descargables por Personaje: Guarda hasta 4 retratos en la hoja de jugador, intercámbialos con un clic y descárgalos localmente.',
        'Mapas Tácticos (En Desarrollo) y Optimización de Sabio Arcano: Los botones de Mapas Tácticos muestran el sello "En Proceso / En Desarrollo", y Sabio Arcano queda reservado para roles autorizados (Moderación y Administración).',
      ],
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
      version: '0.9.5 Alfa',
      date: '2026-10-19',
      title: 'WeRoll 0.9.5 Alfa • Paneles Dinámicos por Rol, Control Reversible de Publicación en Foro y Rediseño Compacto Responsive',
      changes: [
        'Unificación de Sección de Amigos: Consolidación de Amigos, Agregar Amigo y Usuario@ID en un solo panel unificado con botones directos para Copiar ID, Agregar y Actualizar.',
        'Paneles según Rol en la Barra Superior: Para administradores se despliega el Panel de Administración General (usuarios, bodega de backups, ajustes del servidor); para moderadores el Panel de Moderación Comunitaria; y para clientes el botón de Feedback.',
        'Moderación de Foro Reversible y Restricción Admin: Exclusividad de publicación en "Actualizaciones de la App" para administradores y control de permisos de foro entre "Permitido" y "Negado".',
        'Rediseño Compacto y Ajuste Responsive de Cuadros: Optimización visual de los contenedores de Personajes, World Sheets, Amigos y Búsqueda para encajar limpiamente sin desbordes en móviles y PC.',
      ],
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
      version: '0.5 Alfa',
      date: '2026-08-22',
      title: 'WeRoll 0.5 Alfa • Bóveda de Respaldo del DM, Inyección Maestro & Seguridad',
      changes: [
        'Bóveda de Respaldo para DMs: Resguardo de campañas, personajes y fichas con sincronización global.',
        'Paneles de Seguridad y Reseteo: Gestión de contraseñas de DM, moderadores y usuarios.',
      ],
    },
    {
      version: '0.1 Alfa',
      date: '2026-08-10',
      title: 'WeRoll 0.1 Alfa • Lanzamiento Inicial Companion & DM Suite',
      changes: [
        'Lanzamiento oficial de la versión alfa inicial de WeRoll 5E.',
        'Autenticación por roles independientes: Jugador, Dungeon Master y Moderador.',
        'Carpetas jerárquicas de hasta 3 niveles con filtrado acumulativo.',
        'Apartado de Objetos y Conjuros únicos para el DM con compendio genérico SRD.',
        'Bloc de notas de combate en tiempo real, tiradas automáticas y dados 3D.',
        'Manual de usuario 5E completo con armas, armaduras, conjuros y reglas ampliadas.',
      ],
    },
  ],
  roleSwitchingAllowed: 'strict',
};

export function folderMatchesFilter(entityFolder: string | undefined, selectedFolder: string): boolean {
  if (selectedFolder === 'all') return true;
  const folder = entityFolder?.trim() || 'General';
  if (folder === selectedFolder) return true;
  if (folder.startsWith(`${selectedFolder} / `)) return true;
  return false;
}

export function getFolderDepth(folder: string): number {
  if (!folder) return 1;
  return folder.split(' / ').length;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName: string;
  userTagId?: string;
  fullTag?: string;
  avatarUrl?: string;
  friends?: string[];
  role: UserRole;
  playerType?: PlayerType;
  requestedPlayerType?: PlayerType;
  playerTypeChangeRequested?: boolean;
  appRole?: AppRole;
  canPostInForum?: boolean;
  forumPermissionsRequested?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  isGoogleLinked?: boolean;
}

export function loadAuthUser(): AuthSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuthUser(user: AuthSessionUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  } catch {}
}

export function loadActiveWorldId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_WORLD_ID);
  } catch {
    return null;
  }
}

export function saveActiveWorldId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WORLD_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORLD_ID);
    }
  } catch {}
}

export function loadUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE) as UserRole | null;
    if (
      role === 'player' ||
      role === 'dm' ||
      role === 'both' ||
      role === 'moderator' ||
      role === 'creator' ||
      role === 'admin'
    ) {
      return role;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveUserRole(role: UserRole | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (role) {
      localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    }
  } catch (e) {
    console.error('Error saving user role:', e);
  }
}

export function loadCharacters(): Character5e[] {
  if (typeof window === 'undefined') return [SAMPLE_CHARACTER];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (!data) {
      saveCharacters([SAMPLE_CHARACTER]);
      return [SAMPLE_CHARACTER];
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [SAMPLE_CHARACTER];
  } catch (e) {
    console.error('Error loading characters from localStorage:', e);
    return [SAMPLE_CHARACTER];
  }
}

export function saveCharacters(characters: Character5e[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
  } catch (e) {
    console.error('Error saving characters to localStorage:', e);
  }
}

export function loadActiveCharacterId(): string {
  if (typeof window === 'undefined') return SAMPLE_CHARACTER.id;
  try {
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAR_ID);
    return id || SAMPLE_CHARACTER.id;
  } catch {
    return SAMPLE_CHARACTER.id;
  }
}

export function saveActiveCharacterId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAR_ID, id);
  } catch (e) {
    console.error('Error saving active character ID:', e);
  }
}

export function loadDMWorkspace(): DMWorkspace {
  if (typeof window === 'undefined') return SAMPLE_DM_WORKSPACE;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DM_WORKSPACE);
    if (!data) {
      saveDMWorkspace(SAMPLE_DM_WORKSPACE);
      return SAMPLE_DM_WORKSPACE;
    }
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return SAMPLE_DM_WORKSPACE;
    return {
      ...SAMPLE_DM_WORKSPACE,
      ...parsed,
      npcs: Array.isArray(parsed.npcs) ? parsed.npcs : SAMPLE_DM_WORKSPACE.npcs,
      monsters: Array.isArray(parsed.monsters) ? parsed.monsters : SAMPLE_DM_WORKSPACE.monsters,
      locations: Array.isArray(parsed.locations) ? parsed.locations : SAMPLE_DM_WORKSPACE.locations,
      campaignLogs: Array.isArray(parsed.campaignLogs) ? parsed.campaignLogs : SAMPLE_DM_WORKSPACE.campaignLogs,
      combatSummaries: Array.isArray(parsed.combatSummaries) ? parsed.combatSummaries : (SAMPLE_DM_WORKSPACE.combatSummaries || []),
      customItemsAndSpells: Array.isArray(parsed.customItemsAndSpells) ? parsed.customItemsAndSpells : (SAMPLE_DM_WORKSPACE.customItemsAndSpells || []),
      placeAlbumPhotos:
        Array.isArray(parsed.placeAlbumPhotos) && parsed.placeAlbumPhotos.length > 0
          ? parsed.placeAlbumPhotos
          : SAMPLE_DM_WORKSPACE.placeAlbumPhotos || [],
      atlasMaps:
        parsed.atlasMaps && typeof parsed.atlasMaps === 'object'
          ? { ...(SAMPLE_DM_WORKSPACE.atlasMaps || {}), ...parsed.atlasMaps }
          : SAMPLE_DM_WORKSPACE.atlasMaps || {},
      atlasPinPositions:
        parsed.atlasPinPositions && typeof parsed.atlasPinPositions === 'object'
          ? { ...(SAMPLE_DM_WORKSPACE.atlasPinPositions || {}), ...parsed.atlasPinPositions }
          : SAMPLE_DM_WORKSPACE.atlasPinPositions || {},
      activeLiveVisual: parsed.activeLiveVisual || SAMPLE_DM_WORKSPACE.activeLiveVisual,
      dmName: parsed.dmName || SAMPLE_DM_WORKSPACE.dmName || 'Dungeon Master',
      dmAvatarType: parsed.dmAvatarType || SAMPLE_DM_WORKSPACE.dmAvatarType || 'icon',
      dmAvatarUrl: parsed.dmAvatarUrl !== undefined ? parsed.dmAvatarUrl : SAMPLE_DM_WORKSPACE.dmAvatarUrl,
      dmAvatarIcon: parsed.dmAvatarIcon || SAMPLE_DM_WORKSPACE.dmAvatarIcon || 'crown',
      dmLiveMessage: parsed.dmLiveMessage !== undefined ? parsed.dmLiveMessage : SAMPLE_DM_WORKSPACE.dmLiveMessage,
      folders:
        Array.isArray(parsed.folders) && parsed.folders.some((f: string) => f.includes('Costa de la Espada'))
          ? parsed.folders
          : Array.from(new Set([...(SAMPLE_DM_WORKSPACE.folders || []), ...(Array.isArray(parsed.folders) ? parsed.folders : [])])),
      activeEncounter: {
        ...SAMPLE_DM_WORKSPACE.activeEncounter,
        ...(parsed.activeEncounter || {}),
        combatants: Array.isArray(parsed.activeEncounter?.combatants)
          ? parsed.activeEncounter.combatants
          : SAMPLE_DM_WORKSPACE.activeEncounter.combatants,
        combatLog: Array.isArray(parsed.activeEncounter?.combatLog)
          ? parsed.activeEncounter.combatLog
          : [],
      },
    };
  } catch (e) {
    console.error('Error loading DM workspace:', e);
    return SAMPLE_DM_WORKSPACE;
  }
}

export function saveDMWorkspace(workspace: DMWorkspace): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DM_WORKSPACE, JSON.stringify(workspace));
  } catch (e) {
    console.error('Error saving DM workspace:', e);
  }
}

export function loadHostSettings(): HostSettings {
  if (typeof window === 'undefined') return DEFAULT_HOST_SETTINGS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HOST_SETTINGS);
    if (!data) return DEFAULT_HOST_SETTINGS;
    const parsed = JSON.parse(data);
    const merged: HostSettings = { ...DEFAULT_HOST_SETTINGS, ...parsed };
    const v15 = DEFAULT_HOST_SETTINGS.changelog?.[0];
    if (v15 && Array.isArray(merged.changelog)) {
      const idx = merged.changelog.findIndex((c) => c.version && c.version.toLowerCase().includes('1.5'));
      if (idx === -1) {
        merged.changelog = [v15, ...merged.changelog];
      } else {
        merged.changelog[idx] = v15;
      }
    }
    if (
      !merged.headerSubtitle ||
      merged.headerSubtitle.includes('1.4') ||
      merged.headerSubtitle.includes('1.3') ||
      merged.headerSubtitle.includes('1.2') ||
      merged.headerSubtitle.includes('1.1') ||
      merged.headerSubtitle.includes('1.0') ||
      merged.headerSubtitle.includes('0.9') ||
      merged.headerSubtitle.includes('0.8') ||
      merged.headerSubtitle.includes('0.65') ||
      merged.headerSubtitle.includes('0.6 ') ||
      merged.headerSubtitle.includes('0.5')
    ) {
      merged.headerSubtitle = DEFAULT_HOST_SETTINGS.headerSubtitle;
    }
    if (
      merged.developerNotice?.version?.includes('0.9') ||
      merged.developerNotice?.version?.includes('1.0') ||
      merged.developerNotice?.version?.includes('1.1') ||
      merged.developerNotice?.version?.includes('1.2') ||
      merged.developerNotice?.version?.includes('1.3') ||
      merged.developerNotice?.version?.includes('1.4')
    ) {
      merged.developerNotice = DEFAULT_HOST_SETTINGS.developerNotice;
    }
    return merged;
  } catch {
    return DEFAULT_HOST_SETTINGS;
  }
}

export function saveHostSettings(settings: HostSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.HOST_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving host settings:', e);
  }
}

export function loadRoomCode(): string {
  if (typeof window === 'undefined') return 'MESA-DRAGON';
  try {
    return localStorage.getItem(STORAGE_KEYS.ROOM_CODE) || 'MESA-DRAGON';
  } catch {
    return 'MESA-DRAGON';
  }
}

export function saveRoomCode(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ROOM_CODE, code.toUpperCase().trim());
  } catch (e) {
    console.error('Error saving room code:', e);
  }
}

// Session Unlocks
export function isCharacterUnlocked(charId: string, charPassword?: string): boolean {
  if (!charPassword || !charPassword.trim()) return true;
  if (typeof window === 'undefined') return true;
  try {
    const unlocked = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UNLOCKED_CHARS) || '[]');
    return unlocked.includes(charId);
  } catch {
    return false;
  }
}

export function setCharacterUnlocked(charId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const unlocked = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UNLOCKED_CHARS) || '[]');
    if (!unlocked.includes(charId)) {
      unlocked.push(charId);
      sessionStorage.setItem(STORAGE_KEYS.UNLOCKED_CHARS, JSON.stringify(unlocked));
    }
  } catch {}
}

export function isDMUnlocked(workspacePassword?: string): boolean {
  if (!workspacePassword || !workspacePassword.trim()) return true;
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(STORAGE_KEYS.DM_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setDMUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.DM_UNLOCKED, unlocked ? 'true' : 'false');
  } catch {}
}

export function exportBackupData(): string {
  const characters = loadCharacters();
  const dm = loadDMWorkspace();
  const room = loadRoomCode();
  const host = loadHostSettings();
  const payload = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    characters,
    dmWorkspace: dm,
    roomCode: room,
    hostSettings: { ...host, apiKeyOverride: undefined }, // Don't export secret API keys
  };
  return JSON.stringify(payload, null, 2);
}

export function importBackupData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.characters && Array.isArray(data.characters)) {
      saveCharacters(data.characters);
      if (data.characters[0]?.id) {
        saveActiveCharacterId(data.characters[0].id);
      }
    }
    if (data.dmWorkspace) {
      saveDMWorkspace(data.dmWorkspace);
    }
    if (data.roomCode) {
      saveRoomCode(data.roomCode);
    }
    return true;
  } catch (e) {
    console.error('Failed to import backup data:', e);
    return false;
  }
}

// ==========================================
// FIREBASE ASYNC SERVICE LAYER ADAPTER
// ==========================================
export {
  saveCharactersAsync,
  saveSingleCharacterAsync,
  loadCharactersAsync,
  deleteCharacterAsync,
  subscribeToCharacters,
  saveDMWorkspaceAsync,
  loadDMWorkspaceAsync,
  subscribeToDMWorkspace,
  saveUserProfileAsync,
  loadUserProfileAsync,
  saveSkinsAsync,
  loadSkinsAsync,
  subscribeToSkins,
  saveForumPostsAsync,
  loadForumPostsAsync,
  subscribeToForumPosts,
  saveForumCommentsAsync,
  loadForumCommentsAsync,
  saveFriendMessagesAsync,
  loadFriendMessagesAsync,
  subscribeToFriendMessages,
  saveMasterDataSnapshotAsync,
  loadMasterDataSnapshotAsync,
  saveHostSettingsAsync,
  loadHostSettingsAsync,
} from '../services/firebaseService';
