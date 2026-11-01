import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listSkills, skillsSourceDir, installSkills } from '../src/skills.js';

test('every skill has valid SKILL.md frontmatter (name matches folder, description present)', () => {
  const skills = listSkills();
  assert.ok(skills.length >= 6);
  for (const name of skills) {
    const text = fs.readFileSync(path.join(skillsSourceDir(), name, 'SKILL.md'), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(m, `${name}: missing frontmatter`);
    const fm = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
    assert.equal(fm.name, name, `${name}: name must match folder`);
    assert.match(fm.name, /^[a-z0-9-]{1,64}$/);
    assert.ok(fm.description && fm.description.length > 40 && fm.description.length <= 1024, `${name}: description length`);
  }
});

test('installSkills copies into .claude/skills and .github/skills', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  const written = installSkills({ projectDir: dir });
  assert.equal(written.length, listSkills().length * 2);
  assert.ok(fs.existsSync(path.join(dir, '.claude/skills/agent-relay-loop-safety/SKILL.md')));
  assert.ok(fs.existsSync(path.join(dir, '.github/skills/agent-relay-loop-safety/SKILL.md')));
});
