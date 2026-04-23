import { Platform } from 'react-native';

const tintColorLight = '#FF8A7A';
const tintColorDark = '#FFB5A8';

export const Colors = {
  light: {
    text: '#2D2A2E',
    textMuted: '#8A8589',
    background: '#FFF9F5',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF0EA',
    border: '#F0E3DB',
    tint: tintColorLight,
    icon: '#8A8589',
    tabIconDefault: '#B8ADA8',
    tabIconSelected: tintColorLight,
    success: '#7BC67E',
    warning: '#F5B841',
    danger: '#E86A5F',
  },
  dark: {
    text: '#F4EEEA',
    textMuted: '#9C9490',
    background: '#1A1614',
    surface: '#242020',
    surfaceAlt: '#2E2826',
    border: '#3A3330',
    tint: tintColorDark,
    icon: '#9C9490',
    tabIconDefault: '#6B625F',
    tabIconSelected: tintColorDark,
    success: '#7BC67E',
    warning: '#F5B841',
    danger: '#E86A5F',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
