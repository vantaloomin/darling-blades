import { makePersonality, type Personality } from '../ai/personality';
import { makePicker, type PickerProfile } from '../meta/draftPicker';

export interface DraftPersona {
  id: string;
  name: string;
  gender: 'f' | 'm';
  title: string;
  blurb: string;
  /**
   * The tier-2 familiarity reveal: one line about their color behavior, in
   * their voice, truthful to the picker knobs (most personas have no color
   * lock — the hint says so with personality rather than inventing one).
   */
  colorHint: string;
  portraitCardId: string;
  picker: PickerProfile;
  personality: Personality;
}

/**
 * The draft-table cast: 20 grounded drafters, each a data-only pick profile +
 * duel Personality. NEVER shrink this roster below 7 unique ids —
 * assignDraftPersonas throws below 7, and inside SaveManager.migrate() that
 * throw is swallowed by load()'s try/catch, silently replacing a player's
 * whole save with a fresh one (tests pin the floor).
 */
export const DRAFT_PERSONAS: readonly DraftPersona[] = [
  {
    id: 'dp-tiffany',
    name: 'Tiffany',
    gender: 'f',
    title: 'the Rare-Chaser',
    blurb: "Hasn't read rules text in years, but she can spot a gold set-symbol from across the table.",
    colorHint: 'Whatever color the rarest card happens to be.',
    portraitCardId: 'gk-aphrodite',
    picker: makePicker({ rarityWeight: 100, colorLoyalty: 0 }),
    personality: makePersonality({ mulliganShift: 1 }),
  },
  {
    id: 'dp-brandon',
    name: 'Brandon',
    gender: 'm',
    title: 'the Swarm Drafter',
    blurb: 'He keeps counting bodies out loud, especially when one card makes three of them.',
    colorHint: 'No fixed colors; whichever packs bring the most bodies.',
    portraitCardId: 'so-muster-militia',
    picker: makePicker({ creatureWeight: 9, tokenWeight: 12 }),
    personality: makePersonality({ aggression: 1.15, subtypeBias: 1, preferredSubtypes: ['Warrior'] }),
  },
  {
    id: 'dp-megan',
    name: 'Megan',
    gender: 'f',
    title: 'the Tribal Loyalist',
    blurb: 'Once she sees two Warriors, every later pick is judged by whether it belongs with them.',
    colorHint: 'Colors follow the tribe, never the other way around.',
    portraitCardId: 'bk-packmother',
    picker: makePicker({ subtypeWeight: 14, subtypePrefs: ['Warrior'] }),
    personality: makePersonality({ subtypeBias: 1.5, preferredSubtypes: ['Warrior'] }),
  },
  {
    id: 'dp-kyle',
    name: 'Kyle',
    gender: 'm',
    title: 'the Skyborne Fancier',
    blurb: 'He turns every creature sideways in the air and leaves ground combat to somebody else.',
    colorHint: 'Any color with wings; the ground game is negotiable.',
    portraitCardId: 'cf-mist-road',
    picker: makePicker({ keywordWeight: 14, keywordPrefs: ['skyborne'] }),
    personality: makePersonality({ aggression: 1.15, attackThreshold: -0.5 }),
  },
  {
    id: 'dp-jessica',
    name: 'Jessica',
    gender: 'f',
    title: 'the Removal Hoarder',
    blurb: 'She takes the clean answer now because somebody at the table will eventually hand her a threat.',
    colorHint: 'Follows the removal, whatever color it comes in.',
    portraitCardId: 'tk-wei-wangyi',
    picker: makePicker({ removalWeight: 28 }),
    personality: makePersonality({ holdback: 1.2, removalBias: -1 }),
  },
  {
    id: 'dp-lauren',
    name: 'Lauren',
    gender: 'f',
    title: 'the Curve Perfectionist',
    blurb: 'Her picks are already sorted into mana-value columns before the first pack finishes.',
    colorHint: 'Color-flexible; the curve is the part that is non-negotiable.',
    portraitCardId: 'tk-jin-xinxianying',
    picker: makePicker({ curveWeight: 5, bigStuffBias: -5 }),
    personality: makePersonality({ trickRespect: 1.2, mulliganShift: 1 }),
  },
  {
    id: 'dp-tyler',
    name: 'Tyler',
    gender: 'm',
    title: 'the Big-Stuff Timmy',
    blurb: 'If the card costs seven and has the largest numbers in the pack, Tyler has finished reading it.',
    colorHint: 'Any color that goes over the top of yours.',
    portraitCardId: 'rg-ragnarok',
    picker: makePicker({ creatureWeight: 7, bigStuffBias: 10, statBias: 0.25 }),
    personality: makePersonality({ aggression: 1.15, easyAllIn: 1 }),
  },
  {
    id: 'dp-derek',
    name: 'Derek',
    gender: 'm',
    title: 'the Mono-Red Forcer',
    blurb: 'He arrived planning to draft red and treats the packs as confirmation that red is open.',
    colorHint: 'Red. It was red last draft, and it will be red next draft.',
    portraitCardId: 'land-mountain',
    picker: makePicker({ forcedColors: ['R'], colorLoyalty: 6, commitAfter: 0 }),
    personality: makePersonality({ aggression: 1.3, attackThreshold: -0.75 }),
  },
  {
    id: 'dp-amanda',
    name: 'Amanda',
    gender: 'f',
    title: 'the Five-Color Optimist',
    blurb: 'She takes the strongest card in every color and assumes the mana will become a future problem.',
    colorHint: 'All five, unapologetically.',
    portraitCardId: 'bk-kitsune-matriarch',
    picker: makePicker({ colorLoyalty: 0 }),
    personality: makePersonality({ trickRespect: 1.2 }),
  },
  {
    id: 'dp-brittany',
    name: 'Brittany',
    gender: 'f',
    title: 'the Aggro Slasher',
    blurb: 'She wants cheap attackers, extra blades, and a game that ends before anyone stabilizes.',
    colorHint: 'Whatever colors attack fastest that day.',
    portraitCardId: 'tk-other-lulingqi',
    picker: makePicker({ creatureWeight: 7, cheapBias: 2, statBias: 1, keywordWeight: 12, keywordPrefs: ['firstBlade', 'twinBlades'] }),
    personality: makePersonality({ aggression: 1.6, attackThreshold: -1.5, holdback: 0.6 }),
  },
  {
    id: 'dp-kevin',
    name: 'Kevin',
    gender: 'm',
    title: 'the Wall Architect',
    blurb: 'The game ends when he says it ends, and it never ends while he still has blockers.',
    colorHint: 'Any color, as long as its creatures are wider than they are tall.',
    portraitCardId: 'in-shieldwall',
    picker: makePicker({ statBias: -1 }),
    personality: makePersonality({ holdback: 1.5, attackThreshold: 0.75, blockLifePressure: 1.25, blockThreshold: -0.5 }),
  },
  {
    id: 'dp-stephanie',
    name: 'Stephanie',
    gender: 'f',
    title: 'the Lifegain Devotee',
    blurb: 'Every point of life is another small reason she believes her deck is working perfectly.',
    colorHint: 'Goes where the lifegain flows.',
    portraitCardId: 'bk-foxfire-priestess',
    picker: makePicker({ keywordWeight: 12, keywordPrefs: ['bloodoath'], lifeGainWeight: 14 }),
    personality: makePersonality({ aggression: 0.85, lifegainBias: 2 }),
  },
  {
    id: 'dp-zach',
    name: 'Zach',
    gender: 'm',
    title: 'the Grave-Robber',
    blurb: 'He sees the graveyard as a second hand and drafts every card that helps stock or empty it.',
    colorHint: 'Leans toward the colors that dig up graves.',
    portraitCardId: 'cf-moonlit-barrow',
    picker: makePicker({ graveyardWeight: 18 }),
    personality: makePersonality({ aggression: 0.9, holdback: 1.2, mulliganShift: 1 }),
  },
  {
    id: 'dp-rachel',
    name: 'Rachel',
    gender: 'f',
    title: 'the Charm-and-Ritual Mage',
    blurb: 'She drafts the spell first and worries about finding enough creatures somewhere around deck construction.',
    colorHint: 'Any color with more spells than creatures in it.',
    portraitCardId: 'rg-mist-seer',
    picker: makePicker({ creatureWeight: 1, spellWeight: 13 }),
    personality: makePersonality({ holdback: 1.25, counterFloor: 3 }),
  },
  {
    id: 'dp-cody',
    name: 'Cody',
    gender: 'm',
    title: 'the Chaos Drafter',
    blurb: 'He points at a card, changes his mind twice, and somehow still submits before the timer expires.',
    colorHint: 'Ask again in five minutes.',
    portraitCardId: 'cf-glimmerdust-trick',
    picker: makePicker({ chaos: 0.98 }),
    personality: makePersonality({ easyNoise: 0.3, easyPassRate: 0.7, easyAllIn: 1 }),
  },
  {
    id: 'dp-justin',
    name: 'Justin',
    gender: 'm',
    title: 'the Legend Hunter',
    blurb: 'A legendary name is enough to make him reshuffle the whole plan around one card.',
    colorHint: 'Legend colors: all of them, whichever they are.',
    portraitCardId: 'ar-imperial-jade-seal',
    picker: makePicker({ legendWeight: 35 }),
    personality: makePersonality({ mulliganShift: 1 }),
  },
  {
    id: 'dp-samantha',
    name: 'Samantha',
    gender: 'f',
    title: 'the Keyword Collector',
    blurb: 'The more reminder words a creature carries, the more certain she is that it belongs in her pile.',
    colorHint: 'Colors are just keyword delivery systems.',
    portraitCardId: 'rg-norns',
    picker: makePicker({ keywordWeight: 8 }),
    personality: makePersonality({ trickRespect: 1.2 }),
  },
  {
    id: 'dp-matt',
    name: 'Matt',
    gender: 'm',
    title: 'the Bargain Hunter',
    blurb: 'He would rather cast two modest cards early than admire one expensive card in hand.',
    colorHint: 'The cheap end of every color.',
    portraitCardId: 'cf-apple-of-emain',
    picker: makePicker({ rarityWeight: 2, cheapBias: 12 }),
    personality: makePersonality({ mulliganShift: -1, attackThreshold: -0.5 }),
  },
  {
    id: 'dp-ashley',
    name: 'Ashley',
    gender: 'f',
    title: 'the Tinkerer',
    blurb: 'Artifacts and enchantments go into her pile first; the creatures are there to hold everything together.',
    colorHint: 'Colorless at heart; colors are load-bearing details.',
    portraitCardId: 'tk-shu-yueying',
    picker: makePicker({ permanentWeight: 22 }),
    personality: makePersonality({ trickRespect: 1.2, holdback: 1.2 }),
  },
  {
    id: 'dp-chris',
    name: 'Chris',
    gender: 'm',
    title: 'the Textbook Drafter',
    blurb: 'Chris takes solid cards, watches the curve, reads the colors, and rarely gives the table a story.',
    colorHint: 'Reads the signals and settles into two colors, like the books say.',
    portraitCardId: 'so-strategic-planning',
    picker: makePicker(),
    personality: makePersonality(),
  },
];

export function draftPersonaById(id: string): DraftPersona | null {
  return DRAFT_PERSONAS.find((persona) => persona.id === id) ?? null;
}
