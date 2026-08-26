/** Props partagées quand un jeu est intégré dans une leçon (barre unique). */
export interface EmbeddedGameProps {
  embedded?: boolean;
  onStepProgress?: (done: number, total: number) => void;
  /** In a path lesson: keep each mini-game to 1–2 items (Duolingo-style). */
  maxItems?: number;
}
