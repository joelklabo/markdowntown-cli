import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TranslateOutput, type TranslateCompileResult } from '@/components/translate/TranslateOutput';
import { createUamTargetV1 } from '@/lib/uam/uamTypes';

describe('TranslateOutput', () => {
  it('renders compiled file list and enables download', () => {
    const result: TranslateCompileResult = {
      files: [{ path: 'AGENTS.md', content: '# Hello' }],
      warnings: [],
      info: [],
    };

    render(
      <TranslateOutput
        targets={[createUamTargetV1('agents-md')]}
        onToggleTarget={vi.fn()}
        onUpdateTarget={vi.fn()}
        onCompile={vi.fn()}
        onDownloadZip={vi.fn()}
        onOpenWorkbench={vi.fn()}
        loading={false}
        error={null}
        detectedLabel="Markdown"
        disabledCompile={false}
        result={result}
      />
    );

    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /download zip/i })).toBeEnabled();
  });

  it('shows Open in Workbench CTA when results are ready', () => {
    const result: TranslateCompileResult = {
      files: [{ path: 'AGENTS.md', content: '# Ready' }],
      warnings: [],
      info: [],
    };

    render(
      <TranslateOutput
        targets={[createUamTargetV1('agents-md')]}
        onToggleTarget={vi.fn()}
        onUpdateTarget={vi.fn()}
        onCompile={vi.fn()}
        onDownloadZip={vi.fn()}
        onOpenWorkbench={vi.fn()}
        loading={false}
        error={null}
        detectedLabel="Markdown"
        disabledCompile={false}
        result={result}
      />
    );

    expect(screen.getByText(/ready for workbench/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in workbench/i })).toBeInTheDocument();
  });

  it('renders error state with retry guidance', () => {
    render(
      <TranslateOutput
        targets={[createUamTargetV1('agents-md')]}
        onToggleTarget={vi.fn()}
        onUpdateTarget={vi.fn()}
        onCompile={vi.fn()}
        onDownloadZip={vi.fn()}
        onOpenWorkbench={vi.fn()}
        loading={false}
        error="Compilation failed"
        detectedLabel="Markdown"
        disabledCompile={false}
        result={null}
      />
    );

    expect(screen.getByText(/compilation failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try compile again/i })).toBeEnabled();
  });
});
