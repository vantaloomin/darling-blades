import { GUAN_YU_ID, PERSEPHONE_ID, YUTU_ID } from './characters';
import type { StoryEvent, StoryLine, StoryScene, StorySpeaker } from './types';

/**
 * The Act 1 script as data (owner-approved 2026-10-12, draft 4:
 * plans/2.0/story-mode/02-act-1-script.md). Every line is shipped text,
 * transcribed verbatim: a change to any line goes back to the owner first.
 * Background and portrait ids follow the Act 1 art list
 * (03-act-1-art-list.md); the art lives in public/assets/art/story/ (full
 * size) and story-half/ (phones) as `<id>.webp`, portraits as
 * `pt-<speaker id>-<expression>.webp`.
 *
 * Scene and event ids are save keys (`seenSceneIds`) once shipped.
 */

/** The twelve speakers with a portrait. Expressions: the default first (art list, V3). */
export const STORY_SPEAKERS: readonly StorySpeaker[] = [
  { id: 'guanyu', name: 'Guan Yu', expressions: ['steady', 'fierce'] },
  { id: 'persephone', name: 'Persephone', expressions: ['wry', 'cold'] },
  { id: 'yutu', name: 'Yutu', expressions: ['grin', 'pout'] },
  { id: 'simayi', name: 'Sima Yi', expressions: ['composed', 'displeased'] },
  { id: 'gongsun-zan', name: 'Gongsun Zan', expressions: ['proud', 'charge'] },
  { id: 'penthesilea', name: 'Penthesilea', expressions: ['bored', 'eager'] },
  { id: 'shanjun', name: 'Shanjun', expressions: ['lazy', 'hunting'] },
  { id: 'guan-lu', name: 'Guan Lu', expressions: ['knowing', 'amused'] },
  { id: 'hua-tuo', name: 'Hua Tuo', expressions: ['warm', 'concerned'] },
  { id: 'officer', name: 'Officer', expressions: ['smug', 'flustered'] },
  { id: 'rider', name: 'Rider', expressions: ['hurt', 'grateful'] },
  { id: 'merchant', name: 'Merchant', expressions: ['selling', 'caught'] },
];

function say(speakerId: string, expression: string, text: string): StoryLine {
  return { speakerId, expression, text };
}

function narrate(text: string): StoryLine {
  return { speakerId: null, text };
}

/**
 * Every Act 1 scene, in script order: three openings (after the opening boon),
 * Sima Yi's intro and defeat per heroine, three elite intros, nine event
 * vignettes (the lines before the choice; the choices are STORY_EVENTS), three
 * endings and the endless intro.
 *
 * Elite intros key on the elite's avatar id. Gongsun Zan, Penthesilea and
 * Shanjun are not avatars yet (wave 3 builds them), and an elite intro plays
 * only when an elite node's avatar matches its `avatarId`, so none of the
 * three plays today.
 */
