/** Pix mascot — canonical SVG geometry (viewBox 0 0 120 140). */

export const VIEWBOX = '0 0 120 140';

/**
 * Leaf body: teardrop with tip folding to the character's right
 * (matches reference-sheet + happy.png silhouette).
 */
export const BODY_PATH =
  'M 58 4' +
  ' C 61 4 64 6 65 10' +
  ' C 66 13 69 12 73 14' +
  ' C 78 16 82 20 84 24' +
  ' C 96 36 104 52 104 68' +
  ' C 104 88 94 104 78 112' +
  ' C 68 116 60 117 52 112' +
  ' C 36 104 26 88 26 68' +
  ' C 26 50 36 34 50 22' +
  ' C 54 18 56 14 56 10' +
  ' C 56 6 55 4 58 4 Z';

/** Soft top-left highlight (flat substitute for 3D sheen). */
export const BODY_SHINE_PATH =
  'M 48 20' +
  ' C 58 16 70 20 78 34' +
  ' C 70 26 60 22 52 24' +
  ' C 42 28 34 40 32 52' +
  ' C 34 34 40 24 48 20 Z';

/** Faint central leaf vein. */
export const LEAF_VEIN_PATH = 'M 60 22 Q 60 58 60 96';

/** Soft white play mark on lower chest (below the mouth), as in happy.webp. */
export const PLAY_TRIANGLE =
  'M 49 82' +
  ' L 49 102' +
  ' L 71 92 Z';

/** Tip fold (underside of leaf curl to the right) — soft wedge, not a hard triangle. */
export const TIP_FOLD_PATH =
  'M 62 7' +
  ' C 68 8 74 14 76 20' +
  ' C 72 16 68 14 64 12' +
  ' C 62 10 61 8 62 7 Z';

export const EYE_LEFT = { cx: 44, cy: 48, r: 12 };
export const EYE_RIGHT = { cx: 76, cy: 48, r: 12 };

/** Happy content eyes (^ ^) — thick rounded arcs, eye color #0f172a. */
export const EYE_HAPPY_LEFT = `M ${EYE_LEFT.cx - 9} ${EYE_LEFT.cy + 2} Q ${EYE_LEFT.cx} ${EYE_LEFT.cy - 9} ${EYE_LEFT.cx + 9} ${EYE_LEFT.cy + 2}`;
export const EYE_HAPPY_RIGHT = `M ${EYE_RIGHT.cx - 9} ${EYE_RIGHT.cy + 2} Q ${EYE_RIGHT.cx} ${EYE_RIGHT.cy - 9} ${EYE_RIGHT.cx + 9} ${EYE_RIGHT.cy + 2}`;

/**
 * Left arm at rest (idle "Respire"): hangs outside the left silhouette.
 * Shoulder ~ (30,70) → hand ~ (8,102) with 3 stubby fingers.
 */
export const ARM_LEFT_PATH =
  'M 30 68' +
  ' C 22 70 14 78 10 90' +
  ' C 8 98 10 106 18 108' +
  ' C 14 110 12 116 16 118' +
  ' C 20 120 24 116 24 112' +
  ' C 22 116 24 122 30 122' +
  ' C 34 122 36 116 34 112' +
  ' C 36 116 40 118 42 114' +
  ' C 44 110 40 104 36 100' +
  ' C 40 90 38 78 34 72' +
  ' C 33 69 32 68 30 68 Z';

/** Right arm at rest (mirror of left). */
export const ARM_RIGHT_PATH =
  'M 90 68' +
  ' C 98 70 106 78 110 90' +
  ' C 112 98 110 106 102 108' +
  ' C 106 110 108 116 104 118' +
  ' C 100 120 96 116 96 112' +
  ' C 98 116 96 122 90 122' +
  ' C 86 122 84 116 86 112' +
  ' C 84 116 80 118 78 114' +
  ' C 76 110 80 104 84 100' +
  ' C 80 90 82 78 86 72' +
  ' C 87 69 88 68 90 68 Z';

/** Short cylindrical legs with rounded feet. */
export const LEG_LEFT_PATH =
  'M 46 110' +
  ' C 42 114 40 122 40 130' +
  ' C 40 135 46 137 52 134' +
  ' C 56 132 56 126 54 120' +
  ' C 52 114 50 110 46 110 Z';

export const LEG_RIGHT_PATH =
  'M 74 110' +
  ' C 78 114 80 122 80 130' +
  ' C 80 135 74 137 68 134' +
  ' C 64 132 64 126 66 120' +
  ' C 68 114 70 110 74 110 Z';

/** Brand greens (flat + one body gradient). */
export const PIX_GREEN = '#6BCF2E';
export const PIX_GREEN_MID = '#4DBA22';
export const PIX_GREEN_DARK = '#2F9A14';
export const PIX_GREEN_SHADOW = '#1E7A0C';
export const PIX_BROW = '#1A5C0A';
export const PIX_CHEEK = '#FF8FAB';
