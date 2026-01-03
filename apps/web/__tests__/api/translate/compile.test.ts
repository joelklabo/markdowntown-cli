import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/translate/compile/route';

describe('POST /api/translate/compile', () => {
  it('returns compiled files for valid payload', async () => {
    const payload = {
      definition: {
        kind: 'UniversalAgent',
        apiVersion: 'v1',
        metadata: { name: 'Test', version: '1' },
        blocks: [{ id: 'b1', type: 'instruction', content: 'Do this.' }],
      },
      targets: ['agents-md'],
    };

    const req = new Request('http://localhost/api/translate/compile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.files).toHaveLength(1);
    expect(json.files[0].path).toBe('AGENTS.md');
  });

  it('returns 400 for invalid payload', async () => {
    const payload = {
      definition: { invalid: 'data' },
      targets: [],
    };

    const req = new Request('http://localhost/api/translate/compile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    
    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
  });

  it('returns 400 for unknown target selection', async () => {
    const payload = {
      definition: {
        kind: 'UniversalAgent',
        apiVersion: 'v1',
        metadata: { name: 'Test', version: '1' },
        blocks: [{ id: 'b1', type: 'instruction', content: 'Do this.' }],
      },
      targets: ['unknown-target'],
    };

    const req = new Request('http://localhost/api/translate/compile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Unknown target selection');
    expect(json.invalidTargets).toContain('unknown-target');
  });

  it('returns 400 when no valid targets are selected', async () => {
    const payload = {
      definition: {
        kind: 'UniversalAgent',
        apiVersion: 'v1',
        metadata: { name: 'Test', version: '1' },
        blocks: [{ id: 'b1', type: 'instruction', content: 'Do this.' }],
      },
      targets: [],
    };

    const req = new Request('http://localhost/api/translate/compile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('No valid targets selected');
  });

  it('returns 413 for oversized payloads', async () => {
    const payload = {
      definition: {
        kind: 'UniversalAgent',
        apiVersion: 'v1',
        metadata: { name: 'Test', version: '1' },
        blocks: [{ id: 'b1', type: 'instruction', content: 'a'.repeat(260000) }],
      },
      targets: ['agents-md'],
    };

    const req = new Request('http://localhost/api/translate/compile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);

    const json = await res.json();
    expect(json.error).toContain('Payload too large');
  });
});
