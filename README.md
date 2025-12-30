# Express.js + TypeScript App Server

A modern, type-safe Express.js server built with TypeScript.

## Features

- 🚀 Express.js with TypeScript
- � WebSocket support for real-time communication
- �📦 Hot reload development with Nodemon
- 🔧 Build system with TypeScript compiler
- 📊 Built-in health check endpoint
- ⚡ Fast development setup
- 🛡️ Type safety with TypeScript
- 📝 Request logging middleware
- 🔄 Graceful shutdown handling
- 🧪 Jest unit testing with Supertest
- 📈 Code coverage reporting

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Configuration

Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

## Development

The server includes:

- Automatic TypeScript compilation
- Hot reload on file changes
- Request logging
- Error handling
- Graceful shutdown
- **WebSocket support** - Real-time bidirectional communication

### WebSocket Endpoints

The server provides a WebSocket endpoint at `ws://localhost:3000/ws` for real-time communication.

See [WEBSOCKET_API.md](WEBSOCKET_API.md) for complete WebSocket API documentation.

#### Quick WebSocket Test

1. Start the server:
   ```bash
   npm run dev
   ```

2. Open `websocket-client.html` in your browser, or use the Node.js test client:
   ```bash
   node test-websocket-client.js
   ```

#### WebSocket Message Types

- **auth** - Authenticate with userId and threadId
- **chat** - Send chat messages to the AI agent
- **ping** - Check connection status

See the full documentation in [WEBSOCKET_API.md](WEBSOCKET_API.md) for detailed message formats and examples.

## Testing

The project uses Jest with Supertest for testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## License

MIT
