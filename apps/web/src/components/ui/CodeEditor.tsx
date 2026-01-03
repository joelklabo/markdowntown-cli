'use client';

import React from 'react';
import { TextArea, type TextAreaProps } from '@/components/ui/TextArea';
import { cn } from '@/lib/cn';

export type CodeEditorProps = TextAreaProps;

export function CodeEditor({ className, ...props }: CodeEditorProps) {
  return (
    <TextArea
      {...props}
      className={cn(
        'font-mono text-body-sm leading-relaxed border-mdt-border bg-mdt-surface-subtle',
        className
      )}
    />
  );
}

