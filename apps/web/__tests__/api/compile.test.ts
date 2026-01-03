import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/compile/route';
import { resetRateLimitStore } from '@/lib/rateLimiter';

describe('POST /api/compile', () => {
  beforeEach(() => resetRateLimitStore());

  it('returns compiled files for valid payload', async () => {
    const payload = {
      uam: {
        schemaVersion: 1,
        meta: { title: 'Test' },
        scopes: [{ id: 'global', kind: 'global' }],
        blocks: [{ id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Do this.' }],
      },
      targets: [{ targetId: 'agents-md' }, { targetId: 'github-copilot' }],
    };

    const req = new Request('http://localhost/api/compile', {
      method: 'POST',
      headers: { 'x-forwarded-for': 'ip1' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.files.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining(['AGENTS.md', '.github/copilot-instructions.md'])
    );
  });

  it('returns 400 for invalid payload', async () => {
    const payload = { uam: { schemaVersion: 1 }, targets: [] };
    const req = new Request('http://localhost/api/compile', {
      method: 'POST',
      headers: { 'x-forwarded-for': 'ip2' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
  });

  it('returns 429 when rate-limited', async () => {
    const payload = {
      uam: { schemaVersion: 1, meta: { title: 'Test' }, scopes: [], blocks: [] },
      targets: [{ targetId: 'agents-md' }],
    };

    for (let i = 0; i < 30; i++) {
      const req = new Request('http://localhost/api/compile', {
        method: 'POST',
        headers: { 'x-forwarded-for': 'ip3' },
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    const req = new Request('http://localhost/api/compile', {
      method: 'POST',
      headers: { 'x-forwarded-for': 'ip3' },
      body: JSON.stringify(payload),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});

