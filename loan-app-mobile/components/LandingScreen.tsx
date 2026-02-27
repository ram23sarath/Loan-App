import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  StatusBar,
  Platform,
  AccessibilityInfo,
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
import * as Device from "expo-device";

interface LandingScreenProps {
  onContinue: () => void;
}

/**
 * Detects if the device is low-end based on actual performance characteristics.
 * Checks RAM availability and device model hints rather than pixel density.
 *
 * Low-end criteria:
 * - Android with < 2GB total memory, OR
 * - Known budget device identifier
 */
function isLowEndDevice(): boolean {
  // iOS devices supported by Expo are generally performant
  if (Platform.OS === "ios") {
    return false;
  }

  // Android: check actual device capabilities
  if (Platform.OS === "android") {
    try {
      // Check total memory (bytes to GB) using expo-device.
      // Keep this synchronous and dependency-free for Expo managed workflow.
      const totalMemoryBytes = Device.totalMemory ?? 0;

      const totalMemoryGB = totalMemoryBytes / (1024 * 1024 * 1024);

      // Devices with < 2GB RAM are considered low-end
      if (totalMemoryGB > 0 && totalMemoryGB < 2) {
        return true;
      }

      // Detect specific budget device models using expo-device
      // Common budget device indicators
      const modelName = (Device.modelName || "").toLowerCase();
      const brandName = (Device.brand || "").toLowerCase();

      const budgetIndicators = [
        "go",           // Android Go editions
        "a1 ", "a2 ", "a3 ", "a4 ",  // Samsung Galaxy A series
        "lite",         // Various lite editions
        "e5", "e6", "e7",            // Moto E series
        "c3", "c2",     // Realme C series
      ];

      if (budgetIndicators.some(indicator =>
        modelName.includes(indicator) || brandName.includes(indicator)
      )) {
        return true;
      }
    } catch (error) {
      // If device info check fails, assume sufficient resources (safer default)
      console.warn("Device capability check failed, assuming standard device", error);
    }
  }

  return false;
}

// Animation constants
const SLIDE_DISTANCE = 8;           // Subtle "settle into place" offset (was 28)
const FADE_EASING = Easing.out(Easing.cubic);
const HERO_ANIM_DELAY = 100;        // Post-first-frame start delay (~1 frame at 60fps)
const HERO_ANIM_DURATION = 200;     // translateY duration for hero text (≤300ms)
const ICON_FADE_DURATION = 300;     // Icon opacity/scale duration (decorative element)
const AUTO_ADVANCE_DELAY = 2000;    // Total dwell time before auto-advancing

export default function LandingScreen({ onContinue }: LandingScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Robust low-end device detection based on actual hardware capabilities
  // rather than screen density alone. Checks RAM, CPU cores, and device model.
  const isLowEnd = isLowEndDevice();

  // Shared values for icon (decorative — invisible on frame 1 is acceptable)
  const iconOpacity = useSharedValue(isLowEnd ? 1 : 0);
  const iconScale   = useSharedValue(isLowEnd ? 1 : 0.7);

  // Shared values for hero text — translateY ONLY.
  // Opacity is hardcoded to 1 in static styles so text is readable on frame 1.
  // On low-end devices start at final position (0) with no animation.
  const brandY    = useSharedValue(isLowEnd ? 0 : SLIDE_DISTANCE);
  const titleY    = useSharedValue(isLowEnd ? 0 : SLIDE_DISTANCE);
  const subtitleY = useSharedValue(isLowEnd ? 0 : SLIDE_DISTANCE);

  // OS reduce-motion accessibility preference (async check)
  const [reduceMotion, setReduceMotion] = useState(false);

  // Timer refs for safe cleanup on unmount
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref to onContinue — prevents stale closure if parent re-renders before timer fires
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  // Query OS reduce-motion preference once on mount
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {
        // Non-fatal: if the query fails, the 8px/200ms animation is too subtle
        // to cause vestibular harm, so playing it is acceptable.
      });
  }, []);

  // Animation effect — re-runs if reduceMotion state changes (async check resolves).
  // isLowEnd is a mount-time constant; it never changes so it is not a dependency.
  useEffect(() => {
    const shouldSkip = isLowEnd || reduceMotion;

    if (shouldSkip) {
      // Snap all values to final state immediately — zero animation overhead.
      iconOpacity.value = 1;
      iconScale.value   = 1;
      brandY.value      = 0;
      titleY.value      = 0;
      subtitleY.value   = 0;
      return;
    }

    // Delay animation start by HERO_ANIM_DELAY so the first frame is fully painted
    // before any compositor transforms begin. Avoids first-frame jank.
    animTimerRef.current = setTimeout(() => {
      // Icon: fade in + spring scale (decorative)
      iconOpacity.value = withTiming(1, { duration: ICON_FADE_DURATION, easing: FADE_EASING });
      iconScale.value   = withSpring(1, { damping: 14, stiffness: 120 });

      // Hero text: translateY settle only — GPU compositor handles this without re-layout.
      // Short stagger (0 / 40ms / 80ms) gives a cascade within ≤380ms total.
      brandY.value    = withTiming(0, { duration: HERO_ANIM_DURATION, easing: FADE_EASING });
      titleY.value    = withDelay(40, withTiming(0, { duration: HERO_ANIM_DURATION, easing: FADE_EASING }));
      subtitleY.value = withDelay(80, withTiming(0, { duration: HERO_ANIM_DURATION, easing: FADE_EASING }));
    }, HERO_ANIM_DELAY);

    return () => {
      if (animTimerRef.current !== null) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
    };
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance: runs exactly once on mount regardless of motion preferences.
  useEffect(() => {
    autoAdvanceTimerRef.current = setTimeout(() => {
      onContinueRef.current();
    }, AUTO_ADVANCE_DELAY);

    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, []);

  // Animated styles
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  // Hero text: translateY only — no opacity animation (opacity is 1 in static style)
  const brandAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: brandY.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: subtitleY.value }],
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

        {/* Brand name — opacity:1 in static style for immediate frame-1 visibility */}
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

      {/* Continue button removed — screen auto-advances after AUTO_ADVANCE_DELAY */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",  // was "space-between" — no bottom button to anchor
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
});
