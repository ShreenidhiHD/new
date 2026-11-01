// Agent Relay VS Code extension.
// - Registers the bundled Agent Relay MCP server with VS Code, so Copilot
//   (Agent mode, any model) gets the relay tools with zero config.
// - Status bar badge with unread messages for this agent.
// - Commands to view inbox/tasks, send messages, and set up Claude Code.
const vscode = require('vscode');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CHAT_PROMPT =
  'Check your agent-relay inbox and open tasks (read_inbox, list_tasks). Claim and complete any task assigned to you, and reply to messages.';

function cfg() {
  const c = vscode.workspace.getConfiguration('agentRelay');
  return {
    agentName: c.get('agentName') || 'copilot',
    busDir: c.get('busDir') || path.join(os.homedir(), '.agent-relay'),
    agentsFile: c.get('agentsFile') || '',
    pollSeconds: Math.max(1, c.get('pollSeconds') || 5),
  };
}

let busModule; // lazily imported ESM
async function getBus(context) {
  if (!busModule) busModule = await import(pathToFileURL(path.join(context.extensionPath, 'server', 'bus.js')).href);
  return new busModule.Bus(cfg().busDir);
}

// Copy the server to a stable path (<busDir>/server) so Claude Code's config
// keeps working when the extension updates (its install folder is versioned).
function installStableServer(context) {
  const src = path.join(context.extensionPath, 'server');
  const dst = path.join(cfg().busDir, 'server');
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
  return dst;
}

function agentsFilePath(context) {
  return cfg().agentsFile || path.join(context.extensionPath, 'server', 'agents.json');
}

function knownAgents(context, bus) {
  const names = new Set(['claude-code', 'copilot', 'gemini']);
  try {
    Object.keys(JSON.parse(fs.readFileSync(agentsFilePath(context), 'utf8')).agents || {}).forEach((n) => names.add(n));
  } catch {}
  try {
    bus.allMessages().forEach((m) => {
      names.add(m.from);
      if (m.to !== '*') names.add(m.to);
    });
  } catch {}
  names.delete(cfg().agentName);
  return [...names, '*'];
}

function openChat() {
  return vscode.commands
    .executeCommand('workbench.action.chat.open', { query: CHAT_PROMPT, mode: 'agent' })
    .then(undefined, () => vscode.commands.executeCommand('workbench.action.chat.open', CHAT_PROMPT));
}

async function showMarkdown(content) {
  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
  await vscode.window.showTextDocument(doc, { preview: true });
}

