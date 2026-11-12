import type { Handle } from '@sveltejs/kit';

import { APP_COLORS } from '@/shared/lib/palette';

// The document owns scrolling on /start and /quiz; its child Theme cannot supply colors upward.
const scrollbarColors = `--muted:${APP_COLORS.muted};--accent:${APP_COLORS.accent}`;

export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%dogs.scrollbar-colors%', scrollbarColors),
  });
