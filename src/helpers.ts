import yaml from 'js-yaml';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { client } from './mqtt.js';
import { Config } from './types.js';
import { execa } from 'execa';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const configPath = path.resolve(__dirname, '..', 'config.yml');

// Centralized configuration
export const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Config;
const base = config.mqtt?.base || '';

export function log(...args: unknown[]) {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  try {
    if (client.connected && base) {
      client.publish(`${base}/log`, msg);
    }
  } catch {
    // ignore mqtt log errors
  }
}

// Expose Home Assistant and caching constants
export const HA_URL = `https://${config.home_assistant.host}`;
export const HA_TOKEN = config.home_assistant.token;
export const STATE_CACHE_TIME = 1000;

/** Ensure directory for given file path exists */
export function ensureDataDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Wrap a tool execution in a standardized try/catch.
 * Logs errors and returns an MCP-friendly error response.
 */
export async function withToolErrorHandling<R>(toolName: string, fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (e) {
    log(`Tool "${toolName}" failed:`, e);
    // @ts-expect-error intentionally returning generic error structure
    return { content: [{ type: 'text', text: (e as Error).message }] };
  }
}

export async function runCli(args: string[]) {
  try {
    const cliArgs = ['-s', 'run', 'mcp-cli', '--'];
    const { stdout } = await execa('npm', [...cliArgs, ...args], { stdin: 'inherit' });
    return JSON.parse(stdout);
  } catch (error: unknown) {
    const errorObj = error as { stdout: string; stderr: string };
    if (errorObj.stdout) console.error('CLI STDOUT:', errorObj.stdout);
    if (errorObj.stderr) console.error('CLI STDERR:', errorObj.stderr);
    throw error;
  }
}

let clientTest: Client;
export async function runCliTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  if (!clientTest) {
    clientTest = new Client({ name: 'test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: 'npm',
      args: ['run', 'dev'],
      env: {
        ...process.env,
        NODE_OPTIONS: `--unhandled-rejections=warn ${process.env.NODE_OPTIONS || ''}`.trim()
      }
    });
    await clientTest.connect(transport);
  }
  const result = await clientTest.callTool({ name: toolName, arguments: args });
  return result as ToolResponse;
}

interface ToolResponse {
  content: Array<{ text: string }>;
}

export async function runTool<T = unknown>(
  toolName: string,
  params: Record<string, unknown>
): Promise<{ parsed: ToolResponse; valid: boolean; content: T }> {
  // return runToolInspector(toolName, params);
  const parsed = await runCliTool(toolName, params);
  const valid = isValidToolResponse(parsed);
  const content = JSON.parse(parsed.content[0].text);

  return { parsed, valid, content };
}

export async function runToolInspector<T = unknown>(
  toolName: string,
  params: Record<string, unknown>
): Promise<{ parsed: ToolResponse; valid: boolean; content: T }> {
  const args = [
    '--method',
    'tools/call',
    '--tool-name',
    toolName,
    ...Object.entries(params).flatMap(([key, value]) => {
      const val = typeof value === 'string' ? value : JSON.stringify(value);
      return ['--tool-arg', `${key}=${val}`];
    })
  ];
  const parsed = await runCli(args);
  const valid = isValidToolResponse(parsed);
  const content = JSON.parse(parsed.content[0].text);

  return { parsed, valid, content };
}

export function isValidToolResponse(parsed: unknown): parsed is ToolResponse {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'content' in parsed &&
    Array.isArray(parsed.content) &&
    parsed.content.length > 0
  );
}
