import React, { useState } from 'react';
import { User, Shield, ShieldCheck, KeyRound, Lock, AlertCircle, Sparkles, Check, ChevronRight, Mail, UserPlus, LogIn, Clock, ArrowLeft, Crown } from 'lucide-react';
import { HostSettings, UserRole, PlayerType, AppRole } from '../../types/dnd';
import { BrandLogo } from '../common/BrandLogo';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase/config';

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

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  dmPasswordExpected?: string;
  moderatorPasswordExpected?: string;
  hostSettings?: HostSettings;
  onSelectRole: (role: UserRole, user?: AuthSessionUser) => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onClose,
  canClose = false,
  dmPasswordExpected = '',
  moderatorPasswordExpected = 'admin',
  hostSettings,
  onSelectRole,
}) => {
  // Default mode is directly 'login' as requested
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'adminPassword' | 'forgotPassword' | 'google-onboard'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('moderator');

  // Google Onboarding state for new Google users
  const [googleOnboardData, setGoogleOnboardData] = useState<{
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  } | null>(null);
  const [googleDisplayName, setGoogleDisplayName] = useState<string>('');
  const [googleTagId, setGoogleTagId] = useState<string>('123');
  const [googlePlayerType, setGooglePlayerType] = useState<PlayerType>('player');

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Register form state
  const [regEmail, setRegEmail] = useState<string>('');
  const [regName, setRegName] = useState<string>('');
  const [regTagId, setRegTagId] = useState<string>('123');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regRole, setRegRole] = useState<'player' | 'dm' | 'both'>('player');
  const [regAppRole, setRegAppRole] = useState<AppRole>('client');
  const [regOtpCode, setRegOtpCode] = useState<string>('');
  const [otpSentPreview, setOtpSentPreview] = useState<string>('');
  const [otpVerified, setOtpVerified] = useState<boolean>(false);
  const [otpSending, setOtpSending] = useState<boolean>(false);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotNote, setForgotNote] = useState<string>('');
  const [forgotSuccess, setForgotSuccess] = useState<string>('');

  // Direct DM / Admin password
  const [enteredPassword, setEnteredPassword] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pendingNotice, setPendingNotice] = useState<string>('');
  const [rejectedNotice, setRejectedNotice] = useState<{ message: string; customMessage?: string } | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setPendingNotice('');
    setRejectedNotice(null);
    setIsLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const gUser = userCredential.user;
      if (gUser) {
        const res = await fetch('/api/auth/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: gUser.uid,
            email: gUser.email,
            displayName: gUser.displayName || gUser.email?.split('@')[0] || 'Aventurero',
            photoURL: gUser.photoURL,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || 'Error al autenticar con Google.');
          return;
        }

        // New Google user requires completing onboarding (Display Name, @ID, and Player Type)
        if (data.needsOnboarding && data.googleData) {
          setGoogleOnboardData(data.googleData);
          setGoogleDisplayName(data.googleData.displayName || '');
          setGoogleTagId('123');
          setGooglePlayerType('player');
          setAuthMode('google-onboard');
          return;
        }

        // Existing user in pending status must be blocked
        if (data.user?.status === 'pending') {
          setPendingNotice(
            'Tu cuenta vinculada a Google está en estado PENDIENTE de aprobación por el Administrador. No puedes ingresar hasta que sea aprobada.'
          );
          return;
        }

        if (data.user?.status === 'rejected') {
          setRejectedNotice({
            message: 'Tu solicitud de acceso ha sido rechazada por el Administrador.',
            customMessage: data.customMessage,
          });
          return;
        }

        onSelectRole(data.user.role || 'player', data.user);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      setErrorMessage(err.message || 'Error al autenticar con Google Firebase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOnboardData) return;
    setErrorMessage('');
    setPendingNotice('');
    if (!googleDisplayName.trim()) {
      setErrorMessage('Ingresa un nombre de aventurero para tu cuenta de WeRoll.');
      return;
    }
    const cleanTag = googleTagId.replace(/^@+/, '').trim().slice(0, 3) || '123';
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/google-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: googleOnboardData.uid,
          email: googleOnboardData.email,
          displayName: googleDisplayName.trim(),
          userTagId: cleanTag,
          playerType: googlePlayerType,
          photoURL: googleOnboardData.photoURL,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Error al completar el registro con Google.');
        return;
      }
      setPendingNotice(
        '¡Cuenta registrada con éxito! Tu cuenta vinculada a Google ha sido creada y se encuentra en estado PENDIENTE de aprobación por un moderador o administrador.'
      );
      setAuthMode('login');
      setLoginEmail(googleOnboardData.email);
    } catch {
      setErrorMessage('Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtpCode = async () => {
    setErrorMessage('');
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Ingresa un correo electrónico válido antes de solicitar el código OTP.');
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'No se pudo generar el código OTP.');
      } else if (data.alreadyVerified) {
        setOtpVerified(true);
        setOtpSentPreview('');
      } else {
        setOtpVerified(false);
        if (data.otpPreviewCode) {
          setOtpSentPreview(String(data.otpPreviewCode));
          setRegOtpCode(String(data.otpPreviewCode));
        }
      }
    } catch {
      setErrorMessage('Error de conexión al enviar el código OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtpCode = async () => {
    setErrorMessage('');
    if (!regEmail.trim() || !regOtpCode.trim()) {
      setErrorMessage('Ingresa el código OTP de 6 dígitos.');
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim(), code: regOtpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Código OTP inválido.');
      } else {
        setOtpVerified(true);
      }
    } catch {
      setErrorMessage('Error al verificar el código OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setErrorMessage('Ingresa el correo electrónico asociado a tu cuenta.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, note: forgotNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Error al procesar la solicitud.');
      } else {
        setForgotSuccess(
          data.message ||
            'Solicitud enviada al Administrador. El administrador revisará tu cuenta y te proporcionará una nueva clave.'
        );
      }
    } catch (err) {
      setErrorMessage('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleDirectPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    setRejectedNotice(null);

    const expected = (moderatorPasswordExpected || 'admin').trim();
    if (enteredPassword.trim() === expected) {
      onSelectRole('moderator', {
        id: 'usr-admin-master',
        email: 'admin@weroll.app',
        displayName: 'Administrador Supremo',
        role: 'moderator',
        status: 'approved',
      });
    } else {
      setErrorMessage('Contraseña de Administrador incorrecta.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    setRejectedNotice(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage('Por favor ingresa tu correo electrónico y contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'pending') {
          setPendingNotice(
            data.error || 'Tu cuenta está en estado PENDIENTE de aprobación por el Administrador. No puedes ingresar hasta que sea aprobada.'
          );
        } else if (data.status === 'rejected') {
          setRejectedNotice({
            message: data.error || 'Tu solicitud de acceso ha sido rechazada por el Administrador.',
            customMessage:
              data.customMessage ||
              'Lo lamentamos, por el momento no puedes acceder a WeRoll. Manda mensaje a soporte@weroll.app si quieres una revisión manual de tu caso.',
          });
        } else {
          setErrorMessage(data.error || 'Error al iniciar sesión.');
        }
        return;
      }

      onSelectRole(data.user.role, data.user);
    } catch (err: any) {
      setErrorMessage('No se pudo conectar con el servidor para verificar las credenciales. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    if (!regEmail.trim() || !regName.trim() || !regPassword.trim()) {
      setErrorMessage('Todos los campos son obligatorios.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          displayName: regName,
          userTagId: regTagId.replace(/^@+/, '').trim().slice(0, 3) || '123',
          password: regPassword,
          requestedRole: regRole,
          playerType: regRole,
          appRole: regAppRole,
          otpCode: regOtpCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Error en el registro.');
        return;
      }

      setPendingNotice(
        '¡Solicitud enviada con éxito! Tu cuenta ha sido validada con OTP y está en estado PENDIENTE de aprobación por el Administrador.'
      );
      setAuthMode('login');
      setLoginEmail(regEmail);
    } catch (err: any) {
      setErrorMessage('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-[#181920] border-2 border-amber-900/80 rounded-3xl shadow-2xl p-6 sm:p-8 text-stone-200 flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <BrandLogo hostSettings={hostSettings} size="lg" className="mb-3 mx-auto" />
          <h2 className="font-cinzel font-black text-2xl text-amber-300 tracking-wider">
            WeRoll
          </h2>
          <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-cinzel">
            {authMode === 'google-onboard'
              ? 'Completar Registro con Google'
              : authMode === 'register'
              ? 'Crear Cuenta y Seleccionar Perfil'
              : authMode === 'adminPassword'
              ? 'Acceso con Clave Maestra'
              : authMode === 'forgotPassword'
              ? 'Recuperar / Restablecer Contraseña'
              : 'Iniciar Sesión en tu Cuenta'}
          </p>
        </div>

        {pendingNotice && (
          <div className="mb-4 p-4 rounded-xl bg-amber-950/80 border border-amber-600/70 text-xs text-amber-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block font-cinzel font-bold text-amber-300 mb-0.5">Cuenta en Revisión</strong>
              {pendingNotice}
            </div>
          </div>
        )}

        {rejectedNotice && (
          <div className="mb-4 p-4 rounded-xl bg-red-950/90 border border-red-600/80 text-xs text-red-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed w-full">
              <strong className="block font-cinzel font-bold text-red-300 mb-1 text-sm">
                Solicitud de Acceso Rechazada
              </strong>
              <p className="text-red-200/90">{rejectedNotice.message}</p>
              {rejectedNotice.customMessage && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#121318] border border-red-900/60 text-stone-300 font-sans leading-relaxed">
                  {rejectedNotice.customMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1. LOGIN FORM (FIRST OPTION PRESENTED TO USERS)                     */}
        {/* =================================================================== */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoFocus
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-cinzel font-bold uppercase text-stone-400">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setForgotSuccess('');
                    setForgotEmail(loginEmail);
                    setAuthMode('forgotPassword');
                  }}
                  className="text-[11px] text-amber-400/90 hover:text-amber-300 transition underline font-sans"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-stone-800"></div>
              <span className="flex-shrink mx-3 text-[11px] font-cinzel text-stone-500 uppercase tracking-wider">o continuar con</span>
              <div className="flex-grow border-t border-stone-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-[#1a1b23] hover:bg-[#232530] border border-stone-700/80 hover:border-amber-500/70 text-stone-200 font-cinzel font-bold text-xs shadow-lg transition flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continuar con Google (Firebase)
            </button>

            {/* Link to Register */}
            <div className="pt-3 text-center border-t border-stone-800/80 space-y-2">
              <p className="text-xs text-stone-400">
                ¿No tienes una cuenta registrada todavía?
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPendingNotice('');
                  setRejectedNotice(null);
                  setAuthMode('register');
                }}
                className="px-4 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/50 text-amber-300 font-cinzel font-bold text-xs transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Registrar Nueva Cuenta
              </button>
            </div>

            {/* Direct Admin Master Password Access Option */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPendingNotice('');
                  setAuthMode('adminPassword');
                }}
                className="text-[11px] text-stone-500 hover:text-blue-400 font-mono transition flex items-center justify-center gap-1 mx-auto"
              >
                <KeyRound className="w-3 h-3" />
                Acceso directo con Clave Maestra de Administrador
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* GOOGLE ONBOARDING FORM                                              */}
        {/* =================================================================== */}
        {authMode === 'google-onboard' && googleOnboardData && (
          <form onSubmit={handleGoogleOnboardSubmit} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200 flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <div>
                <strong className="block font-cinzel font-bold text-amber-300">Cuenta de Google detectada</strong>
                <span>{googleOnboardData.email}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Nombre de Usuario en WeRoll
              </label>
              <input
                type="text"
                value={googleDisplayName}
                onChange={(e) => setGoogleDisplayName(e.target.value)}
                placeholder="Ej. Valeros del Alba"
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Tag Identificador de 3 Caracteres (@ID)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-amber-400 font-mono font-bold">@</span>
                <input
                  type="text"
                  maxLength={3}
                  value={googleTagId}
                  onChange={(e) => setGoogleTagId(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="123"
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl pl-8 pr-3.5 py-2.5 text-stone-100 font-mono font-bold text-sm uppercase outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-amber-400 mb-1.5">
                Tipo de Jugador / Mesa
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGooglePlayerType('player')}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    googlePlayerType === 'player'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-md'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <span className="font-cinzel font-bold text-xs block">Jugador</span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">Participante</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGooglePlayerType('dm')}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    googlePlayerType === 'dm'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-md'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <span className="font-cinzel font-bold text-xs block">DM / Master</span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">Narrador</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGooglePlayerType('both')}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    googlePlayerType === 'both'
                      ? 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-md'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <span className="font-cinzel font-bold text-xs block">Ambos</span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">Jugador & DM</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#121316] border border-amber-900/50 text-[11px] text-stone-300 leading-relaxed">
              ℹ️ <strong>Revisión de Seguridad:</strong> Tu cuenta con Google se registrará en estado <strong>Pendiente de Aprobación</strong>. Un moderador o administrador deberá revisar y aprobar tu cuenta antes de acceder al portal.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {isLoading ? 'Registrando con Google...' : 'Completar Registro y Solicitar Aprobación'}
            </button>

            <div className="pt-2 text-center border-t border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setAuthMode('login');
                }}
                className="text-xs text-stone-400 hover:text-amber-300 transition flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Regresar al inicio de sesión
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* 2. REGISTER FORM (WITH REQUIRED ROLE PROFILES)                      */}
        {/* =================================================================== */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400">
                Correo Electrónico (Validación OTP para cuentas nuevas)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    setOtpVerified(false);
                  }}
                  placeholder="tu@correo.com"
                  autoFocus
                  required
                  className="flex-1 bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
                />
                <button
                  type="button"
                  onClick={handleSendOtpCode}
                  disabled={otpSending || !regEmail.trim()}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-200 font-cinzel font-bold text-xs transition shrink-0 disabled:opacity-50"
                >
                  {otpSending ? 'Enviando...' : otpSentPreview ? 'Reenviar OTP' : 'Enviar Código OTP'}
                </button>
              </div>

              {(otpSentPreview || otpVerified || regOtpCode) && (
                <div className="p-3 rounded-xl bg-[#121316] border border-amber-700/60 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-cinzel font-bold text-amber-300">
                      Código OTP de 6 dígitos
                    </span>
                    {otpVerified ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Correo Verificado
                      </span>
                    ) : otpSentPreview ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[10px] font-mono">
                        Código enviado: <strong>{otpSentPreview}</strong>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={regOtpCode}
                      onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="flex-1 bg-[#181920] border border-stone-700 focus:border-amber-400 rounded-lg px-3 py-1.5 text-amber-200 font-mono font-bold tracking-widest text-sm outline-none"
                    />
                    {!otpVerified && (
                      <button
                        type="button"
                        onClick={handleVerifyOtpCode}
                        disabled={otpSending || regOtpCode.length < 6}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-cinzel font-bold text-xs transition disabled:opacity-50"
                      >
                        Verificar OTP
                      </button>
                    )}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-stone-500">
                Las cuentas ya registradas anteriormente están verificadas y no requieren código OTP para iniciar sesión.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Nombre de Usuario / Apodo
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="ej. usuario1 o SirGareth"
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-amber-300 mb-1">
                  Tu ID (Máx. 3 car.)
                </label>
                <div className="flex items-center bg-[#121316] border border-amber-700/70 focus-within:border-amber-400 rounded-xl px-3 py-2.5 transition">
                  <span className="text-amber-400 font-mono font-bold text-sm mr-1">@</span>
                  <input
                    type="text"
                    maxLength={3}
                    value={regTagId}
                    onChange={(e) =>
                      setRegTagId(e.target.value.replace(/^@+/, '').replace(/\s+/g, '').slice(0, 3))
                    }
                    placeholder="123"
                    required
                    className="w-full bg-transparent text-amber-200 font-mono font-bold text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/50 text-[11px] text-stone-300 flex items-center justify-between">
              <span>Tu identificador para agregar amigos será:</span>
              <span className="font-mono font-bold text-amber-300 bg-[#121316] px-2.5 py-0.5 rounded-lg border border-amber-700/60">
                {(regName.trim() || 'usuario')}@{(regTagId.trim() || '123').slice(0, 3)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none transition"
              />
            </div>

            {/* 1. Rol de Tipo de Jugador */}
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-amber-300 mb-1.5">
                1. Rol de Tipo de Jugador
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Dungeon Master únicamente */}
                <button
                  type="button"
                  onClick={() => setRegRole('dm')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regRole === 'dm'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <Crown className="w-5 h-5 mb-1 text-purple-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Dungeon Master únicamente
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    World Sheets y mesas
                  </span>
                </button>

                {/* Jugador únicamente */}
                <button
                  type="button"
                  onClick={() => setRegRole('player')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regRole === 'player'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-md ring-1 ring-amber-500'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <User className="w-5 h-5 mb-1 text-amber-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Jugador únicamente
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Hojas de personaje y dados
                  </span>
                </button>

                {/* DM y Jugador */}
                <button
                  type="button"
                  onClick={() => setRegRole('both')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regRole === 'both'
                      ? 'bg-gradient-to-br from-amber-950 to-purple-950 border-amber-400 text-amber-100 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <Sparkles className="w-5 h-5 mb-1 text-amber-300" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    DM y Jugador
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Acceso dual completo
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Rol en la Aplicación */}
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-blue-300 mb-1.5">
                2. Rol en la Aplicación
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Cliente */}
                <button
                  type="button"
                  onClick={() => setRegAppRole('client')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regAppRole === 'client'
                      ? 'bg-stone-800/90 border-stone-400 text-stone-100 shadow-md ring-1 ring-stone-400'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <User className="w-5 h-5 mb-1 text-stone-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Cliente
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Usuario estándar
                  </span>
                </button>

                {/* Moderador */}
                <button
                  type="button"
                  onClick={() => setRegAppRole('moderator')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regAppRole === 'moderator'
                      ? 'bg-purple-950/80 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 mb-1 text-purple-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Moderador
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Gestión de foro & altas
                  </span>
                </button>

                {/* Admin */}
                <button
                  type="button"
                  onClick={() => setRegAppRole('admin')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regAppRole === 'admin'
                      ? 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-md ring-1 ring-blue-500'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <Shield className="w-5 h-5 mb-1 text-blue-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Admin
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Administrador general
                  </span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#121316] border border-amber-900/40 text-[11px] text-stone-300 leading-relaxed">
              ℹ️ <strong>Revisión del Administrador:</strong> Al registrarte, tu cuenta quedará en estado de preaprobación. Una vez aprobada por el Administrador, podrás crear y guardar tus fichas o World Sheets.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {isLoading ? 'Registrando cuenta...' : 'Crear Cuenta y Solicitar Aprobación'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-stone-800"></div>
              <span className="flex-shrink mx-3 text-[11px] font-cinzel text-stone-500 uppercase tracking-wider">o registrarte con</span>
              <div className="flex-grow border-t border-stone-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-[#1a1b23] hover:bg-[#232530] border border-stone-700/80 hover:border-amber-500/70 text-stone-200 font-cinzel font-bold text-xs shadow-lg transition flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continuar con Google (Firebase)
            </button>

            <div className="pt-2 text-center border-t border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPendingNotice('');
                  setRejectedNotice(null);
                  setAuthMode('login');
                }}
                className="text-xs text-stone-400 hover:text-amber-300 transition flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ¿Ya tienes una cuenta registrada? <strong className="underline text-amber-400 ml-1">Inicia Sesión</strong>
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* 3. DIRECT ADMIN MASTER PASSWORD MODAL                               */}
        {/* =================================================================== */}
        {authMode === 'adminPassword' && (
          <form onSubmit={handleDirectPasswordSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#121316] border border-blue-900/50">
              <div className="flex items-center gap-2.5 mb-2">
                <Lock className="w-5 h-5 text-blue-400" />
                <h3 className="font-cinzel font-bold text-base text-stone-200">
                  Acceso de Administrador Maestro
                </h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Introduce la contraseña maestra de moderador/administrador configurada en el servidor para acceder inmediatamente con permisos de gestión, bóveda y ajustes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Contraseña Maestra de Administrador
              </label>
              <input
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none transition"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Iniciar Sesión
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl font-cinzel font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-lg transition"
              >
                Verificar & Acceder
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* 4. FORGOT PASSWORD REQUEST VIEW                                    */}
        {/* =================================================================== */}
        {authMode === 'forgotPassword' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#121316] border border-amber-900/50 text-xs text-stone-300 space-y-2">
              <div className="flex items-center gap-2 font-cinzel font-bold text-amber-300">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Restablecimiento Asistido de Contraseña</span>
              </div>
              <p className="leading-relaxed">
                Ingresa tu correo electrónico registrado. Tu solicitud quedará marcada inmediatamente en el Panel de Administración para que un moderador pueda restablecer o entregarte tu nueva clave de acceso.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-600 text-xs text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-cinzel font-bold text-emerald-300">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>¡Solicitud Registrada con Éxito!</span>
                </div>
                <p className="leading-relaxed">{forgotSuccess}</p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotSuccess('');
                    setAuthMode('login');
                  }}
                  className="mt-2 w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-cinzel font-bold text-xs transition"
                >
                  Volver a Iniciar Sesión
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                    Correo Electrónico de tu Cuenta
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoFocus
                    required
                    className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                    Nota o Mensaje para el Administrador (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={forgotNote}
                    onChange={(e) => setForgotNote(e.target.value)}
                    placeholder="Ej. Olvidé mi clave, por favor restablecer a..."
                    className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl p-3 text-stone-100 text-xs outline-none resize-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {isLoading ? 'Enviando solicitud...' : 'Solicitar Restablecimiento al Administrador'}
                </button>

                <div className="pt-2 text-center border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setAuthMode('login');
                    }}
                    className="text-xs text-stone-400 hover:text-amber-300 transition flex items-center justify-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Regresar al inicio de sesión
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Can close if already logged in */}
        {canClose && onClose && (
          <div className="mt-6 pt-4 border-t border-stone-800/80 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-stone-500 hover:text-stone-300 transition"
            >
              Mantener sesión actual
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
