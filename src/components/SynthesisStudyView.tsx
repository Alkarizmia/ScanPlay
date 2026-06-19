import type { Locale } from '../types';
import type { SynthesisDocument } from '../lib/synthesis';
import { t } from '../lib/i18n';

interface SynthesisStudyViewProps {
  locale: Locale;
  doc: SynthesisDocument;
  thumbnail?: string;
  onClose: () => void;
}

export function SynthesisStudyView({ locale, doc, thumbnail, onClose }: SynthesisStudyViewProps) {
  return (
    <div className="synthesis-study-backdrop" role="presentation">
      <div className="synthesis-study scroll-natural" role="dialog" aria-labelledby="synthesis-study-title">
        <header className="synthesis-study-header">
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('back', locale)}>
            ✕
          </button>
          <span className="synthesis-study-badge">✨ {t('synthesisStudyBadge', locale)}</span>
        </header>

        <div className="synthesis-study-hero">
          {thumbnail && (
            <img src={thumbnail} alt="" className="synthesis-study-thumb" />
          )}
          <div className="synthesis-study-hero-text">
            <h2 id="synthesis-study-title">{doc.title}</h2>
            {doc.subject && <p className="synthesis-study-subject">{doc.subject}</p>}
          </div>
        </div>

        <p className="synthesis-study-intro">{doc.introduction}</p>

        {doc.sections.map((section, i) => (
          <article
            key={`${section.heading}-${i}`}
            className="synthesis-section-card"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <h3>{section.heading}</h3>
            <p>{section.content}</p>
            {section.highlight && (
              <p className="synthesis-highlight">💡 {section.highlight}</p>
            )}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="synthesis-bullets">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {section.table && (section.table.headers.length > 0 || section.table.rows.length > 0) && (
              <div className="synthesis-table-wrap">
                <table className="synthesis-table">
                  {section.table.headers.length > 0 && (
                    <thead>
                      <tr>
                        {section.table.headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {section.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}

        {doc.keyPoints.length > 0 && (
          <section className="synthesis-keypoints">
            <h3>🎯 {t('synthesisKeyPoints', locale)}</h3>
            <div className="synthesis-keypoints-grid">
              {doc.keyPoints.map((point) => (
                <span key={point} className="synthesis-keypoint-chip">
                  {point}
                </span>
              ))}
            </div>
          </section>
        )}

        {doc.memoryTips.length > 0 && (
          <section className="synthesis-tips">
            <h3>🧠 {t('synthesisMemoryTips', locale)}</h3>
            <ul>
              {doc.memoryTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        {doc.relatedToScan && (
          <p className="synthesis-related">📷 {doc.relatedToScan}</p>
        )}
      </div>
    </div>
  );
}
