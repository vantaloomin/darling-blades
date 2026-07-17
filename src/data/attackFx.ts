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
  // heavy when attack >= 5 or trample. Kept explicit so the map stays complete.
  'ar-training-dummy': { archetype: 'impact', heavy: false },
  'ar-terracotta-soldier': { archetype: 'impact', heavy: false },
  'ar-terracotta-guardian': { archetype: 'impact', heavy: false },
  'ar-bronze-colossus': { archetype: 'impact', heavy: true },
  'ar-siege-juggernaut': { archetype: 'impact', heavy: true },
  // --- Ragnarök expansion tokens ---
  'tok-valkyrie': { archetype: 'aerial', heavy: false },
  'tok-draugr': { archetype: 'shadow', heavy: false },
  'tok-wolf': { archetype: 'claw', heavy: false },
  // --- Ragnarök expansion creatures (heavy = attack >= 5 or trample) ---
  'rg-hel': { archetype: 'shadow', heavy: false },
  'rg-freya': { archetype: 'aerial', heavy: false },
  'rg-fenrir': { archetype: 'claw', heavy: true },
  'rg-zhaoyun': { archetype: 'pierce', heavy: false },
  'rg-brunhild': { archetype: 'slash', heavy: false },
  'rg-norns': { archetype: 'arcane', heavy: false },
  'rg-angrboda': { archetype: 'shadow', heavy: false },
  'rg-skadi': { archetype: 'frost', heavy: false },
  'rg-valkyrie-captain': { archetype: 'aerial', heavy: false },
  'rg-draugr-jarl': { archetype: 'shadow', heavy: false },
  'rg-berserker-chieftain': { archetype: 'cleave', heavy: false },
  'rg-jotun-earthshaker': { archetype: 'impact', heavy: true },
  'rg-mist-seer': { archetype: 'arcane', heavy: false },
  'rg-idun': { archetype: 'radiance', heavy: false },
  'rg-valkyrie-vanguard': { archetype: 'aerial', heavy: false },
  'rg-chooser-of-the-slain': { archetype: 'aerial', heavy: false },
  'rg-einherjar-champion': { archetype: 'slash', heavy: false },
  'rg-norn-seeress': { archetype: 'arcane', heavy: false },
  'rg-tidecaller-vanir': { archetype: 'frost', heavy: false },
  'rg-memory-thief': { archetype: 'shadow', heavy: false },
  'rg-hels-handmaiden': { archetype: 'shadow', heavy: false },
  'rg-barrow-wight': { archetype: 'venom', heavy: false },
  'rg-deaths-herald': { archetype: 'shadow', heavy: false },
  'rg-thanatos': { archetype: 'venom', heavy: false },
  'rg-berserker-duelist': { archetype: 'slash', heavy: false },
  'rg-flamecaller-jotun': { archetype: 'fire', heavy: true },
  'rg-warband-leader': { archetype: 'slash', heavy: false },
  'rg-jotun-warleader': { archetype: 'cleave', heavy: true },
  'rg-alpha-of-the-hunt': { archetype: 'claw', heavy: false },
  'rg-great-stag': { archetype: 'claw', heavy: false },
  'rg-worldroot-tender': { archetype: 'claw', heavy: false },
  'rg-xuchu': { archetype: 'slash', heavy: false },
  'rg-dianwei': { archetype: 'slash', heavy: false },
  'rg-valkyrie-scout': { archetype: 'aerial', heavy: false },
  'rg-einherjar-shieldbearer': { archetype: 'slash', heavy: false },
  'rg-dawn-valkyrie': { archetype: 'aerial', heavy: false },
  'rg-honored-footman': { archetype: 'slash', heavy: false },
  'rg-oathbound-cleric': { archetype: 'radiance', heavy: false },
  'rg-shieldwall-maiden': { archetype: 'slash', heavy: false },
  'rg-mist-wraith': { archetype: 'shadow', heavy: false },
  'rg-fate-reader': { archetype: 'arcane', heavy: false },
  'rg-well-keeper': { archetype: 'arcane', heavy: false },
  'rg-runecarver': { archetype: 'arcane', heavy: false },
  'rg-draugr-raider': { archetype: 'shadow', heavy: false },
  'rg-corpse-taker': { archetype: 'shadow', heavy: false },
  'rg-bog-lurker': { archetype: 'shadow', heavy: false },
  'rg-hungry-shade': { archetype: 'shadow', heavy: false },
  'rg-plaguebearer-draugr': { archetype: 'venom', heavy: false },
  'rg-muspel-emberkin': { archetype: 'fire', heavy: false },
  'rg-berserker-initiate': { archetype: 'slash', heavy: false },
  'rg-flame-jotun': { archetype: 'fire', heavy: false },
  'rg-raiding-shieldmaiden': { archetype: 'slash', heavy: false },
  'rg-ember-valkyrie': { archetype: 'fire', heavy: false },
  'rg-frost-jotun': { archetype: 'frost', heavy: false },
  'rg-dire-pup': { archetype: 'claw', heavy: false },
  'rg-elder-jotun': { archetype: 'impact', heavy: true },
  'rg-verdant-seidr': { archetype: 'arcane', heavy: false },
  'rg-wolf-pack-runner': { archetype: 'claw', heavy: true },
  'rg-shu-deathless-guard': { archetype: 'slash', heavy: false },
  'rg-charon-ferryman': { archetype: 'shadow', heavy: false },
  // --- Celtic Fae expansion creatures (heavy = attack >= 5 or overrun) ---
  'cf-morrigan-black-wing': { archetype: 'aerial', heavy: true },
  'cf-titania-silver-court': { archetype: 'arcane', heavy: false },
  'cf-aine-sunlit-bargain': { archetype: 'radiance', heavy: false },
  'cf-nimue-before-the-lake': { archetype: 'arcane', heavy: false },
  'cf-selkie-tide-queen': { archetype: 'frost', heavy: false },
  'cf-wild-hunt-matriarch': { archetype: 'claw', heavy: true },
  'cf-bean-sidhe-keening': { archetype: 'aerial', heavy: false },
  'cf-silver-branch-oracle': { archetype: 'arcane', heavy: false },
  'cf-redcap-blood-host': { archetype: 'slash', heavy: false },
  'cf-queen-mab-midnight': { archetype: 'arcane', heavy: false },
  'cf-hollow-hill-gatekeeper': { archetype: 'arcane', heavy: false },
  'cf-blackthorn-duelist': { archetype: 'slash', heavy: false },
  'cf-raven-torc-envoy': { archetype: 'aerial', heavy: false },
  'cf-moon-pool-selkie': { archetype: 'frost', heavy: false },
  'cf-hounds-of-annwn': { archetype: 'claw', heavy: true },
  'cf-sidhe-silver-lancer': { archetype: 'pierce', heavy: false },
  'cf-fomorian-raider': { archetype: 'impact', heavy: true },
  'cf-otter-familiar': { archetype: 'claw', heavy: false },
  'cf-crowbone-prophet': { archetype: 'arcane', heavy: false },
  'cf-thornmaze-patrol': { archetype: 'pierce', heavy: false },
  'cf-bog-lantern-witch': { archetype: 'venom', heavy: false },
  'cf-green-knoll-champion': { archetype: 'cleave', heavy: true },
  'cf-fae-ring-initiate': { archetype: 'arcane', heavy: false },
  'cf-mistwing-pixie': { archetype: 'aerial', heavy: false },
  'cf-thorn-sprite': { archetype: 'pierce', heavy: false },
  'cf-redcap-skirmisher': { archetype: 'slash', heavy: false },
  'cf-bog-banshee': { archetype: 'venom', heavy: false },
  'cf-sidhe-page': { archetype: 'slash', heavy: false },
  'cf-omen-raven': { archetype: 'aerial', heavy: false },
  'cf-selkie-runner': { archetype: 'frost', heavy: false },
  'cf-mushroom-ring-guard': { archetype: 'impact', heavy: false },
  'cf-willow-wisp-guide': { archetype: 'arcane', heavy: false },
  'cf-fae-court-tokenmaker': { archetype: 'radiance', heavy: false },
  'cf-cold-moon-archer': { archetype: 'pierce', heavy: false },
  'cf-black-dog-of-lane': { archetype: 'venom', heavy: false },
  'cf-heatherblade-scout': { archetype: 'claw', heavy: true },
  'cf-torclight-envoy': { archetype: 'radiance', heavy: false },
  'cf-laughing-pooka': { archetype: 'claw', heavy: false },
  'cf-hazelwand-mystic': { archetype: 'arcane', heavy: false },
  'cf-moorland-guide': { archetype: 'slash', heavy: false },
  'cf-veil-touched-hart': { archetype: 'claw', heavy: false },
  'cf-cairnlight-adept': { archetype: 'arcane', heavy: false },
  // Arthurian Court — polished steel, grail light, and court intrigue.
  'ac-artoria-once-future': { archetype: 'radiance', heavy: true },
  'ac-morgan-thorn-crown': { archetype: 'shadow', heavy: true },
  'ac-nimue-lake-sovereign': { archetype: 'frost', heavy: true },
  'ac-lancelot-moonlit-shame': { archetype: 'slash', heavy: false },
  'ac-guinevere-court-sun': { archetype: 'radiance', heavy: false },
  'ac-gawain-noonblade': { archetype: 'fire', heavy: false },
  'ac-percival-clear-heart': { archetype: 'radiance', heavy: false },
  'ac-galahad-silver-oath': { archetype: 'radiance', heavy: false },
  'ac-merlin-crow-clock': { archetype: 'arcane', heavy: false },
  'ac-mordred-bastard-star': { archetype: 'impact', heavy: true },
  'ac-camelot-banneret': { archetype: 'slash', heavy: false },
  'ac-lakeblade-initiate': { archetype: 'slash', heavy: false },
  'ac-chapel-questant': { archetype: 'radiance', heavy: false },
  'ac-ashwood-ranger': { archetype: 'pierce', heavy: false },
  'ac-velvet-court-spy': { archetype: 'shadow', heavy: false },
  'ac-tournament-favorite': { archetype: 'slash', heavy: false },
  'ac-questing-beast-maiden': { archetype: 'pierce', heavy: false },
  'ac-lady-of-lilies': { archetype: 'arcane', heavy: false },
  'ac-grail-hermit': { archetype: 'radiance', heavy: false },
  'ac-raven-of-camlann': { archetype: 'aerial', heavy: false },
  'ac-oathbroken-knight': { archetype: 'venom', heavy: false },
  'ac-novice-squire': { archetype: 'slash', heavy: false },
  'ac-keep-watchwoman': { archetype: 'impact', heavy: false },
  'ac-lake-attendant': { archetype: 'frost', heavy: false },
  'ac-court-minstrel': { archetype: 'arcane', heavy: false },
  'ac-torchbearer-knight': { archetype: 'fire', heavy: false },
  'ac-borderland-huntress': { archetype: 'pierce', heavy: false },
  'ac-chapel-mender': { archetype: 'radiance', heavy: false },
  'ac-castle-blackguard': { archetype: 'venom', heavy: false },
  'ac-white-horse': { archetype: 'impact', heavy: false },
  'ac-riverford-guard': { archetype: 'slash', heavy: false },
  'ac-errant-duelist': { archetype: 'slash', heavy: false },
  'ac-root-chapel-warden': { archetype: 'pierce', heavy: false },
  'ac-pennant-carrier': { archetype: 'slash', heavy: false },
  'ac-court-archer': { archetype: 'pierce', heavy: false },
  'ac-prophecy-attendant': { archetype: 'arcane', heavy: false },
  'tok-squire': { archetype: 'slash', heavy: false },
  // Gothic Monsters: velvet courts, storm laboratories, and grave gardens.
  'gm-carmilla-crimson-host': { archetype: 'shadow', heavy: true },
  'gm-bride-storm-crowned': { archetype: 'impact', heavy: false },
  'gm-luna-wolf-matriarch': { archetype: 'claw', heavy: true },
  'gm-lenore-velvet-saint': { archetype: 'radiance', heavy: false },
  'gm-victorine-lightning-heir': { archetype: 'arcane', heavy: false },
  'gm-elizabeth-blood-mirror': { archetype: 'shadow', heavy: false },
  'gm-white-chapel-witch': { archetype: 'radiance', heavy: false },
  'gm-moon-doll-orchestra': { archetype: 'impact', heavy: false },
  'gm-silver-bullet-duelist': { archetype: 'pierce', heavy: false },
  'gm-porcelain-queen': { archetype: 'impact', heavy: false },
  'gm-black-veil-matron': { archetype: 'aerial', heavy: false },
  'gm-ravenloft-heiress': { archetype: 'aerial', heavy: false },
  'gm-moonlit-werewolf': { archetype: 'claw', heavy: false },
  'gm-stitchwork-guardian': { archetype: 'impact', heavy: false },
  'gm-blood-opera-soloist': { archetype: 'shadow', heavy: false },
  'gm-thunder-lab-assistant': { archetype: 'arcane', heavy: false },
  'gm-iron-gate-sentinel': { archetype: 'impact', heavy: false },
  'gm-batcloak-cutthroat': { archetype: 'venom', heavy: false },
  'gm-madame-macabre': { archetype: 'shadow', heavy: false },
  'gm-glasshouse-monster': { archetype: 'claw', heavy: true },
  'gm-chapel-exorcist': { archetype: 'radiance', heavy: false },
  'gm-widow-of-the-west-wing': { archetype: 'aerial', heavy: false },
  'gm-stormglass-golem': { archetype: 'impact', heavy: false },
  'gm-choir-of-the-dead': { archetype: 'aerial', heavy: false },
  'gm-manor-thrall': { archetype: 'shadow', heavy: false },
  'gm-bat-swarm': { archetype: 'aerial', heavy: false },
  'gm-wolfbitten-hunter': { archetype: 'pierce', heavy: false },
  'gm-lab-sparkmage': { archetype: 'arcane', heavy: false },
  'gm-chapel-guard': { archetype: 'radiance', heavy: false },
  'gm-grave-gardener': { archetype: 'claw', heavy: false },
  'gm-stitched-footman': { archetype: 'impact', heavy: false },
  'gm-blood-drop-initiate': { archetype: 'shadow', heavy: false },
  'gm-haunted-doll': { archetype: 'impact', heavy: false },
  'gm-crow-on-gate': { archetype: 'aerial', heavy: false },
  'gm-catacomb-ratcatcher': { archetype: 'claw', heavy: false },
  'gm-waxwork-double': { archetype: 'impact', heavy: false },
  'gm-black-cat-familiar': { archetype: 'venom', heavy: false },
  'gm-stitched-hound': { archetype: 'claw', heavy: false },
  'gm-raven-courier': { archetype: 'aerial', heavy: false },
  'gm-lantern-patrol': { archetype: 'pierce', heavy: false },
  'gm-screaming-staircase': { archetype: 'impact', heavy: false },
  'gm-grave-soil-giant': { archetype: 'impact', heavy: true },
  'tok-bat': { archetype: 'aerial', heavy: false },
  'tok-rat': { archetype: 'claw', heavy: false },
  'tok-doll': { archetype: 'impact', heavy: false },
  'tok-grave-rose': { archetype: 'venom', heavy: false },
  'tok-revenant': { archetype: 'shadow', heavy: false },
};

/** Fallback archetype for a creature not in ATTACK_FX_MAP. First match wins. */
function fallbackArchetype(card: CardDef): AttackArchetype {
  const keywords = card.keywords ?? [];
  if (keywords.includes('deathblade')) return 'venom';
  if (keywords.includes('skyborne')) return 'aerial';

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
  return (card.attack ?? 0) >= 5 || card.keywords?.includes('overrun') === true;
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
