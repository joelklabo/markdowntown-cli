import { describe, expect, it } from 'vitest';
import { detectTool } from '@/lib/atlas/simulators/detectTool';

describe('atlas/simulators/detectTool', () => {
  it('returns none when no instruction files are present', () => {
    const result = detectTool([]);

    expect(result.tool).toBeNull();
    expect(result.confidence).toBe('none');
    expect(result.candidates).toHaveLength(0);
    expect(result.isMixed).toBe(false);
  });

  it('detects Codex CLI from AGENTS.md', () => {
    const result = detectTool(['AGENTS.md']);

    expect(result.tool).toBe('codex-cli');
    expect(result.confidence).toBe('high');
    expect(result.isMixed).toBe(false);
    expect(result.candidates[0].paths).toContain('AGENTS.md');
  });

  it('normalizes windows paths when detecting tools', () => {
    const result = detectTool(['apps\\AGENTS.md']);

    expect(result.tool).toBe('codex-cli');
    expect(result.candidates[0].paths).toContain('apps/AGENTS.md');
  });

  it('detects Claude Code from CLAUDE.md in nested folders', () => {
    const result = detectTool(['docs/CLAUDE.md']);

    expect(result.tool).toBe('claude-code');
    expect(result.confidence).toBe('high');
    expect(result.candidates[0].paths).toContain('docs/CLAUDE.md');
  });

  it('flags mixed tools when top scores tie', () => {
    const result = detectTool(['AGENTS.md', 'CLAUDE.md']);

    expect(result.tool).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.isMixed).toBe(true);
    expect(result.candidates).toHaveLength(2);
  });

  it('marks mixed tools when unrelated instruction formats appear together', () => {
    const result = detectTool(['AGENTS.md', '.github/instructions/app.instructions.md']);

    expect(result.tool).toBeNull();
    expect(result.isMixed).toBe(true);
    expect(result.matchedTools.sort()).toEqual(['codex-cli', 'github-copilot']);
  });

  it('detects Copilot CLI from .github/agents', () => {
    const result = detectTool(['.github/agents/assistant.md']);

    expect(result.tool).toBe('copilot-cli');
    expect(result.confidence).toBe('high');
    expect(result.candidates[0].paths).toContain('.github/agents/assistant.md');
  });

  it('detects GitHub Copilot from .github/instructions', () => {
    const result = detectTool(['.github/instructions/code.instructions.md']);

    expect(result.tool).toBe('github-copilot');
    expect(result.confidence).toBe('high');
    expect(result.candidates[0].paths).toContain('.github/instructions/code.instructions.md');
  });

  it('detects Cursor from .cursor/rules', () => {
    const result = detectTool(['.cursor/rules/general.mdc']);

    expect(result.tool).toBe('cursor');
    expect(result.confidence).toBe('high');
    expect(result.candidates[0].paths).toContain('.cursor/rules/general.mdc');
  });

  it('detects Cursor from legacy .cursorrules', () => {
    const result = detectTool(['.cursorrules']);

    expect(result.tool).toBe('cursor');
    expect(result.confidence).toBe('high');
    expect(result.candidates[0].paths).toContain('.cursorrules');
  });

  it('treats root copilot instructions as ambiguous', () => {
    const result = detectTool(['.github/copilot-instructions.md']);

    expect(result.tool).toBeNull();
    expect(result.isMixed).toBe(true);
    const tools = result.candidates.map((candidate) => candidate.tool).sort();
    expect(tools).toEqual(['copilot-cli', 'github-copilot']);
  });
});
