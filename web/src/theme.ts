// Design tokens mirrored from index.css custom properties, for use in
// inline styles / TS. Keep in sync with :root in index.css.
export const C = {
  paper: '#fcf8f1',
  deviceBg: '#ece5da',
  card: '#ffffff',
  sub: '#faf5ec',
  mutedSurface: '#f7f2e9',

  clay: '#c1683f',
  clayDeep: '#a4502c',
  clayTint: '#f6e6dd',
  clayBanner: '#fbf0e9',
  clayBorder: '#ecd3c5',
  clayBorderSoft: '#efd6c8',
  clayBannerBorder: '#f0d6c6',

  herb: '#5b9163',
  herbText: '#467a4e',
  herbTint: '#e7f0e6',
  herbBorder: '#bcd6bf',

  ink: '#2a2520',
  ink2: '#5a5046',
  ink3: '#897e71',
  muted: '#b8ad9e',
  muted2: '#c3b8a8',
  faint: '#a99e8e',

  line: '#ece3d6',
  lineRow: '#f1eadd',
  track: '#efe5d6',
  dash: '#d8cdbd',
  dashGuess: '#ddd2c2',
} as const

export const serif = 'var(--serif)'
export const sans = 'var(--sans)'
