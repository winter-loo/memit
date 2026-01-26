import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Viewer from '../src/Viewer.svelte';

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
        getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      }),
    }),
  }),
  renderTextLayer: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
  GlobalWorkerOptions: {
    workerSrc: '',
  },
}));

describe('PDF Viewer UI', () => {
  it('should render the viewer container', () => {
    render(Viewer);
    const container = screen.getByTestId('pdf-viewer-container');
    expect(container).toBeInTheDocument();
  });

  it('should attempt to load a PDF', async () => {
    const { getDocument } = await import('pdfjs-dist');
    render(Viewer);
    
    await waitFor(() => {
      expect(getDocument).toHaveBeenCalled();
    });
  });

  it('should load PDF from "file" query parameter', async () => {
    const { getDocument } = await import('pdfjs-dist');
    const externalUrl = 'https://example.com/test.pdf';
    
    vi.stubGlobal('location', {
      search: `?file=${externalUrl}`,
      pathname: '/',
      origin: 'http://localhost',
      toString: () => `http://localhost/?file=${externalUrl}`
    });

    render(Viewer);
    
    await waitFor(() => {
      expect(getDocument).toHaveBeenCalledWith(externalUrl);
    });

    vi.unstubAllGlobals();
  });
});