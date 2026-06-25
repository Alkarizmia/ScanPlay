/** Props partagées quand un jeu est intégré dans une leçon (barre unique). */
export interface EmbeddedGameProps {
  embedded?: boolean;
  onStepProgress?: (done: number, total: number) => void;
}
