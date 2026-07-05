import type { CardDef } from '../engine/types';
import { isType } from '../engine/types';

// ---------------------------------------------------------------------------
// Attack visual-effect classification (pure data). Maps each creature to an
// archetype that the UI combat layer uses to pick a strike animation, plus a
// `heavy` flag for bigger, slower hits. This module is Phaser-free: it only
// reads CardDef fields, so tests and the headless engine can import it safely.
// ---------------------------------------------------------------------------

export type AttackArchetype =
  | 'slash'
  | 'cleave'
  | 'pierce'
  | 'arcane'
  | 'fire'
  | 'frost'
  | 'shadow'
  | 'venom'
  | 'claw'
  | 'radiance'
  | 'aerial'
  | 'impact';

export interface AttackFxSpec {
  archetype: AttackArchetype;
  heavy: boolean;
}

/** Explicit per-creature classification (reviewed from the card list). */
export const ATTACK_FX_MAP: Record<string, AttackFxSpec> = {
  'gk-athena': { archetype: 'radiance', heavy: false },
  'gk-ares': { archetype: 'fire', heavy: false },
  'gk-artemis': { archetype: 'pierce', heavy: false },
  'gk-hestia': { archetype: 'radiance', heavy: false },
  'gk-nike': { archetype: 'aerial', heavy: false },
  'gk-hoplite': { archetype: 'slash', heavy: false },
  'gk-zeus': { archetype: 'arcane', heavy: true },
  'gk-hera': { archetype: 'radiance', heavy: false },
  'gk-aphrodite': { archetype: 'radiance', heavy: false },
  'gk-persephone': { archetype: 'venom', heavy: false },
  'gk-hades': { archetype: 'shadow', heavy: true },
  'gk-poseidon': { archetype: 'frost', heavy: true },
  'gk-apollo': { archetype: 'radiance', heavy: false },
  'gk-hermes': { archetype: 'aerial', heavy: false },
  'gk-demeter': { archetype: 'claw', heavy: false },
  'gk-hecate': { archetype: 'arcane', heavy: false },
  'gk-nyx': { archetype: 'shadow', heavy: false },
  'gk-selene': { archetype: 'aerial', heavy: false },
  'gk-iris': { archetype: 'aerial', heavy: false },
  'gk-gaia': { archetype: 'cleave', heavy: true },
  'gk-thanatos': { archetype: 'venom', heavy: false },
  'gk-pan': { archetype: 'claw', heavy: false },
  'gk-eos': { archetype: 'radiance', heavy: false },
  'bk-nekomata-scout': { archetype: 'claw', heavy: false },
  'bk-wolfkin-raider': { archetype: 'claw', heavy: false },
  'bk-bunny-vanguard': { archetype: 'slash', heavy: false },
  'bk-harpy-skirmisher': { archetype: 'aerial', heavy: false },
  'bk-bearkin-guardian': { archetype: 'claw', heavy: false },
  'bk-rhinokin-charger': { archetype: 'cleave', heavy: true },
  'bk-lamia-nightblade': { archetype: 'venom', heavy: false },
  'bk-dragonmaid': { archetype: 'fire', heavy: true },
  'bk-packmother': { archetype: 'claw', heavy: false },
  'bk-kitsune-matriarch': { archetype: 'arcane', heavy: false },
  'bk-wolfqueen': { archetype: 'claw', heavy: true },
  'bk-kitsune-illusionist': { archetype: 'arcane', heavy: false },
  'bk-kitsune-dreamweaver': { archetype: 'arcane', heavy: false },
  'bk-holstaur-milkmaid': { archetype: 'radiance', heavy: false },
  'bk-sheepkin-dreamherd': { archetype: 'claw', heavy: false },
  'bk-mousekin-pantry-guard': { archetype: 'claw', heavy: false },
  'bk-spiderkin-weaver': { archetype: 'venom', heavy: false },
  'bk-batkin-duskwing': { archetype: 'aerial', heavy: false },
  'bk-mermaid-chartsinger': { archetype: 'frost', heavy: false },
  'bk-deerkin-grovekeeper': { archetype: 'claw', heavy: false },
  'bk-foxfire-priestess': { archetype: 'radiance', heavy: false },
  'bk-crowkin-shrike': { archetype: 'aerial', heavy: false },
  'bk-turtlekin-bulwark': { archetype: 'claw', heavy: false },
  'bk-squirrelkin-hoarder': { archetype: 'claw', heavy: false },
  'bk-boarkin-rioter': { archetype: 'claw', heavy: false },
  'tk-shu-liubei': { archetype: 'radiance', heavy: false },
  'tk-shu-guanyu': { archetype: 'cleave', heavy: true },
  'tk-shu-zhangfei': { archetype: 'cleave', heavy: true },
  'tk-shu-zhaoyun': { archetype: 'pierce', heavy: false },
  'tk-shu-zhugeliang': { archetype: 'arcane', heavy: false },
  'tk-shu-guanping': { archetype: 'slash', heavy: false },
  'tk-shu-xingcai': { archetype: 'slash', heavy: false },
  'tk-shu-pangtong': { archetype: 'arcane', heavy: false },
  'tk-shu-yueying': { archetype: 'arcane', heavy: false },
  'tk-shu-guanyinping': { archetype: 'slash', heavy: false },
  'tk-shu-weiyan': { archetype: 'cleave', heavy: true },
  'tk-shu-machao': { archetype: 'pierce', heavy: false },
  'tk-shu-huangzhong': { archetype: 'pierce', heavy: false },
  'tk-shu-jiangwei': { archetype: 'arcane', heavy: false },
  'tk-shu-madai': { archetype: 'slash', heavy: false },
  'tk-shu-baosanniang': { archetype: 'claw', heavy: false },
  'tk-shu-zhangbao': { archetype: 'pierce', heavy: false },
  'tk-shu-guansuo': { archetype: 'slash', heavy: false },
  'tk-shu-liushan': { archetype: 'radiance', heavy: false },
  'tk-shu-wangping': { archetype: 'slash', heavy: false },
  'tk-shu-masu': { archetype: 'arcane', heavy: false },
  'tk-shu-fazheng': { archetype: 'arcane', heavy: false },
  'tk-wei-caocao': { archetype: 'cleave', heavy: true },
  'tk-wei-xiahoudun': { archetype: 'slash', heavy: false },
  'tk-wei-xiahouyuan': { archetype: 'slash', heavy: false },
  'tk-wei-zhangliao': { archetype: 'shadow', heavy: false },
  'tk-wei-dianwei': { archetype: 'slash', heavy: false },
  'tk-wei-xuchu': { archetype: 'slash', heavy: false },
  'tk-wei-zhanghe': { archetype: 'aerial', heavy: false },
  'tk-wei-xuhuang': { archetype: 'cleave', heavy: false },
  'tk-wei-caoren': { archetype: 'slash', heavy: false },
  'tk-wei-caopi': { archetype: 'frost', heavy: false },
  'tk-wei-guojia': { archetype: 'arcane', heavy: false },
  'tk-wei-jiaxu': { archetype: 'venom', heavy: false },
  'tk-wei-xunyu': { archetype: 'arcane', heavy: false },
  'tk-wei-yuejin': { archetype: 'slash', heavy: false },
  'tk-wei-lidian': { archetype: 'slash', heavy: false },
  'tk-wei-yujin': { archetype: 'slash', heavy: false },
  'tk-wei-chengyu': { archetype: 'arcane', heavy: false },
  'tk-wei-manchong': { archetype: 'arcane', heavy: false },
  'tk-wei-chenqun': { archetype: 'arcane', heavy: false },
  'tk-wei-wanglang': { archetype: 'arcane', heavy: false },
  'tk-wei-zhenji': { archetype: 'aerial', heavy: false },
  'tk-wei-caiwenji': { archetype: 'radiance', heavy: false },
  'tk-wei-wangyi': { archetype: 'venom', heavy: false },
  'tk-wei-pangde': { archetype: 'slash', heavy: false },
  'tk-wu-sunquan': { archetype: 'cleave', heavy: true },
  'tk-wu-zhouyu': { archetype: 'arcane', heavy: false },
  'tk-wu-sunjian': { archetype: 'cleave', heavy: false },
  'tk-wu-sunce': { archetype: 'cleave', heavy: false },
  'tk-wu-ganning': { archetype: 'slash', heavy: false },
  'tk-wu-taishici': { archetype: 'slash', heavy: false },
  'tk-wu-luxun': { archetype: 'arcane', heavy: false },
  'tk-wu-lumeng': { archetype: 'arcane', heavy: false },
  'tk-wu-lianshi': { archetype: 'pierce', heavy: false },
  'tk-wu-huanggai': { archetype: 'fire', heavy: false },
  'tk-wu-zhoutai': { archetype: 'slash', heavy: false },
  'tk-wu-lingtong': { archetype: 'impact', heavy: false },
  'tk-wu-xusheng': { archetype: 'slash', heavy: false },
  'tk-wu-sunshangxiang': { archetype: 'pierce', heavy: false },
  'tk-wu-daqiao': { archetype: 'aerial', heavy: false },
  'tk-wu-xiaoqiao': { archetype: 'aerial', heavy: false },
  'tk-wu-lusu': { archetype: 'arcane', heavy: false },
  'tk-wu-chengpu': { archetype: 'pierce', heavy: false },
  'tk-wu-handang': { archetype: 'slash', heavy: false },
  'tk-wu-dingfeng': { archetype: 'frost', heavy: true },
  'tk-wu-zhuran': { archetype: 'pierce', heavy: false },
  'tk-wu-quancong': { archetype: 'slash', heavy: false },
  'tk-wu-zhugeke': { archetype: 'arcane', heavy: false },
  'tk-jin-simayi': { archetype: 'arcane', heavy: false },
  'tk-jin-wangyuanji': { archetype: 'venom', heavy: false },
  'tk-jin-zhangchunhua': { archetype: 'shadow', heavy: false },
  'tk-jin-simashi': { archetype: 'cleave', heavy: false },
  'tk-jin-simazhao': { archetype: 'cleave', heavy: false },
  'tk-jin-zhonghui': { archetype: 'aerial', heavy: false },
  'tk-jin-dengai': { archetype: 'arcane', heavy: false },
  'tk-jin-wenyang': { archetype: 'slash', heavy: false },
  'tk-jin-xinxianying': { archetype: 'arcane', heavy: false },
  'tk-jin-jiachong': { archetype: 'shadow', heavy: false },
  'tk-jin-zhugedan': { archetype: 'cleave', heavy: false },
  'tk-jin-guanqiujian': { archetype: 'slash', heavy: false },
  'tk-jin-xiahouhui': { archetype: 'arcane', heavy: false },
  'tk-other-lubu': { archetype: 'cleave', heavy: true },
  'tk-other-diaochan': { archetype: 'arcane', heavy: false },
  'tk-other-dongzhuo': { archetype: 'cleave', heavy: false },
  'tk-other-zhangjiao': { archetype: 'arcane', heavy: false },
  'tk-other-huaxiong': { archetype: 'slash', heavy: false },
  'tk-other-lulingqi': { archetype: 'pierce', heavy: false },
  'tk-other-yuanshao': { archetype: 'cleave', heavy: false },
  'tk-other-menghuo': { archetype: 'cleave', heavy: true },
  'tk-other-zhurong': { archetype: 'fire', heavy: false },
  'tk-other-zuoci': { archetype: 'arcane', heavy: false },
  'tk-other-chengong': { archetype: 'arcane', heavy: false },
  'tk-other-dongbai': { archetype: 'venom', heavy: false },
  'tok-militia': { archetype: 'slash', heavy: false },
  'tok-fox-spirit': { archetype: 'claw', heavy: false },
  'tok-peacock': { archetype: 'aerial', heavy: false },
  'tok-bloom': { archetype: 'claw', heavy: false },
  'tok-wooden-ox': { archetype: 'impact', heavy: false },
  // Artifact creatures (Constructs). Not in the reviewed archetype array, so
  // classified by the same rule the fallback would apply: Construct -> impact,
  // heavy when power >= 5 or trample. Kept explicit so the map stays complete.
  'ar-training-dummy': { archetype: 'impact', heavy: false },
  'ar-terracotta-soldier': { archetype: 'impact', heavy: false },
  'ar-terracotta-guardian': { archetype: 'impact', heavy: false },
  'ar-bronze-colossus': { archetype: 'impact', heavy: true },
  'ar-siege-juggernaut': { archetype: 'impact', heavy: true },
};

