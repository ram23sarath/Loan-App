import React from "react";
import { render } from "@testing-library/react-native";
import LoadingScreen from "../components/LoadingScreen";

// Mock Reanimated
jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

describe("LoadingScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<LoadingScreen />);
    expect(getByText("I J Reddy Loan App")).toBeTruthy();
    expect(getByText("Loading...")).toBeTruthy();
  });

  it("renders with custom message", () => {
    const { getByText, queryByText } = render(
      <LoadingScreen message="Please wait..." />,
    );
    expect(getByText("Please wait...")).toBeTruthy();
    expect(queryByText("Loading...")).toBeNull();
  });
});
