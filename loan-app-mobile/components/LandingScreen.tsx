import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
} from "react-native";

interface LandingScreenProps {
  onContinue: () => void;
}

export default function LandingScreen({ onContinue }: LandingScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.brandingBlock}>
        <Text style={[styles.brandName, isDark && styles.textDark]}>I J Reddy</Text>
        <Text style={[styles.title, isDark && styles.textDark]}>Loan App</Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Fast, simple loan management.
        </Text>
      </View>

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
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
    backgroundColor: "#F8FAFC",
  },
  containerDark: {
    backgroundColor: "#0F172A",
  },
  brandingBlock: {
    marginTop: 80,
    gap: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 40,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
    marginTop: 4,
  },
  subtitleDark: {
    color: "#94A3B8",
  },
  textDark: {
    color: "#E2E8F0",
  },
  ctaButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
