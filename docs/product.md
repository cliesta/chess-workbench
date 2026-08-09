# Chess Workbench – Project Outline

**Status:** Draft v1  
**Date:** August 2026  
**Owner:** Personal project  
**Primary driver:** Personal interest as an amateur chess player + deliberate skill development

---

## 1. Vision

Build a focused **chess analysis workbench** that helps an amateur player understand a position more deeply than a raw engine evaluation.

The tool should answer questions like:

- What is actually going on in this position?
- What should I be worried about?
- What opportunities exist?
- Why does the engine like a certain move?

It is **not** trying to be a full Chess.com/Lichess replacement, a database, or a training platform. It is a sharp, personal analysis instrument that prioritises clarity and insight over feature count.

Long-term north star:  
A tool I genuinely prefer to open when I want to understand a position, rather than just seeing “+1.3” and a principal variation.

---

## 2. Personal Goals (Why this project exists)

This project serves two equal purposes:

### A. Useful tool for me as a chess player
I want something that helps me think better about positions I care about (my games, interesting master games, tactical puzzles that went wrong, etc.).

### B. Deliberate skill development
By 2026 I still have a glaring gap in modern web development skills. This project is chosen specifically because it forces progress in:

- Building interactive web applications
- Working with WebAssembly
- Client-side architecture and state
- Deployment of real software
- (Later) Small backend services and LLM integration
- Product thinking and scoping

I will primarily direct an AI coding assistant rather than writing most of the code by hand. The learning will come from architecture decisions, reviewing output, testing as a user, and iterating.

---

## 3. Product Principles

1. **Insight over information**  
   Raw engine output is easy. Turning it into understanding is the actual product.

2. **Client-side first**  
   Heavy analysis (Stockfish) should run in the browser. This keeps costs near zero and works offline after first load.

3. **Progressive capability**  
   Ship a useful core early. Add intelligence in layers.

4. **Cost discipline**  
   Any LLM usage must be controllable, cacheable, and optional. I should never be surprised by a bill.

5. **Personal usefulness > public polish**  
   It needs to be good enough that *I* want to use it. Public sharing is a bonus, not the primary goal.

---

## 4. High-Level Feature Map

### Core (Must exist)
- Load position via FEN (paste or upload)
- Interactive board (drag pieces, play moves)
- Live FEN that stays in sync with the board
- Client-side Stockfish analysis
- Evaluation bar / numerical evaluation
- Principal variation (best line)
- Top alternative moves with evaluations

### Intelligent Observations (High value)
- Hanging / unprotected pieces
- Basic tactical motifs (pins, forks, discovered attacks where detectable)
- King safety indicators
- Pawn structure observations
- Material imbalance summary
- “What just changed?” when moving through a line

### Natural Language Layer (Optional, later)
- On-demand plain-English commentary of the position
- Grounded in engine output + static features (not free hallucination)
- Clear cost controls

### Nice-to-have (Future)
- Save positions / analyses locally
- Simple comparison of two moves
- Opening name detection
- Export of analysis
- Light multi-position study mode

---

## 5. Technical Strategy

### Architecture Philosophy
- **Phase 1–2:** Pure client-side application (static hosting)
- **Phase 3+:** Optional lightweight backend only when LLM or accounts appear

### Recommended Starting Stack
| Layer              | Choice                          | Reason |
|--------------------|----------------------------------|--------|
| Build tool         | Vite                            | Fast, simple, excellent AI support |
| UI framework       | React + TypeScript              | Dominant, well-understood by coding models |
| Board logic        | chess.js or chessops            | Standard, reliable |
| Board UI           | react-chessboard or equivalent  | Good enough and maintained |
| Engine             | Stockfish WASM                  | Strong, runs in browser, zero server cost |
| Styling            | Tailwind CSS                    | Fast to iterate with AI assistance |
| Deployment (early) | Vercel, Cloudflare Pages, or Netlify | Free, simple, perfect for static apps |

### Key Technical Decisions
- Stockfish runs entirely in a Web Worker via WebAssembly.
- No native executable is downloaded or installed.
- All heavy computation stays on the user’s machine in early versions.
- TypeScript is used even though I don’t know it well — the AI will write it, and I will learn by reading and directing.

