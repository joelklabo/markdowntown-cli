'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { TextArea } from '@/components/ui/TextArea';
import { Text } from '@/components/ui/Text';
import { emitCityWordmarkEvent } from '@/components/wordmark/sim/bridge';

interface TranslateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
}

export function TranslateInput({ value, onChange, disabled, helperText }: TranslateInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const helperTextId = helperText ? "translate-input-helper" : undefined;
  const tipId = "translate-input-tip";
  const describedBy = helperTextId ? `${helperTextId} ${tipId}` : tipId;

  const readFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      setFileName(file.name);
      onChange(text);
      emitCityWordmarkEvent({ type: 'upload', kind: 'file' });
    },
    [onChange]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      await readFile(file);
    },
    [readFile]
  );

  return (
    <Surface padding="lg" className="flex h-full flex-col gap-mdt-4">
      <div className="flex flex-wrap items-center justify-between gap-mdt-3">
        <div className="space-y-mdt-1">
          <Text as="label" htmlFor="translate-input-content" size="caption" tone="muted">
            Step 2 · Input
          </Text>
          <Text size="bodySm" tone="muted">
            Paste your instructions or drop a file. We detect Markdown vs UAM JSON automatically, then compile files you can
            take into Workbench.
          </Text>
        </div>
        <div className="flex items-center gap-mdt-2">
          {fileName && (
            <Text size="caption" tone="muted" className="max-w-[220px] truncate">
              {fileName}
            </Text>
          )}
          <label htmlFor="translate-input-file" className="sr-only">
            Upload a file
          </label>
          <input
            ref={fileInputRef}
            id="translate-input-file"
            name="translateInputFile"
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await readFile(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Choose file
          </Button>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-mdt-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <TextArea
          id="translate-input-content"
          name="translateInputContent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[320px] flex-1 font-mono text-body-sm resize-none"
          placeholder="Paste Markdown or UAM v1 JSON…"
          aria-describedby={describedBy}
          disabled={disabled}
        />
        <div className="space-y-mdt-1">
          {helperText && (
            <Text id={helperTextId} size="caption" tone="muted">
              {helperText}
            </Text>
          )}
          <Text id={tipId} size="caption" tone="muted">
            Tip: drop a single file here to replace the input.
          </Text>
        </div>
      </div>
    </Surface>
  );
}
