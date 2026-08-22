import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PositionControls } from "./PositionControls";

test("renders the standalone FEN form directly", () => {
  const onSubmit = vi.fn((event) => event.preventDefault());
  render(
    <PositionControls
      fenDraft="example fen"
      error={null}
      onDraftChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole("region", { name: "Position" })).toBeVisible();
  expect(screen.getByLabelText("FEN")).toHaveValue("example fen");
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  expect(onSubmit).toHaveBeenCalledOnce();
});

test("collapses game-mode FEN setup and explains its effect", () => {
  render(
    <PositionControls
      fenDraft="example fen"
      error={null}
      collapsedForGame
      onDraftChange={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.queryByLabelText("FEN")).not.toBeVisible();
  fireEvent.click(screen.getByText("Load a standalone FEN"));
  expect(screen.getByText("A valid FEN leaves game review.")).toBeVisible();
  expect(screen.getByLabelText("FEN")).toBeVisible();
});

test("opens the game-mode disclosure to keep a FEN error visible", () => {
  render(
    <PositionControls
      fenDraft="not a fen"
      error="Invalid FEN"
      collapsedForGame
      onDraftChange={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Invalid FEN");
  expect(screen.getByLabelText("FEN")).toBeVisible();
});
