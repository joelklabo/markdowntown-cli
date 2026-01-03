import { describe, it, expect } from 'vitest';
import { createZip } from '@/lib/uam/compile/zip';
import { CompiledFile } from '@/lib/uam/adapters';
import JSZip from 'jszip';

describe('Zip Generation', () => {
  it('creates a valid zip file from compiled files', async () => {
    const files: CompiledFile[] = [
      { path: 'test.md', content: 'Hello' },
      { path: 'src/code.ts', content: 'console.log("hi")' },
    ];

    const blob = await createZip(files);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);

    // Verify content by unzipping
    const zip = await JSZip.loadAsync(blob);
    
    // Check file existence
    expect(Object.keys(zip.files).length).toBeGreaterThanOrEqual(2);
    expect(zip.file('test.md')).not.toBeNull();
    expect(zip.file('src/code.ts')).not.toBeNull();

    // Check content
    const content1 = await zip.file('test.md')?.async('string');
    const content2 = await zip.file('src/code.ts')?.async('string');
    
    expect(content1).toBe('Hello');
    expect(content2).toBe('console.log("hi")');
  });
});
