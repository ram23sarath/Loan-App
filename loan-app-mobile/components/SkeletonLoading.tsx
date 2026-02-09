import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  useColorScheme,
} from "react-native";
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
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [opacity]);

  const bgStyle = isDark ? styles.skeletonDark : styles.skeletonLight;
  const containerStyle = isDark ? styles.containerDark : styles.containerLight;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <Animated.View style={[styles.avatar, bgStyle, { opacity }]} />
        <View style={styles.headerText}>
          <Animated.View
            style={[styles.textLine, styles.w40, bgStyle, { opacity }]}
          />
          <Animated.View
            style={[
              styles.textLine,
              styles.w60,
              styles.mt2,
              bgStyle,
              { opacity },
            ]}
          />
        </View>
      </View>

      {/* Hero Card Skeleton */}
      <Animated.View style={[styles.heroCard, bgStyle, { opacity }]} />

      {/* List Items Skeleton */}
      <View style={styles.listContainer}>
        <Animated.View style={[styles.listHeader, bgStyle, { opacity }]} />
        {[1, 2, 3].map((key) => (
          <View key={key} style={styles.listItem}>
            <Animated.View style={[styles.icon, bgStyle, { opacity }]} />
            <View style={styles.itemText}>
              <Animated.View
                style={[styles.textLine, styles.w70, bgStyle, { opacity }]}
              />
              <Animated.View
                style={[
                  styles.textLine,
                  styles.w40,
                  styles.mt2,
                  bgStyle,
                  { opacity },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
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
