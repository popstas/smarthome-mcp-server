import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import * as ha from 'home-assistant-js-websocket';
import { connectHomeAssistant, haConnection } from './hass.js';
import { initDevices } from './devices.js';
import { initMqtt, client } from './mqtt.js';
import { log, config, configPath, HA_URL, HA_TOKEN, STATE_CACHE_TIME, ensureDataDir, withToolErrorHandling } from './helpers.js';
import { Device, DeviceConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize devices and MQTT
const devices: Device[] = initDevices(config);
initMqtt(devices, log);

// Cache file path
const cacheFile = path.resolve(__dirname, '..', 'data', 'state.yml');
let cache: { state: DeviceState; ts: number } | null = null;

type DeviceState = Record<string, Device['state']>;
setTimeout(() => {
  connectHomeAssistant(HA_URL, HA_TOKEN, devices, log).catch((e: unknown) => log('Home Assistant startup error:', e));
}, 1000);

async function getState(): Promise<DeviceState> {
  const now = Date.now();
  if (cache && now - cache.ts < STATE_CACHE_TIME) {
    return cache.state;
  }
  // Compose state
  const state: DeviceState = {};
  devices.forEach((d: Device) => {
    state[d.name] = d.state;
  });
  ensureDataDir(cacheFile);
  fs.writeFileSync(cacheFile, yaml.dump(state));
  cache = { state, ts: now };
  return state;
}

async function changeState({ name, value }: { name: string; value: Device['state'] }) {
  name = name.toUpperCase();
  const device = devices.find((d: Device) => d.name.toUpperCase() === name);
  if (!device) throw new Error(`Device not found: ${name}`);

  // If device has entity_id, use Home Assistant service
  if (device.entity_id && haConnection) {
    const [domain] = device.entity_id.split('.', 2);
    let callDomain = domain;
    let service = '';
    const serviceData = { entity_id: device.entity_id };
    // Determine service and value logic per domain
    switch (domain) {
      case 'light':
      case 'switch':
      case 'humidifier':
      case 'fan':
        // if (value === '1' || value === 1 || value === true || value === 'on') {
        //   service = 'turn_on';
        // } else {
        //   service = 'turn_off';
        // }
        service = 'toggle';
        callDomain = 'homeassistant';
        break;
      case 'climate':
        if (value === '1' || value === 1 || value === 'on') {
          service = 'turn_on';
        } else {
          service = 'turn_off';
        }
        break;
      default:
        throw new Error(`Unsupported HA domain for changeState: ${domain}`);
    }
    const res = await ha.callService(haConnection, callDomain, service, serviceData);
    log(`HA callService: ${callDomain}.${service} for ${device.entity_id} value=${value}: ${JSON.stringify(res)}`);
    return { ok: true, res };
  }

  if (!haConnection) {
    throw new Error('Home Assistant connection not established');
  }

  // Fallback to MQTT
  if (device.mqtt_stat) {
    const topic = device.mqtt_stat;
    client.publish(topic, String(value));
    log(`MQTT publish: ${topic} value=${value}`);
    return { ok: true };
  }

  throw new Error(`Device does not support state change: ${name}`);
}

// Build enum of device names with 'mqtt'
const deviceNamesWithEntities = devices
  .filter((d: Device) =>
    typeof d.entity_id === 'string' &&
    (
      d.entity_id.startsWith('light.') ||
      d.entity_id.startsWith('humidifier.') ||
      d.entity_id.startsWith('climate.') ||
      d.entity_id.startsWith('switch.')
    )
  )
  .map((d: Device) => d.name);

const values = ['0', '1'];

const server = new FastMCP({
  name: "Smarthome MCP Server",
  version: "1.0.0"
});

server.addTool({
  name: "get_smarthome_state",
  description: "Get the current state of all devices in the smart home.",
  parameters: z.object({}),
  execute: () =>
    withToolErrorHandling("get_smarthome_state", async () => {
      const state = await getState();
      return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
    })
});

server.addTool({
  name: "change_smarthome_state",
  description: "Change the state of a smart home device.",
  parameters: z.object({
    name: z.enum([...(deviceNamesWithEntities as [string, ...string[]])]),
    value: z.enum(values as [string, ...string[]])
  }),
  execute: ({ name, value }: { name: string; value: string }) =>
    withToolErrorHandling("change_smarthome_state", async () => {
      const res = await changeState({ name, value });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    })
});

server.addTool({
  name: "get_smarthome_rules",
  description: "Get the current rules of the smart home.",
  parameters: z.object({}),
  execute: () =>
    withToolErrorHandling("get_smarthome_rules", async () => {
      return { content: [{ type: "text", text: JSON.stringify(config.rules || [], null, 2) }] };
    }),
});

server.addTool({
  name: "add_smarthome_rule",
  description: "Add a new rule to the smarthome config and persist to config.yml",
  parameters: z.object({ text: z.string() }),
  execute: ({ text }: { text: string }) =>
    withToolErrorHandling("add_smarthome_rule", async () => {
      if (!config.rules) config.rules = [];
      config.rules.push({ text });
      const yamlStr = yaml.dump(config);
      fs.writeFileSync(configPath, yamlStr, 'utf8');
      return { content: [{ type: "text", text: `Rule added: ${text}` }] };
    }),
});

server.addTool({
  name: "smarthome_tts_voice",
  description: "Speak a message to the user using MQTT TTS",
  parameters: z.object({ message: z.string() }),
  execute: ({ message }: { message: string }) =>
    withToolErrorHandling("smarthome_tts_voice", async () => {
      if (client.connected) {
        client.publish('tts', message);
        return { content: [{ type: "text", text: `Speaking: ${message}` }] };
      } else {
        return { content: [{ type: "text", text: `MQTT client not connected. Could not speak: ${message}` }] };
      }
    }),
});

server.addTool({
  name: "add_smarthome_device",
  description: "Add a new device to the smart home config and persist to config.yml",
  parameters: z.object({
    name: z.string(),
    entity_id: z.string(),
    room: z.enum(["room", "hall", "kitchen"])
  }),
  execute: ({ name, entity_id, room }: { name: string; entity_id: string; room: "room"|"hall"|"kitchen" }) =>
    withToolErrorHandling("add_smarthome_device", async () => {
      if (!config.devices) config.devices = [];
      if (config.devices.some((dev: DeviceConfig) => dev.entity_id === entity_id)) {
        return { content: [{ type: "text", text: `Device already exists: ${entity_id}` }] };
      }
      config.devices.push({ name, entity_id, room });
      const yamlStr = yaml.dump(config);
      fs.writeFileSync(configPath, yamlStr, 'utf8');
      return { content: [{ type: "text", text: `Device added: ${entity_id}` }] };
    }),
});

export { server };

// Only start stdio server when this file is the entrypoint
if (
  process.argv[1] &&
  path.resolve(process.cwd(), process.argv[1]) === path.resolve(__filename)
) {
  server.start({ transportType: 'stdio' }).catch(e => log('Server error:', e));
}
