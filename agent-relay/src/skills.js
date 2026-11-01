// Install the bundled agent skills into a project (or the user's home) so
// Claude Code (.claude/skills) and GitHub Copilot (.github/skills) load them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function skillsSourceDir() {
  // Repo layout: src/../skills. Bundled layout (VS Code extension): server/skills.
  const candidates = [path.join(here, '..', 'skills'), path.join(here, 'skills')];
  const found = candidates.find((d) => fs.existsSync(d));
  if (!found) throw new Error('skills folder not found next to agent-relay');
  return found;
}

export function listSkills() {
  const dir = skillsSourceDir();
  return fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'SKILL.md')));
}

/**
 * @param {object} o
 * @param {string} [o.projectDir] project root (default cwd)
 * @param {boolean} [o.user] install to ~/.claude/skills instead of the project
 * @param {('claude'|'copilot')[]} [o.targets]
 * @returns {string[]} directories written
 */
export function installSkills({ projectDir = process.cwd(), user = false, targets = ['claude', 'copilot'] } = {}) {
  const src = skillsSourceDir();
  const dests = user
    ? [path.join(os.homedir(), '.claude', 'skills')]
    : targets.map((t) => path.join(projectDir, t === 'claude' ? '.claude' : '.github', 'skills'));
  const written = [];
  for (const dest of dests) {
    for (const name of listSkills()) {
      const to = path.join(dest, name);
      fs.mkdirSync(to, { recursive: true });
      fs.cpSync(path.join(src, name), to, { recursive: true, force: true });
      written.push(to);
    }
  }
  return written;
}
