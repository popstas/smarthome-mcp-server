import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runCli } from './helpers.js';

describe('MCP server tools', () => {
  let transport: StdioClientTransport;

  beforeAll(async () => {});

  it('measure cold server start', async () => {
    const start = Date.now();
    const client = new Client({ name: 'test', version: '1.0.0' });
    transport = new StdioClientTransport({
      command: 'npm',
      args: ['run', 'dev'],
      env: {
        ...process.env,
        NODE_OPTIONS: `--unhandled-rejections=warn ${process.env.NODE_OPTIONS || ''}`.trim()
      }
    });
    await client.connect(transport);
    const end = Date.now();
    expect(end - start).toBeLessThan(5000);
  });
  // this test freezes, TODO: find out why
  it.skip('measure cold server start (inspector)', async () => {
    const start = Date.now();

    const parsed = await runCli(['--method', 'tools/list']);
    expect(parsed.tools).toBeDefined();
    expect(Array.isArray(parsed.tools)).toBe(true);
    const end = Date.now();
    expect(end - start).toBeLessThan(5000);
  });
  it('exposes all expected tools', async () => {
    // prepare client
    const client = new Client({ name: 'test', version: '1.0.0' });
    transport = new StdioClientTransport({
      command: 'npm',
      args: ['run', 'dev'],
      env: {
        ...process.env,
        NODE_OPTIONS: `--unhandled-rejections=warn ${process.env.NODE_OPTIONS || ''}`.trim()
      }
    });
    await client.connect(transport);

    const { tools } = await client.listTools();
    const names = tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_smarthome_state',
        'change_smarthome_state',
        'get_smarthome_rules',
        'add_smarthome_rule',
        'smarthome_tts_voice',
        'add_smarthome_device'
      ])
    );
  });
});
