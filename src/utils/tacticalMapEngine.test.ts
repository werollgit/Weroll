import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessTacticalMaps,
  cellKey,
  createDefaultTacticalMapConfig,
  evaluateTacticalTokenMove,
  computeCellVisibilityForPlayers,
  resolveTokenFootprintCells,
  addPropStampToLayer,
  isTokenOwnedByPlayer,
  modifyTacticalTokenLive,
} from './tacticalMapEngine';
import { TacticalMapToken } from '../types/dnd';

describe('TacticalMapEngine', () => {
  it('enforces RBAC: allows moderator, creator, admin and blocks client', () => {
    assert.equal(canAccessTacticalMaps('client'), false);
    assert.equal(canAccessTacticalMaps(undefined), false);
    assert.equal(canAccessTacticalMaps('moderator'), true);
    assert.equal(canAccessTacticalMaps('creator'), true);
    assert.equal(canAccessTacticalMaps('admin'), true);
  });

  it('creates 4 layers (0 to 3) and restricts gridType to square or hex', () => {
    const cfg = createDefaultTacticalMapConfig({
      gridCols: 25,
      gridRows: 25,
      gridType: 'square',
      bgImageUrl: 'https://example.com/map.jpg',
    });
    assert.equal(cfg.gridCols, 25);
    assert.equal(cfg.gridRows, 25);
    assert.equal(cfg.gridType, 'square');
    assert.equal(cfg.layers[0].bgImageUrl, 'https://example.com/map.jpg');
    assert.equal(cfg.layers[1].name, 'Capa 1: Subsuelo');
    assert.equal(cfg.layers[2].name, 'Capa 2: Central/Suelo');
    assert.equal(cfg.layers[3].name, 'Capa 3: Superior');
  });

  it('transitions player token from Layer 1 to Layer 2 via stairs bridge and blocks Layer 1 floor afterwards', () => {
    const cfg = createDefaultTacticalMapConfig({ gridCols: 10, gridRows: 10 });
    cfg.layers[1].blockedCells = [cellKey(4, 2), cellKey(5, 2)];
    cfg.layers[1].stairBridgeCells = [cellKey(3, 2)];

    cfg.layers[2].blockedCells = [cellKey(2, 2), cellKey(1, 2)];
    cfg.layers[2].stairBridgeCells = [cellKey(3, 2)];

    const tokens: TacticalMapToken[] = [
      {
        id: 'token-player-p1',
        linkedId: 'p1',
        label: 'Aelar',
        kind: 'player',
        x: 2,
        y: 2,
        layerId: 1,
      },
    ];

    const jumpAttempt = evaluateTacticalTokenMove({
      config: cfg,
      tokens,
      tokenId: 'token-player-p1',
      targetCol: 4,
      targetRow: 2,
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(jumpAttempt.allowed, false);

    const stepOnStairs = evaluateTacticalTokenMove({
      config: cfg,
      tokens,
      tokenId: 'token-player-p1',
      targetCol: 3,
      targetRow: 2,
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(stepOnStairs.allowed, true);
    assert.equal(stepOnStairs.inStairBridge, true);

    const enterUpstairs = evaluateTacticalTokenMove({
      config: cfg,
      tokens: stepOnStairs.updatedTokens,
      tokenId: 'token-player-p1',
      targetCol: 4,
      targetRow: 2,
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(enterUpstairs.allowed, true);
    assert.equal(enterUpstairs.nextLayerId, 2);

    const tryWalkToGroundWithoutStairs = evaluateTacticalTokenMove({
      config: cfg,
      tokens: enterUpstairs.updatedTokens,
      tokenId: 'token-player-p1',
      targetCol: 2,
      targetRow: 2,
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(tryWalkToGroundWithoutStairs.allowed, false);
  });

  it('prevents players from overlapping another player token, while DM can move anything anywhere', () => {
    const cfg = createDefaultTacticalMapConfig({ gridCols: 10, gridRows: 10 });
    cfg.layers[2].blockedCells = [cellKey(7, 7)];

    const tokens: TacticalMapToken[] = [
      { id: 'token-player-p1', linkedId: 'p1', label: 'P1', kind: 'player', x: 1, y: 1, layerId: 2 },
      { id: 'token-player-p2', linkedId: 'p2', label: 'P2', kind: 'player', x: 2, y: 1, layerId: 2 },
    ];

    const overlapMove = evaluateTacticalTokenMove({
      config: cfg,
      tokens,
      tokenId: 'token-player-p1',
      targetCol: 2,
      targetRow: 1,
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(overlapMove.allowed, false);

    const moveOtherPlayer = evaluateTacticalTokenMove({
      config: cfg,
      tokens,
      tokenId: 'token-player-p2',
      targetCol: 3,
      targetRow: 1,
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(moveOtherPlayer.allowed, false);

    const dmMove = evaluateTacticalTokenMove({
      config: cfg,
      tokens,
      tokenId: 'token-player-p1',
      targetCol: 7,
      targetRow: 7,
      actorMode: 'dm',
    });
    assert.equal(dmMove.allowed, true);
    assert.equal(dmMove.nextCol, 7);
    assert.equal(dmMove.nextRow, 7);
  });

  it('allows DM in live mode to modify any player or monster token, while players can only move their own token', () => {
    const cfg = createDefaultTacticalMapConfig({ gridCols: 10, gridRows: 10 });
    cfg.tokens = [
      {
        id: 'tok-player-p1',
        characterId: 'p1',
        name: 'Valeros',
        tokenType: 'player',
        kind: 'player',
        col: 1,
        row: 1,
        layerId: 2,
        hpCurrent: 28,
        hpMax: 28,
        ac: 18,
      },
      {
        id: 'tok-enemy-goblin',
        name: 'Trasgo Jefe',
        tokenType: 'enemy',
        kind: 'enemy',
        col: 5,
        row: 5,
        layerId: 2,
        hpCurrent: 20,
        hpMax: 20,
        ac: 15,
      },
    ];

    assert.equal(isTokenOwnedByPlayer(cfg.tokens[0], 'p1'), true);
    assert.equal(isTokenOwnedByPlayer(cfg.tokens[0], 'p2'), false);
    assert.equal(isTokenOwnedByPlayer(cfg.tokens[0], undefined), false);
    assert.equal(isTokenOwnedByPlayer(cfg.tokens[1], 'p1'), false);

    // Player without characterId or wrong characterId cannot move token
    const unownedMove = evaluateTacticalTokenMove({
      config: cfg,
      tokenId: 'tok-player-p1',
      targetCol: 2,
      targetRow: 1,
      actorMode: 'player',
      actorCharacterId: undefined,
    });
    assert.equal(unownedMove.allowed, false);

    // Player cannot modify any token
    const playerModifyAttempt = modifyTacticalTokenLive({
      config: cfg,
      tokenId: 'tok-player-p1',
      patch: { hpCurrent: 99 },
      actorMode: 'player',
      actorCharacterId: 'p1',
    });
    assert.equal(playerModifyAttempt.allowed, false);

    // DM can modify player token HP, AC, layer, and size
    const dmModifyPlayer = modifyTacticalTokenLive({
      config: cfg,
      tokenId: 'tok-player-p1',
      patch: { hpCurrent: 19, ac: 20, layerId: 3, sizeMode: 'super_2x2' },
      actorMode: 'dm',
    });
    assert.equal(dmModifyPlayer.allowed, true);
    assert.equal(dmModifyPlayer.updatedToken?.hpCurrent, 19);
    assert.equal(dmModifyPlayer.updatedToken?.ac, 20);
    assert.equal(dmModifyPlayer.updatedToken?.layerId, 3);
    assert.equal(dmModifyPlayer.updatedToken?.sizeMode, 'super_2x2');

    // DM can modify monster token HP, maxHP, AC, and name
    const dmModifyMonster = modifyTacticalTokenLive({
      config: dmModifyPlayer.config,
      tokenId: 'tok-enemy-goblin',
      patch: { name: 'Rey Trasgo', hpCurrent: 8, hpMax: 30, ac: 17 },
      actorMode: 'dm',
    });
    assert.equal(dmModifyMonster.allowed, true);
    assert.equal(dmModifyMonster.updatedToken?.name, 'Rey Trasgo');
    assert.equal(dmModifyMonster.updatedToken?.hpCurrent, 8);
    assert.equal(dmModifyMonster.updatedToken?.hpMax, 30);
    assert.equal(dmModifyMonster.updatedToken?.ac, 17);
  });

  it('supports 2x2 large super-tokens and prop stamps with custom grid spans', () => {
    const footprint = resolveTokenFootprintCells(3, 4, 'large', 100, 100);
    assert.deepEqual(footprint, ['3,4', '3,5', '4,4', '4,5']);

    let cfg = createDefaultTacticalMapConfig({ gridCols: 25, gridRows: 25 });
    cfg = addPropStampToLayer(cfg, 2, {
      name: 'Mesa de Taberna',
      imageUrl: 'https://example.com/table.png',
      col: 5,
      row: 5,
      spanCols: 2,
      spanRows: 3,
    });
    assert.equal(cfg.layers[2].props.length, 1);
    assert.equal(cfg.layers[2].props[0].spanCols, 2);
    assert.equal(cfg.layers[2].props[0].spanRows, 3);
  });

  it('computes General FOW and Modular Area FOW visibility accurately', () => {
    const cfg = createDefaultTacticalMapConfig({ gridCols: 10, gridRows: 10 });
    cfg.fow.generalEnabled = true;
    cfg.fow.playerVisionEnabled = true;
    cfg.fow.playerVisionRangeCells = 2;
    cfg.fow.modules = [
      {
        id: 'secret-room',
        name: 'Área 1: Cuarto Oscuro',
        cells: ['1,1'],
        revealed: false,
      },
    ];

    const tokens: TacticalMapToken[] = [
      { id: 'token-player-p1', linkedId: 'p1', label: 'P1', kind: 'player', x: 0, y: 0, layerId: 2 },
    ];

    const vis1 = computeCellVisibilityForPlayers(cfg, tokens);
    assert.equal(vis1['0,1'], 'visible');
    assert.equal(vis1['8,8'], 'hidden');
    assert.equal(vis1['1,1'], 'hidden');

    cfg.fow.modules[0].revealed = true;
    const vis2 = computeCellVisibilityForPlayers(cfg, tokens);
    assert.equal(vis2['1,1'], 'visible');
  });
});
