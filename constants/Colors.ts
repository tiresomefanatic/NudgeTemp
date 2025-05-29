/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#5D5FEE',
    otpFocus: '#7267FF',
    textSecondary: '#6c757d',
    border: '#ced4da',
    lightGray: '#f8f9fa',
    textPlaceholder: '#adb5bd',
    success: '#1CD812',
    danger: '#EF3A29',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: '#5D5FEE',
    otpFocus: '#7267FF',
    textSecondary: '#adb5bd',
    border: '#495057',
    lightGray: '#343a40',
    textPlaceholder: '#6c757d',
    success: '#1CD812',
    danger: '#EF3A29',
  },
};
