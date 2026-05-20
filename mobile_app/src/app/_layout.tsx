import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F7F8FA',
    card: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E8E9ED',
    primary: '#4F46E5',
  },
};

export default function TabLayout() {
  return (
    <ThemeProvider value={LightTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
