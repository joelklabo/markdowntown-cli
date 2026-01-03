'use client';

import React from 'react';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { TextArea } from '@/components/ui/TextArea';
import { cn } from '@/lib/cn';
import { trackSkillWorkbenchEdit } from '@/lib/analytics';

function formatParams(params?: Record<string, unknown>) {
  if (!params || Object.keys(params).length === 0) return '';
  try {
    return JSON.stringify(params, null, 2);
  } catch {
    return '';
  }
}

function parseParams(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (!raw.trim()) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: 'Params must be a JSON object.' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: 'Invalid JSON.' };
  }
}

export function SkillsPanel() {
  const skills = useWorkbenchStore(s => s.skills);
  const selectedSkillId = useWorkbenchStore(s => s.selectedSkillId);
  const addSkill = useWorkbenchStore(s => s.addSkill);
  const updateSkill = useWorkbenchStore(s => s.updateSkill);
  const removeSkill = useWorkbenchStore(s => s.removeSkill);
  const selectSkill = useWorkbenchStore(s => s.selectSkill);

  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? null;

  const [paramsText, setParamsText] = React.useState('');
  const [paramsError, setParamsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setParamsText(formatParams(selectedSkill?.params));
    setParamsError(null);
  }, [selectedSkill?.id, selectedSkill?.params]);

  const handleAdd = () => {
    const id = addSkill({ title: 'New skill' });
    trackSkillWorkbenchEdit({ action: 'add', id });
    selectSkill(id);
  };

  const handleParamsBlur = () => {
    if (!selectedSkill) return;
    const result = parseParams(paramsText);
    if (!result.ok) {
      setParamsError(result.message);
      return;
    }
    setParamsError(null);
    updateSkill(selectedSkill.id, { params: result.value });
    trackSkillWorkbenchEdit({ action: 'update', id: selectedSkill.id, field: 'params' });
  };

  return (
    <div className="flex flex-col gap-mdt-3" data-testid="workbench-skills-panel">
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wider text-mdt-muted">Skills</span>
        <Button size="xs" onClick={handleAdd}>
          + Skill
        </Button>
      </div>
      <Text size="bodySm" tone="muted">
        Capture reusable capabilities that you can export to Codex, Copilot, or Claude.
      </Text>

      <div className="space-y-mdt-2">
        {skills.map((skill) => {
          const selected = skill.id === selectedSkillId;
          const label = skill.title?.trim() || skill.id;
          return (
            <div
              key={skill.id}
              className={cn(
                'group flex items-center gap-mdt-2 rounded-mdt-md border px-mdt-2 py-mdt-2 transition-colors duration-mdt-fast ease-mdt-standard motion-reduce:transition-none',
                selected ? 'border-mdt-primary bg-mdt-primary/10' : 'border-mdt-border bg-mdt-surface hover:border-mdt-primary-soft'
              )}
            >
              <button
                type="button"
                onClick={() => {
                  selectSkill(skill.id);
                  trackSkillWorkbenchEdit({ action: 'select', id: skill.id });
                }}
                className="flex-1 min-w-0 text-left"
                aria-current={selected ? 'true' : undefined}
              >
                <div className="truncate text-body-sm text-mdt-text">{label}</div>
                <div className="text-caption text-mdt-muted font-mono">{skill.id}</div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSkill(skill.id);
                  trackSkillWorkbenchEdit({ action: 'remove', id: skill.id });
                }}
                className="px-mdt-1 text-mdt-muted opacity-0 group-hover:opacity-100 hover:text-mdt-danger"
                aria-label="Remove skill"
              >
                ×
              </button>
            </div>
          );
        })}

        {skills.length === 0 && (
          <div className="rounded-mdt-md border border-dashed border-mdt-border bg-mdt-surface-subtle p-mdt-3 text-body-sm text-mdt-muted">
            <div className="mb-mdt-1 text-body-sm font-semibold text-mdt-text">No skills yet</div>
            <div className="mb-mdt-3">Add a skill capability to make exports more powerful.</div>
            <Button size="xs" onClick={handleAdd}>
              Add a skill
            </Button>
          </div>
        )}
      </div>

      <div className="h-px bg-mdt-border" />

      {selectedSkill ? (
        <div className="space-y-mdt-3">
          <div>
            <Text size="caption" tone="muted">
              Edit skill
            </Text>
          </div>

          <div className="space-y-mdt-2">
            <Text as="label" htmlFor="skill-title" size="caption" tone="muted">
              Title
            </Text>
            <Input
              id="skill-title"
              name="skillTitle"
              value={selectedSkill.title ?? ''}
              onChange={(e) => updateSkill(selectedSkill.id, { title: e.target.value })}
              onBlur={() => trackSkillWorkbenchEdit({ action: 'update', id: selectedSkill.id, field: 'title' })}
              placeholder="Short skill title"
              size="sm"
            />
          </div>

          <div className="space-y-mdt-2">
            <Text as="label" htmlFor="skill-description" size="caption" tone="muted">
              Description
            </Text>
            <TextArea
              id="skill-description"
              name="skillDescription"
              value={selectedSkill.description ?? ''}
              onChange={(e) => updateSkill(selectedSkill.id, { description: e.target.value })}
              onBlur={() => trackSkillWorkbenchEdit({ action: 'update', id: selectedSkill.id, field: 'description' })}
              placeholder="What does this skill do?"
              size="sm"
              rows={3}
            />
          </div>

          <div className="space-y-mdt-2">
            <Text as="label" htmlFor="skill-params" size="caption" tone="muted">
              Params (JSON)
            </Text>
            <TextArea
              id="skill-params"
              name="skillParams"
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              onBlur={handleParamsBlur}
              placeholder='{"tool":"codex-cli"}'
              size="sm"
              rows={4}
              className={cn(paramsError ? 'border-mdt-danger' : '')}
            />
            {paramsError && (
              <Text size="caption" className="text-mdt-danger">
                {paramsError}
              </Text>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-mdt-md border border-dashed border-mdt-border bg-mdt-surface-subtle p-mdt-3 text-body-sm text-mdt-muted">
          Select a skill to edit its details.
        </div>
      )}
    </div>
  );
}
