#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let root = process.cwd();
let showSmokeHints = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--root' && args[i + 1]) {
    root = path.resolve(args[i + 1]);
    i += 1;
  } else if (arg === '--smoke') {
    showSmokeHints = true;
  } else if (arg === '--help') {
    console.log('Usage: node scripts/codex/validate-skills.mjs [--root <path>] [--smoke]');
    process.exit(0);
  }
}

const skillsDir = path.join(root, 'codex', 'skills');

function readFrontmatter(contents) {
  const match = contents.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const raw = match[1] ?? '';
  const data = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key.length === 0) continue;
    data[key] = value.replace(/^"|"$/g, '');
  }
  return data;
}

function extractReferencePaths(contents) {
  const lines = contents.split('\n');
  const refs = [];
  let inRefs = false;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.*)$/);
    if (headingMatch) {
      const heading = headingMatch[1]?.trim().toLowerCase();
      inRefs = heading === 'references';
      continue;
    }

    if (!inRefs) continue;

    if (line.startsWith('## ')) {
      inRefs = false;
      continue;
    }

    const bulletMatch = line.match(/^\s*-\s+(.*)$/);
    if (!bulletMatch) continue;

    const raw = bulletMatch[1]?.trim();
    if (!raw) continue;

    const linkMatch = raw.match(/\[[^\]]+\]\(([^)]+)\)/);
    if (linkMatch) {
      refs.push(linkMatch[1].trim());
      continue;
    }

    refs.push(raw);
  }

  return refs;
}

const errors = [];

if (!fs.existsSync(skillsDir)) {
  console.log(`No skills directory found at ${skillsDir}`);
  process.exit(0);
}

const skillDirs = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(skillsDir, entry.name));

for (const dir of skillDirs) {
  const skillName = path.basename(dir);
  const skillPath = path.join(dir, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    errors.push(`[${skillName}] Missing SKILL.md`);
    continue;
  }

  const contents = fs.readFileSync(skillPath, 'utf8');
  const frontmatter = readFrontmatter(contents);

  if (!frontmatter) {
    errors.push(`[${skillName}] Missing YAML frontmatter`);
  } else {
    if (!frontmatter.name || String(frontmatter.name).trim().length === 0) {
      errors.push(`[${skillName}] Frontmatter missing 'name'`);
    }
    if (!frontmatter.description || String(frontmatter.description).trim().length === 0) {
      errors.push(`[${skillName}] Frontmatter missing 'description'`);
    }
  }

  const references = extractReferencePaths(contents);
  for (const ref of references) {
    if (/^https?:\/\//i.test(ref)) continue;
    const refPath = ref.replace(/^\.\//, '');
    const resolved = path.join(root, refPath);
    if (!fs.existsSync(resolved)) {
      errors.push(`[${skillName}] Missing reference: ${ref}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Skill validation failed:\n' + errors.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Skill validation passed.');

if (showSmokeHints) {
  console.log('\nSmoke check hints:');
  console.log('- Run: scripts/codex/sync-skills.sh --verbose');
  console.log('- In Codex CLI: /skills and confirm all markdowntown-* skills appear.');
  console.log('- Prompt examples: \"workbench export\", \"scan flow\", \"run tests\", \"analytics redaction\".');
}
