import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { SET_TITLES } from '../../src/data/setTitles';

const SKU_ORDER = [
  'base', 'ragnarok', 'celtic-fae', 'arthurian-court', 'gothic-monsters',
  'dark-tales', 'yokai-nights', 'sands-of-the-duat', 'starborne', 'drowned-deep',
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
const openingSource = readSource('scenes/PackOpeningScene.ts');
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
  return runInNewContext(outputText, bindings, { timeout: 1_000 }) as T;
}

interface RetailDeclarations {
  DROWNED_DEEP_PACK_TINT: Record<string, string>;
  DROWNED_DEEP_PACK_ART: {
    key: string;
    sceneArtKey: string;
    tint: Record<string, string>;
    trimY: number;
  };
  BOOSTER_SKUS: RetailRow[];
  NEWEST_SKU: Sku;
  packTextureForSku: (sku: Sku) => string;
  packPriceForSku: (sku: Sku) => number;
  packSetForSku: (sku: Sku) => string;
  visibleBoosterSkus: () => RetailRow[];
}

function retail(duatLive = false): RetailDeclarations {
  return isolatedDeclarations<RetailDeclarations>(shopSource, [
    'DROWNED_DEEP_PACK_TINT', 'DROWNED_DEEP_PACK_ART', 'BOOSTER_SKUS', 'NEWEST_SKU',
    'packTextureForSku', 'packPriceForSku', 'packSetForSku', 'visibleBoosterSkus',
  ], { ECONOMY, SET_TITLES, FEATURES: { duatLive } });
}

describe('Drowned Deep shop retail', () => {
  it('keeps release order and makes Drowned Deep the final launch SKU', () => {
    const shop = retail();
    expect(shop.BOOSTER_SKUS.map(({ sku }) => sku)).toEqual(SKU_ORDER);
    expect(shop.BOOSTER_SKUS.at(-1)).toEqual({
      label: SET_TITLES['drowned-deep'],
      textureKey: 'packart-drowned-deep',
      sku: 'drowned-deep',
    });
    expect(shop.NEWEST_SKU).toBe('drowned-deep');

    const union = oddsSource.statements.find(
      (node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === 'BoosterSku',
    );
    if (!union || !ts.isUnionTypeNode(union.type)) throw new Error('BoosterSku union is missing');
    const skus = union.type.types.map((node) => {
      if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) {
        throw new Error('BoosterSku must contain only string literals');
      }
      return node.literal.text;
    });
    expect(skus).toEqual(SKU_ORDER);
  });

  it('shares the 525 gold price, pack texture, and set across purchase and opening', () => {
    const shop = retail();
    expect(ECONOMY.drownedDeepPackPrice).toBe(525);
    expect(shop.packPriceForSku('drowned-deep')).toBe(525);
    expect(shop.packTextureForSku('drowned-deep')).toBe('packart-drowned-deep');
    expect(shop.packSetForSku('drowned-deep')).toBe('drowned-deep');
  });

  it('keeps Drowned Deep visible independently of the Duat feature flag', () => {
    for (const duatLive of [false, true]) {
      const visible = retail(duatLive).visibleBoosterSkus();
      expect(visible.at(-1)?.sku).toBe('drowned-deep');
      expect(visible.some(({ sku }) => sku === 'sands-of-the-duat')).toBe(duatLive);
    }
  });

  it('pins the approved palette and real pack front at trimY 63', () => {
    const shop = retail();
    expect(shop.DROWNED_DEEP_PACK_TINT).toEqual({
      start: '#eef0ea', middle: '#16303a', end: '#0d1a22',
      trim: '#a8783c', foil: '#d6e07c', mist: '#7d8590',
    });
    expect(shop.DROWNED_DEEP_PACK_ART).toEqual({
      key: 'packart-drowned-deep',
      sceneArtKey: 'scene-pack-art-drowned-deep',
      tint: shop.DROWNED_DEEP_PACK_TINT,
      trimY: 63,
    });
    expect(shop.DROWNED_DEEP_PACK_ART.tint).toBe(shop.DROWNED_DEEP_PACK_TINT);
  });

  it('uses the locked set title for both odds metadata fields', () => {
    const { PACK_ODDS_META } = isolatedDeclarations<{
      PACK_ODDS_META: Record<Sku, { packName: string; setName: string }>;
    }>(oddsSource, ['PACK_ODDS_META'], { SET_TITLES });
    expect(PACK_ODDS_META['drowned-deep']).toEqual({
      packName: SET_TITLES['drowned-deep'],
      setName: SET_TITLES['drowned-deep'],
    });
  });

  it('wires the shared pack art into both scene bake paths', () => {
    expect(shopSource.text).toContain('bakePackArt(this, DROWNED_DEEP_PACK_ART);');
    expect(openingSource.text).toMatch(
      /else if \(this\.sku === 'drowned-deep'\) \{\s*bakePackArt\(this, DROWNED_DEEP_PACK_ART\);\s*\}/,
    );
  });
});
