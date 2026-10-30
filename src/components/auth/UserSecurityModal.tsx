import React, { useState, useRef } from 'react';
import { KeyRound, Lock, Tag, CheckCircle, AlertCircle, Save, Mail, HelpCircle, X, Shield, Copy, Check, Upload, Trash2, User, Crown, Sparkles } from 'lucide-react';
import { AuthSessionUser } from '../auth/RoleSelectionModal';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';
import { PlayerType } from '../../types/dnd';
import { saveUserProfileAsync } from '../../services/firebaseService';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase/config';

interface UserSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthSessionUser;
  onRefreshAuthStatus?: () => Promise<void>;
}

export const UserSecurityModal: React.FC<UserSecurityModalProps> = ({
  isOpen,
  onClose,
  authUser,
  onRefreshAuthStatus,
}) => {
  const currentTagId = authUser.userTagId || '123';
  const myFullTag = `${authUser.displayName}@${currentTagId}`;

  // Player Profile Avatar state
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>(authUser.avatarUrl || '');
  const [isSavingAvatar, setIsSavingAvatar] = useState<boolean>(false);
  const [avatarStatusMsg, setAvatarStatusMsg] = useState<string>('');
  const [avatarErrorMsg, setAvatarErrorMsg] = useState<string>('');

  // Table Player Type state ('player' | 'dm' | 'both')
  const currentPlayerType: PlayerType =
    authUser.playerType || (authUser.role === 'dm' ? 'dm' : authUser.role === 'player' ? 'player' : 'both');
  const [requestedPlayerType, setRequestedPlayerType] = useState<PlayerType | undefined>(
    authUser.playerTypeChangeRequested ? authUser.requestedPlayerType : undefined
  );
  const [isUpdatingPlayerType, setIsUpdatingPlayerType] = useState<boolean>(false);
  const [playerTypeStatusMsg, setPlayerTypeStatusMsg] = useState<string>('');
  const [playerTypeErrorMsg, setPlayerTypeErrorMsg] = useState<string>('');

  // Tag ID state
  const [newTagId, setNewTagId] = useState<string>(currentTagId);
  const [isUpdatingTagId, setIsUpdatingTagId] = useState<boolean>(false);
  const [userTagStatusMsg, setUserTagStatusMsg] = useState<string>('');
  const [userTagErrorMsg, setUserTagErrorMsg] = useState<string>('');
  const [copiedTag, setCopiedTag] = useState<boolean>(false);

  // Change Password state
  const [userOldPassword, setUserOldPassword] = useState<string>('');
  const [userNewPassword, setUserNewPassword] = useState<string>('');
  const [userConfirmPassword, setUserConfirmPassword] = useState<string>('');
  const [isUpdatingUserPass, setIsUpdatingUserPass] = useState<boolean>(false);
  const [userPassStatusMsg, setUserPassStatusMsg] = useState<string>('');
  const [userPassErrorMsg, setUserPassErrorMsg] = useState<string>('');

  // Forgot password request state
  const [userForgotNote, setUserForgotNote] = useState<string>('');
  const [isRequestingForgot, setIsRequestingForgot] = useState<boolean>(false);
  const [userForgotMsg, setUserForgotMsg] = useState<string>('');

  // Google Account Linking state
  const [isLinkingGoogle, setIsLinkingGoogle] = useState<boolean>(false);
  const [googleLinkSuccessMsg, setGoogleLinkSuccessMsg] = useState<string>('');
  const [googleLinkErrorMsg, setGoogleLinkErrorMsg] = useState<string>('');
  const [pendingGoogleConfirm, setPendingGoogleConfirm] = useState<{ email: string; uid: string } | null>(null);

  const handleInitiateGoogleLink = async () => {
    setGoogleLinkSuccessMsg('');
    setGoogleLinkErrorMsg('');
    setIsLinkingGoogle(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const gUser = userCredential.user;
      if (gUser && gUser.email) {
        setPendingGoogleConfirm({ email: gUser.email, uid: gUser.uid });
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setGoogleLinkErrorMsg(err.message || 'Error al autenticar con Google.');
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleConfirmGoogleLink = async () => {
    if (!pendingGoogleConfirm) return;
    setGoogleLinkSuccessMsg('');
    setGoogleLinkErrorMsg('');
    setIsLinkingGoogle(true);
    try {
      const res = await fetch('/api/auth/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUser.id,
          googleEmail: pendingGoogleConfirm.email,
          googleUid: pendingGoogleConfirm.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGoogleLinkErrorMsg(data.error || 'Error al vincular la cuenta de Google.');
        setPendingGoogleConfirm(null);
        return;
      }
      await saveUserProfileAsync({
        ...authUser,
        email: pendingGoogleConfirm.email,
        isGoogleLinked: true,
      }).catch(() => {});

      setGoogleLinkSuccessMsg(
        `¡Cuenta de Google vinculada con éxito! Tu correo de WeRoll ha sido actualizado permanentemente a ${pendingGoogleConfirm.email}.`
      );
      setPendingGoogleConfirm(null);
      if (onRefreshAuthStatus) {
        await onRefreshAuthStatus();
      }
    } catch {
      setGoogleLinkErrorMsg('Error de red al vincular con Google.');
      setPendingGoogleConfirm(null);
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const getPlayerTypeLabel = (t?: PlayerType) =>
    t === 'dm'
      ? 'Dungeon Master únicamente'
      : t === 'player'
      ? 'Jugador únicamente'
      : 'DM y Jugador';

  const handleSelectPlayerType = async (type: PlayerType) => {
    if (type === currentPlayerType && !requestedPlayerType) return;
    setPlayerTypeStatusMsg('');
    setPlayerTypeErrorMsg('');
    setIsUpdatingPlayerType(true);
    try {
      const res = await fetch(`/api/users/${authUser.id}/player-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerType: type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlayerTypeErrorMsg(data.error || 'Error al solicitar cambio de rol de mesa.');
        return;
      }
      setRequestedPlayerType(type);
      setPlayerTypeStatusMsg(
        data.message ||
          `Solicitud enviada para cambiar a "${getPlayerTypeLabel(type)}". Un Moderador o superior debe aprobarla en el apartado de Moderación.`
      );
      if (onRefreshAuthStatus) {
        await onRefreshAuthStatus();
      }
    } catch {
      setPlayerTypeErrorMsg('Error de red al solicitar cambio de rol de mesa.');
    } finally {
      setIsUpdatingPlayerType(false);
    }
  };

  if (!isOpen) return null;

  const handleUploadPlayerAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarStatusMsg('');
    setAvatarErrorMsg('');
    setIsSavingAvatar(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 256, 0.85);
      setAvatarPreviewUrl(dataUrl);
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authUser.email,
          userId: authUser.id,
          avatarUrl: dataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvatarErrorMsg(data.error || 'No se pudo guardar tu imagen de jugador.');
      } else {
        saveUserProfileAsync({ ...authUser, avatarUrl: dataUrl }).catch(() => {});
        setAvatarStatusMsg('¡Imagen de jugador actualizada! Ahora se verá en el Lobby y en la lista de Amigos.');
        if (onRefreshAuthStatus) {
          await onRefreshAuthStatus();
        }
      }
    } catch (err: any) {
      setAvatarErrorMsg(err?.message || 'Error al procesar la imagen.');
    } finally {
      setIsSavingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePlayerAvatar = async () => {
    setAvatarStatusMsg('');
    setAvatarErrorMsg('');
    setIsSavingAvatar(true);
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authUser.email,
          userId: authUser.id,
          avatarUrl: '',
        }),
      });
      if (res.ok) {
        saveUserProfileAsync({ ...authUser, avatarUrl: '' }).catch(() => {});
        setAvatarPreviewUrl('');
        setAvatarStatusMsg('Imagen de jugador restaurada al icono por defecto.');
        if (onRefreshAuthStatus) {
          await onRefreshAuthStatus();
        }
      }
    } catch {
      setAvatarErrorMsg('Error al quitar la imagen.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleCopyTag = () => {
    navigator.clipboard.writeText(myFullTag);
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const handleUserChangeTagId = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserTagStatusMsg('');
    setUserTagErrorMsg('');
    const clean = newTagId.replace(/^@+/, '').trim().slice(0, 3);
    if (!clean) {
      setUserTagErrorMsg('El ID debe tener al menos 1 carácter alfanumérico.');
      return;
    }

    setIsUpdatingTagId(true);
    try {
      const res = await fetch(`/api/users/${authUser.id}/tag-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTagId: clean,
          currentDisplayName: authUser.displayName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUserTagErrorMsg(data.error || 'No se pudo actualizar el ID.');
        return;
      }

      setUserTagStatusMsg(data.message || '¡ID actualizado con éxito!');
      if (onRefreshAuthStatus) {
        await onRefreshAuthStatus();
      }
    } catch (err: any) {
      setUserTagErrorMsg('Error al conectar con el servidor.');
    } finally {
      setIsUpdatingTagId(false);
    }
  };

  const handleUserChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserPassStatusMsg('');
    setUserPassErrorMsg('');

    if (userNewPassword !== userConfirmPassword) {
      setUserPassErrorMsg('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (userNewPassword.length < 3) {
      setUserPassErrorMsg('La nueva contraseña debe tener al menos 3 caracteres.');
      return;
    }

    setIsUpdatingUserPass(true);
    try {
      const res = await fetch(`/api/users/${authUser.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: userOldPassword,
          newPassword: userNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUserPassErrorMsg(data.error || 'No se pudo cambiar la contraseña.');
        return;
      }

      setUserPassStatusMsg(data.message || '¡Contraseña actualizada con éxito!');
      setUserOldPassword('');
      setUserNewPassword('');
      setUserConfirmPassword('');
    } catch (err) {
      setUserPassErrorMsg('Error al conectar con el servidor.');
    } finally {
      setIsUpdatingUserPass(false);
    }
  };

  const handleUserRequestForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequestingForgot(true);
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authUser.email,
          note: userForgotNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserForgotMsg(data.message || 'Solicitud de restablecimiento enviada al Administrador.');
      } else {
        setUserForgotMsg(data.error || 'No se pudo enviar la solicitud.');
      }
    } catch (e) {
      setUserForgotMsg('Error al conectar con el servidor.');
    } finally {
      setIsRequestingForgot(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#14151b] border border-amber-800/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="bg-[#181920] border-b border-stone-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-600/70 flex items-center justify-center text-amber-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel font-black text-base text-amber-200">
                  Seguridad & Perfil de Cuenta
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700/60 text-amber-300 font-bold">
                  {myFullTag}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Sube tu imagen de jugador para Amigos, ajusta tu @ID y actualiza tus credenciales.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#101115]">
          {/* Section 0: Player Profile Image (Avatar de Jugador para Lobby y Lista de Amigos) */}
          <div className="bg-[#161720] border border-amber-800/50 rounded-2xl p-5 shadow space-y-3">
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={handleUploadPlayerAvatar}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
              <div>
                <h4 className="font-cinzel font-bold text-sm text-amber-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  Imagen de Perfil de Jugador (No de Personaje)
                </h4>
                <p className="text-xs text-stone-400 mt-0.5">
                  Esta imagen aparece en tu bienvenida del Lobby y en el cuadrito junto a tu nombre en la lista de Amigos.
                </p>
              </div>
            </div>

            {avatarStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{avatarStatusMsg}</span>
              </div>
            )}
            {avatarErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{avatarErrorMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#111216] border-2 border-[#c8a45c] flex items-center justify-center shadow-lg shrink-0">
                  {(avatarPreviewUrl || authUser.avatarUrl) ? (
                    <img
                      src={avatarPreviewUrl || authUser.avatarUrl}
                      alt={authUser.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-cinzel font-black text-lg text-amber-300">
                      {authUser.displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-cinzel font-bold text-sm text-stone-100 block">
                    {authUser.displayName} <span className="font-mono text-amber-400 text-xs">#{currentTagId}</span>
                  </span>
                  <span className="text-[11px] text-stone-400 block">
                    Formatos soportados: PNG, JPG, WebP (se ajusta automáticamente a cuadrito).
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-upload-player-avatar"
                  disabled={isSavingAvatar}
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-cinzel font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isSavingAvatar ? 'Subiendo...' : 'Subir Imagen PNG/JPG'}</span>
                </button>
                {(avatarPreviewUrl || authUser.avatarUrl) && (
                  <button
                    type="button"
                    disabled={isSavingAvatar}
                    onClick={handleRemovePlayerAvatar}
                    className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 transition cursor-pointer"
                    title="Quitar imagen de jugador"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 0.5: Google Account Linking */}
          <div className="bg-[#161720] border border-amber-800/50 rounded-2xl p-5 shadow space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
              <h4 className="font-cinzel font-bold text-sm text-amber-300 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Cuenta de Google
              </h4>
            </div>

            {authUser.isGoogleLinked ? (
              <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-emerald-300 font-cinzel">Cuenta de Google Vinculada</strong>
                    <span>{authUser.email}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-900/90 border border-emerald-400/50 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                  Google Auth
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#121316] border border-stone-800 text-xs text-stone-300 space-y-3">
                <p>
                  Actualmente tu cuenta no está vinculada a Google. Puedes vincularla para iniciar sesión directamente con un solo clic.
                </p>
                {googleLinkSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{googleLinkSuccessMsg}</span>
                  </div>
                )}
                {googleLinkErrorMsg && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{googleLinkErrorMsg}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleInitiateGoogleLink}
                  disabled={isLinkingGoogle}
                  className="px-4 py-2.5 rounded-xl bg-[#1a1b23] hover:bg-[#232530] border border-stone-700 hover:border-amber-500 text-stone-200 font-cinzel font-bold text-xs shadow transition flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  {isLinkingGoogle ? 'Autenticando...' : 'Vincular Cuenta de Google'}
                </button>
              </div>
            )}
          </div>

          {/* Section 1: Username & Tag ID */}
          <form
            onSubmit={handleUserChangeTagId}
            className="bg-[#161720] border border-stone-800 rounded-2xl p-5 shadow space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
              <h4 className="font-cinzel font-bold text-sm text-stone-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                Mi Nombre de Usuario e Identificador (@ID)
              </h4>
              <button
                type="button"
                onClick={handleCopyTag}
                className="font-mono text-xs px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-300 font-bold flex items-center gap-1.5 hover:bg-emerald-900 transition"
                title="Copiar etiqueta completa"
              >
                {copiedTag ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{myFullTag}</span>
              </button>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Comparte tu nombre seguido de <span className="font-mono text-amber-300">@</span> y tu ID de hasta 3 caracteres (ej: <span className="font-mono text-stone-200">{myFullTag}</span>) para que otros jugadores puedan agregarte en Amigos.
            </p>

            {userTagStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{userTagStatusMsg}</span>
              </div>
            )}

            {userTagErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{userTagErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Nombre de Usuario
                </label>
                <input
                  type="text"
                  value={authUser.displayName}
                  readOnly
                  disabled
                  className="w-full bg-[#111216] border border-stone-800 rounded-xl px-3 py-2 text-stone-300 text-xs font-medium cursor-not-allowed select-all"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-cinzel font-bold uppercase text-amber-300 mb-1">
                  Tu ID (1 a 3 Caracteres)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#111216] border border-stone-700 focus-within:border-amber-500 rounded-xl px-2.5 py-1.5 flex-1">
                    <span className="font-mono font-bold text-amber-400 mr-1 text-xs">@</span>
                    <input
                      type="text"
                      maxLength={3}
                      value={newTagId}
                      onChange={(e) =>
                        setNewTagId(
                          e.target.value.replace(/^@+/, '').replace(/\s+/g, '').slice(0, 3)
                        )
                      }
                      placeholder="123"
                      required
                      className="w-full bg-transparent text-amber-200 font-mono font-bold text-xs outline-none uppercase"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingTagId}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-cinzel font-bold text-xs shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isUpdatingTagId ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Section 2: Table Player Type (Preferencia del Lobby — Requiere Aprobación de Moderador) */}
          <div className="bg-[#161720] border border-stone-800 rounded-2xl p-5 shadow space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
              <h4 className="font-cinzel font-bold text-sm text-stone-200 flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-400" />
                Rol de Mesa (Solicitud a Moderación)
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-stone-900 border border-stone-700 text-amber-300 font-bold">
                  Actual: {getPlayerTypeLabel(currentPlayerType)}
                </span>
                {(requestedPlayerType || authUser.playerTypeChangeRequested) && (
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-purple-950/90 border border-purple-500 text-purple-200 font-bold animate-pulse">
                    Solicitado: {getPlayerTypeLabel(requestedPlayerType || authUser.requestedPlayerType)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Para cambiar tu rol de mesa (<strong className="text-stone-200">Solo DM</strong>, <strong className="text-stone-200">Solo Jugador</strong> o <strong className="text-stone-200">DM y Jugador</strong>), selecciona la opción deseada para enviar una solicitud. Un <strong className="text-purple-300">Moderador o superior</strong> deberá aceptarla en el apartado de Moderación.
            </p>

            {(requestedPlayerType || authUser.playerTypeChangeRequested) && !playerTypeStatusMsg && (
              <div className="p-3 rounded-xl bg-purple-950/70 border border-purple-600/80 text-purple-200 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Tienes una solicitud pendiente para cambiar tu rol de mesa a{' '}
                  <strong>"{getPlayerTypeLabel(requestedPlayerType || authUser.requestedPlayerType)}"</strong>. En espera de aprobación de un Moderador.
                </span>
              </div>
            )}

            {playerTypeStatusMsg && (
              <div className="p-3 rounded-xl bg-purple-950/80 border border-purple-500 text-purple-200 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{playerTypeStatusMsg}</span>
              </div>
            )}

            {playerTypeErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{playerTypeErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Dungeon Master únicamente */}
              <button
                type="button"
                data-testid="btn-request-role-dm"
                disabled={isUpdatingPlayerType}
                onClick={() => handleSelectPlayerType('dm')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left cursor-pointer relative ${
                  currentPlayerType === 'dm'
                    ? 'bg-purple-950/90 border-purple-500 text-purple-200 shadow-lg ring-2 ring-purple-500/50'
                    : (requestedPlayerType || authUser.requestedPlayerType) === 'dm' &&
                      (requestedPlayerType || authUser.playerTypeChangeRequested)
                    ? 'bg-purple-950/50 border-purple-400 border-dashed text-purple-200'
                    : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-purple-700/60 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Crown className="w-5 h-5 text-purple-400" />
                  {currentPlayerType === 'dm' ? (
                    <span className="text-[9px] font-cinzel font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                      Actual
                    </span>
                  ) : (requestedPlayerType || authUser.requestedPlayerType) === 'dm' &&
                    (requestedPlayerType || authUser.playerTypeChangeRequested) ? (
                    <span className="text-[9px] font-cinzel font-bold uppercase px-1.5 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-500">
                      Solicitado
                    </span>
                  ) : null}
                </div>
                <span className="font-cinzel font-bold text-xs text-stone-200 block">
                  Dungeon Master únicamente
                </span>
                <span className="text-[10px] text-stone-400 mt-0.5">
                  {currentPlayerType === 'dm' ? 'Tu rol activo en el Lobby' : 'Solicitar cambio a Solo DM'}
                </span>
              </button>

              {/* Jugador únicamente */}
              <button
                type="button"
                data-testid="btn-request-role-player"
                disabled={isUpdatingPlayerType}
                onClick={() => handleSelectPlayerType('player')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left cursor-pointer relative ${
                  currentPlayerType === 'player'
                    ? 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-lg ring-2 ring-amber-500/50'
                    : (requestedPlayerType || authUser.requestedPlayerType) === 'player' &&
                      (requestedPlayerType || authUser.playerTypeChangeRequested)
                    ? 'bg-amber-950/50 border-amber-400 border-dashed text-amber-200'
                    : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-amber-700/60 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <User className="w-5 h-5 text-amber-400" />
                  {currentPlayerType === 'player' ? (
                    <span className="text-[9px] font-cinzel font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                      Actual
                    </span>
                  ) : (requestedPlayerType || authUser.requestedPlayerType) === 'player' &&
                    (requestedPlayerType || authUser.playerTypeChangeRequested) ? (
                    <span className="text-[9px] font-cinzel font-bold uppercase px-1.5 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-500">
                      Solicitado
                    </span>
                  ) : null}
                </div>
                <span className="font-cinzel font-bold text-xs text-stone-200 block">
                  Jugador únicamente
                </span>
                <span className="text-[10px] text-stone-400 mt-0.5">
                  {currentPlayerType === 'player' ? 'Tu rol activo en el Lobby' : 'Solicitar cambio a Solo Jugador'}
                </span>
              </button>

              {/* DM y Jugador */}
              <button
                type="button"
                data-testid="btn-request-role-both"
                disabled={isUpdatingPlayerType}
                onClick={() => handleSelectPlayerType('both')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left cursor-pointer relative ${
                  currentPlayerType === 'both'
                    ? 'bg-gradient-to-br from-amber-950/90 to-purple-950/90 border-amber-400 text-amber-100 shadow-lg ring-2 ring-amber-400/50'
                    : (requestedPlayerType || authUser.requestedPlayerType) === 'both' &&
                      (requestedPlayerType || authUser.playerTypeChangeRequested)
                    ? 'bg-purple-950/50 border-amber-400 border-dashed text-amber-200'
                    : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-amber-700/60 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  {currentPlayerType === 'both' ? (
                    <span className="text-[9px] font-cinzel font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                      Actual
                    </span>
                  ) : (requestedPlayerType || authUser.requestedPlayerType) === 'both' &&
                    (requestedPlayerType || authUser.playerTypeChangeRequested) ? (
                    <span className="text-[9px] font-cinzel font-bold uppercase px-1.5 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-500">
                      Solicitado
                    </span>
                  ) : null}
                </div>
                <span className="font-cinzel font-bold text-xs text-stone-200 block">
                  DM y Jugador
                </span>
                <span className="text-[10px] text-stone-400 mt-0.5">
                  {currentPlayerType === 'both' ? 'Tu rol activo en el Lobby' : 'Solicitar cambio a DM y Jugador'}
                </span>
              </button>
            </div>
          </div>

          {/* Section 3: Change Password */}
          <form
            onSubmit={handleUserChangePassword}
            className="bg-[#161720] border border-stone-800 rounded-2xl p-5 shadow space-y-3"
          >
            <h4 className="font-cinzel font-bold text-sm text-stone-200 flex items-center gap-2 border-b border-stone-800/80 pb-3">
              <Lock className="w-4 h-4 text-amber-400" />
              Cambiar mi Contraseña
            </h4>

            {userPassStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{userPassStatusMsg}</span>
              </div>
            )}

            {userPassErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{userPassErrorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-cinzel font-bold uppercase text-stone-400 mb-1">
                Contraseña Actual
              </label>
              <input
                type="password"
                value={userOldPassword}
                onChange={(e) => setUserOldPassword(e.target.value)}
                placeholder="Tu contraseña actual..."
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-stone-100 text-xs font-mono outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={userNewPassword}
                  onChange={(e) => setUserNewPassword(e.target.value)}
                  placeholder="Mínimo 3 caracteres..."
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-stone-100 text-xs font-mono outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={userConfirmPassword}
                  onChange={(e) => setUserConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña..."
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-stone-100 text-xs font-mono outline-none transition"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isUpdatingUserPass}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isUpdatingUserPass ? 'Guardando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>

          {/* Section 3: Reset Request / Help */}
          <div className="bg-[#161720] border border-stone-800 rounded-2xl p-5 shadow space-y-3">
            <h4 className="font-cinzel font-bold text-sm text-stone-200 flex items-center gap-2 border-b border-stone-800/80 pb-3">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              ¿Olvidaste tu contraseña o requieres reseteo?
            </h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Si no recuerdas tu contraseña actual para cambiarla, envía una solicitud formal de restablecimiento al Administrador del servidor.
            </p>

            {userForgotMsg ? (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{userForgotMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleUserRequestForgot} className="space-y-2 pt-1">
                <input
                  type="text"
                  value={userForgotNote}
                  onChange={(e) => setUserForgotNote(e.target.value)}
                  placeholder="Nota o motivo para el Administrador (opcional)..."
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3 py-2 text-stone-200 text-xs outline-none focus:border-amber-500 transition"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isRequestingForgot}
                    className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-cinzel font-bold text-xs border border-amber-800/60 shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {isRequestingForgot ? 'Enviando...' : 'Solicitar Reseteo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Google Account Linking */}
      {pendingGoogleConfirm && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#181920] border-2 border-amber-600/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-300">
              <AlertCircle className="w-6 h-6 shrink-0 text-amber-400" />
              <h4 className="font-cinzel font-bold text-base">Confirmar Vinculación de Google</h4>
            </div>
            <p className="text-xs text-stone-200 leading-relaxed">
              <strong>Atención:</strong> Vincular tu cuenta de Google actualizará permanentemente el correo de tu cuenta de WeRoll al correo de tu cuenta de Google (<span className="font-mono text-amber-300 font-bold">{pendingGoogleConfirm.email}</span>). Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingGoogleConfirm(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmGoogleLink}
                disabled={isLinkingGoogle}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow transition disabled:opacity-50"
              >
                {isLinkingGoogle ? 'Vinculando...' : 'Confirmar y Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
