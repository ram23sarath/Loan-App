// Jest setup file
// This file runs before each test file and ensures all Jest globals are available

// Import Testing Library matchers for React Native (guarded)
try {
  require('@testing-library/jest-native/extend-expect');
} catch (err) {
  // If the package isn't installed in this environment, skip extending matchers.
}

// Mock react-native-reanimated globally for all tests
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

