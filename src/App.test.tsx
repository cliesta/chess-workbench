import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";

test("shows that the development environment is ready", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "Chess Workbench" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Development environment ready."),
  ).toBeInTheDocument();
});
