#!/usr/bin/env node
// Single entry point.
//   agent-relay                 -> MCP server on stdio (what MCP clients launch)
//   agent-relay serve           -> same, explicit
//   agent-relay <subcommand>    -> human CLI (inbox, send, tasks, ask, watch, ...)
const [cmd] = process.argv.slice(2);

if (!cmd || cmd === 'serve') {
  if (!cmd && process.stdin.isTTY) {
    process.stderr.write(
      'agent-relay: starting MCP server on stdio (this is what Claude Code / VS Code launch).\n' +
        'Run "agent-relay help" for the human CLI. Ctrl+C to exit.\n',
    );
  }
  const { startServer } = await import('./server.js');
  startServer();
} else {
  const { runCli } = await import('./cli.js');
  await runCli(cmd === 'help' ? [] : process.argv.slice(2));
}
