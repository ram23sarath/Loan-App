/**
 * Loading Screen Component
 * 
 * Displayed while the WebView is loading the web application.
 * Features an animated loading indicator with the app branding.
 */

import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Easing,
  useColorScheme,
} from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Spinning animation
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    pulseAnimation.start();

    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Animated.View 
        style={[
          styles.loaderContainer,
          { transform: [{ scale: pulseValue }] }
        ]}
      >
        <Animated.View 
          style={[
            styles.spinner,
            isDark && styles.spinnerDark,
            { transform: [{ rotate: spin }] }
          ]}
        />
        <View style={[styles.innerCircle, isDark && styles.innerCircleDark]}>
          <Text style={[styles.logoText, isDark && styles.logoTextDark]}>IJ</Text>
        </View>
      </Animated.View>
      
      <Text style={[styles.appName, isDark && styles.appNameDark]}>
        I J Reddy Loan App
      </Text>
      
      <Text style={[styles.message, isDark && styles.messageDark]}>
        {message}
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
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  loaderContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  spinner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#E2E8F0',
    borderTopColor: '#4F46E5',
  },
  spinnerDark: {
    borderColor: '#334155',
    borderTopColor: '#818CF8',
  },
  innerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  innerCircleDark: {
    backgroundColor: '#6366F1',
    shadowColor: '#818CF8',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoTextDark: {
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  appNameDark: {
    color: '#E2E8F0',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
  },
  messageDark: {
    color: '#94A3B8',
  },
});
