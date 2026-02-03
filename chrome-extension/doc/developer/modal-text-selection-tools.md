# Modal Text Selection Tools

## The Feature

Users can now select text _inside_ the explanation modal to reveal a floating tool menu with two actions:

1.  **Explain**: Triggers a new AI explanation for the selected text (nested lookup).
2.  **Highlight**: Accents the selection with the primary brand color and an underline.

## Implementation Details

### `SelectionToolbar.svelte`

A lightweight, fixed-position component that appears near the selected text. It uses Svelte's `fade` transition for a smooth entrance.

### Selection Detection (`Modal.svelte`)

We listen to `selectionchange` on `document` and validate the selection against the modal container.

- **`window.getSelection()`**: Used to retrieve the selected string and its bounding rectangle.
- **Positioning**: The menu is positioned above the selection using the range bounding rect.
- **Cleanup**: The menu closes when the selection collapses or moves outside the modal.

### Highlighting in Shadow DOM

Since the modal content is rendered inside a Shadow DOM, we use the standard DOM `Range` API to perform the highlighting:

- **`range.surroundContents()`**: Wraps the selected text in a `<span class="highlight">` when possible.
- **CSS Isolation**: The `.highlight` class is defined in `src/app.css` and injected into the Shadow Root, ensuring consistent styling that is isolated from the host website.

### Highlight Merge Strategy

If the user selects text that intersects an existing highlight, we merge the new selection with the old highlight instead of replacing it:

1. Collect intersecting highlight spans and build a combined boundary range.
2. Insert stable marker nodes at the start/end boundaries.
3. Unwrap intersecting highlight spans (mutating the DOM).
4. Rebuild a fresh range between the markers and apply the new highlight.

This avoids stale `Range` objects after DOM changes and allows the highlight to expand cleanly.

### Nested Explanations

When "Explain" is clicked, we call `onNewQuery`. This updates the primary text and triggers a new AI request while keeping the existing model and API key state intact.

## Considerations

- **Boundary Crossings**: `surroundContents()` can fail if a selection spans multiple element boundaries (e.g., across two paragraphs). In such cases, we fall back to extracting the contents and inserting a wrapper span.
- **Z-Index**: The tool menu uses a high z-index within the modal container's coordinate space to ensure it always floats above the content.