export const STORY_SCENES: readonly StoryScene[] = [
  {
    id: 'open-guanyu',
    kind: 'opening',
    title: "The Sign over the Yellow River",
    backgroundId: 'bg-yellow-river-night',
    characterId: GUAN_YU_ID,
    avatarId: null,
    lines: [
      narrate("The sky split over the Yellow River at the hour of the ox, and a gold thing fell out of it."),
      narrate("It fell slowly, like a leaf, and landed somewhere past the hills where three realms meet."),
      say("guanyu", "steady", "Sister Liu would say a sign is only a sign."),
      say("guanyu", "steady", "But we swore in the Peach Garden to restore the rightful house. And heaven has just dropped its Mandate in the mud."),
      say("guanyu", "steady", "Every warlord between here and the sea saw that light, and most of them are closer to it than I am."),
      narrate("She takes up the Green Dragon blade and saddles Red Hare in the dark."),
    ],
  },
  {
    id: 'open-persephone',
    kind: 'opening',
    title: "A Crack in the Gate",
    backgroundId: 'bg-underworld-gate',
    characterId: PERSEPHONE_ID,
    avatarId: null,
    lines: [
      narrate("In the underworld nothing changes, so Persephone noticed at once when the ground shook."),
      narrate("A crack had opened in the gate between the living world and the dead. Through it came a thin gold light and the smell of rain."),
      say("persephone", "wry", "Something fell from heaven and hit hard enough to crack my gate. I'm going to see what it was."),
      say("persephone", "wry", "The shades are already wandering toward it. They never listen."),
      say("persephone", "cold", "I've crossed between two courts every year of my life. I can cross one more time and close this."),
      narrate("She puts a pomegranate in her pocket and goes up."),
    ],
  },
  {
    id: 'open-yutu',
    kind: 'opening',
    title: "Something Fell off the Sky",
    backgroundId: 'bg-moon-palace',
    characterId: YUTU_ID,
    avatarId: null,
    lines: [
      narrate("From the Moon Palace you can see everything. Tonight Yutu saw the sky drop something shiny."),
      say("yutu", "grin", "Chang'e! Chang'e, look! No, too late, look where it was!"),
      say("yutu", "grin", "That was the Mandate of Heaven. The actual one. Somebody up there let go of it."),
      say("yutu", "grin", "The moon court has an old rule. Whatever heaven drops, the moon keeps."),
      narrate("She leaves the pestle standing in the mortar and jumps."),
    ],
  },
  {
    id: 'boss-intro-guanyu',
    kind: 'boss-intro',
    title: null,
    backgroundId: 'bg-crater',
    characterId: GUAN_YU_ID,
    avatarId: null,
    lines: [
      narrate("At the bottom of the crater a woman in Wei black is sitting beside the gold light. She looks like she has been there a while."),
      say("simayi", "composed", "General Guan. You've been riding all night. Sit down."),
      say("guanyu", "fierce", "That doesn't belong to you, Sima Yi."),
      say("simayi", "composed", "It doesn't belong to anyone yet. That is the whole point of it."),
      say("simayi", "composed", "Or draw your blade, if you'd rather. I'm not in a hurry."),
    ],
  },
  {
    id: 'boss-intro-persephone',
    kind: 'boss-intro',
    title: null,
    backgroundId: 'bg-crater',
    characterId: PERSEPHONE_ID,
    avatarId: null,
    lines: [
      say("simayi", "composed", "A queen of the dead, this far from home. The Mandate draws stranger guests than I thought."),
      say("persephone", "cold", "Keep your Mandate. It cracked my gate on the way down, and I want it mended."),
      say("simayi", "composed", "Then we want different things, and only one of us can have the crater."),
      say("persephone", "cold", "I'm not leaving until that gate is closed, and the thing that closes it is sitting in your crater."),
    ],
  },
  {
    id: 'boss-intro-yutu',
    kind: 'boss-intro',
    title: null,
    backgroundId: 'bg-crater',
    characterId: YUTU_ID,
    avatarId: null,
    lines: [
      say("simayi", "composed", "A rabbit. From the moon, by the ears."),
      say("yutu", "grin", "Hi! Is that the Mandate? Can I hold it? Just for a second."),
      say("simayi", "composed", "No."),
      say("yutu", "grin", "Can I hold it for a long time?"),
      say("simayi", "displeased", "I've watched you take three purses on the way down here, little thief. Come and try mine."),
    ],
  },
  {
    id: 'boss-defeat-guanyu',
    kind: 'boss-defeat',
    title: null,
    backgroundId: 'bg-crater',
    characterId: GUAN_YU_ID,
    avatarId: null,
    lines: [
      say("simayi", "displeased", "Well fought, General. I'll go back to the capital and wait. The roads are full of people who saw the same light."),
      say("guanyu", "steady", "I'm taking this to Sister Liu. Go home, Sima Yi."),
    ],
  },
  {
    id: 'boss-defeat-persephone',
    kind: 'boss-defeat',
    title: null,
    backgroundId: 'bg-crater',
    characterId: PERSEPHONE_ID,
    avatarId: null,
    lines: [
      say("simayi", "displeased", "You fight like someone who has all the time in the world."),
      say("persephone", "wry", "I do. That's the trouble with arguing with me."),
    ],
  },
  {
    id: 'boss-defeat-yutu',
    kind: 'boss-defeat',
    title: null,
    backgroundId: 'bg-crater',
    characterId: YUTU_ID,
    avatarId: null,
    lines: [
      say("simayi", "displeased", "Take it, then. See how long you keep it."),
      say("yutu", "grin", "I've kept the elixir of immortality safe for three thousand years. I can hold on to this."),
    ],
  },
  {
    id: 'elite-intro-gongsun-zan',
    kind: 'elite-intro',
    title: "Gongsun Zan, White Horse General",
    backgroundId: 'bg-white-horse-road',
    characterId: null,
    avatarId: 'gongsunzan',
    lines: [
      narrate("A line of white horses blocks the road, and every rider sits perfectly still."),
      say("gongsun-zan", "proud", "Whoever reaches the crater rules the north. I intend to reach it first."),
      say("gongsun-zan", "charge", "White horses, forward. Don't wait for her."),
    ],
  },
  {
    id: 'elite-intro-penthesilea',
    kind: 'elite-intro',
    title: "Penthesilea, Amazon Champion",
    backgroundId: 'bg-milestone-road',
    characterId: null,
    avatarId: 'penthesilea',
    lines: [
      narrate("A tall woman with two blades sits on a milestone, sharpening one of them on the other."),
      say("penthesilea", "bored", "The crown can go to whoever takes it. I want to fight that person first."),
      say("penthesilea", "eager", "Is that you?"),
    ],
  },
  {
    id: 'elite-intro-shanjun',
    kind: 'elite-intro',
    title: "Shanjun, Tiger-Queen of the Mountain",
    backgroundId: 'bg-mountain-path',
    characterId: null,
    avatarId: 'shanjun',
    lines: [
      narrate("The trees go quiet. On the rocks above the path, a striped tail swings once, lazily."),
      say("shanjun", "lazy", "The Mandate passed over my mountain. Anything that passes over my mountain is mine."),
      say("shanjun", "hunting", "You're on my mountain too, by the way."),
    ],
  },
  {
    id: 'ev-where-it-landed',
    kind: 'event',
    title: "Where the Light Touched Down",
    backgroundId: 'bg-scorched-field',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("A field of scorched wheat. In the middle, one stalk has turned to gold and is still growing."),
      narrate("The farmers stand at the edge of the field and watch you, and the stalk, and each other."),
    ],
  },
  {
    id: 'ev-meng-ford-toll',
    kind: 'event',
    title: "The Toll at Meng Ford",
    backgroundId: 'bg-meng-ford',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("Two officers in Sima Yi's colours have set a table across the ford and hung a sign that says TOLL in very fresh paint."),
      say("officer", "smug", "By order of General Sima. Everyone going toward the crater pays."),
    ],
  },
  {
    id: 'ev-reader-of-stars',
    kind: 'event',
    title: "The Reader of Stars",
    backgroundId: 'bg-diviners-tree',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("A woman sits under a tree with a bundle of bamboo sticks and a sign that says FORTUNES, HONEST ONES. This is Guan Lu."),
      say("guan-lu", "knowing", "You're going to the crater. Everyone is. Shake the sticks and I'll tell you what you're carrying that you don't need."),
    ],
  },
  {
    id: 'ev-wounded-rider',
    kind: 'event',
    title: "The Wounded Rider",
    backgroundId: 'bg-trampled-road',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("A rider from Wei lies by the road, her horse grazing nearby. She was trampled in the rush toward the crater."),
      say("rider", "hurt", "I won't make it there. Take my place in the line, if you're going."),
    ],
  },
  {
    id: 'ev-pieces-of-heaven',
    kind: 'event',
    title: "Pieces of Heaven",
    backgroundId: 'bg-pilgrim-road',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("A merchant sells \"genuine fragments of the Mandate\" from a cart. They are painted rocks."),
      say("merchant", "selling", "One piece of the sky, only ten gold! Glows in the dark!"),
      narrate("It does not glow in the dark."),
    ],
  },
  {
    id: 'ev-peach-blossom-inn',
    kind: 'event',
    title: "The Peach Blossom Inn",
    backgroundId: 'bg-peach-inn',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("An inn under a peach tree. Three strangers at a corner table are swearing to be sisters over cheap wine, and getting the words wrong."),
      narrate("They see you watching and raise their cups."),
    ],
  },
  {
    id: 'ev-divine-physician',
    kind: 'event',
    title: "The Divine Physician",
    backgroundId: 'bg-physicians-tent',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("Hua Tuo has set up a tent of herbs at the crossroads. A line of bruised soldiers waits outside."),
      say("hua-tuo", "warm", "Everyone fights over the Mandate, and everyone ends up here. Let me look at you."),
    ],
  },
  {
    id: 'ev-cats-in-the-dark',
    kind: 'event',
    title: "Cats in the Dark",
    backgroundId: 'bg-night-camp',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("You wake at midnight to small paws in your pack. A few cat-eared shadows are running off with your purse."),
    ],
  },
  {
    id: 'ev-changban-bridge',
    kind: 'event',
    title: "The Broken Bridge at Changban",
    backgroundId: 'bg-changban-bridge',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("The bridge is half gone. On the far side, someone has written STAY BACK in letters a foot high."),
    ],
  },
  {
    id: 'end-guanyu',
    kind: 'ending',
    title: null,
    backgroundId: 'bg-crater-dawn',
    characterId: GUAN_YU_ID,
    avatarId: null,
    lines: [
      narrate("Guan Yu lifts the Mandate out of the crater. It is lighter than she expected, and warm, like a hand."),
      say("guanyu", "fierce", "For the house of Han. For Sister Liu. For the oath."),
      narrate("Then the Mandate slides out of her grip like water and rises into the air, and every warlord on the horizon turns to watch where it will come down next."),
      say("guanyu", "steady", "Sister Liu, forgive me. This is going to take longer than I said."),
    ],
  },
  {
    id: 'end-persephone',
    kind: 'ending',
    title: null,
    backgroundId: 'bg-underworld-gate',
    characterId: PERSEPHONE_ID,
    avatarId: null,
    lines: [
      narrate("Persephone holds the Mandate over the crack in the earth. The gold light runs into it like a stitch, and the gate below closes."),
      say("persephone", "cold", "There."),
      narrate("She can feel others, far off. Smaller cracks, everywhere the light has passed."),
      narrate("The Mandate pulls loose from her hand and drifts away, toward the next one."),
      say("persephone", "wry", "The dead can wait. I'll follow it."),
    ],
  },
  {
    id: 'end-yutu',
    kind: 'ending',
    title: null,
    backgroundId: 'bg-crater-dawn',
    characterId: YUTU_ID,
    avatarId: null,
    lines: [
      narrate("Yutu has the Mandate. She actually has it. She holds it up to the moon to show everybody at home."),
      say("yutu", "grin", "Look! I got it! I told you the rule was real!"),
      narrate("The Mandate hops out of her hands. It rises over the hills, round and bright, like a second moon."),
      say("yutu", "pout", "Hey! That's my move!"),
      say("yutu", "pout", "Fine! Fine. I'll just steal it again."),
    ],
  },
  {
    id: 'endless-intro',
    kind: 'endless-intro',
    title: null,
    backgroundId: 'bg-mandate-sky',
    characterId: null,
    avatarId: null,
    lines: [
      narrate("The Mandate will not stay held. Wherever it comes down, someone new is waiting for it with an army."),
      narrate("It has come down again, somewhere east of here by the look of the sky."),
    ],
  },
];

