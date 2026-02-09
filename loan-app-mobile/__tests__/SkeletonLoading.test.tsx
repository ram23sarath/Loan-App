/// <reference types="jest" />
import React from "react";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import SkeletonLoading from "../components/SkeletonLoading";

describe("SkeletonLoading", () => {
  it("renders correctly", () => {
    const { toJSON } = render(<SkeletonLoading />);
    expect(toJSON()).toMatchSnapshot();
  });

  describe("Core Skeleton Elements", () => {
    it("should render the main skeleton container with correct test ID", () => {
      const { getByTestId } = render(<SkeletonLoading />);
      const container = getByTestId("skeleton-loading-container");
      expect(container).toBeOnTheScreen();
    });

    it("should render header skeleton with all sub-elements", () => {
      const { getByTestId } = render(<SkeletonLoading />);

      const header = getByTestId("skeleton-header");
      expect(header).toBeOnTheScreen();

      const avatar = getByTestId("skeleton-header-avatar");
      expect(avatar).toBeOnTheScreen();

      const headerText = getByTestId("skeleton-header-text");
      expect(headerText).toBeOnTheScreen();

      const headerLine1 = getByTestId("skeleton-header-line-1");
      expect(headerLine1).toBeOnTheScreen();

      const headerLine2 = getByTestId("skeleton-header-line-2");
      expect(headerLine2).toBeOnTheScreen();
    });

    it("should render hero card skeleton", () => {
      const { getByTestId } = render(<SkeletonLoading />);
      const heroCard = getByTestId("skeleton-hero-card");
      expect(heroCard).toBeOnTheScreen();
    });

    it("should render list container with header and 3 list items", () => {
      const { getByTestId } = render(<SkeletonLoading />);

      const listContainer = getByTestId("skeleton-list-container");
      expect(listContainer).toBeOnTheScreen();

      const listHeader = getByTestId("skeleton-list-header");
      expect(listHeader).toBeOnTheScreen();

      // Verify 3 list items and their sub-elements exist
      for (let i = 1; i <= 3; i++) {
        const listItem = getByTestId(`skeleton-list-item-${i}`);
        expect(listItem).toBeOnTheScreen();

        const icon = getByTestId(`skeleton-list-item-${i}-icon`);
        expect(icon).toBeOnTheScreen();

        const text = getByTestId(`skeleton-list-item-${i}-text`);
        expect(text).toBeOnTheScreen();

        const line1 = getByTestId(`skeleton-list-item-${i}-line-1`);
        expect(line1).toBeOnTheScreen();

        const line2 = getByTestId(`skeleton-list-item-${i}-line-2`);
        expect(line2).toBeOnTheScreen();
      }
    });
  });

  describe("Accessibility", () => {
    it("should have aria-hidden set to true on main container", () => {
      const { getByTestId } = render(<SkeletonLoading />);
      const container = getByTestId("skeleton-loading-container");
      const ariaHidden = container.props["aria-hidden"];
      expect(ariaHidden).toBe(true);
    });

    it("should have importantForAccessibility set to no-hide-descendants", () => {
      const { getByTestId } = render(<SkeletonLoading />);
      const container = getByTestId("skeleton-loading-container");
      const importantForAccessibility =
        container.props.importantForAccessibility;
      expect(importantForAccessibility).toBe("no-hide-descendants");
    });

    it("should have pointerEvents set to none to prevent interaction", () => {
      const { getByTestId } = render(<SkeletonLoading />);
      const container = getByTestId("skeleton-loading-container");
      const pointerEvents = container.props.pointerEvents;
      expect(pointerEvents).toBe("none");
    });
  });

  describe("Element Structure and Layout", () => {
    it("header should contain both avatar and text elements in row layout", () => {
      const { getByTestId } = render(<SkeletonLoading />);
      const header = getByTestId("skeleton-header");
      const headerProps = header.props;

      // Verify flex direction for row layout by flattening the style
      const flattenedStyle = StyleSheet.flatten(headerProps.style);
      expect(flattenedStyle).toHaveProperty("flexDirection", "row");
    });

    it("each list item should have icon and text elements in row layout", () => {
      const { getByTestId } = render(<SkeletonLoading />);

      for (let i = 1; i <= 3; i++) {
        const listItem = getByTestId(`skeleton-list-item-${i}`);
        const listItemProps = listItem.props;

        // Verify flex direction for row layout by flattening the style
        const flattenedStyle = StyleSheet.flatten(listItemProps.style);
        expect(flattenedStyle).toHaveProperty("flexDirection", "row");
      }
    });
  });
});
