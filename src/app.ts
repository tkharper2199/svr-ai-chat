import express, { Request, Response, Application, NextFunction } from 'express';
import { runAgent } from './agent';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Route to invoke the AI agent
app.post('/chat', async (req: Request, res: Response) => {
  const { input, userId, threadId } = req.body;
  if (!input || !userId || !threadId) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    const response = await runAgent(input, userId, threadId);
    res.json(response);
  } catch (error) {
    console.error('Error invoking agent:', error);
    res.status(500).json({ error: 'Failed to invoke agent' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});


// 404 handler for all undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error occurred:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\\n🔴 Server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n🔴 Server shutting down gracefully...');
  process.exit(0);
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Express.js + TypeScript Server Started`);
    console.log(`📡 Server is running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`⏰ Time API: http://localhost:${PORT}/api/time`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Node.js version: ${process.version}`);
    console.log('='.repeat(50));
  });
}

export default app;