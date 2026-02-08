/**
 * Error Screen Component
 * 
 * Displayed when the WebView encounters an error or crash.
 * Provides error details (in dev mode) and retry/reload options.
 */

import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Animated,
  Easing,
} from 'react-native';

interface ErrorScreenProps {
  error?: string;
  errorDetails?: string;
  onRetry?: () => void;
  onReload?: () => void;
}

export default function ErrorScreen({ 
  error = 'Something went wrong', 
  errorDetails,
  onRetry, 
  onReload 
}: ErrorScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fade-in + slide-up entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
          <Text style={styles.icon}>⚠️</Text>
        </View>
        
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Oops! Something Went Wrong
        </Text>
        
        <Text style={[styles.message, isDark && styles.messageDark]}>
          {error}
        </Text>
        
        {__DEV__ && errorDetails && (
          <View style={[styles.errorBox, isDark && styles.errorBoxDark]}>
            <Text style={[styles.errorLabel, isDark && styles.errorLabelDark]}>
              Error Details (Dev Only)
            </Text>
            <Text style={[styles.errorDetails, isDark && styles.errorDetailsDark]}>
              {errorDetails}
            </Text>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          {onRetry && (
            <TouchableOpacity 
              style={[styles.primaryButton, isDark && styles.primaryButtonDark]}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
          
          {onReload && (
            <TouchableOpacity 
              style={[styles.secondaryButton, isDark && styles.secondaryButtonDark]}
              onPress={onReload}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, isDark && styles.secondaryButtonTextDark]}>
                Reload App
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={[styles.hint, isDark && styles.hintDark]}>
          If this problem persists, please try closing and reopening the app.
        </Text>
      </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainerDark: {
    backgroundColor: '#78350F',
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleDark: {
    color: '#E2E8F0',
  },
  message: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  messageDark: {
    color: '#94A3B8',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBoxDark: {
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  errorLabelDark: {
    color: '#FCA5A5',
  },
  errorDetails: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#991B1B',
    lineHeight: 18,
  },
  errorDetailsDark: {
    color: '#FEE2E2',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDark: {
    backgroundColor: '#6366F1',
    shadowColor: '#818CF8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonTextDark: {
    color: '#818CF8',
  },
  hint: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  hintDark: {
    color: '#64748B',
  },
});
