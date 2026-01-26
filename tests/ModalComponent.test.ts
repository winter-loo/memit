import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Modal from '../src/components/Modal.svelte';
import type { DictionaryResponse } from '../src/lib/explanation/types';

describe('Modal Component', () => {
  const mockResult: DictionaryResponse = {
    word: 'eschew',
    simple_definition: 'avoid',
    detailed_explanation: '...',
    in_chinese: '避开'
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
});