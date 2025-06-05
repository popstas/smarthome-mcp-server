import { Device, Config } from './types.js';

// Devices to module global scope
let devices: Device[] = [];

export function useDevices(): Device[] {
  return devices;
}

export function initDevices(config: Config): Device[] {
  devices = config.devices.map((d) => ({ ...d, state: null }));
  return devices;
}
