import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ExplanationResult from '../src/components/ExplanationResult.svelte';
import type { DictionaryResponse } from '../src/lib/explanation/types';

describe('ExplanationResult Component', () => {
  const mockResult: DictionaryResponse = {
    word: 'eschew',
    simple_definition: 'avoid',
    detailed_explanation: 'To deliberately avoid...',
    in_chinese: '避开',
    part_of_speech: 'verb',
    examples: ['They eschew high-tech gadgets.'],
    ipa_pronunciation: '/esˈCHo͞o/',
  };

  it('should render word and basic info', () => {
    render(ExplanationResult, { result: mockResult });
    expect(screen.getByText('eschew')).toBeInTheDocument();
    expect(screen.getByText('避开')).toBeInTheDocument();
    expect(screen.getByText('avoid')).toBeInTheDocument();
    expect(screen.getByText('/esˈCHo͞o/')).toBeInTheDocument();
  });

  it('should truncate long IPA pronunciation', () => {
    const longIPAResult = {
      ...mockResult,
      ipa_pronunciation:
        'this is a very long ipa pronunciation that exceeds twenty seven characters',
    };
    render(ExplanationResult, { result: longIPAResult });

    // First 17: "this is a very lo"
    // Last 10: "characters"
    // Total: "this is a very lo...characters"
    expect(screen.getByText('this is a very lo...characters')).toBeInTheDocument();
  });

  it('should switch tabs', async () => {
    render(ExplanationResult, { result: mockResult });

    // Default is explanation
    expect(screen.getByText(/Detailed Explanation/i)).toBeInTheDocument();

    // Switch to Usage
    const usageTab = screen.getByRole('button', { name: /Usage/i });
    await fireEvent.click(usageTab);
    expect(screen.getByText(/Example Sentences/i)).toBeInTheDocument();

    // Check for example text (handling split nodes)
    expect(screen.getByText(/They/i)).toBeInTheDocument();
    expect(screen.getByText(/eschew/i, { selector: '.highlight' })).toBeInTheDocument();
    expect(screen.getByText(/high-tech gadgets/i)).toBeInTheDocument();

    // Switch to Origin
    const originTab = screen.getByRole('button', { name: /Origin/i });
    await fireEvent.click(originTab);
    expect(originTab).toHaveClass('active');
  });

  it('should call onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(ExplanationResult, { result: mockResult, onRetry });

    const retryBtn = screen.getByTitle(/Try again/i);
    await fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