function fmtMessage(m) {
  return `### ${m.subject || '(no subject)'}\n**${m.from} → ${m.to}** · ${m.createdAt}\n\n${m.body}\n`;
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const changed = new vscode.EventEmitter();
  context.subscriptions.push(changed);

  // ---- MCP server registration (VS Code >= 1.101) ----
  if (vscode.lm && typeof vscode.lm.registerMcpServerDefinitionProvider === 'function') {
    context.subscriptions.push(
      vscode.lm.registerMcpServerDefinitionProvider('agentRelay', {
        onDidChangeMcpServerDefinitions: changed.event,
        provideMcpServerDefinitions: async () => {
          const c = cfg();
          // VS Code's own binary acts as Node with ELECTRON_RUN_AS_NODE=1,
          // so users don't need Node installed.
          return [
            new vscode.McpStdioServerDefinition(
              'Agent Relay',
              process.execPath,
              [path.join(context.extensionPath, 'server', 'bin.js')],
              {
                ELECTRON_RUN_AS_NODE: '1',
                AGENT_NAME: c.agentName,
                AGENT_RELAY_DIR: c.busDir,
                AGENT_RELAY_AGENTS: agentsFilePath(context),
              },
              context.extension?.packageJSON?.version || '0.2.0',
            ),
          ];
        },
      }),
    );
  } else {
    vscode.window.showWarningMessage('Agent Relay needs VS Code 1.101+ to register its MCP server with Copilot.');
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('agentRelay')) {
        changed.fire();
        restartPolling();
      }
    }),
  );

  // ---- status bar unread badge ----
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'agentRelay.showInbox';
  status.show();
  context.subscriptions.push(status);

  let timer;
  let lastUnread = 0;
  async function refresh() {
    try {
      const bus = await getBus(context);
      const unread = bus.inbox(cfg().agentName, { unreadOnly: true, markRead: false });
      status.text = unread.length ? `$(mail) ${unread.length}` : '$(mail-read) Relay';
      status.tooltip = `Agent Relay — ${cfg().agentName}: ${unread.length} unread`;
      if (unread.length > lastUnread) {
        const newest = unread[unread.length - 1];
        vscode.window
          .showInformationMessage(`Agent Relay: ${newest.from} → ${newest.subject || newest.body.slice(0, 60)}`, 'Handle in Copilot Chat', 'Show Inbox')
          .then((pick) => {
            if (pick === 'Handle in Copilot Chat') openChat();
            if (pick === 'Show Inbox') vscode.commands.executeCommand('agentRelay.showInbox');
          });
      }
      lastUnread = unread.length;
    } catch (e) {
      status.text = '$(warning) Relay';
      status.tooltip = `Agent Relay error: ${e.message}`;
    }
  }
  function restartPolling() {
    clearInterval(timer);
    refresh();
    timer = setInterval(refresh, cfg().pollSeconds * 1000);
  }
  restartPolling();
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  // ---- commands ----
  const reg = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('agentRelay.showInbox', async () => {
    const bus = await getBus(context);
    const me = cfg().agentName;
    const unreadIds = new Set(bus.inbox(me, { unreadOnly: true, markRead: false }).map((m) => m.id));
    const msgs = bus.inbox(me, { unreadOnly: false, markRead: false }).reverse();
    const items = [
      { label: '$(comment-discussion) Handle inbox in Copilot Chat', action: 'chat' },
      { label: '$(send) Send a message…', action: 'send' },
      { label: '$(checklist) Show tasks', action: 'tasks' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      ...msgs.map((m) => ({
        label: `${unreadIds.has(m.id) ? '$(circle-filled) ' : ''}${m.subject || m.body.slice(0, 50)}`,
        description: `from ${m.from}`,
        detail: m.body.split('\n')[0].slice(0, 120),
        msg: m,
      })),
    ];
    const pick = await vscode.window.showQuickPick(items, { title: `Agent Relay inbox — ${me}`, matchOnDetail: true });
    if (!pick) return;
    if (pick.action === 'chat') return openChat();
    if (pick.action === 'send') return vscode.commands.executeCommand('agentRelay.sendMessage');
    if (pick.action === 'tasks') return vscode.commands.executeCommand('agentRelay.showTasks');
    const thread = bus.thread(pick.msg.threadId);
    await showMarkdown(`# Thread ${pick.msg.threadId}\n\n${thread.map(fmtMessage).join('\n---\n\n')}`);
  });

  reg('agentRelay.showTasks', async () => {
    const bus = await getBus(context);
    const icon = { open: '$(circle-outline)', claimed: '$(sync)', done: '$(pass)', failed: '$(error)', cancelled: '$(circle-slash)' };
    const tasks = bus.listTasks({ agent: cfg().agentName }).reverse();
    if (!tasks.length) return vscode.window.showInformationMessage('Agent Relay: no tasks yet.');
    const pick = await vscode.window.showQuickPick(
      tasks.map((t) => ({ label: `${icon[t.status] || ''} ${t.title}`, description: `${t.from} → ${t.to} · ${t.status}`, detail: t.details, task: t })),
      { title: 'Agent Relay tasks' },
    );
    if (!pick) return;
    const t = pick.task;
    await showMarkdown(
      `# ${t.title}\n\n- **id:** ${t.id}\n- **from → to:** ${t.from} → ${t.to}\n- **status:** ${t.status}${t.claimedBy ? ` (by ${t.claimedBy})` : ''}\n\n## Details\n\n${t.details || '_none_'}\n\n## Result\n\n${t.result || '_pending_'}\n\n## History\n\n${t.history.map((h) => `- ${h.at} · ${h.by} · ${h.status}${h.note ? ` — ${h.note}` : ''}`).join('\n')}\n`,
    );
  });

  reg('agentRelay.sendMessage', async () => {
    const bus = await getBus(context);
    const to = await vscode.window.showQuickPick(knownAgents(context, bus), { title: 'Send to which agent?', placeHolder: 'claude-code' });
    if (!to) return;
    const body = await vscode.window.showInputBox({ title: `Message to ${to}`, prompt: `Sent as "${cfg().agentName}"` });
    if (!body) return;
    bus.send({ from: cfg().agentName, to, body });
    vscode.window.showInformationMessage(`Agent Relay: sent to ${to}.`);
  });

  reg('agentRelay.setupClaudeCode', async () => {
    const serverDir = installStableServer(context);
    const bin = path.join(serverDir, 'bin.js');
    const c = cfg();
    const envArgs = [`-e AGENT_NAME=claude-code`, `-e AGENT_RELAY_DIR="${c.busDir}"`];
    if (c.agentsFile) envArgs.push(`-e AGENT_RELAY_AGENTS="${c.agentsFile}"`);
    const cmd = `claude mcp add agent-relay --scope user ${envArgs.join(' ')} -- node "${bin}"`;
    const pick = await vscode.window.showInformationMessage(
      'Register Agent Relay with Claude Code (user scope)? Requires the `claude` and `node` commands.',
      { modal: true, detail: cmd },
      'Run in Terminal',
      'Copy Command',
    );
    if (pick === 'Run in Terminal') {
      const term = vscode.window.createTerminal('Agent Relay setup');
      term.show();
      term.sendText(cmd);
    } else if (pick === 'Copy Command') {
      await vscode.env.clipboard.writeText(cmd);
      vscode.window.showInformationMessage('Command copied. Paste it in a terminal.');
    }
  });

  reg('agentRelay.copyInstructions', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return vscode.window.showWarningMessage('Open a folder first.');
    const snippet = fs.readFileSync(path.join(context.extensionPath, 'server', 'AGENT_INSTRUCTIONS.md'), 'utf8').replace(/^<!--.*-->\n/, '');
    const targets = [path.join('.github', 'copilot-instructions.md'), 'CLAUDE.md'];
    const done = [];
    for (const rel of targets) {
      const file = path.join(folder.uri.fsPath, rel);
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (existing.includes('agent-relay')) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, (existing ? existing.replace(/\n*$/, '\n\n') : '') + snippet);
      done.push(rel);
    }
    vscode.window.showInformationMessage(done.length ? `Agent Relay instructions added to ${done.join(' and ')}.` : 'Instructions already present.');
  });

  reg('agentRelay.installSkills', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return vscode.window.showWarningMessage('Open a folder first.');
    const choice = await vscode.window.showQuickPick(
      [
        { label: 'Claude Code + Copilot', description: '.claude/skills and .github/skills', targets: ['claude', 'copilot'] },
        { label: 'Copilot only', description: '.github/skills', targets: ['copilot'] },
        { label: 'Claude Code only', description: '.claude/skills', targets: ['claude'] },
      ],
      { title: 'Install agent-relay skills into this workspace' },
    );
    if (!choice) return;
    const mod = await import(pathToFileURL(path.join(context.extensionPath, 'server', 'skills.js')).href);
    const written = mod.installSkills({ projectDir: folder.uri.fsPath, targets: choice.targets });
    vscode.window.showInformationMessage(`Agent Relay: installed ${mod.listSkills().length} skills (${written.length} folders). Commit them so teammates' agents get them too.`);
  });

  // First run: offer Claude Code setup once.
  if (!context.globalState.get('agentRelay.welcomed')) {
    context.globalState.update('agentRelay.welcomed', true);
    vscode.window
      .showInformationMessage('Agent Relay is ready: Copilot now has relay tools (enable them in Agent mode → Tools). Set up Claude Code too?', 'Set Up Claude Code', 'Later')
      .then((pick) => pick === 'Set Up Claude Code' && vscode.commands.executeCommand('agentRelay.setupClaudeCode'));
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
