import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  StatusBar,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

interface LandingScreenProps {
  onContinue: () => void;
}

// Animation constants
const FADE_DURATION = 420;
const SLIDE_DISTANCE = 28;
const FADE_EASING = Easing.out(Easing.cubic);

export default function LandingScreen({ onContinue }: LandingScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Shared values for each animated element
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.7);

  const brandOpacity = useSharedValue(0);
  const brandY = useSharedValue(SLIDE_DISTANCE);

  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(SLIDE_DISTANCE);

  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(SLIDE_DISTANCE);

  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(SLIDE_DISTANCE);

  useEffect(() => {
    // Icon: scale + fade (delay 0ms)
    iconOpacity.value = withTiming(1, { duration: FADE_DURATION, easing: FADE_EASING });
    iconScale.value = withSpring(1, { damping: 14, stiffness: 120 });

    // Brand name (delay 200ms)
    brandOpacity.value = withDelay(200, withTiming(1, { duration: FADE_DURATION, easing: FADE_EASING }));
    brandY.value = withDelay(200, withTiming(0, { duration: FADE_DURATION, easing: FADE_EASING }));

    // Title (delay 350ms)
    titleOpacity.value = withDelay(350, withTiming(1, { duration: FADE_DURATION, easing: FADE_EASING }));
    titleY.value = withDelay(350, withTiming(0, { duration: FADE_DURATION, easing: FADE_EASING }));

    // Subtitle (delay 500ms)
    subtitleOpacity.value = withDelay(500, withTiming(1, { duration: FADE_DURATION, easing: FADE_EASING }));
    subtitleY.value = withDelay(500, withTiming(0, { duration: FADE_DURATION, easing: FADE_EASING }));

    // Button (delay 650ms) — spring for natural feel
    buttonOpacity.value = withDelay(650, withTiming(1, { duration: FADE_DURATION, easing: FADE_EASING }));
    buttonY.value = withDelay(650, withSpring(0, { damping: 16, stiffness: 140 }));
  }, []);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const brandAnimatedStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandY.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonY.value }],
  }));

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#0F172A" : "#F8FAFC"}
      />

      {/* Top branding block */}
      <View style={styles.brandingBlock}>
        {/* Icon */}
        <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
          <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
            <Ionicons
              name="business"
              size={36}
              color={isDark ? "#818CF8" : "#4F46E5"}
            />
          </View>
        </Animated.View>

        {/* Brand name */}
        <Animated.Text
          style={[styles.brandName, isDark && styles.textDark, brandAnimatedStyle]}
        >
          I J Reddy
        </Animated.Text>

        {/* Title */}
        <Animated.Text
          style={[styles.title, isDark && styles.textDark, titleAnimatedStyle]}
        >
          Loan App
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          style={[styles.subtitle, isDark && styles.subtitleDark, subtitleAnimatedStyle]}
        >
          Fast, simple loan management.
        </Animated.Text>
      </View>

      {/* Continue button */}
      <Animated.View style={buttonAnimatedStyle}>
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed,
          ]}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue to app"
        >
          <Text style={styles.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.ctaIcon} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
    backgroundColor: "#F8FAFC",
  },
  containerDark: {
    backgroundColor: "#0F172A",
  },
  brandingBlock: {
    gap: 6,
  },
  iconWrapper: {
    marginBottom: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleDark: {
    backgroundColor: "rgba(129, 140, 248, 0.15)",
  },
  brandName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 44,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 17,
    color: "#475569",
    marginTop: 8,
    lineHeight: 24,
  },
  subtitleDark: {
    color: "#94A3B8",
  },
  textDark: {
    color: "#E2E8F0",
  },
  ctaButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaButtonPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ctaIcon: {
    marginTop: 1,
  },
});
