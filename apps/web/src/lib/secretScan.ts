import type { UamV1 } from '@/lib/uam/uamTypes';

export type SecretMatch = {
  type: string;
  label: string;
  match: string;
  redacted: string;
  index: number;
};

export type SecretScanResult = {
  matches: SecretMatch[];
  hasSecrets: boolean;
};

type SecretPattern = {
  type: string;
  label: string;
  regex: RegExp;
};

const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: 'private_key',
    label: 'Private key',
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    type: 'aws_access_key',
    label: 'AWS access key',
    regex: /\b(AKIA|ASIA|A3T[A-Z0-9]|AGPA|AIDA|ANPA|ANVA|AROA|AIPA)[0-9A-Z]{16}\b/g,
  },
  {
    type: 'github_token',
    label: 'GitHub token',
    regex: /\bghp_[A-Za-z0-9]{36,}\b/g,
  },
  {
    type: 'github_pat',
    label: 'GitHub fine-grained token',
    regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  },
  {
    type: 'openai_key',
    label: 'OpenAI API key',
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
  },
  {
    type: 'slack_token',
    label: 'Slack token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    type: 'google_api_key',
    label: 'Google API key',
    regex: /\bAIza[0-9A-Za-z-_]{30,}\b/g,
  },
];

const MAX_MATCHES = 12;

function redact(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '••••';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function scanForSecrets(input: string): SecretScanResult {
  if (!input) return { matches: [], hasSecrets: false };
  const matches: SecretMatch[] = [];
  const seen = new Set<string>();

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(input)) !== null) {
      if (matches.length >= MAX_MATCHES) break;
      const value = match[0];
      if (!value) continue;
      const key = `${pattern.type}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        type: pattern.type,
        label: pattern.label,
        match: value,
        redacted: redact(value),
        index: match.index,
      });
    }
    if (matches.length >= MAX_MATCHES) break;
  }

  return { matches, hasSecrets: matches.length > 0 };
}

export function scanUamForSecrets(uam: UamV1): SecretScanResult {
  const parts: string[] = [];
  if (uam.meta.title) parts.push(uam.meta.title);
  if (uam.meta.description) parts.push(uam.meta.description);

  for (const block of uam.blocks) {
    if (block.title) parts.push(block.title);
    if (block.body) parts.push(block.body);
  }

  for (const capability of uam.capabilities) {
    if (capability.title) parts.push(capability.title);
    if (capability.description) parts.push(capability.description);
    if (capability.params) {
      try {
        parts.push(JSON.stringify(capability.params));
      } catch {
        // ignore non-serializable params
      }
    }
  }

  return scanForSecrets(parts.join('\n'));
}
