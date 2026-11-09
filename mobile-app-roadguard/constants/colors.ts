/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const darkPalette = {
  text: '#F7F7F7',
  tint: '#E10600',
  background: '#0B0B0B',
  foreground: '#F7F7F7',
  card: '#161616',
  cardForeground: '#F7F7F7',
  primary: '#E10600',
  primaryForeground: '#FFFFFF',
  secondary: '#222222',
  secondaryForeground: '#F7F7F7',
  muted: '#1B1B1B',
  mutedForeground: '#A3A3A3',
  accent: '#FF6A00',
  accentForeground: '#FFFFFF',
  destructive: '#FF4D43',
  destructiveForeground: '#FFFFFF',
  border: '#2B2B2B',
  input: '#292929',
  success: '#4AC58A',
  warning: '#F4B740',
  critical: '#111111',
  mapRoad: '#252525',
};

const colors = {
  light: darkPalette,
  dark: darkPalette,
  radius: 18,
};

export default colors;
