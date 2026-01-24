/**
 * Root Layout
 * 
 * Sets up the app-wide providers and navigation structure.
 * Configures splash screen, notifications, and status bar.
 */

import React, { useEffect, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotificationHandler } from '@/native/notifications';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Configure notification handling on app start
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Hide splash screen after a short delay (WebView will show loading state)
  const onLayoutRootView = useCallback(async () => {
    // Give a moment for the app to render
    await new Promise(resolve => setTimeout(resolve, 500));
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F8FAFC',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'I J Reddy Loan App',
            gestureEnabled: false, // Prevent swipe back on main screen
          }} 
        />
      </Stack>
    </SafeAreaProvider>
  );
}
