import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tick } from 'svelte';
import Modal from '../src/components/Modal.svelte';
import type { DictionaryResponse } from '../src/lib/explanation/types';

describe('Modal Component', () => {
  beforeEach(() => {
    if (!Range.prototype.getBoundingClientRect) {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        value: () =>
          ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 10,
            bottom: 10,
            width: 10,
            height: 10,
            toJSON: () => '',
          }) as DOMRect,
        configurable: true,
      });
    }
  });

  const mockResult: DictionaryResponse = {
    word: 'eschew',
    simple_definition: 'avoid',
    detailed_explanation: '...',
    in_chinese: '避开',
  };

  it('should render brand and word info', () => {
    render(Modal, { result: mockResult });
    expect(screen.getByText(/memit/i)).toBeInTheDocument();
    expect(screen.getByText('eschew')).toBeInTheDocument();
  });

  it('should render close button and call onClose when clicked', async () => {
    const onClose = vi.fn();
    render(Modal, { result: mockResult, onClose });

    // Selecting by title because there are multiple buttons and title is unique for "Close"
    const closeButton = screen.getByTitle(/Close/i);
    expect(closeButton).toBeInTheDocument();

    await fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onSave when save button is clicked', async () => {
    const onSave = vi.fn();
    render(Modal, { result: mockResult, onSave });

    const saveButton = screen.getByTitle(/Save to Anki/i);
    expect(saveButton).toBeInTheDocument();

    await fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalled();
  });

  it('should render loading state', () => {
    const { container } = render(Modal, { isLoading: true });
    expect(screen.queryByText('eschew')).not.toBeInTheDocument();
    expect(container.querySelector('.skeleton-container')).toBeInTheDocument();
  });

  it('highlights the current selection', async () => {
    vi.useFakeTimers();
    try {
      render(Modal, { result: mockResult });
      const dialog = screen.getByRole('dialog');

      const paragraph = document.createElement('p');
      paragraph.textContent = 'alpha beta gamma delta';
      dialog.appendChild(paragraph);

      const textNode = paragraph.firstChild as Text;

      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 10);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));

      await vi.runAllTimersAsync();
      await tick();

      const highlightButton = await screen.findByTitle('Highlight');
      await fireEvent.click(highlightButton);

      const highlights = dialog.querySelectorAll('.highlight');
      expect(highlights.length).toBe(1);
      expect(highlights[0].textContent).toBe('beta');
    } finally {
      vi.useRealTimers();
    }
  });
});
