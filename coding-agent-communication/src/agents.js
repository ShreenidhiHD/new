// Directly invoke another coding agent's CLI in headless mode and capture its answer.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MAX_DEPTH = Number(process.env.AGENT_BUS_MAX_DEPTH || 2);

export function loadAgents(file = process.env.AGENT_BUS_AGENTS || path.join(here, '..', 'agents.json')) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  return cfg.agents || {};
}

export function buildArgs(template, prompt) {
  return template.map((a) => (a === '{prompt}' ? prompt : a.split('{prompt}').join(prompt)));
}

export function askAgent({ agents, agent, prompt, cwd, timeoutSec = 600, self }) {
  const spec = agents[agent];
  if (!spec) {
    return Promise.reject(new Error(`unknown agent "${agent}". Known: ${Object.keys(agents).join(', ')}`));
  }
  if (agent === self) return Promise.reject(new Error('refusing to ask yourself'));

  // Loop guard: A asks B asks A asks B ... is stopped at MAX_DEPTH.
  const depth = Number(process.env.AGENT_BUS_DEPTH || 0);
  if (depth >= MAX_DEPTH) {
    return Promise.reject(new Error(`ask_agent nesting limit reached (depth ${depth} >= ${MAX_DEPTH})`));
  }

  const preamble = self ? `[Request from agent "${self}" via coding-agent-communication]\n\n` : '';
  const args = buildArgs(spec.args || ['{prompt}'], preamble + prompt);

  return new Promise((resolve, reject) => {
    // No shell: the prompt is a single argv entry, so it cannot inject commands.
    const child = spawn(spec.command, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...(spec.env || {}), AGENT_BUS_DEPTH: String(depth + 1) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${agent} timed out after ${timeoutSec}s`));
    }, timeoutSec * 1000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`failed to start "${spec.command}": ${e.message}. Is it installed and on PATH?`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${agent} exited with code ${code}\n${err.trim() || out.trim()}`));
    });
  });
}