/**
 * The nine Act 1 events (shared by all three heroines). Labels are the
 * script's choice buttons, verbatim; effects encode exactly what each label
 * says. The gold amounts are the script's first guesses (progression tunes
 * them). `reactsToChoice` names the choice after which the reacting speaker
 * switches to her second expression (script, "How to read it").
 */
export const STORY_EVENTS: readonly StoryEvent[] = [
  {
    id: 'ev-where-it-landed',
    reactingSpeakerId: null,
    reactsToChoice: null,
    choices: [
      {
        label: "Take the golden stalk: add a random rare card from your pool.",
        effects: [{ kind: 'add-random', filter: { source: 'pool', rarity: 'r' } }],
      },
      {
        label: "Leave it to the farmers: they press their coins on you. Gain 20 gold.",
        effects: [{ kind: 'gold', amount: 20 }],
      },
    ],
  },
  {
    id: 'ev-meng-ford-toll',
    reactingSpeakerId: 'officer',
    reactsToChoice: 1,
    choices: [
      {
        label: "Pay the toll: lose 25 gold.",
        effects: [{ kind: 'gold', amount: -25 }],
      },
      {
        label: "Wade the deep channel instead: the river takes something from your pack. Remove a random card.",
        effects: [{ kind: 'remove-random' }],
      },
    ],
  },
  {
    id: 'ev-reader-of-stars',
    reactingSpeakerId: 'guan-lu',
    reactsToChoice: 0,
    choices: [
      {
        label: "Shake the sticks: change a random card into another card of the same rarity.",
        effects: [{ kind: 'transform-random' }],
      },
      {
        label: "Ask her plainly: lose 30 gold, and remove a card of your choice.",
        effects: [{ kind: 'gold', amount: -30 }, { kind: 'remove-choice', upTo: 1, atLeast: 1 }],
      },
    ],
  },
  {
    id: 'ev-wounded-rider',
    reactingSpeakerId: 'rider',
    reactsToChoice: 0,
    choices: [
      {
        label: "Share your supplies: lose 15 gold. She gives you her place in the ranks. Add a common card of your choice from three.",
        effects: [{ kind: 'gold', amount: -15 }, { kind: 'add-choice', options: 3, filter: { source: 'pool', rarity: 'c' } }],
      },
      {
        label: "Leave her with water and go on: nothing changes.",
        effects: [],
      },
    ],
  },
  {
    id: 'ev-pieces-of-heaven',
    reactingSpeakerId: 'merchant',
    reactsToChoice: 1,
    choices: [
      {
        label: "Buy one anyway: lose 10 gold. You get a very nice rock.",
        effects: [{ kind: 'gold', amount: -10 }],
      },
      {
        label: "Tell the crowd the truth: they get their money back and give you a share for it. Gain 20 gold.",
        effects: [{ kind: 'gold', amount: 20 }],
      },
    ],
  },
  {
    id: 'ev-peach-blossom-inn',
    reactingSpeakerId: null,
    reactsToChoice: null,
    choices: [
      {
        label: "Join the toast: add a card of your choice from three.",
        effects: [{ kind: 'add-choice', options: 3, filter: { source: 'pool' } }],
      },
      {
        label: "Pay for their round and slip out early: lose 20 gold, and remove a card of your choice.",
        effects: [{ kind: 'gold', amount: -20 }, { kind: 'remove-choice', upTo: 1, atLeast: 1 }],
      },
    ],
  },
  {
    id: 'ev-divine-physician',
    reactingSpeakerId: 'hua-tuo',
    reactsToChoice: 0,
    choices: [
      {
        label: "Let her treat you: lose 35 gold, and remove up to two cards of your choice.",
        effects: [{ kind: 'gold', amount: -35 }, { kind: 'remove-choice', upTo: 2, atLeast: 0 }],
      },
      {
        label: "Help her gather herbs for an hour: add a random common white card.",
        effects: [{ kind: 'add-random', filter: { source: 'catalog', rarity: 'c', color: 'W' } }],
      },
    ],
  },
  {
    id: 'ev-cats-in-the-dark',
    reactingSpeakerId: null,
    reactsToChoice: null,
    choices: [
      {
        label: "Chase them down: you catch one, and she joins you to avoid the trouble. Add a random black Beastkin card.",
        effects: [{ kind: 'add-random', filter: { source: 'catalog', color: 'B', subtype: 'Beastkin' } }],
      },
      {
        label: "Let them go: lose 15 gold.",
        effects: [{ kind: 'gold', amount: -15 }],
      },
    ],
  },
  {
    id: 'ev-changban-bridge',
    reactingSpeakerId: null,
    reactsToChoice: null,
    choices: [
      {
        label: "Climb across what's left: something falls into the river. Remove a random card.",
        effects: [{ kind: 'remove-random' }],
      },
      {
        label: "Wait for the ferry: lose 20 gold.",
        effects: [{ kind: 'gold', amount: -20 }],
      },
    ],
  },
];
