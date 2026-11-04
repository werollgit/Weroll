import React, { useState } from 'react';
import {
  Shield,
  Heart,
  Zap,
  Sword,
  BookOpen,
  Backpack,
  Scroll,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Flame,
  Edit2,
  Edit3,
  Lock,
  Unlock,
  Upload,
  ArrowLeft,
  Coins,
  Settings,
  Palette,
  Compass,
  Map as MapIcon,
  Crown,
  MessageSquare,
  Dices,
  Eye,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EntityAvatar } from '../common/EntityAvatar';
import { AvatarCustomizerModal } from '../common/AvatarCustomizerModal';
import { CharacterSettingsModal } from './CharacterSettingsModal';
import { CharacterJournalBookModal } from './CharacterJournalBookModal';
import { CharacterBackpackModal } from './CharacterBackpackModal';
import { CharacterParchmentModal } from './CharacterParchmentModal';
import {
  CharacterTarotCard,
  AlignmentBadgeIcon,
  invalidateTarotSkinCache,
} from './CharacterTarotCard';
import { GeometricSvgBorder } from '../common/GeometricSvgBorder';
import {
  Character5e,
  AbilityKey,
  SkillKey,
  AttackAction,
  CustomSkillEntry,
  PartyMemberLive,
  LiveCombatantMini,
  DiceRollResult,
} from '../../types/dnd';
import {
  calculateModifier,
  formatModifier,
  calculateProficiencyBonus,
  calculatePassivePerception,
  calculateSpellSaveDC,
  calculateSpellAttackBonus,
  calculateCarryCapacity,
  deriveEquippedWeaponAttacks,
  getEffectiveAbilityModifier,
  buildJournalIndexEntries,
  calculateEquippedItemStatBonuses,
  calculateTotalAbilityScore,
  deriveAllCharacterActions,
  buildDeduplicatedPlayerSkillCards,
  clampPortraitGallery,
  resolveMaxPortraitGalleryCount,
  getGeometricClipPath,
  getEdgeFadeMaskCss,
  resolvePortraitAspectRatioCss,
} from '../../utils/dnd-math';
import {
  resolvePlayerSheetLayout,
  resolveDeckCardTemplate,
  resolveStatBoxGraphicConfig,
  buildSpatialBlockInlineStyle,
  buildInnerButtonInlineStyle,
  getInnerButtonLabel,
  buildGeometricElementStyle,
} from '../../utils/playerSkinLayout';
import { ABILITY_LABELS, SKILL_METADATA, SKILLS_5E } from '../../data/srd';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';
import { CreatorPlayerSkin } from '../../types/dnd';

const DEFAULT_SRD_SKILL_DESCRIPTIONS: Record<SkillKey, string> = {
  acrobatics: 'Mantener el equilibrio, hacer piruetas, escapar de agarres o aterrizar de pie.',
  animalHandling: 'Calmar animales domesticados, intuir intenciones de una bestia o guiar monturas.',
  arcana: 'Recordar conocimiento sobre hechizos, objetos mágicos, símbolos arcanos y planos.',
  athletics: 'Escalar muros escarpados, saltar grandes distancias, nadar o forcejear.',
  deception: 'Ocultar la verdad, mentir con convicción, disfrazarse o engañar.',
  history: 'Recordar eventos históricos, reinos antiguos, guerras pasadas y leyendas.',
  insight: 'Determinar las verdaderas intenciones de una criatura o detectar mentiras.',
  intimidation: 'Influir en alguien mediante amenazas abiertas o presencia imponente.',
  investigation: 'Buscar pistas ocultas, hacer deducciones lógicas o hallar mecanismos.',
  medicine: 'Estabilizar a un compañero moribundo o diagnosticar enfermedades y heridas.',
  nature: 'Recordar información sobre el terreno, plantas, animales y ciclos naturales.',
  perception: 'Detectar la presencia de algo oculto, escuchar ruidos o notar detalles.',
  performance: 'Deleitar a una audiencia con música, danza, actuación o narración.',
  persuasion: 'Influir en otros con tacto, diplomacia, gracia social o buena fe.',
  religion: 'Recordar conocimientos sobre deidades, ritos sagrados y símbolos divinos.',
  sleightOfHand: 'Realizar trucos de prestidigitación, robar bolsas u ocultar objetos.',
  stealth: 'Esconderse de los enemigos, caminar en silencio o escabullirse en las sombras.',
  survival: 'Seguir rastros, cazar presas, guiar al grupo por tierras salvajes o predecir clima.',
};

