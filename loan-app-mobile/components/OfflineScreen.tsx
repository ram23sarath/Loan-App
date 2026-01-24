/**
 * Offline Screen Component
 * 
 * Displayed when the device has no network connectivity.
 * Provides a retry button to check connection again.
 */

import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  useColorScheme,
} from 'react-native';

interface OfflineScreenProps {
  onRetry?: () => void;
}

export default function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
        <Text style={styles.icon}>📡</Text>
      </View>
      
      <Text style={[styles.title, isDark && styles.titleDark]}>
        No Internet Connection
      </Text>
      
      <Text style={[styles.message, isDark && styles.messageDark]}>
        Please check your network connection and try again.
      </Text>
      
      {onRetry && (
        <TouchableOpacity 
          style={[styles.retryButton, isDark && styles.retryButtonDark]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}
      
      <Text style={[styles.hint, isDark && styles.hintDark]}>
        Make sure you're connected to Wi-Fi or mobile data
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainerDark: {
    backgroundColor: '#7F1D1D',
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
    marginBottom: 32,
    lineHeight: 24,
  },
  messageDark: {
    color: '#94A3B8',
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonDark: {
    backgroundColor: '#6366F1',
    shadowColor: '#818CF8',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
