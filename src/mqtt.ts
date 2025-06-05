import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import yaml from 'js-yaml';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Config, Device } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.resolve(__dirname, '..', 'config.yml');
// Typed configuration
export const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Config;

const mqttConfig = config.mqtt;
const mqttUrl = `mqtt://${mqttConfig.host}:${mqttConfig.port}`;
const mqttOptions: IClientOptions = {
  username: mqttConfig.user,
  password: mqttConfig.password
};
// MQTT client
export const client: MqttClient = mqtt.connect(mqttUrl, mqttOptions);
const base = mqttConfig.base || '';

// log is passed in to avoid circular dependency
export function initMqtt(devices: Device[], log: (...args: unknown[]) => void): void {
  client.on('connect', () => {
    log('MQTT connected');
    log('MQTT publish', `${base}/log`, 'started');
    client.publish(`${base}/log`, 'started');
    devices.forEach((device: Device) => {
      if (device.mqtt_stat) {
        log('MQTT subscribe', device.mqtt_stat);
        client.subscribe(device.mqtt_stat);
      }
    });
  });

  client.on('message', (topic: string, message: Buffer) => {
    devices.forEach((device: Device) => {
      if (topic === device.mqtt_stat) {
        const newState = message.toString();
        if (device.state !== newState) {
          device.state = newState;
          log(`MQTT state update: ${device.name} = ${device.state}`);
        }
      }
    });
  });
}
