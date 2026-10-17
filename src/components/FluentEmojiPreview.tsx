import '../styles/game-ui.css';
import { FLUENT_EMOJI_ART } from '../lib/fluentEmojiArt';

/**
 * Local preview: Fluent emoji sizing for the 4-choice Image Pick grid.
 * Open with `?fluent=preview`. Does not touch scan.
 */
export function FluentEmojiPreview() {
  const sample = FLUENT_EMOJI_ART.slice(0, 4);

  return (
    <main className="fluent-preview">
      <h1>Fluent emoji · aperçu 4 choix</h1>
      <p className="fluent-preview__hint">
        Source: microsoft/fluentui-emoji (3D, MIT). Objets du quotidien, vêtements, outils, nourriture,
        transports + rôles humains. Pas de visages jaunes ronds. Scan intact. Jeu Image Pick conservé.
      </p>

      <h2>Grille jeu (taille réelle)</h2>
      <div className="imagepick-grid is-ready fluent-preview__grid" aria-label="Exemple 4 choix">
        {sample.map((art) => (
          <div key={art.id} className="imagepick-card fluent-preview__card">
            <img className="imagepick-art" src={art.src} alt={art.id} draggable={false} />
            <span className="fluent-preview__label">{art.id}</span>
          </div>
        ))}
      </div>

      <h2>Catalogue ({FLUENT_EMOJI_ART.length})</h2>
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
