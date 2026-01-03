import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readStoredScanContext, useWorkbenchStore } from '../../src/hooks/useWorkbenchStore';

// Mock storage
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

const sessionStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('useWorkbenchStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
  });

  // Helper to reset store state between tests since it's a global singleton
  const resetStore = () => {
    const { resetDraft } = useWorkbenchStore.getState();
    act(() => {
      resetDraft();
    });
  };

  afterEach(() => {
    resetStore();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWorkbenchStore());
    expect(result.current.title).toBe('Untitled Agent');
    expect(result.current.scopes).toContain('root');
    expect(result.current.visibility).toBe('PRIVATE');
  });

  it('should add and remove a block', () => {
    const { result } = renderHook(() => useWorkbenchStore());
    
    let blockId: string;
    act(() => {
      blockId = result.current.addBlock({ kind: 'markdown', body: 'Test content' });
    });

    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.uam.blocks[0].body).toBe('Test content');

    act(() => {
      result.current.removeBlock(blockId);
    });

    expect(result.current.blocks).toHaveLength(0);
  });

  describe('Scan Context Handoff', () => {
    it('should apply scan context and auto-select target', () => {
      const { result } = renderHook(() => useWorkbenchStore());
      
      const context = {
        tool: 'github-copilot' as const,
        cwd: '/Users/test/repo',
        paths: ['AGENTS.md', '.github/copilot-instructions.md'],
      };

      act(() => {
        result.current.applyScanContext(context);
      });

      expect(result.current.scanContext).toEqual({
        tool: 'github-copilot',
        cwd: '/Users/test/repo',
        paths: ['AGENTS.md', '.github/copilot-instructions.md'],
      });

      // Should auto-select github-copilot target
      expect(result.current.uam.targets).toHaveLength(1);
      expect(result.current.uam.targets[0].targetId).toBe('github-copilot');
      
      // Verify persistence to sessionStorage
      const stored = sessionStorageMock.getItem('workbench-scan-context-v1');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!).context).toEqual(expect.objectContaining({
        tool: 'github-copilot'
      }));
    });

    it('should apply scan context for codex-cli', () => {
      const { result } = renderHook(() => useWorkbenchStore());
      
      const context = {
        tool: 'codex-cli' as const,
        cwd: '/Users/test/repo',
        paths: ['AGENTS.md'],
      };

      act(() => {
        result.current.applyScanContext(context);
      });

      expect(result.current.scanContext?.tool).toBe('codex-cli');
      expect(result.current.uam.targets[0].targetId).toBe('agents-md');
    });

    it('should clear scan context and remove auto-added target', () => {
      const { result } = renderHook(() => useWorkbenchStore());
      
      // Apply first
      act(() => {
        result.current.applyScanContext({
          tool: 'github-copilot',
          cwd: '/tmp',
          paths: [],
        });
      });

      expect(result.current.scanContext).not.toBeNull();
      expect(result.current.uam.targets).toHaveLength(1);

      // Clear
      act(() => {
        result.current.clearScanContext();
      });

      expect(result.current.scanContext).toBeNull();
      // Should remove target if it was the only one and matched the tool
      expect(result.current.uam.targets).toHaveLength(0);
      expect(sessionStorageMock.getItem('workbench-scan-context-v1')).toBeNull();
    });

    it('should keep targets when clearing scan context if multiple targets exist', () => {
      const { result } = renderHook(() => useWorkbenchStore());

      act(() => {
        result.current.applyScanContext({
          tool: 'github-copilot',
          cwd: '/tmp',
          paths: [],
        });
      });

      act(() => {
        result.current.toggleTarget('claude-code');
      });

      expect(result.current.uam.targets).toHaveLength(2);

      act(() => {
        result.current.clearScanContext();
      });

      expect(result.current.scanContext).toBeNull();
      expect(result.current.uam.targets).toHaveLength(2);
    });

    it('should normalize paths in scan context', () => {
      const { result } = renderHook(() => useWorkbenchStore());
      
      act(() => {
        result.current.applyScanContext({
          tool: 'codex-cli',
          cwd: './foo//bar/',
          paths: ['./file1.md', 'dir//file2.md'],
        });
      });

      expect(result.current.scanContext).toEqual({
        tool: 'codex-cli',
        cwd: 'foo//bar',
        paths: ['file1.md', 'dir//file2.md'],
      });
    });

    it('reads stored scan context from sessionStorage', () => {
      const stored = {
        version: 1,
        storedAt: Date.now(),
        context: {
          tool: 'github-copilot',
          cwd: '/repo',
          paths: ['AGENTS.md'],
        },
      };
      sessionStorageMock.setItem('workbench-scan-context-v1', JSON.stringify(stored));
      expect(readStoredScanContext()).toEqual(stored.context);
    });

    it('clears invalid stored scan context', () => {
      sessionStorageMock.setItem('workbench-scan-context-v1', '{bad json');
      expect(readStoredScanContext()).toBeNull();
      expect(sessionStorageMock.getItem('workbench-scan-context-v1')).toBeNull();

      sessionStorageMock.setItem('workbench-scan-context-v1', JSON.stringify({ version: 0, context: {} }));
      expect(readStoredScanContext()).toBeNull();
      expect(sessionStorageMock.getItem('workbench-scan-context-v1')).toBeNull();
    });
  });

  describe('Persistence', () => {
    it('should persist uam state to localStorage', () => {
      const { result } = renderHook(() => useWorkbenchStore());
      
      act(() => {
        result.current.setTitle('Persisted Title');
      });

      const stored = JSON.parse(localStorageMock.getItem('workbench-storage') || '{}');
      expect(stored.state.uam.meta.title).toBe('Persisted Title');
    });

    it('should rehydrate from localStorage', () => {
      // Setup initial state in storage
      const initialState = {
        state: {
          uam: {
            schemaVersion: '1.0.0',
            meta: { title: 'Hydrated Title' },
            scopes: [],
            blocks: [],
            capabilities: [],
            targets: [],
          },
          selectedScopeId: 'global',
          visibility: 'PUBLIC',
        },
        version: 2,
      };
      localStorageMock.setItem('workbench-storage', JSON.stringify(initialState));

      // Re-render hook to trigger hydration (simulated by just reading state in this env, 
      // but in real app persist middleware handles init)
      // Since we reset the store in beforeEach, we need to manually trigger hydration or check if it picks up
      
      // Force re-creation of store or just verify that if we *were* to load, it would work.
      // Ideally we'd test `migrate` function directly if exported, but testing via public API:
      
      // Reset store to force read
      useWorkbenchStore.persist.rehydrate();
      
      const { result } = renderHook(() => useWorkbenchStore());
      expect(result.current.title).toBe('Hydrated Title');
      expect(result.current.visibility).toBe('PUBLIC');
    });
  });
});
