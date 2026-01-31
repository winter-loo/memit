# next ideas

- when switch to another model, keep an eye on the previous model request. Use the earliest response
  from any on-wire requests.

- select any text in the modal pops up a tool menu including: explain, highlight
  - when click the 'explain' tool, a new modal pops up used to explaining the new selection
  - when click the 'highlight' tool, the selection is accented by the primary color(and underline).
  - use the latest css property:
    ```css
    corner-shape: bevel round;
    border-radius: 1em 0 / 3em 0;
    ```

- add a 'retry' icon button in the primary section so that a user can click it to trigger a
  re-explanation when the user is not satisfying with the current explanation. Use an emoji icon.

- for this type of page, we need OCR to extract text
  https://app.smarterhumans.ai/library/4d898e99-0ac5-4fca-94fb-cc6551b11cb5/document

- Image generation. When it worths explaining the text with an engaging image, then generate an image for it.
  For example, the image for text: `racking up a massive bill`: ![racking up a massive bill](./racking_up_a_massive_bill.jpeg)
