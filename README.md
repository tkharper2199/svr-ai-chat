# Express.js + TypeScript App Server

A modern, type-safe Express.js server built with TypeScript.

## Features

- 🚀 Express.js with TypeScript
- 📦 Hot reload development with Nodemon
- 🔧 Build system with TypeScript compiler
- 📊 Built-in health check endpoint
- ⚡ Fast development setup
- 🛡️ Type safety with TypeScript
- 📝 Request logging middleware
- 🔄 Graceful shutdown handling

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server with hot reload:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Start production server:
```bash
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (not yet implemented)

## API Endpoints

- `GET /` - Welcome message and server info
- `GET /health` - Health check endpoint with system stats
- `GET /api/time` - Current time in various formats

## Project Structure

```
├── src/
│   ├── app.ts          # Main application setup
│   └── index.ts        # Application entry point
├── dist/               # Compiled JavaScript (generated)
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── nodemon.json        # Nodemon configuration
└── .env.example        # Environment variables example
```

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

## Testing

Access the running server:
- Main page: http://localhost:3000
- Health check: http://localhost:3000/health
- Time API: http://localhost:3000/api/time

## License

MIT