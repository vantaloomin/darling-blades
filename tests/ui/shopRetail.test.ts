import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { BOOSTER_SKUS, packPriceForSku } from '../../src/meta/boosterSkus';
import { SET_BLURBS, SET_TITLES } from '../../src/data/setTitles';
import manifest from '../../src/data/art-manifest.json';
import { CARD_DB } from '../../src/data/catalog';
import { createRngState } from '../../src/engine/rng';
import type { CardDef } from '../../src/engine/types';
import { spendGold } from '../../src/meta/Economy';
import { openPack, openPacks, type PackResult } from '../../src/meta/PackOpener';
import { packPoolSummary } from '../../src/meta/packSummary';
import { freshSave } from '../../src/meta/SaveManager';
import { colorInt, theme } from '../../src/ui/theme';

const SKU_ORDER = [
  'base', 'ragnarok', 'celtic-fae', 'arthurian-court', 'gothic-monsters',
  'dark-tales', 'yokai-nights', 'sands-of-the-duat', 'starborne', 'drowned-deep', 'first-dawn',
] as const;
type Sku = typeof SKU_ORDER[number];
type RetailRow = { label: string; textureKey: string; sku: Sku };

function readSource(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

const shopSource = readSource('scenes/ShopScene.ts');
const oddsSource = readSource('ui/OddsModal.ts');

/**
 * Scenes import Phaser, which must never enter the headless tests. Compile
 * only these named pure declarations, with their data dependencies supplied
 * explicitly. This exercises the production functions without scene imports.
 */
function isolatedDeclarations<T>(
  source: ts.SourceFile,
  names: readonly string[],
  bindings: Record<string, unknown>,
): T {
  const declarations = names.map((name) => {
    const statement = source.statements.find((node) =>
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isVariableStatement(node) && node.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name,
      )),
    );
    if (!statement) throw new Error(`${source.fileName}: missing declaration ${name}`);
    return statement.getText(source).replace(/^export\s+/, '');
  });
  const script = `${declarations.join('\n')}\n({ ${names.join(', ')} });`;
  const { outputText } = ts.transpileModule(script, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  return runInNewContext(outputText, bindings, { timeout: 10_000 } /* 2026-09-18: 1 s blew once under a full-suite run; a budget, not a behaviour */) as T;
}

interface RetailDeclarations {
  FIRST_DAWN_PACK_TINT: Record<string, string>;
  FIRST_DAWN_PACK_ART: {
    key: string;
    sceneArtKey: string;
    tint: Record<string, string>;
    trimY: number;
  };
  NEWEST_SKU: Sku;
  packTextureForSku: (sku: Sku) => string;
  packSetForSku: (sku: Sku) => string;
  visibleBoosterSkus: () => RetailRow[];
}

function retail(duatLive = false): RetailDeclarations {
  return isolatedDeclarations<RetailDeclarations>(shopSource, [
    'FIRST_DAWN_PACK_TINT', 'FIRST_DAWN_PACK_ART', 'NEWEST_SKU',
    'packTextureForSku', 'packSetForSku', 'visibleBoosterSkus',
  ], { BOOSTER_SKUS, SET_TITLES, isLiveSet: (sku: string) => sku !== 'sands-of-the-duat' || duatLive });
}

