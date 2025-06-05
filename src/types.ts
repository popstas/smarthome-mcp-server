export interface MqttConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  base?: string;
}

export interface HomeAssistantConfig {
  host: string;
  token: string;
}

export interface Rule {
  text: string;
}

export interface DeviceConfig {
  name: string;
  room: 'global' | 'room' | 'hall' | 'kitchen';
  entity_id?: string;
  state_type?: 'boolean';
  state_template?: string;
  mqtt_stat?: string;
}

export interface Config {
  mqtt: MqttConfig;
  home_assistant: HomeAssistantConfig;
  rules: Rule[];
  devices: DeviceConfig[];
}

export interface Device extends DeviceConfig {
  state: string | number | null;
  mqtt_stat?: string;
}

// Home Assistant entity state representation
export interface HaEntity {
  state: string;
  attributes?: Record<string, unknown>;
}

// Collection of Home Assistant entities
export type HaEntities = Record<string, HaEntity>;
