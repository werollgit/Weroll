import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  MessageSquare,
  Sparkles,
  ArrowLeft,
  Bell,
  Send,
  Palette,
  Layers,
} from 'lucide-react';
import { AuthSessionUser } from '../auth/RoleSelectionModal';

interface ModeratorPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthSessionUser;
  onNavigateToForum?: () => void;
  onSwitchToAdminPanel?: () => void;
  onSwitchToCreatorPanel?: () => void;
  onSwitchToModeratorPanel?: () => void;
  asPage?: boolean;
  creatorMode?: boolean;
  onBroadcastLivePopup?: (popup: any) => void;
  onRefreshAuthStatus?: () => Promise<void>;
}

export const ModeratorPanelModal: React.FC<ModeratorPanelModalProps> = ({
  isOpen,
  onClose,
  authUser,
  onNavigateToForum,
  onSwitchToAdminPanel,
  onSwitchToCreatorPanel,
  onSwitchToModeratorPanel,
  asPage = false,
  creatorMode = false,
  onBroadcastLivePopup,
  onRefreshAuthStatus,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'role-requests'>('all');
  const [actionMessage, setActionMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Live Broadcast Pop-up state (available to Admin, Creator, and Moderator)
  const [popupTitle, setPopupTitle] = useState<string>('Aviso en Vivo del Moderador');
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [popupSending, setPopupSending] = useState<boolean>(false);
  const [popupSuccessMsg, setPopupSuccessMsg] = useState<string>('');

  const isCreatorOrAdmin =
    creatorMode ||
    authUser.appRole === 'creator' ||
    authUser.role === 'creator' ||
    authUser.appRole === 'admin' ||
    authUser.role === 'admin';

  const fetchModerationUsers = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/moderator/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar usuarios');
      setUsers(data.users || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchModerationUsers();
      setActionMessage('');
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendLivePopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!popupMessage.trim()) return;
    setPopupSending(true);
    setPopupSuccessMsg('');
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/live-popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: popupTitle.trim() || 'Aviso del Administrador',
          message: popupMessage.trim(),
          senderName: authUser.displayName || 'Moderador',
          senderRole:
            authUser.appRole === 'admin' || authUser.role === 'admin'
              ? 'Administrador'
              : authUser.appRole === 'creator' || authUser.role === 'creator' || creatorMode
              ? 'Creador de Contenido'
              : 'Moderador',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el aviso pop-up.');
      setPopupMessage('');
      setPopupSuccessMsg('¡Aviso Pop-up enviado en tiempo real a todos los jugadores conectados!');
      if (onBroadcastLivePopup && data.popup) {
        onBroadcastLivePopup(data.popup);
      }
      setTimeout(() => setPopupSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al enviar el aviso en vivo.');
    } finally {
      setPopupSending(false);
    }
  };

  // Approve User
  const handleApprove = async (userId: string) => {
    setActionMessage('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar');
      setActionMessage(`Cuenta aprobada con éxito.`);
      fetchModerationUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al aprobar usuario.');
    }
  };

  // Reject User
  const handleReject = async (userId: string) => {
    if (!confirm('¿Rechazar solicitud de acceso de este usuario?')) return;
    setActionMessage('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar');
      setActionMessage(`Solicitud de usuario rechazada.`);
      fetchModerationUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al rechazar usuario.');
    }
  };

  // Toggle Forum Permission
  const handleToggleForumPermission = async (userId: string, currentAllowed: boolean) => {
    setActionMessage('');
    try {
      const res = await fetch(`/api/moderator/users/${userId}/forum-permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: !currentAllowed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al modificar permisos');
      setActionMessage(data.message || 'Permiso de foro actualizado.');
      fetchModerationUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar permiso de foro.');
    }
  };

  // Approve or Reject Table Role (playerType) Change Request
  const handleResolvePlayerTypeRequest = async (
    userId: string,
    approved: boolean,
    requestedType?: string
  ) => {
    setActionMessage('');
    setErrorMessage('');
    try {
      const res = await fetch(`/api/moderator/users/${userId}/player-type-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          playerType: requestedType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar solicitud de rol de mesa');
      setActionMessage(data.message || 'Solicitud de rol de mesa procesada.');
      await fetchModerationUsers();
      if (onRefreshAuthStatus && userId === authUser.id) {
        await onRefreshAuthStatus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar solicitud de rol de mesa.');
    }
  };

  const formatPlayerTypeLabel = (t?: string) =>
    t === 'dm' ? 'Solo DM' : t === 'player' ? 'Solo Jugador' : 'DM y Jugador';

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const roleRequestsCount = users.filter((u) => Boolean(u.playerTypeChangeRequested)).length;
  const filteredUsers = users.filter((u) => {
    if (statusFilter === 'pending' && u.status !== 'pending') return false;
    if (statusFilter === 'approved' && u.status !== 'approved') return false;
    if (statusFilter === 'role-requests' && !u.playerTypeChangeRequested) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.userTagId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const panelContent = (
    <div
      className={`bg-[#14151b] border ${
        isCreatorOrAdmin ? 'border-amber-600/80' : 'border-purple-800/80'
      } rounded-3xl w-full ${
        asPage ? 'min-h-[75vh]' : 'max-w-5xl h-[720px]'
      } flex flex-col shadow-2xl animate-in fade-in overflow-hidden`}
    >
      {/* Header */}
      <div className="bg-[#181920] border-b border-stone-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {asPage && (
            <button
              type="button"
              data-testid="btn-back-to-lobby-from-mod"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-[#c8a45c]/50 text-[#f5e4be] font-cinzel font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
            >
              <ArrowLeft className="w-4 h-4 text-[#e2c275]" />
              <span>Volver al Lobby</span>
            </button>
          )}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-950/70 border border-purple-600 text-purple-300"
          >
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-cinzel font-black text-base sm:text-lg text-purple-200">
                Página de Moderación WeRoll
              </h3>
              <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full border bg-purple-950/80 border-purple-700/60 text-purple-300">
                {authUser.appRole === 'admin' || authUser.role === 'admin'
                  ? 'Nivel: Administrador'
                  : 'Nivel: Moderador'}
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Aprobación de nuevos usuarios, envío de avisos pop-up en vivo y permisos del foro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onSwitchToAdminPanel && (authUser.appRole === 'admin' || authUser.role === 'admin') && (
            <button
              type="button"
              onClick={onSwitchToAdminPanel}
              className="px-3 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-600/80 text-blue-300 hover:text-white transition flex items-center gap-1.5 text-xs font-cinzel font-bold shadow-sm cursor-pointer"
              title="Cambiar a la Página de Administrador"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Panel Admin</span>
            </button>
          )}
          {!asPage && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition"
              title="Cerrar Panel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications Bar */}
      {actionMessage && (
        <div className="bg-emerald-950/60 border-b border-emerald-800 px-5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}
      {popupSuccessMsg && (
        <div className="bg-amber-950/70 border-b border-amber-600 px-5 py-2.5 text-xs text-amber-200 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span>{popupSuccessMsg}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-950/60 border-b border-red-800 px-5 py-2.5 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-[#101115]">
        {/* CREATOR EXCLUSIVE SECTION HIDDEN FOR v1.2 BETA */}
        {false && isCreatorOrAdmin && (
          <div
            data-testid="creator-studio-4-modules"
            className="bg-gradient-to-r from-[#1a1610] via-[#181822] to-[#1a1610] border-2 border-amber-600/60 rounded-2xl p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-500 flex items-center justify-center text-amber-300">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-cinzel font-black text-sm text-amber-300 uppercase">
                      Estudio de Creador de Contenido • 4 Apartados Oficiales
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-[10px] font-mono font-bold text-emerald-300">
                      ⚡ Delta Sync Listo
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-600 text-[10px] font-cinzel font-bold text-amber-300">
                      Arquitectura Preparada
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Estructura dividida en los 4 apartados oficiales e integrada con el motor de Guardado Incremental por Diferencias (Delta Sync) y separación de imágenes para portabilidad en GitHub y AI Studio.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Apartado 1: Diseño de Skin de Jugador */}
              <div
                data-testid="creator-module-player-skin"
                className="p-3.5 rounded-xl bg-[#121318] border border-amber-800/50 flex items-start gap-3"
              >
                <Palette className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel font-bold text-xs text-amber-200">
                      1. Diseño de Skin de Jugador (Pantalla de Jugador)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-700/60">
                      delta: creator_skin_player
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Al elegir esta skin, la <strong>Player Sheet</strong> (tanto en modo edición individual como conectado en una mesa en vivo) cambia su estética visual y la <strong>Carta Tarot de Personaje</strong> adopta un marco y diseño único.
                  </p>
                </div>
              </div>

              {/* Apartado 2: Diseño de Skin de DM */}
              <div
                data-testid="creator-module-dm-skin"
                className="p-3.5 rounded-xl bg-[#121318] border border-purple-800/50 flex items-start gap-3"
              >
                <Layers className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel font-bold text-xs text-purple-200">
                      2. Diseño de Skin de DM (Pantalla de DM)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-700/60">
                      delta: creator_skin_dm
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Personaliza la hoja del Dungeon Master (<strong>World Sheet</strong>) y transforma los marcos, paneles tácticos y estética visual cuando el DM entra al <strong>Modo Mapa en Vivo</strong>.
                  </p>
                </div>
              </div>

              {/* Apartado 3: Paquetes de DLC */}
              <div
                data-testid="creator-module-dlc"
                className="p-3.5 rounded-xl bg-[#121318] border border-emerald-800/50 flex items-start gap-3"
              >
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel font-bold text-xs text-emerald-200">
                      3. Paquetes de DLC (Expansiones Inyectables)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/60">
                      delta: creator_dlc
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Al inyectar un <strong>DLC de Creador</strong> en una campaña se agregan de forma modular: mapas del Atlas, álbumes de fotos, monstruos del bestiario, armas/objetos e historias prediseñadas.
                  </p>
                </div>
              </div>

              {/* Apartado 4: Skins de la Página / App General */}
              <div
                data-testid="creator-module-app-skin"
                className="p-3.5 rounded-xl bg-[#121318] border border-cyan-800/50 flex items-start gap-3"
              >
                <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel font-bold text-xs text-cyan-200">
                      4. Skins de la Página (App General / Temporadas)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/60">
                      delta: creator_skin_app
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Permite activar temas globales de temporada (ej. <strong>Navidad</strong>, Halloween o aniversario) y regresar en un clic al <strong>Diseño Original</strong>, cambiando el Lobby, el Foro, la carátula superior y los botones.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIVE POP-UP BROADCAST SENDER (Available to Moderators, Creators, and Admins) */}
        <form
          onSubmit={handleSendLivePopup}
          className="bg-[#161720] border border-purple-700/60 rounded-2xl p-4 shadow-lg space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <h4 className="font-cinzel font-bold text-xs sm:text-sm text-amber-200 uppercase">
                Enviar Aviso Pop-up en Vivo (Jugadores en Línea)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-stone-400">
              Remitente: <strong className="text-amber-300">{authUser.displayName}</strong>
            </span>
          </div>
          <p className="text-xs text-stone-400">
            Envía una ventana emergente instantánea a todos los usuarios que estén conectados en este momento en el Lobby o dentro de una partida (ej. aviso de mantenimiento próximo).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <input
                type="text"
                value={popupTitle}
                onChange={(e) => setPopupTitle(e.target.value)}
                placeholder="Título del aviso..."
                className="w-full bg-[#111216] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none"
              />
            </div>
            <div className="sm:col-span-6">
              <input
                type="text"
                value={popupMessage}
                onChange={(e) => setPopupMessage(e.target.value)}
                placeholder="Escribe el mensaje en vivo (ej. En 15 min entraremos en mantenimiento)..."
                required
                className="w-full bg-[#111216] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={popupSending}
                className="w-full h-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-cinzel font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{popupSending ? '...' : 'Enviar'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Filter & Search Bar */}
        <div className="bg-[#16171e] border border-stone-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-600'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              Todos ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-900/60 text-amber-200 border border-amber-600'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <span>Pendientes</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              data-testid="filter-role-requests"
              onClick={() => setStatusFilter('role-requests')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'role-requests'
                  ? 'bg-purple-950 text-purple-200 border border-purple-500'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <span>Solicitudes de Rol</span>
              {roleRequestsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-black animate-pulse">
                  {roleRequestsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold transition cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-950 text-emerald-200 border border-emerald-700'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              Aprobados
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por correo o @ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121318] border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        {/* Users Table / List */}
        <div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mb-2" />
              <span className="text-xs font-cinzel">Cargando cuentas de usuarios...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs">
              No se encontraron usuarios con los filtros aplicados.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const isUserPending = u.status === 'pending';
                const hasForumPerm = Boolean(
                  u.canPostInForum ||
                    u.appRole === 'admin' ||
                    u.appRole === 'creator' ||
                    u.appRole === 'moderator'
                );
                const requestedPerm = Boolean(u.forumPermissionsRequested);
                const requestedRoleChange = Boolean(u.playerTypeChangeRequested && u.requestedPlayerType);

                return (
                  <div
                    key={u.id}
                    className={`bg-[#181920] border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-sm ${
                      isUserPending
                        ? 'border-amber-700/60 bg-amber-950/10'
                        : requestedRoleChange
                        ? 'border-purple-500/80 bg-purple-950/15'
                        : 'border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {/* User Identity Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-800 flex items-center justify-center text-purple-300 font-bold font-cinzel shrink-0 overflow-hidden">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          u.displayName?.slice(0, 2).toUpperCase() || 'US'
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-cinzel font-bold text-stone-100">
                            {u.displayName}
                          </strong>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-amber-300 font-bold">
                            @{u.userTagId || '123'}
                          </span>
                          {u.isGoogleLinked && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 shadow-sm"
                              title="Cuenta vinculada con Google Auth"
                            >
                              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span>Google</span>
                            </span>
                          )}
                          {/* Player Type Badge */}
                          <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                            Rol Mesa: {u.playerType === 'dm' ? 'Solo DM' : u.playerType === 'player' ? 'Solo Jugador' : 'DM y Jugador'}
                          </span>
                          {requestedRoleChange && (
                            <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-200 border border-purple-500 animate-pulse">
                              Solicita cambiar a: {formatPlayerTypeLabel(u.requestedPlayerType)}
                            </span>
                          )}
                          {/* App Role Badge */}
                          <span
                            className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border ${
                              u.appRole === 'admin'
                                ? 'bg-red-950 text-red-300 border-red-700'
                                : u.appRole === 'creator'
                                ? 'bg-amber-950 text-amber-300 border-amber-600'
                                : u.appRole === 'moderator'
                                ? 'bg-purple-950 text-purple-300 border-purple-700'
                                : 'bg-stone-800 text-stone-300 border-stone-700'
                            }`}
                          >
                            App:{' '}
                            {u.appRole === 'admin'
                              ? 'Administrador'
                              : u.appRole === 'creator'
                              ? 'Creador de Contenido'
                              : u.appRole === 'moderator'
                              ? 'Moderador'
                              : 'Cliente'}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{u.email}</p>
                      </div>
                    </div>

                    {/* Moderation Controls: Approval, Table Role Request & Forum Perms */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Table Role Change Request Approval / Rejection */}
                      {requestedRoleChange && (
                        <div className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-500/80 rounded-xl px-2.5 py-1">
                          <span className="text-[11px] font-cinzel font-bold text-purple-200">
                            Rol: {formatPlayerTypeLabel(u.requestedPlayerType)}
                          </span>
                          <button
                            type="button"
                            data-testid={`btn-approve-role-${u.id}`}
                            onClick={() =>
                              handleResolvePlayerTypeRequest(u.id, true, u.requestedPlayerType)
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-cinzel font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow"
                            title="Aceptar solicitud de cambio de rol de mesa"
                          >
                            <Check className="w-3 h-3" />
                            <span>Aceptar Rol</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`btn-reject-role-${u.id}`}
                            onClick={() => handleResolvePlayerTypeRequest(u.id, false)}
                            className="px-2 py-1 rounded-lg bg-red-950 hover:bg-red-900 border border-red-700 text-red-300 font-cinzel font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                            title="Rechazar solicitud de cambio de rol de mesa"
                          >
                            <X className="w-3 h-3" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      )}

                      {isUserPending ? (
                        <>
                          <button
                            onClick={() => handleApprove(u.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-stone-100 font-cinzel font-bold text-xs transition flex items-center gap-1 shadow cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Aprobar Registro</span>
                          </button>
                          <button
                            onClick={() => handleReject(u.id)}
                            className="px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-cinzel font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">

                          {/* Forum Posting Permission Toggle (Denegar / Permitir) */}
                          <button
                            onClick={() => handleToggleForumPermission(u.id, hasForumPerm)}
                            disabled={
                              u.appRole === 'admin' ||
                              u.appRole === 'creator' ||
                              u.appRole === 'moderator'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold transition flex items-center gap-1.5 border shadow-sm cursor-pointer ${
                              u.appRole === 'admin' ||
                              u.appRole === 'creator' ||
                              u.appRole === 'moderator'
                                ? 'bg-purple-950/30 border-purple-800/40 text-purple-400 cursor-not-allowed'
                                : hasForumPerm
                                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 hover:bg-red-950/80 hover:border-red-600 hover:text-red-300'
                                : requestedPerm
                                ? 'bg-amber-950/80 border-amber-600 text-amber-200 animate-pulse hover:bg-emerald-950/80 hover:border-emerald-600'
                                : 'bg-red-950/40 border-red-900/60 text-red-300 hover:bg-emerald-950/80 hover:border-emerald-600 hover:text-emerald-200'
                            }`}
                          >
                            {u.appRole === 'admin' ||
                            u.appRole === 'creator' ||
                            u.appRole === 'moderator' ? (
                              <>
                                <Shield className="w-3.5 h-3.5 text-purple-400" />
                                <span>Permiso Total (Staff)</span>
                              </>
                            ) : hasForumPerm ? (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Permitido (Denegar Permiso)</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-red-400" />
                                <span>
                                  Negado {requestedPerm ? '(Solicitó - Aprobar)' : '(Permitir Publicar)'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#181920] border-t border-stone-800 p-4 flex items-center justify-between">
        <p className="text-[11px] text-stone-500">
          Jerarquía de Roles: Administrador &gt; Creador de Contenido &gt; Moderador &gt; Cliente.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-cinzel font-bold text-xs transition cursor-pointer"
        >
          {asPage ? 'Volver al Lobby' : 'Cerrar Panel'}
        </button>
      </div>
    </div>
  );

  if (asPage) {
    return panelContent;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      {panelContent}
    </div>
  );
};