interface CharacterSheetViewProps {
  character: Character5e;
  onUpdateCharacter: (updated: Character5e) => void;
  onTriggerRoll: (title: string, modifier: number, diceType?: number) => void;
  isLocked?: boolean;
  onUnlockRequest?: () => void;
  onSaveToCloud?: () => void;
  onReturnToLobby?: () => void;
  isInActiveRoom?: boolean;
  roomCode?: string;
  partyMembers?: PartyMemberLive[];
  dmConnected?: boolean;
  dmLiveMessage?: string;
  showCombatantsOnTable?: boolean;
  liveCombatants?: LiveCombatantMini[];
  activeAnnouncement?: { title: string; content: string } | null;
  onDismissAnnouncement?: () => void;
  onOpenRollFeed?: () => void;
  rollFeed?: DiceRollResult[];
  onSendPlayerMessageToDM?: (
    title: string,
    description: string
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
  onOpenTableMapView?: () => void;
  activeLocationName?: string;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character,
  onUpdateCharacter,
  onTriggerRoll,
  isLocked = false,
  onUnlockRequest,
  onSaveToCloud,
  onReturnToLobby,
  isInActiveRoom = false,
  roomCode = 'MESA-1',
  partyMembers = [],
  dmConnected = false,
  dmLiveMessage = '',
  showCombatantsOnTable = false,
  liveCombatants = [],
  activeAnnouncement = null,
  onDismissAnnouncement,
  onOpenRollFeed,
  rollFeed = [],
  onSendPlayerMessageToDM,
  onOpenTableMapView,
  activeLocationName,
}) => {
  // Active Deck in "Mazos de Juego" & Horizontal Card Carousel Index
  const [activeDeck, setActiveDeck] = useState<'combat' | 'skills' | 'spells'>('combat');
  const [playerDeckScrollIndex, setPlayerDeckScrollIndex] = useState<number>(0);

  // Interactive Modals for "El Rincón del Aventurero" & Settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState<boolean>(false);
  const [isBackpackModalOpen, setIsBackpackModalOpen] = useState<boolean>(false);
  const [isParchmentModalOpen, setIsParchmentModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [skinNotice, setSkinNotice] = useState<boolean>(false);
  const [isSkinModalOpen, setIsSkinModalOpen] = useState<boolean>(false);
  const [availablePlayerSkins, setAvailablePlayerSkins] = useState<CreatorPlayerSkin[]>([]);
  const [catalogPlayerSkinRecords, setCatalogPlayerSkinRecords] = useState<any[]>([]);
  const [onlineDefaultPlayerSkinId, setOnlineDefaultPlayerSkinId] = useState<string>('skin-player-classic-gold');
  const [redeemCodeInput, setRedeemCodeInput] = useState<string>('');
  const [redeemFeedback, setRedeemFeedback] = useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    fetch('/api/creator/catalog')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const mergedPlayerSkins: any[] = [];
        if (Array.isArray(data.playerSkins)) {
          setAvailablePlayerSkins(data.playerSkins);
          mergedPlayerSkins.push(...data.playerSkins);
        }
        if (Array.isArray(data.skins)) {
          for (const s of data.skins) {
            if (s.scope === 'player' && !mergedPlayerSkins.some((p) => p.id === s.id)) {
              mergedPlayerSkins.push(s);
            }
          }
        }
        setCatalogPlayerSkinRecords(mergedPlayerSkins);
        if (data.activeOnlinePlayerSkinId) {
          setOnlineDefaultPlayerSkinId(data.activeOnlinePlayerSkinId);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const activeSkinRecord = React.useMemo(() => {
    const targetId = character.playerSkinId || onlineDefaultPlayerSkinId;
    return (
      catalogPlayerSkinRecords.find((s) => s.id === targetId) ||
      catalogPlayerSkinRecords.find((s) => s.id === onlineDefaultPlayerSkinId) ||
      null
    );
  }, [character.playerSkinId, catalogPlayerSkinRecords, onlineDefaultPlayerSkinId]);

  const activeSkinTokens = activeSkinRecord?.themeTokens || null;

  const sheetLayoutBlocks = React.useMemo(
    () => resolvePlayerSheetLayout(activeSkinTokens),
    [activeSkinTokens]
  );
  const getSheetBlock = React.useCallback(
    (id: string) => sheetLayoutBlocks.find((b) => b.id === id),
    [sheetLayoutBlocks]
  );

  const statGraphicCfg = React.useMemo(
    () => resolveStatBoxGraphicConfig(activeSkinTokens),
    [activeSkinTokens]
  );
  const combatCardTpl = React.useMemo(
    () => resolveDeckCardTemplate(activeSkinTokens, 'combat'),
    [activeSkinTokens]
  );
  const skillsCardTpl = React.useMemo(
    () => resolveDeckCardTemplate(activeSkinTokens, 'skills'),
    [activeSkinTokens]
  );
  const spellsCardTpl = React.useMemo(
    () => resolveDeckCardTemplate(activeSkinTokens, 'spells'),
    [activeSkinTokens]
  );
  const maxPortraitCount = React.useMemo(
    () => resolveMaxPortraitGalleryCount(activeSkinTokens),
    [activeSkinTokens]
  );
  const portraitAspectCss = React.useMemo(
    () =>
      resolvePortraitAspectRatioCss(
        activeSkinTokens?.portraitAspectRatio,
        activeSkinTokens?.portraitCustomAspectW,
        activeSkinTokens?.portraitCustomAspectH
      ),
    [activeSkinTokens]
  );
  const portraitGeomStyle = React.useMemo(
    () =>
      buildGeometricElementStyle({
        shape: activeSkinTokens?.portraitGeometricShape || 'circle',
        hideBorder: activeSkinTokens?.portraitHideBorder,
        edgeFadePercent: activeSkinTokens?.portraitEdgeFadePercent || 0,
      }),
    [activeSkinTokens]
  );

  const statBoxCustomStyle: React.CSSProperties = React.useMemo(() => {
    if (!activeSkinTokens) return {};
    const geom = buildGeometricElementStyle({
      shape: statGraphicCfg.shape,
      hideBorder: statGraphicCfg.hideBorder || activeSkinTokens.sheetStatBoxHideBox,
      edgeFadePercent: statGraphicCfg.edgeFadePercent,
      bgColor: statGraphicCfg.bgColor,
      borderColor: statGraphicCfg.borderColor,
      borderWidthPx: statGraphicCfg.borderWidthPx,
      customPngUrl: statGraphicCfg.customPngUrl,
      opacity: statGraphicCfg.opacity,
    });
    if (activeSkinTokens.sheetStatBoxHideBox || statGraphicCfg.hideBorder) {
      return {
        ...geom,
        backgroundColor: statGraphicCfg.hideBorder ? geom.backgroundColor : 'transparent',
        borderColor: 'transparent',
        boxShadow: 'none',
      };
    }
    return {
      ...geom,
      borderRadius:
        statGraphicCfg.shape === 'rounded' && activeSkinTokens.sheetStatBoxBorderRadius !== undefined
          ? `${activeSkinTokens.sheetStatBoxBorderRadius}px`
          : geom.borderRadius,
    };
  }, [activeSkinTokens, statGraphicCfg]);

  const hpBarContainerStyle: React.CSSProperties = React.useMemo(() => {
    if (!activeSkinTokens) return {};
    return {
      height: activeSkinTokens.sheetHpBarHeight
        ? `${activeSkinTokens.sheetHpBarHeight}px`
        : undefined,
      backgroundColor: activeSkinTokens.sheetHpBarBg || undefined,
      backgroundImage: activeSkinTokens.sheetHpBarCustomFramePngUrl
        ? `url(${activeSkinTokens.sheetHpBarCustomFramePngUrl})`
        : undefined,
      backgroundSize: 'cover',
      borderRadius:
        activeSkinTokens.sheetHpBarBorderRadius !== undefined
          ? `${activeSkinTokens.sheetHpBarBorderRadius}px`
          : undefined,
      opacity:
        activeSkinTokens.sheetHpBarOpacity !== undefined
          ? activeSkinTokens.sheetHpBarOpacity
          : 1,
    };
  }, [activeSkinTokens]);

  const hpBarFillStyle: React.CSSProperties = React.useMemo(() => {
    if (!activeSkinTokens) return {};
    return {
      backgroundColor: activeSkinTokens.sheetHpBarFill || undefined,
      backgroundImage: activeSkinTokens.sheetHpBarCustomFillPngUrl
        ? `url(${activeSkinTokens.sheetHpBarCustomFillPngUrl})`
        : undefined,
      backgroundSize: 'cover',
    };
  }, [activeSkinTokens]);

  // Table Mode Modals (Map & Private Message to DM)
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [isDmMsgModalOpen, setIsDmMsgModalOpen] = useState<boolean>(false);
  const [dmMsgTitle, setDmMsgTitle] = useState<string>('');
  const [dmMsgBody, setDmMsgBody] = useState<string>('');
  const [dmMsgStatus, setDmMsgStatus] = useState<string>('');

  // HP Adjustment Modal
  const [hpChangeAmount, setHpChangeAmount] = useState<number>(5);
  const [showHpModal, setShowHpModal] = useState<boolean>(false);
  const [hpModalMode, setHpModalMode] = useState<'heal' | 'damage' | 'temp'>('damage');

  // Add Combat Card Modal
  const [showAddCombatCardModal, setShowAddCombatCardModal] = useState<boolean>(false);
  const [combatCardForm, setCombatCardForm] = useState<{
    name: string;
    type: 'melee' | 'ranged' | 'spell';
    attackBonus: number;
    damageDice: string;
    damageType: string;
    notes: string;
  }>({
    name: '',
    type: 'melee',
    attackBonus: 4,
    damageDice: '1d8+2',
    damageType: 'Cortante',
    notes: '',
  });

  // Add / Edit Skill Card Modal
  const [showAddSkillCardModal, setShowAddSkillCardModal] = useState<boolean>(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillCardForm, setSkillCardForm] = useState<{
    srdKey: SkillKey | 'custom';
    name: string;
    ability: AbilityKey;
    proficiency: 'proficient' | 'expertise';
    description: string;
    imageUrl: string;
  }>({
    srdKey: 'perception',
    name: 'Percepción',
    ability: 'wis',
    proficiency: 'proficient',
    description: DEFAULT_SRD_SKILL_DESCRIPTIONS.perception,
    imageUrl: '',
  });

  const profBonus = calculateProficiencyBonus(character.level);

  // Dynamic Equipped Item Bonuses (Stats, AC, Speed, HP, Initiative)
  const equippedBonuses = React.useMemo(
    () => calculateEquippedItemStatBonuses(character.inventory || []),
    [character.inventory]
  );

  const effectiveAc = (character.armorClass ?? 10) + equippedBonuses.ac;
  const effectiveInitiativeBonus = (character.initiativeBonus ?? 0) + equippedBonuses.initiative;
  const effectiveSpeed = (character.speed ?? 30) + equippedBonuses.speed;
  const effectiveMaxHp = (character.maxHp ?? 10) + equippedBonuses.maxHp;

  const wisBreakdown = calculateTotalAbilityScore(character.abilities.wis, equippedBonuses.wis);
  const wisEffectiveMod = wisBreakdown.modifier;
  const percProf = character.skills?.perception || 'none';
  const passivePerception =
    10 +
    wisEffectiveMod +
    (percProf === 'expertise' ? profBonus * 2 : percProf === 'proficient' ? profBonus : 0);

  const spellAbilityKey: AbilityKey = character.spellcastingAbility || 'wis';
  const spellBreakdown = calculateTotalAbilityScore(character.abilities[spellAbilityKey], equippedBonuses[spellAbilityKey]);
  const spellAbilityScore = spellBreakdown.totalScore;
  const spellSaveDC =
    character.spellSaveDcOverride !== undefined
      ? character.spellSaveDcOverride
      : calculateSpellSaveDC(spellAbilityScore, profBonus);
  const spellAttackBonus =
    character.spellAttackBonusOverride !== undefined
      ? character.spellAttackBonusOverride
      : calculateSpellAttackBonus(spellAbilityScore, profBonus);

  // Quick Edit Modal for Combat / Action Card or Spell Card Description
  const [editingDeckCardModal, setEditingDeckCardModal] = useState<{
    deck: 'combat' | 'spells';
    cardId: string;
    sourceId: string;
    sourceKind?: string;
    name: string;
    description: string;
    damageOrFormula?: string;
    imageUrl?: string;
  } | null>(null);

  const handleSaveDeckCardDescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeckCardModal) return;
    const { deck, cardId, sourceId, name, description, damageOrFormula, imageUrl } = editingDeckCardModal;

    if (deck === 'spells') {
      const nextSpells = (character.spells || []).map((sp) =>
        sp.id === cardId || sp.id === sourceId
          ? {
              ...sp,
              name: name.trim() || sp.name,
              description: description.trim(),
              damageOrHeal: damageOrFormula !== undefined ? damageOrFormula.trim() : sp.damageOrHeal,
              imageUrl: imageUrl?.trim() || sp.imageUrl,
            }
          : sp
      );
      onUpdateCharacter({ ...character, spells: nextSpells });
      setEditingDeckCardModal(null);
      return;
    }

    // Combat / Action Card editing: update matching inventory weaponAttack / itemAction, spell itemAction, feature itemAction, or custom attack
    const nextInventory = (character.inventory || []).map((item) => {
      if (item.id !== sourceId) return item;
      let updatedItem = { ...item };
      if (Array.isArray(item.weaponAttacks) && item.weaponAttacks.length > 0) {
        updatedItem.weaponAttacks = item.weaponAttacks.map((wa, idx) =>
          `${item.id}-atk-${wa.id || idx}` === cardId || wa.name === name
            ? {
                ...wa,
                name: name.trim() || wa.name,
                description: description.trim(),
                imageUrl: imageUrl?.trim() || wa.imageUrl,
              }
            : wa
        );
      } else if (cardId === `${item.id}-atk-default`) {
        updatedItem.description = description.trim();
        if (imageUrl?.trim()) updatedItem.imageUrl = imageUrl.trim();
      }
      if (Array.isArray(item.itemActions) && item.itemActions.length > 0) {
        updatedItem.itemActions = item.itemActions.map((ia, idx) =>
          `${item.id}-act-${ia.id || idx}` === cardId || ia.name === name
            ? {
                ...ia,
                name: name.trim() || ia.name,
                description: description.trim(),
                imageUrl: imageUrl?.trim() || ia.imageUrl,
              }
            : ia
        );
      }
      return updatedItem;
    });

    const nextAttacks = (character.attacks || []).map((atk) =>
      atk.id === cardId || atk.id === sourceId || atk.name === name
        ? {
            ...atk,
            name: name.trim() || atk.name,
            notes: description.trim(),
            damageDice: damageOrFormula?.trim() || atk.damageDice,
          }
        : atk
    );

    const nextSpells = (character.spells || []).map((sp) => {
      if (sp.id !== sourceId || !Array.isArray(sp.itemActions)) return sp;
      return {
        ...sp,
        itemActions: sp.itemActions.map((ia, idx) =>
          `${sp.id}-spact-${ia.id || idx}` === cardId
            ? { ...ia, name: name.trim() || ia.name, description: description.trim() }
            : ia
        ),
      };
    });

    const nextFeatures = (character.featuresAndTraits || []).map((ft) => {
      const ftActions = (ft as any).itemActions;
      if (ft.id !== sourceId || !Array.isArray(ftActions)) return ft;
      return {
        ...ft,
        itemActions: (ftActions as any[]).map((ia, idx) =>
          `${ft.id}-featact-${ia.id || idx}` === cardId
            ? { ...ia, name: name.trim() || ia.name, description: description.trim() }
            : ia
        ),
      };
    });

    onUpdateCharacter({
      ...character,
      inventory: nextInventory,
      attacks: nextAttacks,
      spells: nextSpells,
      featuresAndTraits: nextFeatures,
    });
    setEditingDeckCardModal(null);
  };

  // Derived Equipped Weapons & Actions for "Combates y Acciones" Deck
  const allCharacterActions = React.useMemo(
    () =>
      deriveAllCharacterActions({
        inventory: character.inventory || [],
        spells: character.spells || [],
        features: character.featuresAndTraits || [],
        attacks: character.attacks || [],
        strScore: calculateTotalAbilityScore(character.abilities.str, equippedBonuses.str).totalScore,
        dexScore: calculateTotalAbilityScore(character.abilities.dex, equippedBonuses.dex).totalScore,
        profBonus,
      }),
    [
      character.inventory,
      character.spells,
      character.featuresAndTraits,
      character.attacks,
      character.abilities,
      equippedBonuses,
      profBonus,
    ]
  );
  const equippedWeaponAttacks = allCharacterActions;

  // Derived Possessed / Unlocked Skills for "Habilidades" Deck (Deduplicated by srdKey & normalized name)
  const possessedSkills: CustomSkillEntry[] = React.useMemo(() => {
    const deduped = buildDeduplicatedPlayerSkillCards(
      character,
      SKILLS_5E,
      (ab) => getEffectiveAbilityModifier(character.abilities[ab])
    );
    return deduped.map((sk) => ({
      id: sk.id,
      srdKey: sk.srdKey as SkillKey | undefined,
      name: sk.name,
      ability: sk.ability,
      proficiency: sk.proficiency,
      description: sk.description,
      imageUrl: sk.imageUrl,
    }));
  }, [character]);

  // Derived Prepared Spells for "Lanzar Conjuros" Deck
  const preparedSpells = React.useMemo(
    () => (character.spells || []).filter((s) => s.prepared !== false),
    [character.spells]
  );

  const totalWeight = (character.inventory || []).reduce(
    (sum, item) => sum + (Number(item.weight) || 0) * (Number(item.quantity) || 1),
    0
  );
  const carryCap = calculateCarryCapacity(character.abilities.str.score);
  const journalIndex = buildJournalIndexEntries(character.playerJournal || []);
  const currency = character.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  // Handlers
  const applyHpChange = () => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const amt = Math.max(0, Number(hpChangeAmount) || 0);
    const updated = { ...character };

    if (hpModalMode === 'heal') {
      updated.currentHp = Math.min(updated.maxHp, updated.currentHp + amt);
    } else if (hpModalMode === 'damage') {
      if (updated.tempHp > 0) {
        if (amt <= updated.tempHp) {
          updated.tempHp -= amt;
        } else {
          const rem = amt - updated.tempHp;
          updated.tempHp = 0;
          updated.currentHp = Math.max(0, updated.currentHp - rem);
        }
      } else {
        updated.currentHp = Math.max(0, updated.currentHp - amt);
      }
    } else if (hpModalMode === 'temp') {
      updated.tempHp = amt;
    }

    onUpdateCharacter(updated);
    setShowHpModal(false);
  };

  const handleShortRestHitDie = () => {
    const match = (character.hitDiceTotal || '1d8').match(/d(\d+)/);
    const dieSides = match ? parseInt(match[1], 10) : 8;
    const conMod = getEffectiveAbilityModifier(character.abilities.con);
    onTriggerRoll(`Descanso Corto: Dado de Golpe (1d${dieSides} + CON)`, conMod, dieSides);

    const maxDiceCount = parseInt(character.hitDiceTotal, 10) || character.level;
    if (character.hitDiceUsed < maxDiceCount && !isLocked) {
      onUpdateCharacter({
        ...character,
        hitDiceUsed: character.hitDiceUsed + 1,
      });
    }
  };

  const handleLongRest = () => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const maxDiceCount = parseInt(character.hitDiceTotal, 10) || character.level;
    const diceRegained = Math.max(1, Math.floor(maxDiceCount / 2));
    onUpdateCharacter({
      ...character,
      currentHp: character.maxHp,
      tempHp: 0,
      hitDiceUsed: Math.max(0, character.hitDiceUsed - diceRegained),
      deathSaves: { successes: 0, failures: 0 },
      spellSlots: (character.spellSlots || []).map((s) => ({ ...s, expended: 0 })),
    });
  };

  const toggleDeathSave = (type: 'successes' | 'failures', index: number) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const current = character.deathSaves[type];
    const nextVal = current === index + 1 ? index : index + 1;
    onUpdateCharacter({
      ...character,
      deathSaves: {
        ...character.deathSaves,
        [type]: nextVal,
      },
    });
  };

  const updateAbilityBaseScore = (key: AbilityKey, nextBase: number) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const currentAb = character.abilities[key];
    const itemBonus = equippedBonuses[key] || 0;
    const clampedBase = Math.max(1, Math.min(30, Math.round(nextBase || 10)));
    const extraPts = currentAb.extraScore ?? currentAb.customModifier ?? 0;
    const totalScore = clampedBase + extraPts + itemBonus;
    onUpdateCharacter({
      ...character,
      abilities: {
        ...character.abilities,
        [key]: {
          ...currentAb,
          baseScore: clampedBase,
          extraScore: extraPts,
          itemScore: itemBonus,
          score: totalScore,
        },
      },
    });
  };

  const updateAbilityExtraScore = (key: AbilityKey, nextExtra: number) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const currentAb = character.abilities[key];
    const itemBonus = equippedBonuses[key] || 0;
    const basePts = currentAb.baseScore ?? currentAb.score ?? 10;
    const clampedExtra = Math.max(-10, Math.min(20, Math.round(nextExtra || 0)));
    const totalScore = basePts + clampedExtra + itemBonus;
    onUpdateCharacter({
      ...character,
      abilities: {
        ...character.abilities,
        [key]: {
          ...currentAb,
          baseScore: basePts,
          extraScore: clampedExtra,
          customModifier: clampedExtra,
          itemScore: itemBonus,
          score: totalScore,
        },
      },
    });
  };

  const toggleSaveProficiency = (key: AbilityKey) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    onUpdateCharacter({
      ...character,
      abilities: {
        ...character.abilities,
        [key]: {
          ...character.abilities[key],
          proficientSave: !character.abilities[key].proficientSave,
        },
      },
    });
  };

  const handleAddCombatCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!combatCardForm.name.trim()) return;
    const newAttack: AttackAction = {
      id: `atk-${Date.now()}`,
      name: combatCardForm.name.trim(),
      type: combatCardForm.type,
      attackBonus: Number(combatCardForm.attackBonus) || 0,
      damageDice: combatCardForm.damageDice.trim() || '1d6',
      damageType: combatCardForm.damageType.trim() || 'Cortante',
      notes: combatCardForm.notes.trim(),
    };
    onUpdateCharacter({
      ...character,
      attacks: [...(character.attacks || []), newAttack],
    });
    setShowAddCombatCardModal(false);
    setCombatCardForm({
      name: '',
      type: 'melee',
      attackBonus: 4,
      damageDice: '1d8+2',
      damageType: 'Cortante',
      notes: '',
    });
  };

  const handleDeleteAttackCard = (id: string) => {
    if (isLocked) return;
    onUpdateCharacter({
      ...character,
      attacks: (character.attacks || []).filter((a) => a.id !== id),
    });
  };

  const handleAddSkillCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillCardForm.name.trim()) return;
    const trimmedName = skillCardForm.name.trim();
    const normTarget = trimmedName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const newEntry: CustomSkillEntry = {
      id: editingSkillId || `cskill-${Date.now()}`,
      srdKey: skillCardForm.srdKey !== 'custom' ? skillCardForm.srdKey : undefined,
      name: trimmedName,
      ability: skillCardForm.ability,
      proficiency: skillCardForm.proficiency,
      description: skillCardForm.description.trim() || 'Habilidad desbloqueada.',
      imageUrl: skillCardForm.imageUrl.trim() || undefined,
    };

    // Replace any existing entry with the same id, srdKey, or normalized name so we never create duplicates
    const filteredExisting = possessedSkills.filter((s) => {
      if (editingSkillId && s.id === editingSkillId) return false;
      if (newEntry.srdKey && s.srdKey === newEntry.srdKey) return false;
      const sNorm = (s.name || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (sNorm === normTarget) return false;
      return true;
    });

    const nextCustom = [...filteredExisting, newEntry];
    const nextSkills = { ...character.skills };
    const nextSkillDescriptions = { ...(character.skillDescriptions || {}) };
    const nextSkillImages = { ...(character.skillImages || {}) };

    if (skillCardForm.srdKey !== 'custom') {
      nextSkills[skillCardForm.srdKey] = skillCardForm.proficiency;
      if (newEntry.description) {
        nextSkillDescriptions[skillCardForm.srdKey] = newEntry.description;
      }
      if (newEntry.imageUrl) {
        nextSkillImages[skillCardForm.srdKey] = newEntry.imageUrl;
      }
    }

    onUpdateCharacter({
      ...character,
      skills: nextSkills,
      customSkills: nextCustom,
      skillDescriptions: nextSkillDescriptions,
      skillImages: nextSkillImages,
    });
    setEditingSkillId(null);
    setShowAddSkillCardModal(false);
  };

  const handleOpenEditSkillCard = (sk: CustomSkillEntry) => {
    if (isLocked) return;
    setEditingSkillId(sk.id);
    setSkillCardForm({
      srdKey: sk.srdKey || 'custom',
      name: sk.name,
      ability: sk.ability,
      proficiency: sk.proficiency === 'expertise' ? 'expertise' : 'proficient',
      description: sk.description || '',
      imageUrl: sk.imageUrl || '',
    });
    setShowAddSkillCardModal(true);
  };

  const handleRemoveSkillCard = (id: string, srdKey?: SkillKey) => {
    if (isLocked) return;
    const nextCustom = possessedSkills.filter((s) => s.id !== id && (!srdKey || s.srdKey !== srdKey));
    const nextSkills = { ...character.skills };
    if (srdKey) {
      nextSkills[srdKey] = 'none';
    }
    onUpdateCharacter({
      ...character,
      skills: nextSkills,
      customSkills: nextCustom,
    });
  };

  const handleOpenPlayerSkinModal = async () => {
    setIsSkinModalOpen(true);
    try {
      invalidateTarotSkinCache();
      const res = await fetch('/api/creator/catalog');
      const data = await res.json();
      const mergedPlayerSkins: any[] = [];
      if (Array.isArray(data.playerSkins)) {
        setAvailablePlayerSkins(data.playerSkins);
        mergedPlayerSkins.push(...data.playerSkins);
      }
      if (Array.isArray(data.skins)) {
        for (const s of data.skins) {
          if (s.scope === 'player' && !mergedPlayerSkins.some((p) => p.id === s.id)) {
            mergedPlayerSkins.push(s);
          }
        }
      }
      setCatalogPlayerSkinRecords(mergedPlayerSkins);
      if (data.activeOnlinePlayerSkinId) {
        setOnlineDefaultPlayerSkinId(data.activeOnlinePlayerSkinId);
      }
    } catch {
      // ignore
    }
  };

  const handleRedeemSkinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCodeInput.trim()) return;
    try {
      const res = await fetch('/api/creator/entitlements/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCodeInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setRedeemFeedback(data.message || '¡Skin desbloqueada en tu cuenta!');
        setRedeemCodeInput('');
        if (data.skinId) {
          onUpdateCharacter({ ...character, playerSkinId: data.skinId });
        }
        const catRes = await fetch('/api/creator/catalog');
        const catData = await catRes.json();
        if (catData.ok && Array.isArray(catData.playerSkins)) {
          setAvailablePlayerSkins(catData.playerSkins);
        }
      } else {
        setRedeemFeedback(data.error || 'Código inválido.');
      }
    } catch {
      setRedeemFeedback('Error de red al canjear código.');
    }
  };

  const handleSubmitMessageToDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendPlayerMessageToDM || !dmMsgTitle.trim() || !dmMsgBody.trim()) return;
    const res = await onSendPlayerMessageToDM(dmMsgTitle.trim(), dmMsgBody.trim());
    if (res.ok) {
      setDmMsgStatus(res.message || '¡Mensaje enviado al DM!');
      setDmMsgTitle('');
      setDmMsgBody('');
      setTimeout(() => {
        setDmMsgStatus('');
        setIsDmMsgModalOpen(false);
      }, 1500);
    } else {
      setDmMsgStatus(res.error || 'Error al enviar mensaje.');
    }
  };

  // Allies & Enemies for Table Mode Right Sidebar (Max 8 each in 4x2 grid)
  const tableAllies = React.useMemo(() => {
    const list: {
      id: string;
      name: string;
      hp: number;
      maxHp: number;
      avatarType?: 'icon' | 'custom';
      avatarCustomUrl?: string;
      avatarIcon?: string;
    }[] = [];

    // Ensure current character is always first ally
    list.push({
      id: character.id,
      name: character.name,
      hp: character.currentHp,
      maxHp: character.maxHp,
      avatarType: character.avatarType,
      avatarCustomUrl: character.avatarCustomUrl || character.avatarUrl,
      avatarIcon: character.avatarIcon || 'anonymous',
    });

    partyMembers.forEach((pm) => {
      if (pm.characterId !== character.id && list.length < 8) {
        list.push({
          id: pm.characterId,
          name: pm.characterName,
          hp: pm.currentHp,
          maxHp: pm.maxHp,
          avatarType: pm.avatarType,
          avatarCustomUrl: pm.avatarCustomUrl || pm.avatarUrl,
          avatarIcon: pm.avatarIcon || 'anonymous',
        });
      }
    });

    if (showCombatantsOnTable) {
      liveCombatants
        .filter((c) => c.faction === 'ally' && !c.isPlayer)
        .forEach((ally) => {
          if (list.length < 8) {
            list.push({
              id: ally.id,
              name: ally.name,
              hp: ally.hp,
              maxHp: ally.maxHp,
              avatarIcon: 'shield',
            });
          }
        });
    }

    return list.slice(0, 8);
  }, [character, partyMembers, showCombatantsOnTable, liveCombatants]);

  const tableEnemies = React.useMemo(() => {
    if (!showCombatantsOnTable) return [];
    return liveCombatants.filter((c) => c.faction === 'enemy').slice(0, 8);
  }, [showCombatantsOnTable, liveCombatants]);

  const hitDiceAvailable = Math.max(
    0,
    (parseInt(character.hitDiceTotal, 10) || character.level) - (character.hitDiceUsed || 0)
  );

  return (
    <div className="space-y-2.5 select-none">
      {/* Optional DM Announcement Toast in Table Mode */}
      {isInActiveRoom && activeAnnouncement && (
        <div className="bg-gradient-to-r from-purple-950/90 via-[#1a1329] to-purple-950/90 border border-purple-500/70 rounded-xl px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-cinzel font-bold text-xs text-amber-300">
              {activeAnnouncement.title}:
            </span>
            <span className="text-xs text-purple-100">{activeAnnouncement.content}</span>
          </div>
          {onDismissAnnouncement && (
            <button
              type="button"
              onClick={onDismissAnnouncement}
              className="text-purple-300 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* MAIN GRID: Full Width in Solo Mode | 9 Cols + 3 Cols Right Sidebar in Table Mode */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        {/* ================================================================= */}
        {/* MAIN CHARACTER SHEET PANEL (12 cols in Solo, 9 cols in Table Mode)*/}
        {/* ================================================================= */}
        {activeSkinTokens?.customFontUrl && (
          <style>{`
            @font-face {
              font-family: '${activeSkinTokens.customFontFamilyName || 'CustomSheetFont'}';
              src: url('${activeSkinTokens.customFontUrl}');
            }
            .custom-sheet-font {
              font-family: '${activeSkinTokens.customFontFamilyName || 'CustomSheetFont'}', sans-serif !important;
            }
          `}</style>
        )}
        <div
          style={
            activeSkinTokens?.sheetBgColor
              ? {
                  backgroundColor: activeSkinTokens.sheetBgColor,
                  borderColor: activeSkinTokens.cardFrameColor || '#c8a45c',
                  backgroundImage: activeSkinTokens.sheetBgTextureUrl
                    ? `url(${activeSkinTokens.sheetBgTextureUrl})`
                    : undefined,
                }
              : undefined
          }
          className={`${
            isInActiveRoom ? 'xl:col-span-9' : 'xl:col-span-12'
          } ${
            character.playerSkinId === 'skin-player-crimson-dragon'
              ? 'bg-gradient-to-b from-[#2b1014] via-[#1c0b0e] to-[#120709] border-2 border-red-500/80'
              : character.playerSkinId === 'skin-player-frost-2026'
              ? 'bg-gradient-to-b from-[#0d2238] via-[#091829] to-[#06101c] border-2 border-cyan-400/80'
              : 'bg-gradient-to-b from-[#1a1c24] via-[#15171e] to-[#121319] border-2 border-[#c8a45c]/65'
          } ${
            activeSkinTokens?.customFontUrl || activeSkinTokens?.sheetFontFamily === 'custom'
              ? 'custom-sheet-font'
              : activeSkinTokens?.sheetFontFamily === 'serif'
              ? 'font-serif'
              : activeSkinTokens?.sheetFontFamily === 'mono'
              ? 'font-mono'
              : ''
          } rounded-2xl p-3 sm:p-3.5 shadow-[0_15px_50px_rgba(0,0,0,0.85)] flex flex-col gap-2.5 relative overflow-hidden`}
        >
          {activeSkinRecord &&
            !activeSkinRecord.hideCreatorCredit &&
            (activeSkinRecord.editorCreditName || !activeSkinRecord.createdByAdmin) && (
              <div
                data-testid="active-player-skin-creator-credit"
                className="px-3 py-1.5 rounded-xl bg-amber-950/75 border border-amber-500/50 flex items-center justify-between gap-2 text-[11px] text-amber-200"
              >
                <span>
                  ✨ <strong>Skin: {activeSkinRecord.name}</strong> • Créditos:{' '}
                  <strong>{activeSkinRecord.editorCreditName || activeSkinRecord.authorName}</strong>
                </span>
                <span className="text-[10px] text-stone-300 truncate max-w-md">
                  {activeSkinRecord.customCreditDescription || activeSkinRecord.description}
                </span>
              </div>
            )}
          {/* Decorative Corner Accents */}
          <div className="pointer-events-none absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#e2c275]/60 rounded-tl" />
          <div className="pointer-events-none absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#e2c275]/60 rounded-tr" />
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#e2c275]/60 rounded-bl" />
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#e2c275]/60 rounded-br" />

          {/* --------------------------------------------------------------- */}
          {/* ROW 1: CHARACTER IDENTITY & 4 ORNATE COMBAT STAT BOXES          */}
          {/* --------------------------------------------------------------- */}
          {!getSheetBlock('identity_header')?.hidden && (
          <div
            style={buildSpatialBlockInlineStyle(getSheetBlock('identity_header'), false)}
            className="bg-[#12141b]/90 border border-[#c8a45c]/45 rounded-xl px-3 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5"
          >
            {/* Left: Geometric Gold Avatar + Dynamic Portrait Quick Switcher + Name + Subtitle */}
            <div className="flex items-center gap-3.5">
              <div
                style={buildInnerButtonInlineStyle(getSheetBlock('identity_header'), 'portrait_box')}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div
                  onClick={() => !isLocked && setIsAvatarModalOpen(true)}
                  style={{
                    ...portraitGeomStyle,
                    width: activeSkinTokens?.portraitWidthPx
                      ? `${activeSkinTokens.portraitWidthPx}px`
                      : '68px',
                    aspectRatio: portraitAspectCss,
                    padding: activeSkinTokens?.portraitHideBorder ? '0px' : undefined,
                    background: activeSkinTokens?.portraitHideBorder ? 'transparent' : undefined,
                  }}
                  className={`relative group shrink-0 w-16 sm:w-[68px] ${
                    activeSkinTokens?.portraitHideBorder
                      ? ''
                      : 'p-0.5 bg-gradient-to-b from-[#f3dfb2] via-[#c8a45c] to-[#785a28] shadow-lg'
                  } ${!isLocked ? 'cursor-pointer' : ''}`}
                  title={!isLocked ? `Cambiar retrato o gestionar galería (máx ${maxPortraitCount} imágenes)` : undefined}
                >
                  <div
                    style={{
                      clipPath: portraitGeomStyle.clipPath,
                      borderRadius: portraitGeomStyle.borderRadius,
                    }}
                    className="relative overflow-hidden bg-[#14161d] w-full h-full flex items-center justify-center"
                  >
                    <GeometricSvgBorder
                      shape={activeSkinTokens?.portraitShape}
                      borderColor={activeSkinTokens?.sheetBaseFrameBorder || '#c8a45c'}
                      borderWidthPx={2}
                      hideBorder={activeSkinTokens?.portraitHideBorder}
                    />
                    <EntityAvatar
                      avatarType={character.avatarType || (character.avatarUrl ? 'custom' : 'icon')}
                      customUrl={character.avatarCustomUrl || character.avatarUrl}
                      iconId={character.avatarIcon || 'anonymous'}
                      size="lg"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      aria-label="Editar retrato"
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#241c12] border border-[#e2c275] text-[#e2c275] flex items-center justify-center shadow z-10"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Quick Portrait Switcher Strip (supports up to 24 portraits configured by skin) */}
                {Array.isArray(character.portraitGallery) && character.portraitGallery.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap max-w-[140px] justify-center" data-testid="character-portrait-quick-strip">
                    {clampPortraitGallery(character.portraitGallery, maxPortraitCount).map((imgUrl, idx) => {
                      const isActive = (character.avatarCustomUrl || character.avatarUrl) === imgUrl;
                      return (
                        <button
                          key={`qport-${idx}`}
                          type="button"
                          onClick={() =>
                            !isLocked &&
                            onUpdateCharacter({
                              ...character,
                              avatarType: 'custom',
                              avatarCustomUrl: imgUrl,
                              avatarUrl: imgUrl,
                            })
                          }
                          title={`Cambiar a Retrato #${idx + 1}`}
                          className={`w-4 h-4 rounded-full overflow-hidden border transition cursor-pointer ${
                            isActive
                              ? 'border-amber-300 ring-1 ring-amber-400 scale-110'
                              : 'border-stone-600 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={imgUrl} alt={`Retrato ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                style={buildInnerButtonInlineStyle(getSheetBlock('identity_header'), 'char_name_box')}
                className="min-w-0"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-cinzel font-black text-xl sm:text-2xl text-[#f5e4be] tracking-wide leading-none">
                    {character.name}
                  </h1>
                  <div style={buildInnerButtonInlineStyle(getSheetBlock('identity_header'), 'alignment_box')}>
                    <AlignmentBadgeIcon
                      alignment={character.alignment}
                      size="sm"
                      customIconUrl={activeSkinTokens?.alignmentCustomIcons?.[character.alignment]}
                    />
                  </div>

                  <button
                    type="button"
                    style={buildInnerButtonInlineStyle(getSheetBlock('combat_stats_bar'), 'box_inspiration')}
                    onClick={() => {
                      if (isLocked) {
                        if (onUnlockRequest) onUnlockRequest();
                        return;
                      }
                      onUpdateCharacter({ ...character, inspiration: !character.inspiration });
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-cinzel font-bold tracking-wider uppercase flex items-center gap-1.5 border transition cursor-pointer ${
                      character.inspiration
                        ? 'bg-gradient-to-r from-[#8c6218] to-[#b88628] text-white border-[#f5e4be] shadow-[0_0_12px_rgba(226,194,117,0.4)]'
                        : 'bg-[#1b1e28] text-[#cbb692] border-[#c8a45c]/50 hover:border-[#e2c275]'
                    }`}
                  >
                    {activeSkinTokens?.sheetInspBtnCustomPngUrl ? (
                      <img
                        src={activeSkinTokens.sheetInspBtnCustomPngUrl}
                        alt="Inspiración"
                        className="w-3.5 h-3.5 object-contain"
                      />
                    ) : (
                      <Sparkles className="w-3 h-3 text-[#e2c275]" />
                    )}
                    <span>
                      {getInnerButtonLabel(getSheetBlock('combat_stats_bar'), 'box_inspiration', 'INSPIRACIÓN')}
                    </span>
                  </button>
                </div>

                {/* Subtitle with Race, Class, Level, XP, Background, Alignment & circular Edit/Lock */}
                <div
                  style={buildInnerButtonInlineStyle(getSheetBlock('identity_header'), 'level_xp_box')}
                  className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#d6c5a7]"
                >
                  <span className="font-semibold text-[#f3dfb2]">
                    {character.race} {character.characterClass}
                  </span>
                  <span className="text-[#8a7656]">•</span>
                  <span className="font-semibold text-[#e2c275]">Nivel {character.level}</span>
                  <span className="text-[#8a7656]">•</span>
                  <span className="font-mono text-[#e2c275]">
                    XP {character.xp ?? character.experience ?? 0}
                  </span>
                  <span className="text-[#8a7656]">•</span>
                  <span>{character.background}</span>
                  <span className="text-[#8a7656]">•</span>
                  <span>{character.alignment}</span>

                  {/* Circular Quick Edit Identity Button */}
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(true)}
                    aria-label="Editar identidad y estadísticas del personaje"
                    className="w-5 h-5 rounded-full bg-[#1e222d] hover:bg-[#2c3140] border border-[#c8a45c]/60 text-[#e2c275] flex items-center justify-center transition cursor-pointer ml-1"
                    title="Abrir Ajustes de Personaje"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>

                  {character.password && (
                    <button
                      type="button"
                      onClick={onUnlockRequest}
                      aria-label={isLocked ? 'Desbloquear hoja' : 'Hoja desbloqueada'}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition cursor-pointer ${
                        isLocked
                          ? 'bg-red-950/80 border-red-500/60 text-red-300'
                          : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                      }`}
                      title={isLocked ? 'Hoja bloqueada' : 'Hoja desbloqueada'}
                    >
                      {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: 4 Tall Ornate Gold-Bordered Combat Stat Boxes */}
            {!getSheetBlock('combat_stats_bar')?.hidden && (
            <div
              style={buildSpatialBlockInlineStyle(getSheetBlock('combat_stats_bar'), false)}
              className="grid grid-cols-4 gap-2 shrink-0"
            >
              <div
                style={{
                  ...statBoxCustomStyle,
                  ...buildInnerButtonInlineStyle(getSheetBlock('combat_stats_bar'), 'box_ac'),
                }}
                className="bg-gradient-to-b from-[#1d202b] to-[#12141c] border-2 border-[#c8a45c]/70 rounded-xl px-2.5 py-1 text-center min-w-[68px] shadow-inner"
                title={equippedBonuses.ac ? `Base ${character.armorClass ?? 10} + ${equippedBonuses.ac} por objetos equipados` : undefined}
              >
                <div className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[#cbb692] flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3 text-[#e2c275]" />
                  <span>CA</span>
                </div>
                <div className="font-cinzel font-black text-xl text-[#f5e4be] leading-tight">
                  {effectiveAc}
                </div>
              </div>

              <button
                type="button"
                style={{
                  ...statBoxCustomStyle,
                  ...buildInnerButtonInlineStyle(getSheetBlock('combat_stats_bar'), 'box_init'),
                }}
                onClick={() => onTriggerRoll('Iniciativa', effectiveInitiativeBonus)}
                className="bg-gradient-to-b from-[#1d202b] to-[#12141c] hover:from-[#262a38] border-2 border-[#c8a45c]/70 hover:border-[#f3dfb2] rounded-xl px-2.5 py-1 text-center min-w-[68px] shadow-inner transition cursor-pointer"
                title={`Tirar Iniciativa (1d20 ${formatModifier(effectiveInitiativeBonus)})`}
              >
                <div className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[#cbb692] flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3 text-[#e2c275]" />
                  <span>INIC.</span>
                </div>
                <div className="font-cinzel font-black text-xl text-white leading-tight">
                  {formatModifier(effectiveInitiativeBonus)}
                </div>
              </button>

              <div
                style={{
                  ...statBoxCustomStyle,
                  ...buildInnerButtonInlineStyle(getSheetBlock('combat_stats_bar'), 'box_speed'),
                }}
                className="bg-gradient-to-b from-[#1d202b] to-[#12141c] border-2 border-[#c8a45c]/70 rounded-xl px-2.5 py-1 text-center min-w-[78px] shadow-inner"
                title={equippedBonuses.speed ? `Base ${character.speed ?? 30} + ${equippedBonuses.speed} por objetos equipados` : undefined}
              >
                <div className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[#cbb692]">
                  VELOCIDAD
                </div>
                <div className="font-cinzel font-black text-lg text-white leading-tight">
                  {effectiveSpeed} <span className="text-[10px] text-[#cbb692]">FT</span>
                </div>
              </div>

              <div
                style={{
                  ...statBoxCustomStyle,
                  ...buildInnerButtonInlineStyle(getSheetBlock('combat_stats_bar'), 'box_prof'),
                }}
                className="bg-gradient-to-b from-[#1d202b] to-[#12141c] border-2 border-[#c8a45c]/70 rounded-xl px-2.5 py-1 text-center min-w-[68px] shadow-inner"
              >
                <div className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[#cbb692]">
                  COMP.
                </div>
                <div className="font-cinzel font-black text-xl text-[#e2c275] leading-tight">
                  +{profBonus}
                </div>
              </div>
            </div>
            )}
          </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* ROW 2: HP BAR + TIRADAS DE MUERTE + AJUSTES/SKIN + DESCANSOS    */}
          {/* --------------------------------------------------------------- */}
          {!getSheetBlock('hp_and_rests_bar')?.hidden && (
          <div
            style={buildSpatialBlockInlineStyle(getSheetBlock('hp_and_rests_bar'), false)}
            className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch"
          >
            {/* Left 7 Cols: PG Actual & Glowing Green HP Bar */}
            <div className="lg:col-span-7 bg-[#12141b]/95 border border-[#c8a45c]/45 rounded-xl px-3 py-2 flex flex-col justify-between gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  style={buildInnerButtonInlineStyle(getSheetBlock('hp_and_rests_bar'), 'hp_main_counter')}
                  className="flex items-center gap-2"
                >
                  {activeSkinTokens?.sheetHeartCustomPngUrl ? (
                    <img
                      src={activeSkinTokens.sheetHeartCustomPngUrl}
                      alt="PG"
                      className="w-4 h-4 object-contain"
                    />
                  ) : (
                    <Heart className="w-4 h-4 text-red-500 fill-red-500/30" />
                  )}
                  <span className="font-cinzel font-bold text-xs sm:text-sm text-[#f5e4be]">
                    {getSheetBlock('hp_and_rests_bar')?.titleText || 'PG Actual'}:{' '}
                    <strong className="text-white text-base">
                      {character.currentHp}/{character.maxHp}
                    </strong>
                  </span>
                  {character.tempHp > 0 && (
                    <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-sky-300 text-[11px] font-mono font-bold">
                      +{character.tempHp} Temp
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    style={buildInnerButtonInlineStyle(getSheetBlock('hp_and_rests_bar'), 'btn_damage')}
                    onClick={() => {
                      setHpModalMode('damage');
                      setShowHpModal(true);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-gradient-to-b from-red-900/90 to-red-950 hover:from-red-800 border border-red-500/60 text-red-100 font-cinzel font-bold text-[11px] transition cursor-pointer shadow"
                  >
                    {getInnerButtonLabel(getSheetBlock('hp_and_rests_bar'), 'btn_damage', '- Daño')}
                  </button>
                  <button
                    type="button"
                    style={buildInnerButtonInlineStyle(getSheetBlock('hp_and_rests_bar'), 'btn_heal')}
                    onClick={() => {
                      setHpModalMode('heal');
                      setShowHpModal(true);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-gradient-to-b from-emerald-800/90 to-emerald-950 hover:from-emerald-700 border border-emerald-500/60 text-emerald-100 font-cinzel font-bold text-[11px] transition cursor-pointer shadow"
                  >
                    {getInnerButtonLabel(getSheetBlock('hp_and_rests_bar'), 'btn_heal', '+ Curar')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHpModalMode('temp');
                      setShowHpModal(true);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-gradient-to-b from-sky-900/90 to-sky-950 hover:from-sky-800 border border-sky-500/60 text-sky-100 font-cinzel font-bold text-[11px] transition cursor-pointer shadow"
                  >
                    PG Temp
                  </button>
                </div>
              </div>

              {/* Glowing Green Health Bar with Dados de Golpe overlaid inside right */}
              <div
                style={{
                  ...hpBarContainerStyle,
                  ...buildInnerButtonInlineStyle(getSheetBlock('hp_and_rests_bar'), 'hp_progress_bar'),
                }}
                className="relative h-6 rounded-lg bg-[#0b0d12] border border-[#c8a45c]/50 overflow-hidden shadow-inner flex items-center"
              >
                <div
                  className={`h-full transition-all duration-300 ${
                    character.currentHp / Math.max(1, character.maxHp) > 0.45
                      ? 'bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                      : character.currentHp / Math.max(1, character.maxHp) > 0.2
                      ? 'bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400'
                      : 'bg-gradient-to-r from-red-800 via-red-600 to-red-500 animate-pulse'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, (character.currentHp / Math.max(1, character.maxHp)) * 100)
                    )}%`,
                    ...hpBarFillStyle,
                  }}
                />
                <div className="absolute inset-0 px-2.5 flex items-center justify-end pointer-events-none">
                  <span className="text-[10px] font-cinzel font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] bg-black/45 px-2 py-0.5 rounded">
                    Dados de Golpe: {character.hitDiceTotal} ({hitDiceAvailable} disp.)
                  </span>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Tiradas de Muerte + Ajustes & Skin + Descanso Corto/Largo */}
            <div className="lg:col-span-5 bg-[#12141b]/95 border border-[#c8a45c]/45 rounded-xl px-2.5 py-2 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between gap-2">
                {/* Tiradas de Muerte Box */}
                <div className="flex-1 bg-[#171a24] border border-[#c8a45c]/35 rounded-lg px-2.5 py-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-cinzel font-bold text-[10px] uppercase tracking-wider text-[#f3dfb2]">
                      TIRADAS DE MUERTE
                    </span>
                    <button
                      type="button"
                      onClick={() => onTriggerRoll('Salvación de Muerte', 0)}
                      className="text-[10px] font-cinzel font-bold text-[#e2c275] hover:underline cursor-pointer flex items-center gap-1"
                      title="Tirar Salvación de Muerte (1d20)"
                    >
                      {activeSkinTokens?.sheetD20ButtonCustomPngUrl ? (
                        <img
                          src={activeSkinTokens.sheetD20ButtonCustomPngUrl}
                          alt="d20"
                          className="w-4 h-4 object-contain inline-block hover:scale-110 transition"
                        />
                      ) : (
                        <span>d20</span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((idx) => (
                        <button
                          key={`suc-${idx}`}
                          type="button"
                          aria-label={`Éxito de muerte ${idx + 1}`}
                          onClick={() => toggleDeathSave('successes', idx)}
                          className={`w-3 h-3 rounded-full border transition cursor-pointer ${
                            character.deathSaves.successes > idx
                              ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                              : 'bg-black/60 border-stone-600'
                          }`}
                        />
                      ))}
                      <span className="text-[#cbb692] ml-0.5">Éxitos</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((idx) => (
                        <button
                          key={`fail-${idx}`}
                          type="button"
                          aria-label={`Fracaso de muerte ${idx + 1}`}
                          onClick={() => toggleDeathSave('failures', idx)}
                          className={`w-3 h-3 rounded-full border transition cursor-pointer ${
                            character.deathSaves.failures > idx
                              ? 'bg-red-500 border-red-300 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                              : 'bg-black/60 border-stone-600'
                          }`}
                        />
                      ))}
                      <span className="text-[#cbb692] ml-0.5">Fracasos</span>
                    </div>
                  </div>
                </div>

                {/* Ajustes & Skin Buttons (Right below Velocidad/Comp) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="w-13 h-11 rounded-lg bg-gradient-to-b from-[#25221d] to-[#171512] hover:from-[#332e26] border border-[#c8a45c]/70 flex flex-col items-center justify-center gap-0.5 text-[#f3dfb2] shadow transition cursor-pointer"
                    title="Abrir Ajustes completos del personaje (Stats base, modificadores extra, raza, clase y nivel)"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#e2c275]" />
                    <span className="font-cinzel font-bold text-[9px]">Ajustes</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-player-sheet-skin"
                    onClick={handleOpenPlayerSkinModal}
                    className="w-13 h-11 rounded-lg bg-gradient-to-b from-[#25221d] to-[#171512] hover:from-[#332e26] border border-[#c8a45c]/70 flex flex-col items-center justify-center gap-0.5 text-[#f3dfb2] shadow transition cursor-pointer relative"
                    title="Cambiar Skin de Hoja de Jugador y Carta de Personaje"
                  >
                    <Palette className="w-3.5 h-3.5 text-[#e2c275]" />
                    <span className="font-cinzel font-bold text-[9px]">Skin</span>
                  </button>
                </div>
              </div>

              {/* Short Rest & Long Rest Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  style={buildInnerButtonInlineStyle(getSheetBlock('hp_and_rests_bar'), 'btn_short_rest')}
                  onClick={handleShortRestHitDie}
                  className="py-1 px-2 rounded-lg bg-gradient-to-r from-[#2c2219] to-[#211a14] hover:from-[#3b2d21] border border-[#c8a45c]/50 text-[#f3dfb2] font-cinzel font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>
                    {getInnerButtonLabel(getSheetBlock('hp_and_rests_bar'), 'btn_short_rest', 'Descanso Corto')}
                  </span>
                </button>
                <button
                  type="button"
                  style={buildInnerButtonInlineStyle(getSheetBlock('hp_and_rests_bar'), 'btn_long_rest')}
                  onClick={handleLongRest}
                  className="py-1 px-2 rounded-lg bg-gradient-to-r from-[#1d2233] to-[#161926] hover:from-[#262d45] border border-indigo-400/50 text-indigo-100 font-cinzel font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-300" />
                  <span>
                    {getInnerButtonLabel(getSheetBlock('hp_and_rests_bar'), 'btn_long_rest', 'Descanso Largo')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          )}

          {/* --------------------------------------------------------------- */}
          {/* ROW 3: 6 ORNATE ABILITY SCORE CARDS (FUE, DES, CON, INT, SAB, CAR)*/}
          {/* --------------------------------------------------------------- */}
          {!getSheetBlock('ability_scores_grid')?.hidden && (
          <div
            style={buildSpatialBlockInlineStyle(getSheetBlock('ability_scores_grid'), false)}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
          >
            {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map((key) => {
              const ab = character.abilities[key];
              const itemBonus = equippedBonuses[key] || 0;
              const breakdown = calculateTotalAbilityScore(ab, itemBonus);
              const saveMod = breakdown.modifier + (ab.proficientSave ? profBonus : 0);
              const meta = ABILITY_LABELS[key];

              return (
                <div
                  key={key}
                  style={statBoxCustomStyle}
                  className="bg-gradient-to-b from-[#1e212d] via-[#161821] to-[#11131a] border-2 border-[#c8a45c]/65 rounded-xl px-2 py-1.5 flex flex-col items-center justify-between shadow-md relative group hover:border-[#f3dfb2] transition"
                >
                  <GeometricSvgBorder
                    shape={statGraphicCfg.shape}
                    borderColor={statGraphicCfg.borderColor || '#c8a45c'}
                    borderWidthPx={statGraphicCfg.borderWidthPx ?? 2}
                    hideBorder={statGraphicCfg.hideBorder}
                  />
                  {/* Top Label */}
                  <div className="text-center">
                    <div
                      style={{
                        color: statGraphicCfg.labelColor || undefined,
                        fontSize: statGraphicCfg.labelFontSizePx
                          ? `${statGraphicCfg.labelFontSizePx}px`
                          : undefined,
                      }}
                      className="font-cinzel font-black text-xs text-[#f5e4be] tracking-wider leading-none"
                    >
                      {meta.abbr}
                    </div>
                    <div className="text-[10px] text-[#b8a68e]">{meta.nameEs}</div>
                  </div>

                  {/* Center Large Modifier Button */}
                  <button
                    type="button"
                    onClick={() => onTriggerRoll(`Prueba de ${meta.nameEs}`, breakdown.modifier)}
                    style={{
                      color: statGraphicCfg.modifierColor || undefined,
                      fontSize: statGraphicCfg.valueFontSizePx
                        ? `${statGraphicCfg.valueFontSizePx}px`
                        : undefined,
                    }}
                    className="my-1 w-14 h-9 rounded-xl bg-[#0e1016] border border-[#c8a45c]/50 group-hover:border-[#e2c275] flex items-center justify-center font-cinzel font-black text-xl text-white group-hover:text-[#f5e4be] transition shadow-inner cursor-pointer"
                    title={`Tirar prueba de ${meta.nameEs} (1d20 ${formatModifier(breakdown.modifier)})`}
                  >
                    {formatModifier(breakdown.modifier)}
                  </button>

                  {/* Total Points Header */}
                  <div className="text-[10px] font-cinzel font-bold text-[#e5c478] mb-0.5">
                    TOTAL:{' '}
                    <strong
                      style={{ color: statGraphicCfg.valueColor || undefined }}
                      className="text-white text-xs"
                    >
                      {breakdown.totalScore}
                    </strong>
                  </div>

                  {/* 3-Part Decomposition: Base, Extra, Objetos Equipados */}
                  <div className="w-full bg-black/50 rounded-lg p-1 border border-[#c8a45c]/25 space-y-1 mb-1">
                    {/* 1. Base Score */}
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-[#cbb692]">Base:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateAbilityBaseScore(key, breakdown.baseScore - 1)}
                          className="w-3.5 h-3.5 rounded bg-[#202330] hover:bg-[#2e3346] border border-stone-600 text-stone-300 font-bold flex items-center justify-center cursor-pointer"
                          title="Restar 1 punto base"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-bold text-white">{breakdown.baseScore}</span>
                        <button
                          type="button"
                          onClick={() => updateAbilityBaseScore(key, breakdown.baseScore + 1)}
                          className="w-3.5 h-3.5 rounded bg-[#202330] hover:bg-[#2e3346] border border-stone-600 text-stone-300 font-bold flex items-center justify-center cursor-pointer"
                          title="Sumar 1 punto base"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 2. Extra Score */}
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-amber-300">Extra:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateAbilityExtraScore(key, breakdown.extraScore - 1)}
                          className="w-3.5 h-3.5 rounded bg-[#202330] hover:bg-[#2e3346] border border-stone-600 text-stone-300 font-bold flex items-center justify-center cursor-pointer"
                          title="Restar 1 punto extra"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-bold text-amber-300">
                          {breakdown.extraScore >= 0 ? `+${breakdown.extraScore}` : breakdown.extraScore}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateAbilityExtraScore(key, breakdown.extraScore + 1)}
                          className="w-3.5 h-3.5 rounded bg-[#202330] hover:bg-[#2e3346] border border-stone-600 text-stone-300 font-bold flex items-center justify-center cursor-pointer"
                          title="Sumar 1 punto extra"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 3. Objetos Equipados (Read-only, dynamically derived from equipped gear) */}
                    <div
                      className="flex items-center justify-between text-[9px] font-mono bg-emerald-950/40 rounded px-1 py-0.5 border border-emerald-500/30"
                      title={
                        breakdown.itemScore > 0
                          ? `Puntos dados por objetos equipados: +${breakdown.itemScore}`
                          : 'Sin bonos de objetos equipados para esta estadística'
                      }
                    >
                      <span className="text-emerald-300 font-semibold flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5 text-emerald-400" /> Objetos:
                      </span>
                      <span className="font-bold text-emerald-300">
                        {breakdown.itemScore >= 0 ? `+${breakdown.itemScore}` : breakdown.itemScore}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Control Bar: Save Dot & Roll */}
                  <div className="w-full flex items-center justify-between pt-1 border-t border-[#c8a45c]/25 text-[10px]">
                    <div className="flex items-center gap-1.5 w-full justify-center">
                      <button
                        type="button"
                        aria-label={`Competencia en salvación de ${meta.nameEs}`}
                        onClick={() => toggleSaveProficiency(key)}
                        className={`w-2.5 h-2.5 rounded-full border cursor-pointer ${
                          ab.proficientSave
                            ? 'bg-[#e2c275] border-[#fff1cc] shadow-[0_0_6px_rgba(226,194,117,0.8)]'
                            : 'bg-black/50 border-stone-500'
                        }`}
                        title="Competencia en Tirada de Salvación"
                      />
                      <button
                        type="button"
                        onClick={() => onTriggerRoll(`Salvación de ${meta.nameEs}`, saveMod)}
                        className="font-mono text-[#d6c5a7] hover:text-[#e2c275] cursor-pointer"
                        title="Tirar Salvación"
                      >
                        Salv {formatModifier(saveMod)}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* ROW 4: MAZOS DE JUEGO (LEFT) & EL RINCÓN DEL AVENTURERO (RIGHT) */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 pt-1 items-stretch">
            {/* LEFT 7 COLS: MAZOS DE JUEGO (Tarot-Proportioned Cards in Both Solo & Table Modes) */}
            {!getSheetBlock('game_decks_panel')?.hidden && (
            <div
              style={buildSpatialBlockInlineStyle(getSheetBlock('game_decks_panel'), false)}
              className="lg:col-span-7 bg-[#12151e]/95 border-2 border-[#c8a45c]/65 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xl"
            >
              {(() => {
                const combatCardsCount = Math.max(1, equippedWeaponAttacks.length);
                const currentPlayerDeckCount =
                  activeDeck === 'combat'
                    ? combatCardsCount
                    : activeDeck === 'skills'
                    ? possessedSkills.length
                    : preparedSpells.length;
                const maxScrollIdx = Math.max(0, currentPlayerDeckCount - 2);
                const safeScrollIdx = Math.min(playerDeckScrollIndex, maxScrollIdx);

                return (
                  <div className="flex flex-col h-full">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="font-cinzel font-black text-base sm:text-lg text-[#f5e4be] tracking-wider uppercase whitespace-nowrap">
                        {activeSkinTokens?.deckSectionTitleText || 'MAZOS DE JUEGO'}
                      </h2>
                      <div className="h-px flex-1 bg-gradient-to-r from-[#c8a45c]/60 to-transparent" />
                      {currentPlayerDeckCount > 2 && (
                        <span className="text-[10px] font-mono text-amber-300 bg-[#181b26] px-2 py-0.5 rounded border border-[#c8a45c]/40">
                          Cartas {safeScrollIdx + 1}–{Math.min(currentPlayerDeckCount, safeScrollIdx + 2)} de {currentPlayerDeckCount}
                        </span>
                      )}
                      <span className="text-[11px] font-cinzel text-[#d8ba73] uppercase tracking-wider">
                        {activeDeck === 'combat'
                          ? activeSkinTokens?.deckCombatTitleText || 'COMBATE Y ACCIONES'
                          : activeDeck === 'skills'
                          ? activeSkinTokens?.deckSkillsTitleText || 'HABILIDADES'
                          : activeSkinTokens?.deckSpellsTitleText || 'LANZAR CONJUROS'}
                      </span>
                    </div>

                    {/* LAYER 1 (TOP TABS): 3 Deck Selector Tabs tucked behind the main Tarot Card Tray */}
                    <div className="grid grid-cols-3 gap-2.5 px-1">
                      {/* Deck Tab 1: COMBATES Y ACCIONES */}
                      <button
                        type="button"
                        data-testid="player-deck-combat"
                        style={buildInnerButtonInlineStyle(getSheetBlock('game_decks_panel'), 'tab_deck_combat')}
                        onClick={() => {
                          setActiveDeck('combat');
                          setPlayerDeckScrollIndex(0);
                        }}
                        className={`relative h-[86px] rounded-t-2xl p-2.5 pb-5 border-2 text-left transition-all duration-200 cursor-pointer overflow-hidden flex items-start gap-2 ${
                          activeDeck === 'combat'
                            ? 'bg-gradient-to-b from-[#3d2914] via-[#26190c] to-[#171008] border-[#f5e4be] shadow-[0_0_22px_rgba(226,194,117,0.35)] z-10'
                            : 'bg-gradient-to-b from-[#1e1813] to-[#120f0c] border-[#c8a45c]/40 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/70 flex items-center justify-center text-amber-300 shadow-inner shrink-0 mt-0.5">
                          <Sword className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-cinzel font-black text-[11px] sm:text-xs text-[#f5e4be] leading-tight uppercase">
                            {getInnerButtonLabel(
                              getSheetBlock('game_decks_panel'),
                              'tab_deck_combat',
                              activeSkinTokens?.deckCombatTitleText || 'COMBATES Y ACCIONES'
                            )}
                          </div>
                          <div className="text-[10px] text-amber-300/90 font-mono mt-0.5">
                            {combatCardsCount} Cartas
                          </div>
                        </div>
                      </button>

                      {/* Deck Tab 2: HABILIDADES */}
                      <button
                        type="button"
                        data-testid="player-deck-skills"
                        style={buildInnerButtonInlineStyle(getSheetBlock('game_decks_panel'), 'tab_deck_skills')}
                        onClick={() => {
                          setActiveDeck('skills');
                          setPlayerDeckScrollIndex(0);
                        }}
                        className={`relative h-[86px] rounded-t-2xl p-2.5 pb-5 border-2 text-left transition-all duration-200 cursor-pointer overflow-hidden flex items-start gap-2 ${
                          activeDeck === 'skills'
                            ? 'bg-gradient-to-b from-[#132e40] via-[#0e1f2c] to-[#09131c] border-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.3)] z-10'
                            : 'bg-gradient-to-b from-[#111c26] to-[#0b1218] border-cyan-500/35 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/70 flex items-center justify-center text-cyan-300 shadow-inner shrink-0 mt-0.5">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-cinzel font-black text-[11px] sm:text-xs text-cyan-100 leading-tight uppercase">
                            {getInnerButtonLabel(
                              getSheetBlock('game_decks_panel'),
                              'tab_deck_skills',
                              activeSkinTokens?.deckSkillsTitleText || 'HABILIDADES'
                            )}
                          </div>
                          <div className="text-[10px] text-cyan-300 font-mono mt-0.5">
                            {possessedSkills.length} Cartas
                          </div>
                        </div>
                      </button>

                      {/* Deck Tab 3: LANZAR CONJUROS */}
                      <button
                        type="button"
                        data-testid="player-deck-spells"
                        style={buildInnerButtonInlineStyle(getSheetBlock('game_decks_panel'), 'tab_deck_spells')}
                        onClick={() => {
                          setActiveDeck('spells');
                          setPlayerDeckScrollIndex(0);
                        }}
                        className={`relative h-[86px] rounded-t-2xl p-2.5 pb-5 border-2 text-left transition-all duration-200 cursor-pointer overflow-hidden flex items-start gap-2 ${
                          activeDeck === 'spells'
                            ? 'bg-gradient-to-b from-[#2f1845] via-[#1f102f] to-[#12091c] border-purple-300 shadow-[0_0_22px_rgba(192,132,252,0.32)] z-10'
                            : 'bg-gradient-to-b from-[#1c1228] to-[#110b18] border-purple-500/35 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/70 flex items-center justify-center text-purple-300 shadow-inner shrink-0 mt-0.5">
                          <Flame className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-cinzel font-black text-[11px] sm:text-xs text-purple-100 leading-tight uppercase">
                            {getInnerButtonLabel(
                              getSheetBlock('game_decks_panel'),
                              'tab_deck_spells',
                              activeSkinTokens?.deckSpellsTitleText || 'LANZAR CONJUROS'
                            )}
                          </div>
                          <div className="text-[10px] text-purple-300 font-mono mt-0.5">
                            {preparedSpells.length} Preparados
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* LAYER 2 (FOREGROUND TAROT TRAY): Balanced Tarot-Proportioned Cards + "+ NUEVA CARTA" Slot */}
                    <div className="relative -mt-5 z-20 flex-1 rounded-2xl bg-[#10131c] border-2 border-[#c8a45c]/80 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.95)] flex items-center gap-2">
                      {/* Left Scroll Arrow (when > 2 cards) */}
                      {currentPlayerDeckCount > 2 && (
                        <button
                          type="button"
                          data-testid="btn-player-deck-prev"
                          disabled={safeScrollIdx === 0}
                          onClick={() => setPlayerDeckScrollIndex(Math.max(0, safeScrollIdx - 1))}
                          style={{
                            backgroundColor: activeSkinTokens?.sheetDeckArrowBtnBg || undefined,
                            borderColor: activeSkinTokens?.sheetDeckArrowBtnBorder || undefined,
                          }}
                          className="w-7 h-36 rounded-xl bg-[#191c29] hover:bg-amber-950/80 disabled:opacity-30 border border-[#c8a45c]/60 text-[#f5e4be] flex items-center justify-center shrink-0 transition cursor-pointer disabled:cursor-default shadow overflow-hidden"
                          title="Ver cartas anteriores"
                        >
                          {activeSkinTokens?.sheetDeckArrowBtnCustomPngUrl ? (
                            <img
                              src={activeSkinTokens.sheetDeckArrowBtnCustomPngUrl}
                              alt="Anterior"
                              className="w-4 h-4 object-contain -scale-x-100"
                            />
                          ) : (
                            <ChevronLeft className="w-4 h-4 text-amber-300" />
                          )}
                        </button>
                      )}

                      {/* 3-Column Tarot Cards Tray (2 Visible Playable Tarot Cards + 1 "+ NUEVA CARTA" Tarot Slot) */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
                        {/* DECK 1 CARDS: COMBATES Y ACCIONES */}
                        {activeDeck === 'combat' && (
                          <>
                            {allCharacterActions
                              .slice(safeScrollIdx, safeScrollIdx + 2)
                              .map((action) => (
                                <div
                                  key={action.id}
                                  data-testid={`player-card-${action.id}`}
                                  title={action.description || undefined}
                                  onClick={() =>
                                    onTriggerRoll(
                                      `${action.sourceName}: ${action.name} (${action.damageFormula} ${action.damageType})`,
                                      action.toHitBonus,
                                      20
                                    )
                                  }
                                  style={buildGeometricElementStyle({
                                    shape: combatCardTpl.cardShape,
                                    hideBorder: combatCardTpl.hideBorder,
                                    edgeFadePercent: combatCardTpl.edgeFadePercent,
                                    bgColor: combatCardTpl.bgColor,
                                    borderColor: combatCardTpl.borderColor,
                                    borderWidthPx: combatCardTpl.borderWidthPx,
                                    customPngUrl: combatCardTpl.customBgPngUrl,
                                    opacity: combatCardTpl.opacity,
                                  })}
                                  className={`group relative rounded-2xl border-2 ring-1 ring-inset p-2.5 flex flex-col justify-between min-h-[225px] sm:min-h-[240px] shadow-2xl hover:-translate-y-1 transition cursor-pointer ${
                                    action.isSpecialAction
                                      ? 'border-purple-400/80 ring-purple-300/35 hover:border-purple-200 bg-gradient-to-b from-[#2a173d] via-[#1a1226] to-[#110e1a]'
                                      : 'border-[#c8a45c] ring-[#e2c275]/35 hover:border-[#fff0c2] bg-gradient-to-b from-[#231d17] via-[#17161d] to-[#11131a]'
                                  }`}
                                >
                                  {/* Card Top Header */}
                                  <div
                                    style={{ backgroundColor: combatCardTpl.headerBgColor || undefined }}
                                    className={`flex items-center justify-between text-[11px] font-cinzel font-bold border-b pb-1 ${
                                      action.isSpecialAction
                                        ? 'text-purple-300 border-purple-500/30'
                                        : 'text-[#d8ba73] border-[#c8a45c]/30'
                                    }`}
                                  >
                                    <span className="truncate uppercase">{action.sourceName}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {!isLocked && (
                                        <button
                                          type="button"
                                          data-testid={`btn-edit-combat-card-${action.id}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingDeckCardModal({
                                              deck: 'combat',
                                              cardId: action.id,
                                              sourceId: action.sourceId,
                                              sourceKind: action.sourceKind,
                                              name: action.name,
                                              description: action.description || '',
                                              damageOrFormula: action.damageFormula,
                                              imageUrl: action.imageUrl || '',
                                            });
                                          }}
                                          className="text-amber-300 hover:text-white transition"
                                          title="Editar descripción o imagen de esta acción"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {action.isSpecialAction ? (
                                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                                      ) : (
                                        <Sword className="w-3.5 h-3.5 shrink-0 text-[#e2c275]" />
                                      )}
                                    </div>
                                  </div>

                                  {/* Framed Tarot Illustration Box */}
                                  <div
                                    style={buildGeometricElementStyle({
                                      shape: combatCardTpl.illustrationShape,
                                      hideBorder: combatCardTpl.illustrationHideBorder,
                                      edgeFadePercent: combatCardTpl.illustrationEdgeFadePercent,
                                    })}
                                    className={`my-1.5 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 shadow-inner flex items-center justify-center overflow-hidden group-hover:scale-105 transition ${
                                      action.isSpecialAction
                                        ? 'bg-gradient-to-b from-[#3d1e58] to-[#180f24] border-purple-400/50'
                                        : 'bg-gradient-to-b from-[#2b2318] to-[#141210] border-[#786545]'
                                    }`}
                                  >
                                    {action.imageUrl ? (
                                      <img
                                        src={action.imageUrl}
                                        alt={action.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : action.isSpecialAction ? (
                                      <Zap className="w-9 h-9 text-purple-300 drop-shadow" />
                                    ) : (
                                      <svg
                                        viewBox="0 0 64 64"
                                        className="w-11 h-11 text-[#dcb868] drop-shadow"
                                        fill="currentColor"
                                      >
                                        <path d="M52 8L40 12L18 34L12 32L8 36L16 44L10 50L14 54L20 48L28 56L32 52L30 46L52 24L56 12L52 8ZM22 40L44 18L46 20L24 42L22 40Z" />
                                      </svg>
                                    )}
                                  </div>

                                  {/* Title, Description & Formula Pill */}
                                  <div className="text-center space-y-1">
                                    <div
                                      style={{ color: combatCardTpl.titleColor || undefined }}
                                      className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] uppercase leading-tight line-clamp-1"
                                    >
                                      {action.name}
                                    </div>
                                    {action.description && (
                                      <p
                                        data-testid={`combat-card-desc-${action.id}`}
                                        style={{ color: combatCardTpl.descColor || undefined }}
                                        className="text-[10px] text-amber-200/80 line-clamp-2 leading-tight px-1"
                                      >
                                        {action.description}
                                      </p>
                                    )}
                                    <div
                                      style={{
                                        backgroundColor: combatCardTpl.badgeBgColor || undefined,
                                        color: combatCardTpl.badgeTextColor || undefined,
                                      }}
                                      className="rounded-xl bg-[#181c29] border border-white/10 py-1 px-2.5 shadow-inner"
                                    >
                                      <div className="font-cinzel font-black text-base sm:text-lg text-white leading-none">
                                        {action.damageFormula}
                                      </div>
                                      <div className="text-[9px] font-cinzel font-bold text-[#8e96aa] uppercase tracking-wider mt-0.5">
                                        {action.damageType}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Footer */}
                                  <div className="pt-1.5 mt-1.5 border-t border-[#c8a45c]/35 flex items-center justify-between text-[11px] font-sans text-[#e2d6c1]">
                                    <span>
                                      {action.isSpecialAction ? 'Bono/Acción' : `Impacto: ${formatModifier(action.toHitBonus)}`}
                                    </span>
                                    <span className="font-cinzel font-black text-[#e5c478] uppercase tracking-wider">
                                      TIRAR
                                    </span>
                                  </div>
                                </div>
                              ))}

                            {allCharacterActions.length === 0 && (
                              <div
                                data-testid="player-card-unarmed"
                                onClick={() =>
                                  onTriggerRoll(
                                    'Golpe Desarmado',
                                    getEffectiveAbilityModifier(character.abilities.str) + profBonus,
                                    20
                                  )
                                }
                                className="group relative rounded-2xl border-2 border-[#c8a45c] ring-1 ring-inset ring-[#e2c275]/35 hover:border-[#fff0c2] bg-gradient-to-b from-[#231d17] via-[#17161d] to-[#11131a] p-2.5 flex flex-col justify-between min-h-[225px] sm:min-h-[240px] shadow-2xl hover:-translate-y-1 transition cursor-pointer"
                              >
                                <div className="flex items-center justify-between text-[11px] text-[#d8ba73] font-cinzel font-bold border-b border-[#c8a45c]/30 pb-1">
                                  <span>BÁSICO</span>
                                  <Sword className="w-3.5 h-3.5 text-[#e2c275]" />
                                </div>

                                {/* Framed Clenched Fist Tarot Emblem */}
                                <div className="my-1.5 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-b from-[#2b2318] to-[#141210] border-2 border-[#786545] shadow-inner flex items-center justify-center p-2.5 group-hover:scale-105 transition">
                                  <svg
                                    viewBox="0 0 64 64"
                                    className="w-full h-full text-[#dcb868] drop-shadow"
                                    fill="currentColor"
                                  >
                                    <path d="M18 22c0-3 2.5-5 5.5-5 1.5 0 2.8.6 3.7 1.5.9-1.5 2.5-2.5 4.3-2.5 2 0 3.7 1 4.5 2.6.9-.9 2.2-1.6 3.7-1.6 2.8 0 5 2.2 5 5v2.2c2.8.6 4.8 3.1 4.8 6.1v7.7c0 7.5-5.8 13.5-13.2 13.5H27c-6.6 0-12-5.4-12-12V27c0-2.8 1.3-4.2 3-5zm5 4v8h3v-9c0-1.1-.9-2-2-2s-1 .9-1 3zm6-1v9h3V24c0-1.1-.9-2-2-2s-1 .9-1 2zm6 1v8h3v-8c0-1.1-.9-2-2-2s-1 .9-1 2zm6 4v6h2.5c1.4 0 2.5-1.1 2.5-2.5v-1c0-1.4-1.1-2.5-2.5-2.5H41z" />
                                  </svg>
                                </div>

                                <div className="text-center space-y-1">
                                  <div className="font-cinzel font-black text-xs sm:text-sm text-[#f5e4be] uppercase leading-tight">
                                    GOLPE DESARMADO
                                  </div>
                                  <p className="text-[10px] text-amber-200/80 line-clamp-2 leading-tight px-1">
                                    Ataque cuerpo a cuerpo directo con tus puños o artes marciales.
                                  </p>
                                  <div className="rounded-xl bg-[#181c29] border border-white/10 py-1 px-2.5 shadow-inner">
                                    <div className="font-cinzel font-black text-base sm:text-lg text-white leading-none">
                                      1 + {getEffectiveAbilityModifier(character.abilities.str)}
                                    </div>
                                    <div className="text-[9px] font-cinzel font-bold text-[#8e96aa] uppercase tracking-wider mt-0.5">
                                      CONTUNDENTE
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-1.5 mt-1.5 border-t border-[#c8a45c]/35 flex items-center justify-between text-[11px] font-sans text-[#e2d6c1]">
                                  <span>
                                    Impacto:{' '}
                                    {formatModifier(
                                      getEffectiveAbilityModifier(character.abilities.str) + profBonus
                                    )}
                                  </span>
                                  <span className="font-cinzel font-black text-[#e5c478] uppercase tracking-wider">
                                    TIRAR
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* DECK 2 CARDS: HABILIDADES */}
                        {activeDeck === 'skills' &&
                          possessedSkills
                            .slice(safeScrollIdx, safeScrollIdx + 2)
                            .map((sk) => {
                              const abMod = getEffectiveAbilityModifier(character.abilities[sk.ability]);
                              const totalBonus =
                                abMod +
                                (sk.proficiency === 'expertise'
                                  ? profBonus * 2
                                  : sk.proficiency === 'proficient'
                                  ? profBonus
                                  : 0);
                              return (
                                <div
                                  key={sk.id}
                                  data-testid={`player-card-${sk.id}`}
                                  onClick={() => onTriggerRoll(`Habilidad: ${sk.name}`, totalBonus, 20)}
                                  title={sk.description || undefined}
                                  style={buildGeometricElementStyle({
                                    shape: skillsCardTpl.cardShape,
                                    hideBorder: skillsCardTpl.hideBorder,
                                    edgeFadePercent: skillsCardTpl.edgeFadePercent,
                                    bgColor: skillsCardTpl.bgColor,
                                    borderColor: skillsCardTpl.borderColor,
                                    borderWidthPx: skillsCardTpl.borderWidthPx,
                                    customPngUrl: skillsCardTpl.customBgPngUrl,
                                    opacity: skillsCardTpl.opacity,
                                  })}
                                  className="group relative rounded-2xl border-2 border-cyan-400/80 ring-1 ring-inset ring-cyan-300/25 hover:border-cyan-200 bg-gradient-to-b from-[#132838] via-[#0e1c28] to-[#09121a] p-2.5 flex flex-col justify-between min-h-[225px] sm:min-h-[240px] shadow-2xl hover:-translate-y-1 transition cursor-pointer"
                                >
                                  <div className="flex items-center justify-between text-[11px] text-cyan-300 font-cinzel font-bold border-b border-cyan-500/30 pb-1">
                                    <span>{ABILITY_LABELS[sk.ability].abbr}</span>
                                    {!isLocked ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditSkillCard(sk);
                                          }}
                                          className="text-cyan-300 hover:text-white"
                                          title="Editar descripción o imagen de la habilidad"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveSkillCard(sk.id, sk.srdKey);
                                          }}
                                          className="text-red-400 hover:text-red-200"
                                          title="Quitar habilidad del mazo"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                                    )}
                                  </div>

                                  <div
                                    style={buildGeometricElementStyle({
                                      shape: skillsCardTpl.illustrationShape,
                                      hideBorder: skillsCardTpl.illustrationHideBorder,
                                      edgeFadePercent: skillsCardTpl.illustrationEdgeFadePercent,
                                    })}
                                    className="my-1.5 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-b from-[#152d3e] to-[#0b1721] border-2 border-cyan-500/50 shadow-inner flex items-center justify-center overflow-hidden group-hover:scale-105 transition"
                                  >
                                    {sk.imageUrl ? (
                                      <img
                                        src={sk.imageUrl}
                                        alt={sk.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <BookOpen className="w-9 h-9 text-cyan-300" />
                                    )}
                                  </div>

                                  <div className="text-center space-y-1">
                                    <div
                                      style={{ color: skillsCardTpl.titleColor || undefined }}
                                      className="font-cinzel font-black text-xs sm:text-sm text-white uppercase leading-tight line-clamp-1"
                                    >
                                      {sk.name}
                                    </div>
                                    {sk.description && (
                                      <p
                                        style={{ color: skillsCardTpl.descColor || undefined }}
                                        className="text-[10px] text-cyan-200/80 line-clamp-2 leading-tight px-1"
                                      >
                                        {sk.description}
                                      </p>
                                    )}
                                    <div className="rounded-xl bg-[#0b141e] border border-cyan-400/25 py-1 px-2.5 shadow-inner">
                                      <div className="font-cinzel font-black text-base sm:text-lg text-cyan-200 leading-none">
                                        {formatModifier(totalBonus)}
                                      </div>
                                      <div className="text-[9px] font-cinzel font-bold text-cyan-400/80 uppercase tracking-wider mt-0.5">
                                        {sk.proficiency === 'expertise' ? 'PERICIA' : 'COMPETENTE'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-1.5 mt-1.5 border-t border-cyan-500/30 flex items-center justify-between text-[11px] font-sans text-cyan-100">
                                    <span>Prueba d20</span>
                                    <span className="font-cinzel font-black text-cyan-300 uppercase tracking-wider">
                                      TIRAR
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                        {/* DECK 3 CARDS: LANZAR CONJUROS */}
                        {activeDeck === 'spells' &&
                          preparedSpells.slice(safeScrollIdx, safeScrollIdx + 2).map((sp) => (
                            <div
                              key={sp.id}
                              data-testid={`player-card-${sp.id}`}
                              title={sp.description || undefined}
                              onClick={() =>
                                onTriggerRoll(
                                  `Conjuro: ${sp.name} ${sp.damageOrHeal ? `(${sp.damageOrHeal})` : ''}`,
                                  spellAttackBonus,
                                  20
                                )
                              }
                              style={buildGeometricElementStyle({
                                shape: spellsCardTpl.cardShape,
                                hideBorder: spellsCardTpl.hideBorder,
                                edgeFadePercent: spellsCardTpl.edgeFadePercent,
                                bgColor: spellsCardTpl.bgColor,
                                borderColor: spellsCardTpl.borderColor,
                                borderWidthPx: spellsCardTpl.borderWidthPx,
                                customPngUrl: spellsCardTpl.customBgPngUrl,
                                opacity: spellsCardTpl.opacity,
                              })}
                              className="group relative rounded-2xl border-2 border-purple-400/80 ring-1 ring-inset ring-purple-300/25 hover:border-purple-200 bg-gradient-to-b from-[#28153d] via-[#1b0e29] to-[#11091a] p-2.5 flex flex-col justify-between min-h-[225px] sm:min-h-[240px] shadow-2xl hover:-translate-y-1 transition cursor-pointer"
                            >
                              <div className="flex items-center justify-between text-[11px] text-purple-300 font-cinzel font-bold border-b border-purple-500/30 pb-1">
                                <span>{sp.level === 0 ? 'TRUCO' : `NIVEL ${sp.level}`}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      data-testid={`btn-edit-spell-card-${sp.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDeckCardModal({
                                          deck: 'spells',
                                          cardId: sp.id,
                                          sourceId: sp.id,
                                          name: sp.name,
                                          description: sp.description || '',
                                          damageOrFormula: sp.damageOrHeal || '',
                                          imageUrl: sp.imageUrl || '',
                                        });
                                      }}
                                      className="text-purple-300 hover:text-white transition"
                                      title="Editar descripción o imagen de este conjuro"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <Flame className="w-3.5 h-3.5 text-purple-300" />
                                </div>
                              </div>

                              <div
                                style={buildGeometricElementStyle({
                                  shape: spellsCardTpl.illustrationShape,
                                  hideBorder: spellsCardTpl.illustrationHideBorder,
                                  edgeFadePercent: spellsCardTpl.illustrationEdgeFadePercent,
                                })}
                                className="my-1.5 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-b from-[#311a4a] to-[#160b24] border-2 border-purple-400/50 shadow-inner flex items-center justify-center overflow-hidden group-hover:scale-105 transition"
                              >
                                {sp.imageUrl ? (
                                  <img
                                    src={sp.imageUrl}
                                    alt={sp.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Sparkles className="w-9 h-9 text-purple-300" />
                                )}
                              </div>

                              <div className="text-center space-y-1">
                                <div
                                  style={{ color: spellsCardTpl.titleColor || undefined }}
                                  className="font-cinzel font-black text-xs sm:text-sm text-white uppercase leading-tight line-clamp-1"
                                >
                                  {sp.name}
                                </div>
                                {sp.description && (
                                  <p
                                    data-testid={`spell-card-desc-${sp.id}`}
                                    style={{ color: spellsCardTpl.descColor || undefined }}
                                    className="text-[10px] text-purple-200/80 line-clamp-2 leading-tight px-1"
                                  >
                                    {sp.description}
                                  </p>
                                )}
                                <div className="rounded-xl bg-[#140b20] border border-purple-400/25 py-1 px-2.5 shadow-inner">
                                  <div className="font-cinzel font-black text-base sm:text-lg text-amber-300 leading-none">
                                    {sp.damageOrHeal || formatModifier(spellAttackBonus)}
                                  </div>
                                  <div className="text-[9px] font-cinzel font-bold text-purple-300/80 uppercase tracking-wider mt-0.5 truncate">
                                    {sp.school || 'CONJURO ARCANO'}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-1.5 mt-1.5 border-t border-purple-500/30 flex items-center justify-between text-[11px] font-sans text-purple-200">
                                <span className="truncate">{sp.range || '60 ft'}</span>
                                <span className="font-cinzel font-black text-[#e5c478] uppercase tracking-wider">
                                  TIRAR
                                </span>
                              </div>
                            </div>
                          ))}

                        {/* BALANCED TAROT-PROPORTIONED "+ NUEVA CARTA" DASHED SLOT CARD */}
                        <button
                          type="button"
                          data-testid="btn-player-deck-add"
                          onClick={() => {
                            if (activeDeck === 'combat') setShowAddCombatCardModal(true);
                            else if (activeDeck === 'skills') {
                              setEditingSkillId(null);
                              setSkillCardForm({
                                srdKey: 'perception',
                                name: 'Percepción',
                                ability: 'wis',
                                proficiency: 'proficient',
                                description:
                                  character.skillDescriptions?.perception ||
                                  DEFAULT_SRD_SKILL_DESCRIPTIONS.perception,
                                imageUrl: character.skillImages?.perception || '',
                              });
                              setShowAddSkillCardModal(true);
                            } else setIsBackpackModalOpen(true);
                          }}
                          className="min-h-[225px] sm:min-h-[240px] rounded-2xl border-2 border-dashed border-[#c8a45c]/45 hover:border-[#f5e4be] bg-[#141724]/75 hover:bg-[#1a1f30] p-3 flex flex-col items-center justify-center gap-2.5 text-[#cbb692] hover:text-white transition cursor-pointer group shadow-inner"
                          title="Agregar nueva carta a este mazo"
                        >
                          <div className="w-12 h-12 rounded-full border-2 border-[#c8a45c]/75 bg-[#291e14] group-hover:scale-110 flex items-center justify-center transition shadow-lg">
                            <Plus className="w-6 h-6 text-[#e2c275]" />
                          </div>
                          <span className="font-cinzel font-black text-xs sm:text-sm text-[#9aa3b5] group-hover:text-[#f5e4be] uppercase tracking-widest text-center leading-tight">
                            NUEVA
                            <br />
                            CARTA
                          </span>
                        </button>
                      </div>

                      {/* Right Scroll Arrow (when > 2 cards) */}
                      {currentPlayerDeckCount > 2 && (
                        <button
                          type="button"
                          data-testid="btn-player-deck-next"
                          disabled={safeScrollIdx >= maxScrollIdx}
                          onClick={() => setPlayerDeckScrollIndex(Math.min(maxScrollIdx, safeScrollIdx + 1))}
                          style={{
                            backgroundColor: activeSkinTokens?.sheetDeckArrowBtnBg || undefined,
                            borderColor: activeSkinTokens?.sheetDeckArrowBtnBorder || undefined,
                          }}
                          className="w-7 h-36 rounded-xl bg-[#191c29] hover:bg-amber-950/80 disabled:opacity-30 border border-[#c8a45c]/60 text-[#f5e4be] flex items-center justify-center shrink-0 transition cursor-pointer disabled:cursor-default shadow overflow-hidden"
                          title="Ver siguientes cartas"
                        >
                          {activeSkinTokens?.sheetDeckArrowBtnCustomPngUrl ? (
                            <img
                              src={activeSkinTokens.sheetDeckArrowBtnCustomPngUrl}
                              alt="Siguiente"
                              className="w-4 h-4 object-contain"
                            />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-amber-300" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            )}

            {/* RIGHT 5 COLS: EL RINCÓN DEL AVENTURERO (1 Large Inventory Box on Top + 2 Half-Size Boxes Below) */}
            {!getSheetBlock('adventurer_corner_panel')?.hidden && (
            <div
              style={buildSpatialBlockInlineStyle(getSheetBlock('adventurer_corner_panel'), false)}
              className="lg:col-span-5 bg-[#12151e]/95 border-2 border-[#c8a45c]/65 rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <h2 className="font-cinzel font-black text-base sm:text-lg text-[#e7c67b] tracking-wider uppercase whitespace-nowrap">
                  {getSheetBlock('adventurer_corner_panel')?.titleText ||
                    activeSkinTokens?.adventurerCornerTitleText ||
                    'EL RINCÓN DEL AVENTURERO'}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-[#c8a45c]/60 to-transparent" />
              </div>

              {/* 1. TOP LARGE CARD: EQUIPO E INVENTARIO */}
              <button
                type="button"
                data-testid="btn-rincon-inventario"
                style={buildInnerButtonInlineStyle(getSheetBlock('adventurer_corner_panel'), 'btn_open_inventory')}
                onClick={() => setIsBackpackModalOpen(true)}
                className="relative w-full rounded-2xl border-2 border-[#c8a45c] ring-1 ring-inset ring-[#e2c275]/25 hover:border-[#f5e4be] bg-gradient-to-b from-[#1e2330] via-[#191d28] to-[#141720] p-3 flex flex-col items-center justify-center text-center shadow-xl transition cursor-pointer group flex-1"
              >
                {/* Weight Badge Top-Right */}
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-[#161412] border border-[#c8a45c]/70 text-[11px] font-sans font-semibold text-[#f3e3c3] shadow">
                  {totalWeight.toFixed(0)} / {carryCap.maxCarry} lb
                </span>

                {/* Framed Adventurer's Leather Backpack SVG or Custom Skin Illustration */}
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-[#10141c] border-2 border-[#8c7853] shadow-inner flex items-center justify-center p-2.5 group-hover:scale-105 transition overflow-hidden">
                  {activeSkinTokens?.sheetBackpackCustomPngUrl ? (
                    <img
                      src={activeSkinTokens.sheetBackpackCustomPngUrl}
                      alt="Mochila"
                      className="w-full h-full object-contain drop-shadow-lg"
                    />
                  ) : (
                    <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-lg">
                      {/* Left & Right Straps */}
                      <path
                        d="M22 26 C12 32, 12 54, 20 58"
                        stroke="#593e28"
                        strokeWidth="4.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <path
                        d="M36 14 C36 9, 44 9, 44 14"
                        stroke="#6e4d32"
                        strokeWidth="4"
                        fill="none"
                      />
                      {/* Main Backpack Body */}
                      <rect
                        x="22"
                        y="16"
                        width="36"
                        height="46"
                        rx="8"
                        fill="#7c583b"
                        stroke="#1f140b"
                        strokeWidth="2.5"
                      />
                      {/* Top Flap */}
                      <path
                        d="M22 22 C22 15, 58 15, 58 22 L56 36 C46 39, 34 39, 24 36 Z"
                        fill="#8f6746"
                        stroke="#1f140b"
                        strokeWidth="2.4"
                      />
                      {/* Front Pocket */}
                      <rect
                        x="27"
                        y="41"
                        width="26"
                        height="17"
                        rx="4"
                        fill="#69482e"
                        stroke="#1f140b"
                        strokeWidth="2.2"
                      />
                      {/* Side Pouch */}
                      <rect
                        x="17"
                        y="38"
                        width="7"
                        height="18"
                        rx="3"
                        fill="#69482e"
                        stroke="#1f140b"
                        strokeWidth="2"
                      />
                      <rect
                        x="56"
                        y="38"
                        width="7"
                        height="18"
                        rx="3"
                        fill="#69482e"
                        stroke="#1f140b"
                        strokeWidth="2"
                      />
                      {/* Leather Buckle Straps & Gold Clasps */}
                      <rect x="30" y="20" width="4" height="24" rx="1.5" fill="#4a301c" stroke="#1f140b" strokeWidth="1.4" />
                      <rect x="46" y="20" width="4" height="24" rx="1.5" fill="#4a301c" stroke="#1f140b" strokeWidth="1.4" />
                      <rect x="29" y="32" width="6" height="5" rx="1" fill="#d8b467" stroke="#1f140b" strokeWidth="1.3" />
                      <rect x="45" y="32" width="6" height="5" rx="1" fill="#d8b467" stroke="#1f140b" strokeWidth="1.3" />
                    </svg>
                  )}
                </div>

                <h3 className="font-cinzel font-black text-sm sm:text-base text-[#e7c67b] group-hover:text-[#fff1cc] uppercase tracking-wider mt-2">
                  {getInnerButtonLabel(
                    getSheetBlock('adventurer_corner_panel'),
                    'btn_open_inventory',
                    activeSkinTokens?.sheetBackpackLabelText || 'EQUIPO E INVENTARIO'
                  )}
                </h3>

                <div className="flex items-center justify-center gap-1.5 mt-0.5 text-xs font-sans">
                  <Coins className="w-3.5 h-3.5 text-[#d8b467] shrink-0" />
                  <span className="text-[#d8b467] font-semibold">
                    {currency.gp} PO • {currency.sp} PP • {currency.cp} PC
                  </span>
                  <span className="text-[#8e96aa]">
                    • {(character.inventory || []).length} objetos
                  </span>
                </div>
              </button>

              {/* 2. BOTTOM 2-COLUMN GRID: DIARIO (LEFT) & RASGOS Y TRASFONDO (RIGHT) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Bottom-Left: DIARIO DE [NOMBRE] */}
                <button
                  type="button"
                  data-testid="btn-rincon-diario"
                  style={buildInnerButtonInlineStyle(getSheetBlock('adventurer_corner_panel'), 'btn_open_journal')}
                  onClick={() => setIsJournalModalOpen(true)}
                  className="relative rounded-2xl border-2 border-[#8c94a4]/65 hover:border-[#e2c275] bg-gradient-to-b from-[#1e2330] via-[#181c27] to-[#131720] p-2.5 flex flex-col items-center justify-between text-center shadow-lg transition cursor-pointer group"
                >
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#161412] border border-[#c8a45c]/60 text-[10px] font-sans font-semibold text-[#f3e3c3] shadow">
                    {journalIndex.totalSheets} Hojas
                  </span>

                  {/* Framed Leather Journal SVG or Custom Skin Illustration */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#10141c] border-2 border-[#8c7853] shadow-inner flex items-center justify-center p-2 mt-1.5 group-hover:scale-105 transition overflow-hidden">
                    {activeSkinTokens?.sheetJournalCustomPngUrl ? (
                      <img
                        src={activeSkinTokens.sheetJournalCustomPngUrl}
                        alt="Diario"
                        className="w-full h-full object-contain drop-shadow"
                      />
                    ) : (
                      <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow">
                        <rect
                          x="14"
                          y="8"
                          width="36"
                          height="48"
                          rx="4"
                          fill="#6b462b"
                          stroke="#1c1108"
                          strokeWidth="2.5"
                        />
                        <line x1="20" y1="8" x2="20" y2="56" stroke="#3d2616" strokeWidth="2.5" />
                        {/* Gold Corners & Clasp */}
                        <path d="M42 8 H50 V16 Z" fill="#d8b467" />
                        <path d="M42 56 H50 V48 Z" fill="#d8b467" />
                        <rect
                          x="43"
                          y="28"
                          width="9"
                          height="8"
                          rx="2"
                          fill="#d8b467"
                          stroke="#1c1108"
                          strokeWidth="1.8"
                        />
                        {/* Open Book Emblem on Cover */}
                        <path
                          d="M25 24 Q30 22 34 25 Q38 22 43 24 V38 Q38 36 34 39 Q30 36 25 38 Z"
                          fill="none"
                          stroke="#d8b467"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="mt-1.5">
                    <h3 className="font-cinzel font-black text-xs text-[#e7c67b] group-hover:text-[#fff1cc] uppercase leading-tight">
                      {getInnerButtonLabel(
                        getSheetBlock('adventurer_corner_panel'),
                        'btn_open_journal',
                        activeSkinTokens?.sheetJournalLabelText || 'DIARIO DE'
                      )}
                      <br />
                      {character.name}
                    </h3>
                    <p className="text-[10px] text-[#8e96aa] mt-0.5 line-clamp-1">
                      Crónicas y apuntes de sesión
                    </p>
                  </div>
                </button>

                {/* Bottom-Right: RASGOS Y TRASFONDO */}
                <button
                  type="button"
                  data-testid="btn-rincon-rasgos"
                  style={buildInnerButtonInlineStyle(getSheetBlock('adventurer_corner_panel'), 'btn_open_traits')}
                  onClick={() => setIsParchmentModalOpen(true)}
                  className="relative rounded-2xl border-2 border-[#8c94a4]/65 hover:border-[#e2c275] bg-gradient-to-b from-[#1e2330] via-[#181c27] to-[#131720] p-2.5 flex flex-col items-center justify-between text-center shadow-lg transition cursor-pointer group"
                >
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#161412] border border-[#c8a45c]/60 text-[10px] font-sans font-semibold text-[#f3e3c3] shadow">
                    {(character.featuresAndTraits || []).length} Dotes
                  </span>

                  {/* Framed Parchment Scroll with Wax Seal SVG Illustration */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#10141c] border-2 border-[#8c7853] shadow-inner flex items-center justify-center p-2 mt-1.5 group-hover:scale-105 transition overflow-hidden">
                    {activeSkinTokens?.sheetTraitsCustomPngUrl ? (
                      <img
                        src={activeSkinTokens.sheetTraitsCustomPngUrl}
                        alt="Rasgos"
                        className="w-full h-full object-contain drop-shadow"
                      />
                    ) : (
                      <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow">
                        {/* Top Roll */}
                        <rect
                          x="12"
                          y="10"
                          width="40"
                          height="8"
                          rx="4"
                          fill="#c9ad7c"
                          stroke="#24180c"
                          strokeWidth="2.2"
                        />
                        {/* Scroll Body */}
                        <path
                          d="M16 18 H48 L46 46 H14 Z"
                          fill="#DFC699"
                          stroke="#24180c"
                          strokeWidth="2.2"
                        />
                        {/* Script Lines */}
                        <line x1="21" y1="25" x2="41" y2="25" stroke="#6e5430" strokeWidth="1.8" strokeLinecap="round" />
                        <line x1="20" y1="31" x2="40" y2="31" stroke="#6e5430" strokeWidth="1.8" strokeLinecap="round" />
                        <line x1="20" y1="37" x2="33" y2="37" stroke="#6e5430" strokeWidth="1.8" strokeLinecap="round" />
                        {/* Bottom Roll */}
                        <rect
                          x="10"
                          y="45"
                          width="42"
                          height="9"
                          rx="4.5"
                          fill="#b89864"
                          stroke="#24180c"
                          strokeWidth="2.2"
                        />
                        {/* Wax Seal */}
                        <circle
                          cx="40"
                          cy="42"
                          r="5"
                          fill="#8c3b2b"
                          stroke="#24180c"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="mt-1.5">
                    <h3 className="font-cinzel font-black text-xs text-[#e7c67b] group-hover:text-[#fff1cc] uppercase leading-tight">
                      {getInnerButtonLabel(
                        getSheetBlock('adventurer_corner_panel'),
                        'btn_open_traits',
                        activeSkinTokens?.sheetTraitsLabelText || 'RASGOS Y TRASFONDO'
                      )}
                    </h3>
                    <p className="text-[10px] text-[#8e96aa] mt-0.5 line-clamp-1">
                      {character.background} • Personalidad e Ideales
                    </p>
                  </div>
                </button>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT SIDEBAR IN TABLE MODE (SALA EN VIVO + CARTA DE JUGADOR)     */}
        {/* ================================================================= */}
        {isInActiveRoom && (
          <div className="xl:col-span-3 flex flex-col gap-3">
            {/* 1. SALA EN VIVO (Aliados 4x2 max 8 & Enemigos 4x2 max 8) */}
            {!getSheetBlock('live_table_combatants_bar')?.hidden && (
              <div
                style={buildSpatialBlockInlineStyle(getSheetBlock('live_table_combatants_bar'), false)}
                className="bg-gradient-to-b from-[#1a1c24] to-[#12141b] border-2 border-[#c8a45c]/65 rounded-2xl p-3.5 shadow-xl space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#c8a45c]/30 pb-2">
                  <h3 className="font-cinzel font-black text-sm text-[#f5e4be] tracking-wider uppercase">
                    {getSheetBlock('live_table_combatants_bar')?.titleText || 'SALA EN VIVO'}
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {roomCode}
                  </span>
                </div>

                {/* Aliados (Max 8, 4x2 grid) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#cbb692] mb-1.5">
                    <span>Aliados</span>
                    <span className="text-[10px] font-mono text-[#e2c275]">
                      {tableAllies.length}/8
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {tableAllies.map((ally, idx) => {
                      const pct = Math.min(
                        100,
                        Math.max(0, (ally.hp / Math.max(1, ally.maxHp)) * 100)
                      );
                      return (
                        <div
                          key={ally.id}
                          style={buildInnerButtonInlineStyle(
                            getSheetBlock('live_table_combatants_bar'),
                            idx % 2 === 0 ? 'ally_chip_1' : 'ally_chip_2'
                          )}
                          className="bg-[#11131a] border border-[#c8a45c]/50 rounded-lg p-1 flex flex-col items-center text-center"
                          title={`${ally.name}: ${ally.hp}/${ally.maxHp} PG`}
                        >
                          <EntityAvatar
                            avatarType={ally.avatarType}
                            customUrl={ally.avatarCustomUrl}
                            iconId={ally.avatarIcon || 'anonymous'}
                            size="sm"
                            className="rounded-md"
                          />
                          <span className="text-[9px] font-cinzel font-bold text-[#f3dfb2] truncate w-full mt-1">
                            {ally.name}
                          </span>
                          <div className="w-full h-2.5 bg-black/80 rounded-full overflow-hidden border border-emerald-500/40 mt-0.5 relative">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                            <span className="absolute inset-0 text-[8px] font-mono font-bold text-white flex items-center justify-center leading-none">
                              {ally.hp}/{ally.maxHp}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enemigos (Max 8, 4x2 grid) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#cbb692] mb-1.5">
                    <span>Enemigos</span>
                    <span className="text-[10px] font-mono text-red-400">
                      {tableEnemies.length}/8
                    </span>
                  </div>
                  {tableEnemies.length === 0 ? (
                    <div className="bg-[#11131a]/80 border border-stone-800 rounded-xl p-2.5 text-center text-[11px] text-stone-400 font-cinzel">
                      Sin enemigos visibles en la mesa
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {tableEnemies.map((enemy, idx) => {
                        const pct = Math.min(
                          100,
                          Math.max(0, (enemy.hp / Math.max(1, enemy.maxHp)) * 100)
                        );
                        return (
                          <div
                            key={enemy.id}
                            style={buildInnerButtonInlineStyle(
                              getSheetBlock('live_table_combatants_bar'),
                              idx % 2 === 0 ? 'enemy_chip_1' : 'enemy_chip_2'
                            )}
                            className="bg-[#1a1113] border border-red-500/50 rounded-lg p-1 flex flex-col items-center text-center"
                            title={`${enemy.name}: ${enemy.hp}/${enemy.maxHp} PG`}
                          >
                            <EntityAvatar iconId="skull" size="sm" className="rounded-md" />
                            <span className="text-[9px] font-cinzel font-bold text-red-200 truncate w-full mt-1">
                              {enemy.name}
                            </span>
                            <div className="w-full h-2.5 bg-black/80 rounded-full overflow-hidden border border-red-500/40 mt-0.5 relative">
                              <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
                              <span className="absolute inset-0 text-[8px] font-mono font-bold text-white flex items-center justify-center leading-none">
                                {enemy.hp}/{enemy.maxHp}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. CARTA DE JUGADOR (Tarot-Proportioned Character Card with Alignment Badge & Coin Medallions) */}
            {!getSheetBlock('sheet_tarot_dock')?.hidden && (
              <div style={buildSpatialBlockInlineStyle(getSheetBlock('sheet_tarot_dock'), false)}>
                <CharacterTarotCard
                  character={character}
                  skinTokens={activeSkinTokens}
                  isOnline={true}
                  onClickCoinPouch={() => setIsBackpackModalOpen(true)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* La barra de sesión (Regresar al Lobby, Guardar, Estandarte del DM y Ubicación/Mapa) ahora está integrada en la barra superior */}

      {/* =================================================================== */}
      {/* INTERACTIVE MODALS                                                  */}
      {/* =================================================================== */}

      {/* 1. Ajustes de Personaje Modal (Base Stats, Custom Modifiers, Race, Class, Level) */}
      <CharacterSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        character={character}
        onSaveCharacter={onUpdateCharacter}
      />

      {/* 2. Diario de [Nombre] Notebook Modal */}
      <CharacterJournalBookModal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        character={character}
        onUpdateCharacter={onUpdateCharacter}
        isLocked={isLocked}
        onUnlockRequest={onUnlockRequest}
      />

      {/* 3. Mochila Abierta Modal (Armas, Armaduras, Objetos, Dinero y Grimorio Completo) */}
      <CharacterBackpackModal
        isOpen={isBackpackModalOpen}
        onClose={() => setIsBackpackModalOpen(false)}
        character={character}
        onUpdateCharacter={onUpdateCharacter}
        isLocked={isLocked}
        onUnlockRequest={onUnlockRequest}
      />

      {/* 4. Pergamino 5E Modal (Rasgos, Dotes y Trasfondo) */}
      <CharacterParchmentModal
        isOpen={isParchmentModalOpen}
        onClose={() => setIsParchmentModalOpen(false)}
        character={character}
        onUpdateCharacter={onUpdateCharacter}
        isLocked={isLocked}
        onUnlockRequest={onUnlockRequest}
      />

      {/* 5. Avatar Customizer Modal (with Dynamic Portrait Gallery up to 24 PNGs) */}
      {isAvatarModalOpen && (
        <AvatarCustomizerModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          title={`Retrato de ${character.name}`}
          currentType={character.avatarType || (character.avatarUrl ? 'custom' : 'icon')}
          currentCustomUrl={character.avatarCustomUrl || character.avatarUrl || ''}
          currentIconId={character.avatarIcon || 'anonymous'}
          currentPortraitGallery={character.portraitGallery || []}
          maxPortraits={maxPortraitCount}
          aspectRatioCss={portraitAspectCss}
          onSave={({ type, customUrl, iconId, portraitGallery }) => {
            onUpdateCharacter({
              ...character,
              avatarType: type,
              avatarCustomUrl: customUrl,
              avatarIcon: iconId,
              avatarUrl: type === 'custom' ? customUrl : undefined,
              portraitGallery: clampPortraitGallery(
                portraitGallery || character.portraitGallery || [],
                maxPortraitCount
              ),
            });
            setIsAvatarModalOpen(false);
          }}
        />
      )}

      {/* 5b. Player Skin Selector Modal */}
      {isSkinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          data-testid="player-skin-selector-modal"
        >
          <div className="w-full max-w-lg bg-[#171922] border-2 border-[#c8a45c] rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#e2c275]" />
                <h3 className="font-cinzel font-black text-base text-[#f5e4be] uppercase tracking-wider">
                  Skins de Hoja y Carta de Jugador
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSkinModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#cbb692]">
              La skin seleccionada se aplicará tanto a tu <strong>Hoja de Personaje</strong> como a tu{' '}
              <strong>Carta de Personaje</strong> en el Lobby y en la Mesa. La Skin Online Default está siempre disponible.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(availablePlayerSkins.length > 0
                ? availablePlayerSkins
                : [
                    {
                      id: 'skin-player-default',
                      name: 'Obsidiana & Oro Real (Skin Online Default)',
                      description: 'Aspecto predeterminado sincronizado con la Skin Online de la App.',
                      accentColor: '#c8a45c',
                      cardFrameStyle: 'gold-ornate' as const,
                      createdAt: '',
                      createdBy: 'system',
                    },
                  ]
              ).map((sk) => {
                const isSelected = (character.playerSkinId || 'skin-player-default') === sk.id;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    data-testid={`select-player-skin-${sk.id}`}
                    onClick={() => {
                      onUpdateCharacter({ ...character, playerSkinId: sk.id });
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#251f16] border-[#e2c275] shadow-lg'
                        : 'bg-[#11131a] border-stone-800 hover:border-[#c8a45c]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-7 h-7 rounded-lg border border-white/25 shrink-0"
                        style={{ backgroundColor: sk.accentColor || '#c8a45c' }}
                      />
                      <div className="min-w-0">
                        <div className="font-cinzel font-bold text-xs text-[#f5e4be] flex items-center gap-2">
                          <span>{sk.name}</span>
                          {sk.seasonTag && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-[9px] text-amber-300">
                              {sk.seasonTag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400 truncate">{sk.description}</p>
                        {(() => {
                          const fullRec = catalogPlayerSkinRecords.find((r) => r.id === sk.id);
                          if (
                            fullRec &&
                            !fullRec.hideCreatorCredit &&
                            (fullRec.editorCreditName || !fullRec.createdByAdmin)
                          ) {
                            return (
                              <p className="text-[10px] text-amber-300 font-cinzel mt-0.5">
                                ✨ Créditos del Creador:{' '}
                                <strong>{fullRec.editorCreditName || fullRec.authorName}</strong>
                                {fullRec.customCreditDescription
                                  ? ` — ${fullRec.customCreditDescription}`
                                  : ''}
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-cinzel font-bold text-[10px] uppercase shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-black'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {isSelected ? 'Activa' : 'Aplicar'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Redeem Seasonal / Exclusive Skin Code */}
            <form onSubmit={handleRedeemSkinCode} className="pt-2 border-t border-stone-800 space-y-2">
              <label className="block text-[11px] font-cinzel text-[#cbb692]">
                ¿Tienes un código de Skin de Temporada o Evento? (Ej. NAVIDAD2026 o DRAGONROJO)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={redeemCodeInput}
                  onChange={(e) => setRedeemCodeInput(e.target.value)}
                  placeholder="Ingresa código de skin o DLC..."
                  className="flex-1 bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono uppercase"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-cinzel font-black text-xs cursor-pointer"
                >
                  Canjear
                </button>
              </div>
              {redeemFeedback && (
                <p className="text-[11px] font-cinzel text-emerald-300">{redeemFeedback}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 6. HP Damage / Heal / Temp Modal */}
      {showHpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#171922] border-2 border-[#c8a45c] rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="font-cinzel font-bold text-base text-[#f5e4be]">
                {hpModalMode === 'damage'
                  ? 'Aplicar Daño'
                  : hpModalMode === 'heal'
                  ? 'Aplicar Curación'
                  : 'Definir PG Temporales'}
              </h3>
              <button
                type="button"
                onClick={() => setShowHpModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-stone-300 mb-1 font-cinzel">Cantidad de PG</label>
              <input
                type="number"
                min={1}
                value={hpChangeAmount}
                onChange={(e) => setHpChangeAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-[#101218] border border-[#c8a45c]/60 rounded-xl py-2 px-3 text-center font-mono font-bold text-lg text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowHpModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyHpChange}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-cinzel font-black text-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Add Combat Action Card Modal */}
      {showAddCombatCardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleAddCombatCard}
            className="w-full max-w-md bg-[#171922] border-2 border-[#c8a45c] rounded-2xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="font-cinzel font-bold text-base text-[#f5e4be]">
                Nueva Carta de Combate o Acción
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCombatCardModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-cinzel text-[#cbb692] mb-1">
                Nombre de la Acción o Ataque *
              </label>
              <input
                type="text"
                required
                value={combatCardForm.name}
                onChange={(e) => setCombatCardForm({ ...combatCardForm, name: e.target.value })}
                placeholder="Ej. Espadazo Divino / Aliento de Dragón"
                className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-cinzel text-[#cbb692] mb-1">
                  Bono Impacto
                </label>
                <input
                  type="number"
                  value={combatCardForm.attackBonus}
                  onChange={(e) =>
                    setCombatCardForm({
                      ...combatCardForm,
                      attackBonus: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-cinzel text-[#cbb692] mb-1">
                  Dados de Daño
                </label>
                <input
                  type="text"
                  value={combatCardForm.damageDice}
                  onChange={(e) =>
                    setCombatCardForm({ ...combatCardForm, damageDice: e.target.value })
                  }
                  placeholder="1d8+3"
                  className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-cinzel text-[#cbb692] mb-1">
                  Tipo Daño
                </label>
                <input
                  type="text"
                  value={combatCardForm.damageType}
                  onChange={(e) =>
                    setCombatCardForm({ ...combatCardForm, damageType: e.target.value })
                  }
                  placeholder="Cortante"
                  className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-cinzel text-[#cbb692] mb-1">
                Descripción del Ataque o Acción
              </label>
              <textarea
                rows={3}
                data-testid="input-combat-card-description"
                value={combatCardForm.notes}
                onChange={(e) => setCombatCardForm({ ...combatCardForm, notes: e.target.value })}
                placeholder="Describe el efecto, alcance, propiedades o notas de esta acción..."
                className="w-full bg-[#101218] border border-stone-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCombatCardModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="btn-save-combat-card"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-cinzel font-black text-xs cursor-pointer"
              >
                Añadir Carta al Mazo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7b. Quick Edit Modal for Combat / Spell Card Description & Image */}
      {editingDeckCardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          data-testid="modal-edit-deck-card-description"
        >
          <form
            onSubmit={handleSaveDeckCardDescription}
            className="w-full max-w-md bg-[#171922] border-2 border-amber-400 rounded-2xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="font-cinzel font-bold text-base text-amber-200">
                {editingDeckCardModal.deck === 'spells'
                  ? 'Editar Carta de Conjuro'
                  : 'Editar Carta de Combate o Acción'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDeckCardModal(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-cinzel text-[#cbb692] mb-1">
                Nombre de la Carta
              </label>
              <input
                type="text"
                required
                data-testid="input-edit-deck-card-name"
                value={editingDeckCardModal.name}
                onChange={(e) =>
                  setEditingDeckCardModal({ ...editingDeckCardModal, name: e.target.value })
                }
                className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel text-amber-200 mb-1">
                Descripción en la Carta
              </label>
              <textarea
                rows={4}
                data-testid="input-edit-deck-card-description"
                value={editingDeckCardModal.description}
                onChange={(e) =>
                  setEditingDeckCardModal({ ...editingDeckCardModal, description: e.target.value })
                }
                placeholder="Describe el efecto, alcance, dados adicionales o notas narrativas..."
                className="w-full bg-[#101218] border border-stone-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-cinzel text-stone-300 mb-1">
                Imagen de la Carta (Opcional)
              </label>
              <div className="flex items-center gap-2">
                {editingDeckCardModal.imageUrl && (
                  <img
                    src={editingDeckCardModal.imageUrl}
                    alt="Vista previa"
                    className="w-10 h-10 rounded-lg object-cover border border-amber-400 shrink-0"
                  />
                )}
                <input
                  type="text"
                  value={editingDeckCardModal.imageUrl || ''}
                  onChange={(e) =>
                    setEditingDeckCardModal({ ...editingDeckCardModal, imageUrl: e.target.value })
                  }
                  placeholder="URL de imagen o sube archivo PNG/JPG..."
                  className="flex-1 bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <label className="px-2.5 py-1.5 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-xs font-cinzel font-bold cursor-pointer shrink-0">
                  Subir
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await compressImageFileToDataUrl(file, 360, 0.85);
                        setEditingDeckCardModal((prev) =>
                          prev ? { ...prev, imageUrl: dataUrl } : null
                        );
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDeckCardModal(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="btn-save-deck-card-description"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-cinzel font-black text-xs cursor-pointer"
              >
                Guardar Descripción
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. Add / Edit Skill Card Modal */}
      {showAddSkillCardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleAddSkillCard}
            className="w-full max-w-md bg-[#171922] border-2 border-cyan-400 rounded-2xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="font-cinzel font-bold text-base text-cyan-200">
                {editingSkillId
                  ? 'Editar Carta de Habilidad'
                  : 'Desbloquear / Equipar Carta de Habilidad'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingSkillId(null);
                  setShowAddSkillCardModal(false);
                }}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-cinzel text-cyan-200 mb-1">
                Seleccionar Habilidad 5E o Personalizada
              </label>
              <select
                value={skillCardForm.srdKey}
                onChange={(e) => {
                  const val = e.target.value as SkillKey | 'custom';
                  if (val === 'custom') {
                    setSkillCardForm({
                      ...skillCardForm,
                      srdKey: 'custom',
                      name: '',
                      description: '',
                      imageUrl: '',
                    });
                  } else {
                    const meta = SKILL_METADATA[val];
                    const existingCard = possessedSkills.find((s) => s.srdKey === val);
                    setSkillCardForm({
                      srdKey: val,
                      name: meta.nameEs,
                      ability: meta.ability,
                      proficiency:
                        existingCard?.proficiency === 'expertise' ? 'expertise' : 'proficient',
                      description:
                        existingCard?.description ||
                        character.skillDescriptions?.[val] ||
                        DEFAULT_SRD_SKILL_DESCRIPTIONS[val] ||
                        meta.description,
                      imageUrl: existingCard?.imageUrl || character.skillImages?.[val] || '',
                    });
                  }
                }}
                className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {(Object.keys(SKILL_METADATA) as SkillKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SKILL_METADATA[k].nameEs} ({ABILITY_LABELS[SKILL_METADATA[k].ability].abbr})
                  </option>
                ))}
                <option value="custom">✨ Crear Habilidad Personalizada...</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-cinzel text-stone-300 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={skillCardForm.name}
                  onChange={(e) => setSkillCardForm({ ...skillCardForm, name: e.target.value })}
                  className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-cinzel text-stone-300 mb-1">
                  Nivel de Dominio
                </label>
                <select
                  value={skillCardForm.proficiency}
                  onChange={(e) =>
                    setSkillCardForm({
                      ...skillCardForm,
                      proficiency: e.target.value as 'proficient' | 'expertise',
                    })
                  }
                  className="w-full bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                >
                  <option value="proficient">Competente (+{profBonus})</option>
                  <option value="expertise">Pericia (+{profBonus * 2})</option>
                </select>
              </div>
            </div>

            {/* Skill Description Input */}
            <div>
              <label className="block text-[11px] font-cinzel text-cyan-200 mb-1">
                Descripción de la Habilidad
              </label>
              <textarea
                rows={3}
                data-testid="input-skill-card-description"
                value={skillCardForm.description}
                onChange={(e) =>
                  setSkillCardForm({ ...skillCardForm, description: e.target.value })
                }
                placeholder="Describe cómo tu personaje usa esta habilidad, efectos o notas de rol..."
                className="w-full bg-[#101218] border border-stone-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            {/* Skill Image Upload / URL */}
            <div>
              <label className="block text-[11px] font-cinzel text-cyan-200 mb-1">
                Imagen de la Carta de Habilidad (Opcional)
              </label>
              <div className="flex items-center gap-2">
                {skillCardForm.imageUrl && (
                  <img
                    src={skillCardForm.imageUrl}
                    alt="Previsualización habilidad"
                    className="w-10 h-10 rounded-lg object-cover border border-cyan-400 shrink-0"
                  />
                )}
                <input
                  type="text"
                  data-testid="input-skill-card-image-url"
                  value={skillCardForm.imageUrl}
                  onChange={(e) =>
                    setSkillCardForm({ ...skillCardForm, imageUrl: e.target.value })
                  }
                  placeholder="URL de imagen o sube archivo..."
                  className="flex-1 bg-[#101218] border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <label className="px-2.5 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-xs font-cinzel font-bold cursor-pointer shrink-0">
                  Subir
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await compressImageFileToDataUrl(file, 360, 0.8);
                        setSkillCardForm((prev) => ({ ...prev, imageUrl: dataUrl }));
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingSkillId(null);
                  setShowAddSkillCardModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="btn-save-skill-card"
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-cinzel font-black text-xs cursor-pointer"
              >
                {editingSkillId ? 'Guardar Cambios' : 'Añadir al Mazo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 9. Map Modal in Table Mode */}
      {isMapModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-[#181512] border-2 border-[#e2c275] rounded-2xl p-6 space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-[#5e4522] pb-3">
              <div className="flex items-center gap-2.5">
                <MapIcon className="w-5 h-5 text-amber-400" />
                <h3 className="font-cinzel font-black text-lg text-[#f5e4be] uppercase">
                  Cartografía de la Mesa ({roomCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-10 px-4 rounded-xl bg-[#120e0a] border border-[#5e4522] space-y-2">
              <Compass className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
              <p className="font-cinzel font-bold text-base text-[#f5e4be]">
                Mapa Táctico de la Sesión Activa
              </p>
              <p className="text-xs text-[#cbb692] max-w-md mx-auto">
                {dmLiveMessage
                  ? `Ubicación / Estado actual del DM: "${dmLiveMessage}"`
                  : 'El Dungeon Master proyectará aquí los mapas y regiones descubiertas por el grupo.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 10. Private Message to DM Modal */}
      {isDmMsgModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitMessageToDM}
            className="w-full max-w-md bg-[#181522] border-2 border-purple-400 rounded-2xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-purple-900 pb-2">
              <h3 className="font-cinzel font-bold text-base text-purple-200">
                Susurrar al Dungeon Master ({roomCode})
              </h3>
              <button
                type="button"
                onClick={() => setIsDmMsgModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-cinzel text-purple-200 mb-1">Asunto *</label>
              <input
                type="text"
                required
                value={dmMsgTitle}
                onChange={(e) => setDmMsgTitle(e.target.value)}
                placeholder="Ej. Acción secreta / Pregunta de percepción"
                className="w-full bg-black/50 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-cinzel text-purple-200 mb-1">Mensaje *</label>
              <textarea
                rows={3}
                required
                value={dmMsgBody}
                onChange={(e) => setDmMsgBody(e.target.value)}
                placeholder="Escribe tu mensaje privado para el DM..."
                className="w-full bg-black/50 border border-purple-500/40 rounded-xl p-3 text-xs text-white"
              />
            </div>
            {dmMsgStatus && (
              <p className="text-xs font-cinzel font-bold text-emerald-300">{dmMsgStatus}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDmMsgModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-cinzel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-cinzel font-bold text-xs"
              >
                Enviar al DM
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
