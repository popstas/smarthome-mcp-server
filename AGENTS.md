# Development Rules

This project is a TypeScript implementation of an MCP server that integrates with Home Assistant and MQTT. The code resides in `src/` and tests are located alongside the source files.

## Linting
- Run `npm run lint src` to lint the entire project.
- Lint a single file with `npm run lint [filePath]`.

## Testing
- Always update tests when you change the code.
- Execute tests with `npm test`.

## Coding Guidelines
- Do not use `z.union` when defining schemas.

## Configuration
- The server requires a `config.yml` file (not committed to git). Copy `config.yml.example` and adjust your credentials.

## Building and Running
- Development server: `npm run dev`.
- Build for production: `npm run build` and start with `npm start`.

