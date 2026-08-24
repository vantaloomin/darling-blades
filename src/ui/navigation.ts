/** Canonical destination nouns for the shared upper-left back affordance. */
export const BACK_LABELS = {
  MainMenu: 'Menu',
  Play: 'Play',
  Draft: 'Draft',
  Shop: 'Shop',
  Profile: 'Profile',
  DeckBuilder: 'Decks',
  PracticePicker: 'Practice',
} as const;

export type BackDestination = keyof typeof BACK_LABELS;
export type BackLabel = (typeof BACK_LABELS)[BackDestination];

export function backLabelFor(destination: BackDestination): BackLabel {
  return BACK_LABELS[destination];
}