### LLM Integration (when added)
- Frontend sends structured analysis (eval, PV, detected features) to a small backend/serverless function.
- Backend constructs a constrained prompt and calls the model.
- Results are cached by position hash where possible.
- Free tier is strictly rate-limited.
- “Bring your own API key” option should exist early.

---

## 6. Development Approach

I will not write the majority of the code myself. I will act as:

- Product owner
- Architect
- Reviewer
- End user (chess player)
- Prompt engineer for the coding AI

### Working Method
1. Define a clear milestone with acceptance criteria.
2. Hand a detailed specification to the coding AI.
3. Review the result critically.
4. Test it myself with real positions I care about.
5. Refine and only then move to the next milestone.

This keeps the learning focused on the parts that actually close my skill gaps (system design, web concepts, deployment, evaluation of quality) rather than syntax.

---

## 7. Phased Roadmap

### Phase 1 – Foundation (Core Learning Goal)
**Goal:** A working, deployable analysis board.

- Paste/load FEN
- Interactive board with drag-and-drop
- FEN updates live
- Stockfish WASM integration
- Evaluation + principal variation displayed
- Basic responsive layout
- Deployed to a public URL

**Exit criteria:** I can analyse real positions from my games and the tool feels stable.

### Phase 2 – Workbench Intelligence
**Goal:** Move from “engine frontend” to “useful analysis instrument.”

- Hanging piece detection
- Simple tactical highlights
- Material and basic positional summary
- Clear visual indication of engine’s main concerns
- Improved UX for moving through lines

**Exit criteria:** I regularly choose this tool over a plain engine when I want to understand a position.

### Phase 3 – Natural Language Commentary
**Goal:** Add optional, high-quality explanation.

- Structured data → LLM pipeline
- On-demand commentary button
- Caching + rate limiting
- Bring-your-own-key support
- Cost monitoring

**Exit criteria:** Commentary is grounded, useful, and costs remain predictable.

### Phase 4 – Polish & Personal Workflow (Optional)
- Local saved positions
- Keyboard-driven workflow improvements
- Study / comparison features that I personally want
- Light persistence

---

## 8. Deployment & Cost Strategy

### Early phases (1–2)
- Static hosting only (Vercel / Cloudflare Pages / Netlify)
- Cost: effectively $0

### When LLM is introduced
- Prefer serverless functions first
- Strict rate limits for anonymous use
- Caching by position
- Optional user-provided API keys
- Ads are a possible minor offset later, but not relied upon
- Primary cost control is architectural, not monetisation

Philosophy:  
I should be able to run this for my own use indefinitely at near-zero cost. Public usage must not be able to generate surprise bills.

---

## 9. Success Criteria

The project will be considered successful if most of the following are true:

- I have a live URL I can open and actually use for real analysis.
- I understand the main moving parts of a modern client-side web application.
- I have successfully integrated and communicated with a WebAssembly module.
- I have deployed something myself.
- The tool gives me insights I did not get as easily from existing free tools.
- I can explain the architecture to another programmer.
- (Stretch) Other amateur players find it useful enough to come back.

It does **not** need to become popular or generate revenue to be a success.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|----------|
| Scope creep into a full chess platform | Strict phase gates. Personal usefulness is the filter. |
| AI generates overly complex or opaque code | Demand simple architecture. Review and require explanations. |
| LLM costs spiral | Rate limits + caching + BYOK from the beginning of Phase 3. |
| I stop using it after the novelty wears off | Keep Phase 1 focused on positions from *my* games. |
| Getting stuck on web concepts | Ask for explanations of any generated code I don’t understand. |

---

## 11. Immediate Next Actions

1. Lock the Phase 1 scope (this document).
2. Choose final library decisions for board + Stockfish WASM.
3. Write a detailed technical specification for Milestone 1.
4. Hand that specification to the coding AI.
5. Get a first working board + FEN loop running locally.
6. Deploy the moment it is usable.

---

## Appendix – Design Notes

- Prefer clarity of information hierarchy over visual flash.
- The evaluation and the “what should I pay attention to” section are more important than long lists of engine lines.
- Keyboard usability matters for a tool I will use often.
- Mobile usefulness is secondary but the board should not be broken on a phone.

---

*This is a living document. Update it when major decisions change.*