/** Execute scene methods with a small display adapter, never importing Phaser. */
function sceneMethod<T>(
  name: string, bindings: Record<string, unknown>, source = shopSource, className = 'ShopScene',
): T {
  const scene = source.statements.find((node): node is ts.ClassDeclaration =>
    ts.isClassDeclaration(node) && node.name?.text === className);
  const method = scene?.members.find((node): node is ts.MethodDeclaration =>
    ts.isMethodDeclaration(node) && node.name.getText(source) === name);
  if (!method) throw new Error(`${className} is missing ${name}`);
  const script = `({ ${method.getText(source).replace(/^private\s+/, '')} }).${name}`;
  const { outputText } = ts.transpileModule(script, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  return runInNewContext(outputText, bindings, { timeout: 10_000 }) as T;
}

function displayObject(x = 0, y = 0) {
  const object = {
    x, y, width: 60, height: 20, displayWidth: 60,
    setOrigin: () => object, setScale: () => object, setDisplaySize: () => object,
    setInteractive: () => object, fillStyle: () => object, fillRoundedRect: () => object,
    lineStyle: () => object, strokeRoundedRect: () => object,
    fillCircle: () => object, strokeCircle: () => object,
  };
  return object;
}

describe('Expansion shop retail', () => {
  it.each([['ragnarok', 450], ['drowned-deep', 525], ['first-dawn', 525]] as const)(
    'sells %s at its tier price, keeps its pool, and rejects an unaffordable purchase', (sku, price) => {
      const shop = retail();
      const save = freshSave(0);
      const start = vi.fn();
      const insufficientFunds = vi.fn();
      const buy = sceneMethod<(price: number, set: CardDef['set'], sku: Sku) => void>('buyPacks', {
        Services: { save: { data: save, flush: vi.fn() } },
        spendGold, createRngState, openPack, openPacks, CARD_DB,
        Sfx: { play: vi.fn() }, queueAchievementUnlockToasts: vi.fn(),
        Date: { now: () => 12345 },
      });
      const scene = {
        qty: 1, boosterStripIndex: 0, insufficientFunds, closeOverlay: vi.fn(),
        checkpointAchievementUnlocks: () => [], scene: { start },
      };
      save.gold = price - 1;
      buy.call(scene, packPriceForSku(sku), shop.packSetForSku(sku) as CardDef['set'], sku);
      expect(insufficientFunds).toHaveBeenCalledOnce();
      expect(save.gold).toBe(price - 1);
      expect(save.stats.packsOpened).toBe(0);
      expect(start).not.toHaveBeenCalled();
      save.gold = price;
      buy.call(scene, packPriceForSku(sku), shop.packSetForSku(sku) as CardDef['set'], sku);
      expect(save.gold).toBe(0);
      expect(save.stats.packsOpened).toBe(1);
      expect(start).toHaveBeenCalledOnce();
      const [destination, result] = start.mock.calls[0] as [string, PackResult & { sku: Sku }];
      expect(destination).toBe('PackOpening');
      expect(result.sku).toBe(sku);
      expect(result.cards).toHaveLength(9);
      for (const { cardId } of result.cards) expect(CARD_DB[cardId].set).toBe(sku);
    },
  );

  it.each([['ragnarok', 450], ['first-dawn', 525]] as const)(
    'shows and charges the %s tier price for single and batch re-buys', (sku, price) => {
      const source = readSource('scenes/PackOpeningScene.ts');
      for (const qty of [1, 5]) {
        const save = freshSave(0);
        save.gold = qty * price;
        const restart = vi.fn();
        const addRailButton = vi.fn<(x: number, label: string, enabled: boolean, buy: () => void) => void>();
        const buildButtons = sceneMethod<(qty?: number) => void>(
          qty === 1 ? 'checkAllRevealed' : 'buildBatchButtons', {
            packPriceForSku, packSetForSku: retail().packSetForSku,
            Services: { save: { data: save, flush: vi.fn() } },
            spendGold, openPack, openPacks, CARD_DB, createRngState,
            Sfx: { play: vi.fn() }, Date: { now: () => 12345 },
          }, source, 'PackOpeningScene',
        );
        const scene = {
          sku, specials: [], buttons: [], finishAchievementCheckpoint: vi.fn(),
          addButtonRailPanel: vi.fn(), addRailButton, tweens: { timeScale: 1 },
          scene: { restart },
        };
        buildButtons.call(scene, qty);
        const [, label, enabled, buy] = addRailButton.mock.calls[0];
        expect(label).toContain(String(qty * price));
        expect(enabled).toBe(true);
        buy();
        expect(save.gold).toBe(0);
        expect(save.stats.packsOpened).toBe(qty);
        expect(restart).toHaveBeenCalledOnce();
        expect(restart.mock.calls[0][0].sku).toBe(sku);
      }
    },
  );

  it('leads the visible strip with First Dawn and gives only that tile the New chip', () => {
    for (const duatLive of [false, true]) {
      const shop = retail(duatLive);
      const visible = shop.visibleBoosterSkus();
      expect(visible[0]?.sku).toBe('first-dawn');
      const releaseRank = visible.map(({ sku }) => SKU_ORDER.indexOf(sku));
      expect(releaseRank).toEqual([...releaseRank].sort((a, b) => b - a));
      expect(visible.some(({ sku }) => sku === 'sands-of-the-duat')).toBe(duatLive);
      const text = vi.fn<(x: number, y: number, label: string) => ReturnType<typeof displayObject>>(
        (x, y) => displayObject(x, y),
      );
      const tile = sceneMethod<(
        group: { add: ReturnType<typeof vi.fn> }, x: number, label: string,
        textureKey: string, price: number, sku: Sku, onBuy: () => void,
      ) => void>('buildPackSku', {
        NEWEST_SKU: shop.NEWEST_SKU, SET_BLURBS, theme, colorInt, CARD_DB,
        Services: { save: { data: freshSave(0) } }, packPoolSummary,
        packSetForSku: shop.packSetForSku, fxPolicy: () => ({ shine: false }),
        themedButton: () => ({ container: {}, inputZone: {} }),
        inflateHitArea: vi.fn(), bindTapButton: vi.fn(),
      });
      const scene = {
        add: { text, image: displayObject, graphics: displayObject },
        skuButtons: [], shopInteractiveTargets: [],
      };
      for (const row of visible) {
        text.mockClear();
        tile.call(scene, { add: vi.fn() }, 0, row.label, row.textureKey,
          packPriceForSku(row.sku), row.sku, vi.fn());
        expect(text.mock.calls.filter(([, , label]) => label === 'New')).toHaveLength(
          row.sku === 'first-dawn' ? 1 : 0,
        );
      }
    }
  });

  it('resolves the First Dawn shop texture to a manifest-listed WebP front', () => {
    const shop = retail();
    const { sceneTextureKey } = isolatedDeclarations<{ sceneTextureKey: (key: string) => string }>(
      readSource('ui/SceneBackdrop.ts'), ['sceneTextureKey'], {},
    );
    const row = shop.visibleBoosterSkus().find(({ sku }) => sku === 'first-dawn')!;
    expect(shop.packTextureForSku(row.sku)).toBe(row.textureKey);
    expect(shop.FIRST_DAWN_PACK_ART.key).toBe(row.textureKey);
    const asset = manifest.scenes.find((key) => sceneTextureKey(key) === shop.FIRST_DAWN_PACK_ART.sceneArtKey);
    const webp = readFileSync(new URL(`../../public/assets/art/scenes/${asset}.webp`, import.meta.url));
    expect(webp.toString('ascii', 0, 4)).toBe('RIFF');
    expect(webp.toString('ascii', 8, 12)).toBe('WEBP');
    const image = { width: 640, height: 800 };
    const ctx = {
      ...displayObject(), strokeStyle: '', lineWidth: 0, fillStyle: '', globalAlpha: 1,
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
      arcTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(), fillRect: vi.fn(),
      drawImage: vi.fn<(image: unknown, ...crop: number[]) => void>(), stroke: vi.fn(),
    };
    const canvas = { getContext: () => ctx, refresh: vi.fn() };
    const createCanvas = vi.fn<(key: string, width: number, height: number) => typeof canvas>(() => canvas);
    const scene = { textures: {
      exists: (key: string) => key === sceneTextureKey(asset!),
      get: () => ({ getSourceImage: () => image }), createCanvas,
    } };
    const fallback = vi.fn();
    const { bakePackArt } = isolatedDeclarations<{
      bakePackArt: (scene: unknown, opts: RetailDeclarations['FIRST_DAWN_PACK_ART']) => void;
    }>(shopSource, ['PACK_W', 'PACK_H', 'packRR', 'bakeRealPackBase', 'bakePackArt'], {
      theme, bakeProceduralPackBase: fallback,
    });
    bakePackArt(scene, shop.FIRST_DAWN_PACK_ART);
    expect(createCanvas.mock.calls[0]?.[0]).toBe(row.textureKey);
    expect(ctx.drawImage.mock.calls[0]?.[0]).toBe(image);
    expect(fallback).not.toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#efe6d0');
    expect(canvas.refresh).toHaveBeenCalledOnce();
  });

  it.each(['drowned-deep', 'first-dawn'] as const)('discloses the %s pool under its shop title', (sku) => {
    const shop = retail();
    const { PACK_ODDS_META } = isolatedDeclarations<{
      PACK_ODDS_META: Record<Sku, { packName: string; setName: string }>;
    }>(oddsSource, ['PACK_ODDS_META'], { SET_TITLES });
    const row = shop.visibleBoosterSkus().find((entry) => entry.sku === sku)!;
    expect(PACK_ODDS_META[sku]).toEqual({ packName: row.label, setName: SET_TITLES[shop.packSetForSku(sku) as Sku] });
  });
});
