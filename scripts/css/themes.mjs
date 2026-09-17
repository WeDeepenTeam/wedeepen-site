/**
 * themes.mjs — the Tailwind themes the site compiles, and which pages use them.
 *
 * These were lifted verbatim from the `tailwind.config` blocks the pages used
 * to carry inline. Most pages share `wedeepen`; three sections had diverged on
 * their own values and keep their own theme rather than being silently
 * normalized. Edit a color here, then run `npm run css:build`.
 */

const COLORS = {
  // Love Club sub-brand accents
  rose:    { deep: '#A01B4A', light: '#C4577A' },
  pink:    { hot: '#E8337A', bright: '#FF4F8C', glow: 'rgba(232,51,122,0.25)' },
  // WeDeepen parent platform — Teal is the signature thread
  teal:    { DEFAULT: '#C9A277', light: '#D4B78C', dark: '#A8855C' },
  gold:    { DEFAULT: '#C9A277', light: '#D4B78C', dark: '#A8855C' }, // alias to teal during migration
  // Structural
  charcoal: '#2D2D2D',
  cream:   '#F4EDE0',
  ink:     '#1A1A1A',
  black:   '#1A1A1A',
  softgray: '#F5F5F5',
};

const FONTS = {
  heading: ['"Playfair Display"', 'Georgia', 'serif'],
  body:    ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
};

export const THEMES = {
  // Every page except the ones listed below.
  wedeepen: {
    theme: { extend: { colors: COLORS, fontFamily: FONTS, maxWidth: { site: '1200px' } } },
  },

  // /membership/ runs a darker ink and wider containers.
  'wedeepen-membership': {
    theme: {
      extend: {
        colors: { ...COLORS, ink: '#141414', black: '#141414' },
        fontFamily: FONTS,
        maxWidth: { site: '1240px', reading: '680px' },
      },
    },
  },

  // /kashf/ ships its own reset, so Tailwind's preflight must stay off.
  'wedeepen-kashf': {
    corePlugins: { preflight: false },
    theme: { extend: { colors: COLORS, fontFamily: FONTS, maxWidth: { site: '1200px' } } },
  },
};

export const DEFAULT_THEME = 'wedeepen';

/** Page path (e.g. "/membership/") to theme name. */
const BY_PREFIX = [
  ['/membership/', 'wedeepen-membership'],
  ['/kashf/', 'wedeepen-kashf'],
];

export function themeFor(urlPath) {
  const hit = BY_PREFIX.find(([prefix]) => urlPath === prefix || urlPath.startsWith(prefix));
  return hit ? hit[1] : DEFAULT_THEME;
}