/** Fallback archetype for a creature not in ATTACK_FX_MAP. First match wins. */
function fallbackArchetype(card: CardDef): AttackArchetype {
  const keywords = card.keywords ?? [];
  if (keywords.includes('deathtouch')) return 'venom';
  if (keywords.includes('flying')) return 'aerial';

  const subtypes = card.subtypes;
  if (
    subtypes.includes('Sorcerer') ||
    subtypes.includes('Strategist') ||
    subtypes.includes('Poet')
  ) {
    return 'arcane';
  }
  if (subtypes.includes('Construct')) return 'impact';
  if (subtypes.includes('Warlord')) return 'cleave';
  if (subtypes.includes('Beastkin')) return 'claw';

  const colors = card.colors;
  if (colors.includes('R')) return 'fire';
  if (colors.includes('U')) return 'frost';
  if (colors.includes('B')) return 'shadow';
  if (colors.includes('W')) return 'radiance';
  if (colors.includes('G')) return 'claw';

  return 'impact';
}

/** Fallback heavy flag for a creature not in ATTACK_FX_MAP. */
function fallbackHeavy(card: CardDef): boolean {
  return (card.power ?? 0) >= 5 || card.keywords?.includes('trample') === true;
}

/**
 * Resolve the attack FX for a card: the explicit map wins, otherwise a
 * keyword/subtype/color-derived fallback keeps every creature covered.
 */
export function attackFxFor(card: CardDef): AttackFxSpec {
  const mapped = ATTACK_FX_MAP[card.id];
  if (mapped) return mapped;
  // Non-creatures never attack; if one is passed in, its `heavy` flag is
  // meaningless, so force it light while still returning a valid archetype.
  const heavy = isType(card, 'creature') && fallbackHeavy(card);
  return { archetype: fallbackArchetype(card), heavy };
}
