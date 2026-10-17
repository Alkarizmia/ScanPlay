import '../styles/game-ui.css';
import { FLUENT_EMOJI_ART } from '../lib/fluentEmojiArt';

/**
 * Local preview: Fluent emoji sizing for the 4-choice Image Pick grid.
 * Open with `?fluent=preview`. Does not touch scan.
 */
export function FluentEmojiPreview() {
  const byId = (id: string) => FLUENT_EMOJI_ART.find((a) => a.id === id)!;
  const colorSquares = FLUENT_EMOJI_ART.filter((a) => a.id.endsWith('_square'));
  const keycaps = FLUENT_EMOJI_ART.filter((a) => a.id.startsWith('keycap_'));
  /** Référence visuelle: carré bleu Fluent + chiffres keycap. */
  const sample = [
    byId('blue_square'),
    byId('red_square'),
    byId('keycap_1'),
    byId('keycap_2'),
  ].filter(Boolean);

  return (
    <main className="fluent-preview">
      <h1>Fluent emoji · aperçu 4 choix</h1>
      <p className="fluent-preview__hint">
        Source: microsoft/fluentui-emoji (3D, MIT). Objets du quotidien, vêtements, outils, nourriture,
        transports, rôles humains, carrés couleur (réf. blue square) et chiffres keycap. Pas de visages
        jaunes ronds. Scan intact. Jeu Image Pick conservé.
      </p>

      <h2>Grille jeu (réf. blue + chiffres)</h2>
      <div className="imagepick-grid is-ready fluent-preview__grid" aria-label="Exemple 4 choix">
        {sample.map((art) => (
          <div key={art.id} className="imagepick-card fluent-preview__card">
            <img className="imagepick-art" src={art.src} alt={art.id} draggable={false} />
            <span className="fluent-preview__label">{art.id}</span>
          </div>
        ))}
      </div>

      <h2>Couleurs carrées ({colorSquares.length})</h2>
      <ul className="fluent-preview__catalog">
        {colorSquares.map((art) => (
          <li key={art.id}>
            <img src={art.src} alt="" width={56} height={56} loading="lazy" />
            <span>{art.id}</span>
          </li>
        ))}
      </ul>

      <h2>Chiffres keycap ({keycaps.length})</h2>
      <ul className="fluent-preview__catalog">
        {keycaps.map((art) => (
          <li key={art.id}>
            <img src={art.src} alt="" width={56} height={56} loading="lazy" />
            <span>{art.id}</span>
          </li>
        ))}
      </ul>

      <h2>Catalogue complet ({FLUENT_EMOJI_ART.length})</h2>
      <ul className="fluent-preview__catalog">
        {FLUENT_EMOJI_ART.map((art) => (
          <li key={art.id}>
            <img src={art.src} alt="" width={56} height={56} loading="lazy" />
            <span>{art.id}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
