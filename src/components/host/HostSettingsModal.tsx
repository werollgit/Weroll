import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  Key,
  Bell,
  Sparkles,
  Shield,
  Save,
  Cpu,
  Layers,
  Palette,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  HelpCircle,
  Sword,
  BookOpen,
  Users,
  Database,
  Download,
  Check,
  UserCheck,
  UserX,
  RefreshCw,
  Flame,
  Crown,
  Skull,
  Wand2,
  Castle,
  Upload,
  Dices,
  Clock,
  GitBranch,
  HardDrive,
  Webhook,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { HostSettings, ChangelogEntry, UserAccountPublic, AutoBackupLog } from '../../types/dnd';

interface HostSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: HostSettings;
  onSaveSettings: (updated: HostSettings) => void;
}

export const HostSettingsModal: React.FC<HostSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [activeTab, setActiveTab] = useState<
    'app' | 'ai' | 'security' | 'changelog' | 'users' | 'vault' | 'notice' | 'autobackup'
  >('app');

  // Auto Backup State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(settings.autoBackup?.enabled ?? false);
  const [autoBackupFreq, setAutoBackupFreq] = useState<12 | 24>(settings.autoBackup?.frequencyHours || 24);
  const [autoBackupDest, setAutoBackupDest] = useState<'github' | 'drive' | 'webhook'>(
    settings.autoBackup?.destination || 'github'
  );
  const [githubToken, setGithubToken] = useState<string>(settings.autoBackup?.githubToken || '');
  const [githubRepo, setGithubRepo] = useState<string>(settings.autoBackup?.githubRepo || '');
  const [githubPath, setGithubPath] = useState<string>(
    settings.autoBackup?.githubPath || 'backups/weroll-backup-latest.json'
  );
  const [driveFolderId, setDriveFolderId] = useState<string>(settings.autoBackup?.driveFolderId || '');
  const [driveAccessToken, setDriveAccessToken] = useState<string>(settings.autoBackup?.driveAccessToken || '');
  const [driveAccountEmail, setDriveAccountEmail] = useState<string>(settings.autoBackup?.driveAccountEmail || '');
  const [webhookUrl, setWebhookUrl] = useState<string>(settings.autoBackup?.webhookUrl || '');

  const [testBackupLoading, setTestBackupLoading] = useState<boolean>(false);
  const [testBackupMsg, setTestBackupMsg] = useState<string>('');
  const [testBackupError, setTestBackupError] = useState<string>('');

  const handleRunTestBackup = async () => {
    setTestBackupLoading(true);
    setTestBackupMsg('');
    setTestBackupError('');
    try {
      const cfg = {
        enabled: autoBackupEnabled,
        frequencyHours: autoBackupFreq,
        destination: autoBackupDest,
        githubToken: githubToken.trim(),
        githubRepo: githubRepo.trim(),
        githubPath: githubPath.trim(),
        driveFolderId: driveFolderId.trim(),
        driveAccessToken: driveAccessToken.trim(),
        driveAccountEmail: driveAccountEmail.trim(),
        webhookUrl: webhookUrl.trim(),
      };
      const res = await fetch('/api/admin/vault/trigger-autobackup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar respaldo.');
      setTestBackupMsg(data.message || '¡Respaldo de prueba enviado con éxito!');
      fetchVault();
    } catch (err: any) {
      setTestBackupError(err.message || 'Error al conectar.');
    } finally {
      setTestBackupLoading(false);
    }
  };

  const handleUnlinkGithub = async () => {
    setGithubToken('');
    setGithubRepo('');
    setGithubPath('');
    setAutoBackupDest('drive');
    setTestBackupMsg('');
    setTestBackupError('');
    try {
      const res = await fetch('/api/admin/vault/unlink-github', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al desvincular GitHub');
      setTestBackupMsg(data.message || 'Cuenta de GitHub desvinculada exitosamente.');
      try {
        localStorage.removeItem('weroll_cloud_mirror_config_v2');
        const curHost = JSON.parse(localStorage.getItem('weroll_host_settings_v1') || '{}');
        if (curHost.autoBackup) {
          curHost.autoBackup.githubToken = '';
          curHost.autoBackup.githubRepo = '';
          curHost.autoBackup.destination = 'drive';
          localStorage.setItem('weroll_host_settings_v1', JSON.stringify(curHost));
        }
      } catch {}
      fetchVault();
    } catch (err: any) {
      setTestBackupError(err.message || 'Error al desvincular GitHub.');
    }
  };

  // App & Branding
  const [headerTitle, setHeaderTitle] = useState<string>(settings.headerTitle || 'WeRoll');
  const [headerSubtitle, setHeaderSubtitle] = useState<string>(
    settings.headerSubtitle || 'Companion & DM Suite v0.1'
  );
  const [headerLogoIcon, setHeaderLogoIcon] = useState<string>(settings.headerLogoIcon || 'shield');
  const [logoType, setLogoType] = useState<'icon' | 'custom'>(settings.logoType || 'icon');
  const [customLogoUrl, setCustomLogoUrl] = useState<string | undefined>(settings.customLogoUrl);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP, GIF, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setCustomLogoUrl(dataUrl);
      setLogoType('custom');
    };
    reader.readAsDataURL(file);
  };

  // AI & Models
  const [apiKey, setApiKey] = useState<string>(settings.apiKeyOverride || '');
  const [aiModel, setAiModel] = useState<string>(settings.aiModel || 'gemini-flash-lite-latest');
  const [oracleWelcome, setOracleWelcome] = useState<string>(
    settings.oracleWelcomeMessage ||
      'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?'
  );

  // Security & Passwords
  const [dmPassword, setDmPassword] = useState<string>(settings.dmPassword || '');
  const [moderatorPassword, setModeratorPassword] = useState<string>(settings.moderatorPassword || 'admin');
  const [roleSwitchingAllowed, setRoleSwitchingAllowed] = useState<'strict' | 'open'>(
    settings.roleSwitchingAllowed || 'strict'
  );

  // Developer Global Notice
  const [devNoticeEnabled, setDevNoticeEnabled] = useState<boolean>(settings.developerNotice?.enabled ?? true);
  const [devNoticeTitle, setDevNoticeTitle] = useState<string>(
    settings.developerNotice?.title || 'WeRoll • Actualizaciones v0.1'
  );
  const [devNoticeContent, setDevNoticeContent] = useState<string>(
    settings.developerNotice?.content ||
      'Bienvenido a WeRoll v0.1. Se ha implementado el Hub de partidas, salas protegidas con clave, aprobación de usuarios, estados AFK, respaldos rotativos en servidor y borrador IA relacional.'
  );

  // Changelog List
  const [changelog, setChangelog] = useState<ChangelogEntry[]>(() => settings.changelog || []);
  const [newVersionInput, setNewVersionInput] = useState<string>('');
  const [newVersionTitle, setNewVersionTitle] = useState<string>('');
  const [newVersionChanges, setNewVersionChanges] = useState<string>('');

  // Users Admin Management State
  const [usersList, setUsersList] = useState<UserAccountPublic[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  // Vault Server State
  const [vaultSheets, setVaultSheets] = useState<any[]>([]);
  const [vaultWorlds, setVaultWorlds] = useState<any[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState<boolean>(false);

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Fetch users when switching to users tab
  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      fetchUsers();
    } else if (isOpen && activeTab === 'vault') {
      fetchVault();
    }
  }, [isOpen, activeTab]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchVault = async () => {
    setIsLoadingVault(true);
    try {
      const [resSheets, resWorlds] = await Promise.all([
        fetch('/api/vault/sheets'),
        fetch('/api/vault/worlds'),
      ]);
      if (resSheets.ok) {
        const d = await resSheets.json();
        setVaultSheets(d.sheets || []);
      }
      if (resWorlds.ok) {
        const d = await resWorlds.json();
        setVaultWorlds(d.worlds || []);
      }
    } catch (e) {
      console.error('Error fetching vault data:', e);
    } finally {
      setIsLoadingVault(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, { method: 'POST' });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddChangelogEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionInput.trim() || !newVersionTitle.trim()) return;

    const changesArray = newVersionChanges
      .split('\n')
      .map((c) => c.trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean);

    const newEntry: ChangelogEntry = {
      version: newVersionInput.trim(),
      date: new Date().toISOString().split('T')[0],
      title: newVersionTitle.trim(),
      changes: changesArray.length > 0 ? changesArray : ['Actualizaciones menores del sistema.'],
    };

    setChangelog((prev) => [newEntry, ...prev]);
    setNewVersionInput('');
    setNewVersionTitle('');
    setNewVersionChanges('');
  };

  const handleRemoveChangelogEntry = (index: number) => {
    setChangelog((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    onSaveSettings({
      ...settings,
      headerTitle: headerTitle.trim() || 'WeRoll',
      headerSubtitle: headerSubtitle.trim() || 'Companion & DM Suite v0.1',
      headerLogoIcon,
      logoIcon: headerLogoIcon,
      logoType,
      customLogoUrl,
      apiKeyOverride: apiKey.trim(),
      aiModel,
      oracleWelcomeMessage: oracleWelcome.trim(),
      dmPassword: dmPassword.trim(),
      moderatorPassword: moderatorPassword.trim() || 'admin',
      developerNotice: {
        enabled: devNoticeEnabled,
        title: devNoticeTitle.trim(),
        content: devNoticeContent.trim(),
        version: headerSubtitle.match(/v\d+(\.\d+)*/i)?.[0] || '0.1',
      },
      changelog,
      roleSwitchingAllowed,
      autoBackup: {
        enabled: autoBackupEnabled,
        frequencyHours: autoBackupFreq,
        destination: autoBackupDest,
        githubToken: githubToken.trim(),
        githubRepo: githubRepo.trim(),
        githubPath: githubPath.trim(),
        driveFolderId: driveFolderId.trim(),
        driveAccessToken: driveAccessToken.trim(),
        driveAccountEmail: driveAccountEmail.trim(),
        webhookUrl: webhookUrl.trim(),
        lastBackupAt: settings.autoBackup?.lastBackupAt,
        lastBackupStatus: settings.autoBackup?.lastBackupStatus,
        lastBackupMessage: settings.autoBackup?.lastBackupMessage,
        history: settings.autoBackup?.history || [],
      },
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl bg-[#181920] border-2 border-stone-700 rounded-2xl shadow-2xl p-6 text-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-600/50 flex items-center justify-center text-blue-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-lg text-amber-300">
                Ajustes Privados del Administrador & Bóveda
              </h3>
              <p className="text-[11px] text-stone-400">
                Panel maestro de WeRoll: aprobación de usuarios, descargas de base de datos, branding e IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-stone-800 pb-3 mb-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Usuarios & Aprobaciones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'vault'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Bóveda del Servidor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('autobackup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'autobackup'
                ? 'bg-cyan-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Respaldos Auto (Drive/GitHub)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'app'
                ? 'bg-amber-600 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Cabecera & Logo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'ai'
                ? 'bg-purple-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>IA & Claves API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'security'
                ? 'bg-red-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Contraseñas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('changelog')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'changelog'
                ? 'bg-stone-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Blog de Versiones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'notice'
                ? 'bg-amber-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Aviso Global</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 pr-1.5 space-y-4">
          {/* ========================================================= */}
          {/* 1. USERS & APPROVALS TAB                                  */}
          {/* ========================================================= */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-cinzel font-bold text-sm text-blue-300">
                    Cuentas Registradas y Solicitudes de Acceso
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Revisa las solicitudes de nuevos jugadores y DMs. Aprueba o deniega su acceso a la plataforma.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchUsers}
                  disabled={isLoadingUsers}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-[#121316] border border-stone-800 rounded-xl overflow-hidden shadow">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-[#1a1b24] text-[11px] font-cinzel text-stone-400 uppercase border-b border-stone-800">
                    <tr>
                      <th className="py-2.5 px-3">Correo</th>
                      <th className="py-2.5 px-3">Nombre en Mesa</th>
                      <th className="py-2.5 px-3">Rol</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-[#181922] transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-stone-200">
                          {u.email}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{u.displayName}</span>
                            {u.isGoogleLinked && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 shadow-sm"
                                title="Cuenta vinculada con Google Auth"
                              >
                                <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <Check className="w-2 h-2 text-emerald-400 shrink-0" />
                                <span>Google</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            className="bg-[#181920] border border-stone-700 rounded px-2 py-0.5 text-xs text-stone-200"
                          >
                            <option value="player">Jugador</option>
                            <option value="dm">Dungeon Master</option>
                            <option value="moderator">Moderador</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                              u.status === 'approved'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                                : u.status === 'pending'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 animate-pulse'
                                : 'bg-red-950/80 text-red-300 border border-red-700/60'
                            }`}
                          >
                            {u.status === 'approved' ? 'Aprobado' : u.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {u.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveUser(u.id)}
                                className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shadow"
                              >
                                <UserCheck className="w-3 h-3" />
                                Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectUser(u.id)}
                                className="px-2 py-1 rounded bg-red-900/80 hover:bg-red-800 text-red-200 text-[11px] flex items-center gap-1"
                              >
                                <UserX className="w-3 h-3" />
                                Rechazar
                              </button>
                            </div>
                          ) : u.status === 'rejected' ? (
                            <button
                              type="button"
                              onClick={() => handleApproveUser(u.id)}
                              className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px]"
                            >
                              Reactivar
                            </button>
                          ) : (
                            <span className="text-[11px] text-stone-500">Activo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. SERVER VAULT & DATABASE TAB                            */}
          {/* ========================================================= */}
          {activeTab === 'vault' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121316] border border-stone-800 rounded-xl p-4">
                <div>
                  <h4 className="font-cinzel font-bold text-sm text-emerald-300 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Base de Datos Persistente en Servidor
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Todas las hojas de personajes (Player Sheets) y mundos (World Sheets) se sincronizan en la nube del servidor.
                  </p>
                </div>

                <a
                  href="/api/vault/backup-all"
                  download
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-2 shrink-0 justify-center"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Base de Datos Completa</span>
                </a>
              </div>

              {/* World Sheets in Server */}
              <div className="space-y-2">
                <h5 className="font-cinzel font-bold text-xs uppercase text-purple-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-400" />
                  World Sheets Guardados en el Servidor ({vaultWorlds.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {vaultWorlds.map((w) => (
                    <div
                      key={w.id}
                      className="bg-[#121316] border border-stone-800 rounded-xl p-3 flex items-center justify-between shadow"
                    >
                      <div>
                        <strong className="block text-xs text-stone-200 font-cinzel">{w.name}</strong>
                        <span className="block text-[10px] text-stone-500 font-mono">
                          Mesa: {w.roomCode} • Dueño: {w.ownerEmail}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadJSON(w, `world-${w.name.toLowerCase().replace(/\s+/g, '-')}.json`)}
                        className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-purple-300"
                        title="Descargar World Sheet JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {vaultWorlds.length === 0 && (
                    <div className="col-span-2 text-center py-4 text-xs text-stone-500">
                      No hay World Sheets sincronizados en el servidor aún.
                    </div>
                  )}
                </div>
              </div>

              {/* Player Sheets in Server */}
              <div className="space-y-2">
                <h5 className="font-cinzel font-bold text-xs uppercase text-amber-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  Player Sheets Guardadas en el Servidor ({vaultSheets.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {vaultSheets.map((s) => (
                    <div
                      key={s.id}
                      className="bg-[#121316] border border-stone-800 rounded-xl p-3 flex items-center justify-between shadow"
                    >
                      <div>
                        <strong className="block text-xs text-stone-200 font-cinzel">{s.name}</strong>
                        <span className="block text-[10px] text-stone-500 font-mono">
                          {s.character?.race} {s.character?.characterClass} Niv {s.character?.level} • Dueño: {s.ownerEmail}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadJSON(s.character, `sheet-${s.name.toLowerCase().replace(/\s+/g, '-')}.json`)}
                        className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300"
                        title="Descargar Player Sheet JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {vaultSheets.length === 0 && (
                    <div className="col-span-2 text-center py-4 text-xs text-stone-500">
                      No hay Player Sheets sincronizadas en el servidor aún.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* AUTOMATED BACKUPS (GITHUB / DRIVE / WEBHOOK) TAB          */}
          {/* ========================================================= */}
          {activeTab === 'autobackup' && (
            <div className="space-y-5">
              <div className="bg-[#121316] border border-cyan-800/80 rounded-2xl p-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3 mb-4">
                  <div>
                    <h4 className="font-cinzel font-bold text-sm text-cyan-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Respaldos Automáticos en la Nube
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Sincroniza y envía un Respaldo Total Maestro automáticamente cada 12 o 24 horas a GitHub, Google Drive o un Webhook.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="text-xs font-cinzel font-bold text-stone-300">Estado:</span>
                    <button
                      type="button"
                      onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                      className={`px-3 py-1.5 rounded-xl font-cinzel font-bold text-xs transition border flex items-center gap-1.5 ${
                        autoBackupEnabled
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-200 shadow'
                          : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${autoBackupEnabled ? 'bg-cyan-400 animate-ping' : 'bg-stone-600'}`} />
                      <span>{autoBackupEnabled ? 'AUTOMÁTICO ACTIVADO' : 'DESACTIVADO'}</span>
                    </button>
                  </div>
                </div>

                {/* Status Summary & Manual Trigger Card */}
                <div className="p-3.5 rounded-xl bg-[#181924] border border-cyan-500/50 mb-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-300 shrink-0">
                        <Clock className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[10px] font-cinzel font-bold uppercase text-stone-400 block tracking-wider">
                          Última Copia de Seguridad Realizada:
                        </span>
                        <span className="font-mono font-bold text-xs text-cyan-200 block">
                          {settings.autoBackup?.lastBackupAt
                            ? new Date(settings.autoBackup.lastBackupAt).toLocaleString('es-ES', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Ningún respaldo ejecutado aún'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          settings.autoBackup?.lastBackupStatus === 'success'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : settings.autoBackup?.lastBackupStatus === 'error'
                            ? 'bg-red-950 text-red-300 border-red-700'
                            : 'bg-stone-800 text-stone-400 border-stone-700'
                        }`}
                      >
                        {settings.autoBackup?.lastBackupStatus === 'success'
                          ? 'Éxito'
                          : settings.autoBackup?.lastBackupStatus === 'error'
                          ? 'Error'
                          : 'Pendiente'}
                      </span>

                      <button
                        type="button"
                        onClick={handleRunTestBackup}
                        disabled={testBackupLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-cinzel font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{testBackupLoading ? 'Enviando...' : '⚡ Hacer Copia Manual Ahora'}</span>
                      </button>
                    </div>
                  </div>

                  {settings.autoBackup?.lastBackupMessage && (
                    <div className="text-[11px] text-stone-300 font-mono bg-[#111218] p-2 rounded-lg border border-stone-800">
                      💬 <span className="text-cyan-400 font-semibold">Detalle del último envío:</span>{' '}
                      {settings.autoBackup.lastBackupMessage}
                    </div>
                  )}
                </div>

                {/* Configuration Options */}
                <div className="space-y-4">
                  {/* Frequency Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-cinzel font-bold text-stone-300 mb-1">
                        Frecuencia de Envío Automático
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAutoBackupFreq(12)}
                          className={`p-2 rounded-xl border text-xs font-cinzel font-bold transition ${
                            autoBackupFreq === 12
                              ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200'
                              : 'bg-[#181920] border-stone-800 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          Cada 12 Horas
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoBackupFreq(24)}
                          className={`p-2 rounded-xl border text-xs font-cinzel font-bold transition ${
                            autoBackupFreq === 24
                              ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200'
                              : 'bg-[#181920] border-stone-800 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          Cada 24 Horas
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-cinzel font-bold text-stone-300 mb-1">
                        Destino del Respaldo
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setAutoBackupDest('github')}
                          className={`p-2 rounded-xl border text-xs font-cinzel font-bold transition flex items-center justify-center gap-1.5 ${
                            autoBackupDest === 'github'
                              ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                              : 'bg-[#181920] border-stone-800 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>GitHub</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoBackupDest('drive')}
                          className={`p-2 rounded-xl border text-xs font-cinzel font-bold transition flex items-center justify-center gap-1.5 ${
                            autoBackupDest === 'drive'
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                              : 'bg-[#181920] border-stone-800 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Drive</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoBackupDest('webhook')}
                          className={`p-2 rounded-xl border text-xs font-cinzel font-bold transition flex items-center justify-center gap-1.5 ${
                            autoBackupDest === 'webhook'
                              ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                              : 'bg-[#181920] border-stone-800 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          <Webhook className="w-3.5 h-3.5" />
                          <span>Webhook</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Destination Specific Inputs */}
                  {autoBackupDest === 'github' && (
                    <div className="p-3.5 bg-[#181920] border border-stone-800 rounded-xl space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-purple-300 font-cinzel font-bold text-xs">
                        <GitBranch className="w-4 h-4 text-purple-400" />
                        <span>Configuración de Repositorio GitHub</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-stone-400 mb-1">
                            GitHub Personal Access Token (PAT):
                          </label>
                          <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                          />
                          <span className="text-[10px] text-stone-500 block mt-0.5">
                            Crea un token en GitHub con permiso 'repo'.
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] text-stone-400 mb-1">
                            Repositorio Destino:
                          </label>
                          <input
                            type="text"
                            value={githubRepo}
                            onChange={(e) => setGithubRepo(e.target.value)}
                            placeholder="usuario/weroll-respaldos"
                            className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-stone-400 mb-1">
                          Ruta del Archivo en el Repositorio:
                        </label>
                        <input
                          type="text"
                          value={githubPath}
                          onChange={(e) => setGithubPath(e.target.value)}
                          placeholder="backups/weroll-backup-latest.json"
                          className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                        />
                      </div>

                      <div className="pt-2 border-t border-purple-900/50 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-stone-400">
                          ¿Deseas desvincular GitHub para evitar bloqueos y conflictos de sincronización?
                        </span>
                        <button
                          type="button"
                          onClick={handleUnlinkGithub}
                          className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-700/60 text-red-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Desvincular GitHub</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {autoBackupDest === 'drive' && (
                    <div className="p-3.5 bg-[#181920] border border-stone-800 rounded-xl space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-300 font-cinzel font-bold text-xs">
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                        <span>Configuración de Google Drive</span>
                      </div>
                      <div>
                        <label className="block text-[11px] text-stone-400 mb-1">
                          Token de Acceso OAuth / Bearer Token de Google Drive:
                        </label>
                        <input
                          type="password"
                          value={driveAccessToken}
                          onChange={(e) => setDriveAccessToken(e.target.value)}
                          placeholder="ya29.a0A..."
                          className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-stone-400 mb-1">
                          ID de Carpeta en Google Drive (Opcional):
                        </label>
                        <input
                          type="text"
                          value={driveFolderId}
                          onChange={(e) => setDriveFolderId(e.target.value)}
                          placeholder="1a2b3c4d5e..."
                          className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-stone-400 mb-1">
                          Correo / Cuenta de Drive Vinculada (Opcional):
                        </label>
                        <input
                          type="text"
                          value={driveAccountEmail}
                          onChange={(e) => setDriveAccountEmail(e.target.value)}
                          placeholder="ej. mi-cuenta@gmail.com"
                          className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                        />
                      </div>
                    </div>
                  )}

                  {autoBackupDest === 'webhook' && (
                    <div className="p-3.5 bg-[#181920] border border-stone-800 rounded-xl space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-xs">
                        <Webhook className="w-4 h-4 text-amber-400" />
                        <span>Configuración de Webhook / Servidor Propio</span>
                      </div>
                      <div>
                        <label className="block text-[11px] text-stone-400 mb-1">
                          URL del Webhook (Discord, N8N, Zapier, Make, etc.):
                        </label>
                        <input
                          type="text"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://n8n.tu-servidor.com/webhook/weroll-backup"
                          className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Manual Test Action */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-stone-800">
                    <span className="text-[11px] text-stone-400 italic">
                      Comprueba la conexión inmediata y envía un respaldo de prueba ahora mismo:
                    </span>
                    <button
                      type="button"
                      onClick={handleRunTestBackup}
                      disabled={testBackupLoading}
                      className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-cinzel font-bold text-xs shadow transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testBackupLoading ? 'Probando Envio...' : 'Probar Respaldo Ahora'}</span>
                    </button>
                  </div>

                  {testBackupMsg && (
                    <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{testBackupMsg}</span>
                    </div>
                  )}

                  {testBackupError && (
                    <div className="p-3 rounded-xl bg-red-950/80 border border-red-600 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{testBackupError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Backup History */}
              <div className="space-y-2">
                <h5 className="font-cinzel font-bold text-xs uppercase text-cyan-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Historial de Respaldos Automáticos
                </h5>
                <div className="bg-[#121316] border border-stone-800 rounded-xl overflow-hidden shadow max-h-48 overflow-y-auto">
                  {settings.autoBackup?.history && settings.autoBackup.history.length > 0 ? (
                    <div className="divide-y divide-stone-800/80">
                      {settings.autoBackup.history.map((log: AutoBackupLog) => (
                        <div key={log.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-[#181922]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                                log.status === 'success'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : 'bg-red-950 text-red-300 border border-red-700'
                              }`}
                            >
                              {log.status === 'success' ? 'Éxito' : 'Error'}
                            </span>
                            <span className="text-stone-300 font-mono text-[11px]">{log.message}</span>
                          </div>
                          <span className="text-stone-500 font-mono text-[10px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-stone-500 italic">
                      No hay ejecuciones de respaldo automático en el historial aún.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. APP & BRANDING TAB                                     */}
          {/* ========================================================= */}
          {activeTab === 'app' && (
            <div className="space-y-4">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Título Principal del Encabezado
                </label>
                <input
                  type="text"
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                  placeholder="WeRoll"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-cinzel font-bold tracking-wider"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Subtítulo con Número de Versión
                </label>
                <input
                  type="text"
                  value={headerSubtitle}
                  onChange={(e) => setHeaderSubtitle(e.target.value)}
                  placeholder="Companion & DM Suite v0.1"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <span className="block text-xs font-cinzel font-bold text-purple-300 mb-1">
                  Logo e Identidad Visual del Lobby
                </span>
                <p className="text-[11px] text-stone-400">
                  El logotipo principal de WeRoll, íconos y diseño del encabezado se personalizan directamente desde el <strong>Creador de Contenido → Skins de la App (Editor de Skin de Lobby)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. AI & MODELS TAB                                        */}
          {/* ========================================================= */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-purple-400 mb-1">
                  Modelo de Inteligencia Artificial (Gemini)
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono cursor-pointer"
                >
                  <option value="gemini-flash-lite-latest">Gemini Flash Lite Latest (Recomendado: Ultrarrápido y preciso)</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (General y equilibrado)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Razonamiento profundo para tramas)</option>
                </select>
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Clave API de Gemini Personalizada (Opcional)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Mensaje de Saludo del Sabio Arcano
                </label>
                <textarea
                  value={oracleWelcome}
                  onChange={(e) => setOracleWelcome(e.target.value)}
                  rows={2}
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. SECURITY & PASSWORDS TAB                               */}
          {/* ========================================================= */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-blue-400 mb-1">
                  Contraseña Maestra de Administrador / Moderador
                </label>
                <input
                  type="password"
                  value={moderatorPassword}
                  onChange={(e) => setModeratorPassword(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-purple-400 mb-1">
                  Contraseña Predeterminada del Dungeon Master
                </label>
                <input
                  type="password"
                  value={dmPassword}
                  onChange={(e) => setDmPassword(e.target.value)}
                  placeholder="Opcional: protege el acceso a World Sheets"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. CHANGELOG BLOG TAB                                     */}
          {/* ========================================================= */}
          {activeTab === 'changelog' && (
            <div className="space-y-4">
              <form onSubmit={handleAddChangelogEntry} className="bg-[#121316] border border-stone-800 rounded-xl p-4 space-y-3">
                <h4 className="font-cinzel font-bold text-xs text-amber-300">Añadir Entrada al Blog de Versiones</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newVersionInput}
                    onChange={(e) => setNewVersionInput(e.target.value)}
                    placeholder="Versión (ej. 0.2)"
                    className="bg-[#181920] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100 font-mono"
                  />
                  <input
                    type="text"
                    value={newVersionTitle}
                    onChange={(e) => setNewVersionTitle(e.target.value)}
                    placeholder="Título de la actualización"
                    className="bg-[#181920] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <textarea
                  value={newVersionChanges}
                  onChange={(e) => setNewVersionChanges(e.target.value)}
                  placeholder="Escribe cada cambio en una nueva línea..."
                  rows={3}
                  className="w-full bg-[#181920] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs"
                >
                  Publicar Novedad
                </button>
              </form>

              <div className="space-y-2">
                {changelog.map((entry, idx) => (
                  <div key={idx} className="bg-[#121316] border border-stone-800 rounded-xl p-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs text-amber-400">v{entry.version}</span>
                        <strong className="text-xs text-stone-200">{entry.title}</strong>
                        <span className="text-[10px] text-stone-500">{entry.date}</span>
                      </div>
                      <ul className="text-xs text-stone-400 space-y-0.5 list-disc list-inside">
                        {entry.changes.map((c, cIdx) => (
                          <li key={cIdx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveChangelogEntry(idx)}
                      className="text-stone-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. NOTICE TAB                                             */}
          {/* ========================================================= */}
          {activeTab === 'notice' && (
            <div className="space-y-4">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-cinzel font-bold text-blue-400">Anuncio Público en Pantalla</label>
                  <label className="flex items-center gap-2 text-xs text-stone-300">
                    <input
                      type="checkbox"
                      checked={devNoticeEnabled}
                      onChange={(e) => setDevNoticeEnabled(e.target.checked)}
                      className="rounded border-stone-700 text-amber-600"
                    />
                    <span>Activar aviso</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={devNoticeTitle}
                  onChange={(e) => setDevNoticeTitle(e.target.value)}
                  className="w-full bg-[#181920] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                />
                <textarea
                  value={devNoticeContent}
                  onChange={(e) => setDevNoticeContent(e.target.value)}
                  rows={3}
                  className="w-full bg-[#181920] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-stone-800 mt-4 flex items-center justify-between">
          <span className="text-xs text-stone-500 font-mono">
            {savedSuccess ? '✅ Guardado con éxito' : 'Ajustes persistentes en servidor'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
