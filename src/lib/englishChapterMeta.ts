/** Small chapter thumbnails (emoji art) keyed by chapter id suffix. */

const ICONS: Record<string, string> = {
  greet: '👋',
  airport: '✈️',
  hotel: '🏨',
  city: '🗺️',
  food: '🍽️',
  help: '🆘',
  office: '💼',
  meet: '🗣️',
  email: '📧',
  career: '🚀',
  travelwork: '🧳',
  class: '📚',
  study: '✏️',
  exam: '📝',
  academic: '🎓',
  life: '🎉',
  core: '🧱',
  instructions: '📋',
  reading: '📖',
  writing: '✍️',
  oral: '🎤',
  precision: '🎯',
  daily: '☀️',
  hobbies: '🎸',
  social: '☕',
  stories: '✨',
  basics: '🔤',
  travel: '🌍',
  worklite: '🤝',
  grow: '📈',
};

export function chapterThumb(chapterId: string): string {
  const suffix = chapterId.includes('-') ? chapterId.slice(chapterId.indexOf('-') + 1) : chapterId;
  return ICONS[suffix] ?? '📗';
}
