import React, { useEffect } from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { lightTheme, darkTheme } from "../config/theme";

/**
 * Skeleton Loading Component
 *
 * A native skeleton loader that mimics the structure of the dashboard
 * (Header, Hero Card, List Items) to provide a smoother loading experience.
 */
export default function SkeletonLoading() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.3, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const bgStyle = isDark ? styles.skeletonDark : styles.skeletonLight;
  const containerStyle = isDark ? styles.containerDark : styles.containerLight;

  return (
    <View
      testID="skeleton-loading-container"
      style={[styles.container, containerStyle]}
      pointerEvents="none"
      // @ts-ignore: Web-only prop for stability checks
      className="skeleton--nonblocking"
      // @ts-ignore: Web/Accessibility prop
      aria-hidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[animatedStyle, { flex: 1 }]}>
        {/* Header Skeleton */}
        <View style={styles.header} testID="skeleton-header">
          <View
            style={[styles.avatar, bgStyle]}
            testID="skeleton-header-avatar"
          />
          <View style={styles.headerText} testID="skeleton-header-text">
            <View
              style={[styles.textLine, styles.w40, bgStyle]}
              testID="skeleton-header-line-1"
            />
            <View
              style={[styles.textLine, styles.w60, styles.mt2, bgStyle]}
              testID="skeleton-header-line-2"
            />
          </View>
        </View>

        {/* Hero Card Skeleton */}
        <View style={[styles.heroCard, bgStyle]} testID="skeleton-hero-card" />

        {/* List Items Skeleton */}
        <View style={styles.listContainer} testID="skeleton-list-container">
          <View
            style={[styles.listHeader, bgStyle]}
            testID="skeleton-list-header"
          />
          {[1, 2, 3].map((key) => (
            <View
              key={key}
              style={styles.listItem}
              testID={`skeleton-list-item-${key}`}
            >
              <View
                style={[styles.icon, bgStyle]}
                testID={`skeleton-list-item-${key}-icon`}
              />
              <View
                style={styles.itemText}
                testID={`skeleton-list-item-${key}-text`}
              >
                <View
                  style={[styles.textLine, styles.w70, bgStyle]}
                  testID={`skeleton-list-item-${key}-line-1`}
                />
                <View
                  style={[styles.textLine, styles.w40, styles.mt2, bgStyle]}
                  testID={`skeleton-list-item-${key}-line-2`}
                />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    marginTop: 20,
  },
  containerLight: {
    backgroundColor: lightTheme.primaryBg,
  },
  containerDark: {
    backgroundColor: darkTheme.primaryBg,
  },
  skeletonLight: {
    backgroundColor: lightTheme.skeleton,
  },
  skeletonDark: {
    backgroundColor: darkTheme.skeleton,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  // Hero Card
  heroCard: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    marginBottom: 30,
  },
  // List
  listContainer: {
    flex: 1,
  },
  listHeader: {
    width: 120,
    height: 20,
    borderRadius: 4,
    marginBottom: 20,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 15,
  },
  itemText: {
    flex: 1,
  },
  // Utilities
  textLine: {
    height: 12,
    borderRadius: 6,
  },
  w40: { width: "40%" },
  w60: { width: "60%" },
  w70: { width: "70%" },
  mt2: { marginTop: 8 },
});
