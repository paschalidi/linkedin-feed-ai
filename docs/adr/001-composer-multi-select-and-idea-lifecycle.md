# ADR 001: Composer Multi-Select and Idea Lifecycle

## Status

Accepted

## Context

The composer page (`/compose`) originally used `@base-ui/react/select` dropdowns for both idea and style selection. Several issues emerged:

1. **UUID leakage**: `SelectValue` displayed the raw `value` prop (UUID) instead of the human-readable label because `@base-ui/react/select`'s `ItemText` could not resolve complex nested DOM children (`div > span`) into display text for the trigger.

2. **Narrow dropdowns**: The trigger was constrained to `w-fit` by default, making long idea titles unreadable.

3. **Single-idea limitation**: Users could only pick one idea per generation, but in practice they wanted to blend multiple topics (e.g., "AI in recruiting" + "remote work trends") into a single cohesive LinkedIn post.

4. **Idea disappearance**: After generation, the idea was marked `used` and vanished from the composer entirely. Users wanted to keep ideas around for reuse with different styles or tweaks.

The Ideas page only showed `draft` ideas; there was no visibility into `used` or `archived` states.

## Decision

We decided to:

1. **Replace the idea dropdown with a full-width, scrollable multi-select checkbox list.**
   - A new client component `IdeaMultiSelect` renders each idea as a card with a checkbox, title, and optional description.
   - The list is `w-full` and `max-h-[320px]` so long titles are always visible.
   - Multiple `idea_ids` are submitted as `FormData` via native `input[type="checkbox"] name="idea_ids"`.

2. **Keep style selection as a single-select dropdown.**
   - Writing voice should be consistent within a single post. Mixing multiple styles would create a disjointed tone.
   - The style dropdown now uses `w-full` so the selected style name is fully visible.

3. **Support multi-idea post generation.**
   - `composePost` reads `formData.getAll("idea_ids")` instead of a single `idea_id`.
   - Selected idea titles are joined with `" + "` to form the primary topic string.
   - Descriptions are joined with `"\n\n"`.
   - The combined text is embedded for semantic article retrieval, then passed to the LLM as a single blended prompt.
   - The generated post links to the first selected idea as the primary `ideaId` (database foreign key constraint).

4. **Restore and formalise the idea status lifecycle.**
   - After generation, all selected ideas are marked `used` via `updateMany`.
   - `getIdeasForCompose` returns both `draft` and `used` ideas, so the composer always has a full inventory.
   - The Ideas page now has three tabs: **Draft**, **Used**, **Archived**.
   - A `reuseIdea` server action sets `status: "draft"`, making a used idea available again.
   - Archiving still sets `status: "archived"`.

## Consequences

### Positive

- Users can blend topics, leading to richer, more nuanced posts that connect multiple themes.
- Idea titles are always readable (full-width list vs. narrow dropdown).
- Ideas are no longer "consumed" and lost; the full lifecycle (draft → used → archived → draft) supports iterative content creation.
- The checkbox list avoids the `@base-ui/react/select` `SelectValue` rendering bug entirely.

### Negative / Trade-offs

- **Blended retrieval quality**: Vector search uses the concatenated text of all selected ideas. If two ideas are semantically distant, the query embedding sits somewhere in between in vector space, potentially pulling articles that are only weakly relevant to either topic. In practice this is acceptable because the LLM prompt explicitly lists both ideas and asks for synthesis.
- **Database schema unchanged**: We still store a single `ideaId` on `GeneratedPost` (the first selected idea). A truly multi-idea post would need a join table (`GeneratedPostIdeas`). We accepted this denormalisation because the primary purpose of `ideaId` is traceability, not analytics.
- **Client component required**: `IdeaMultiSelect` must be `"use client"` because form state (checked checkboxes) lives in React state. This slightly increases client bundle size.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Fix `SelectValue` with Base UI render prop | Base UI's `SelectValue` children-as-function pattern works, but the dropdown is still single-select and narrow. Would not solve the multi-idea requirement. |
| Use a multi-select dropdown (Radix `Select` with `multiple`) | Radix and Base UI do not natively support multi-select. Would require building a combobox from scratch, which is more complexity than a checkbox list. |
| Tag-based selection (chips) | Nice UX, but requires a full combobox with autocomplete. Overkill for the current idea count (typically < 50). |
| Add a `generatedPosts` relation array to `DailyIdea` instead of `ideaId` on `GeneratedPost` | Would require a schema migration and a join table. Deferred until we need true many-to-many analytics. |
| Keep ideas as always `draft`, never mark `used` | Would cause the Ideas list to grow indefinitely with no distinction between "not yet tried" and "already generated". The tabbed lifecycle solves this cleanly. |

## Related Files

- `app/(app)/compose/page.tsx` — composer layout
- `app/(app)/compose/idea-multi-select.tsx` — new client component
- `app/(app)/compose/actions.ts` — `composePost`, `retrieveRelevantArticles`
- `app/(app)/ideas/page.tsx` — tabbed ideas list
- `app/(app)/ideas/actions.ts` — `reuseIdea`, `archiveIdea`

## Date

2026-05-29
