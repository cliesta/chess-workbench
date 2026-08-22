import { useState, type FormEvent } from "react";

type PositionControlsProps = {
  fenDraft: string;
  error: string | null;
  collapsedForGame?: boolean;
  onDraftChange: (fen: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PositionControls({
  fenDraft,
  error,
  collapsedForGame = false,
  onDraftChange,
  onSubmit,
}: PositionControlsProps) {
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  const form = (
    <form onSubmit={onSubmit}>
      <label htmlFor="fen-input">FEN</label>
      <input
        id="fen-input"
        type="text"
        value={fenDraft}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? "fen-error" : undefined}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
      />
      {error && (
        <p id="fen-error" className="error-message" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Load position</button>
    </form>
  );

  if (collapsedForGame) {
    return (
      <details
        className="position-controls position-controls-disclosure"
        open={disclosureOpen || error !== null}
        onToggle={(event) => setDisclosureOpen(event.currentTarget.open)}
      >
        <summary>Load a standalone FEN</summary>
        <p className="field-note">A valid FEN leaves game review.</p>
        {form}
      </details>
    );
  }

  return (
    <section className="position-controls" aria-labelledby="position-title">
      <h2 id="position-title">Position</h2>
      {form}
    </section>
  );
}
