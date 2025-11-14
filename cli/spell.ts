#!/usr/bin/env node
/* eslint-disable no-console */

import process from 'node:process';

interface CliOptions {
  server: string;
  userId: string;
  input: Record<string, unknown>;
}

function printUsage(): void {
  console.log(`Spell CLI

Usage:
  pnpm spell execute <spell-id> [--input '{"message":"hi"}'] [--server http://localhost:3000] [--user user-123]
`);
}

function parseOptions(argv: string[]): {
  command: string | null;
  spellId?: string;
  options: CliOptions;
} {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { command: null, options: getDefaultOptions() };
  }

  const [command, maybeSpellId, ...rest] = argv;
  const options = getDefaultOptions();
  let spellId = maybeSpellId;

  if (!command) {
    return { command: null, options };
  }

  if (!spellId) {
    throw new Error('Spell id is required.');
  }

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token) continue;
    if (!token.startsWith('--')) {
      continue;
    }

    const nextValue = rest[i + 1];
    switch (token) {
      case '--server':
        if (!nextValue) throw new Error('--server requires a value');
        options.server = stripTrailingSlash(nextValue);
        i += 1;
        break;
      case '--user':
        if (!nextValue) throw new Error('--user requires a value');
        options.userId = nextValue;
        i += 1;
        break;
      case '--input':
        if (!nextValue) throw new Error('--input requires a JSON value');
        try {
          const parsed = JSON.parse(nextValue);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            options.input = parsed as Record<string, unknown>;
          } else {
            throw new Error('Input must be a JSON object');
          }
        } catch (error) {
          throw new Error(
            `Failed to parse --input JSON: ${error instanceof Error ? error.message : error}`
          );
        }
        i += 1;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return { command, spellId, options };
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function getDefaultOptions(): CliOptions {
  return {
    server: stripTrailingSlash(process.env.SPELL_API_URL ?? 'http://localhost:3000'),
    userId: process.env.SPELL_USER_ID ?? 'cli-user',
    input: {},
  };
}

async function run() {
  try {
    const argv = process.argv.slice(2);
    const parsed = parseOptions(argv);

    if (!parsed.command) {
      printUsage();
      return;
    }

    if (parsed.command !== 'execute') {
      throw new Error(`Unsupported command: ${parsed.command}`);
    }

    if (!parsed.spellId) {
      throw new Error('Spell id is required.');
    }

    const response = await fetch(`${parsed.options.server}/api/spell/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': parsed.options.userId,
      },
      body: JSON.stringify({ spell_id: parsed.spellId, inputs: parsed.options.input }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('Spell execution failed');
      console.error(JSON.stringify(payload, null, 2));
      process.exitCode = 1;
      return;
    }

    console.log('Spell executed successfully');
    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
  }
}

run();
