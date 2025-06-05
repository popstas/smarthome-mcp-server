# Smart Home MCP Server

This MCP server integrates with Home Assistant and MQTT, allowing Model Context Protocol (MCP) clients to control and monitor smart home devices.

## Features

- Retrieve the current state of all configured devices
- Change device states via Home Assistant or MQTT as fallback
- Manage automation rules persisted in `config.yml`
- Add new devices dynamically and persist to configuration
- Text-to-speech messaging via MQTT TTS

## Installation

```bash
npm install
```

## Configuration

Copy the sample configuration and update credentials:

```bash
cp config.yml.example config.yml
```

Edit `config.yml`:

```yaml
mqtt:
  host: YOUR_MQTT_HOST
  port: 1883
  user: YOUR_MQTT_USER
  password: YOUR_MQTT_PASSWORD
  base: home/mcp
home_assistant:
  host: YOUR_HASS_HOST
  token: YOUR_LONG_LIVED_ACCESS_TOKEN
rules:
  - text: 'Your Automation Rule'
devices:
  - name: 'Light in Room'
    room: room
    entity_id: light.your_light_entity
    state_type: boolean
```

## Usage

Start the server:

```bash
npm run build
npm start
```

## Available Tools

- `get_smarthome_state`: Get current device states
- `change_smarthome_state`: Change a device state
- `get_smarthome_rules`: List automation rules
- `add_smarthome_rule`: Add a new automation rule
- `add_smarthome_device`: Add a new device to the config
- `smarthome_tts_voice`: Send a TTS message via MQTT

## Examples

### Sample `config.yml`

```yaml
mqtt:
  host: localhost
  port: 1883
  user: user
  password: pass
  base: home/mcp
home_assistant:
  host: localhost
  token: token
rules:
  - text: 'When no one is home or sleeping, turn off all lights.'
devices:
  - name: 'Light in Room'
    room: room
    entity_id: light.yeelight_ceiling20_0x2339ef2c
    state_type: boolean
```

### Using Tools via MCP

#### Get all device states

```json
{
  "tool": "get_smarthome_state",
  "parameters": {}
}
```

#### Change device state

```json
{
  "tool": "change_smarthome_state",
  "parameters": {
    "name": "Light in Room",
    "value": "1"
  }
}
```

#### List automation rules

```json
{
  "tool": "get_smarthome_rules",
  "parameters": {}
}
```

#### Add a new rule

```json
{
  "tool": "add_smarthome_rule",
  "parameters": { "text": "Turn on fan if humidity > 60%" }
}
```

#### Add a new device

```json
{
  "tool": "add_smarthome_device",
  "parameters": {
    "name": "Kitchen Fan",
    "entity_id": "switch.kitchen_fan",
    "room": "kitchen"
  }
}
```

## Development

Lint the source:

```bash
npm run lint src
```

Run tests:

```bash
npm test
```

## License

MIT
