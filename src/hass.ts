import * as ha from 'home-assistant-js-websocket';
import ws from 'ws';
import { Device, HaEntities } from './types.js';

global.WebSocket = ws as unknown as typeof WebSocket;

export let haConnection: ha.Connection | null = null;
export const haStates: Record<string, Device['state']> = {};

/** Render templated state strings, e.g. '{{ state.some.path }}' */
function renderTemplate(template: string, state: string | number): string {
  const result = template.replace(
    /{{\s*state((?:\.[A-Za-z0-9_]+)+)\s*}}/g,
    (_match: string, path: string) => {
      const keys = path.slice(1).split('.');
      let value: unknown = state;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[key];
        } else {
          return '';
        }
      }
      return value != null ? String(value) : '';
    }
  );
  return result.replace(/{{\s*state\s*}}/g, String(state));
}

function onOffToNumber(state: string): number {
  return ['on', '1', 'auto'].includes(state) ? 1 : 0;
}

export async function connectHomeAssistant(
  haUrl: string,
  haToken: string,
  devices: Device[],
  log: (...args: unknown[]) => void
): Promise<void> {
  try {
    log('Connecting to Home Assistant...');
    const auth = ha.createLongLivedTokenAuth(haUrl, haToken);
    haConnection = await ha.createConnection({ auth });
    log('Connected to Home Assistant');

    devices
      .filter((d: Device) => typeof d.entity_id === 'string')
      .forEach((device: Device) => {
        ha.subscribeEntities(haConnection!, (entities: HaEntities) => {
          const entity = device.entity_id && entities[device.entity_id];
          if (entity) {
            // state may be number after template/boolean conversion
            let state: string | number = entity.state;
            if (device.state_template) {
              state = renderTemplate(device.state_template, state);
            }
            if (device.state_type === 'boolean') {
              state = onOffToNumber(state);
            }
            if (device.state !== state) {
              haStates[device.name] = state;
              device.state = state;
              log(`HA state update: ${device.name} = ${state}`);
            }
          }
        });
      });
  } catch (e) {
    log('Home Assistant connection error:', e);
  }
}
