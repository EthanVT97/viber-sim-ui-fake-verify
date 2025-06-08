import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { botRoutes } from './routes/bot.routes';
import { viberRoutes } from './routes/viber.routes';
import { sessionRoutes } from './routes/session.routes';
import { webhookRoutes } from './routes/webhook.routes';

import { maskBotInfo } from './middleware/maskBotInfo.middleware';
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { logger } from './utils/logger';

import { DatabaseService } from './services/database.service';
import { ViberBotManager } from './services/viber-bot.service';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

const PORT = process.env.PORT || 8080;

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/bot', authMiddleware, botRoutes);
app.use('/api/session', authMiddleware, sessionRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/viber/info', maskBotInfo, viberRoutes); // masked
app.use('/viber', viberRoutes); // unmasked

// Error handler
app.use(errorHandler);

// Socket.io handlers
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('bot:status', async (data) => {
    try {
      const botManager = ViberBotManager.getInstance();
      const status = await botManager.getBotStatus(data.botId);
      socket.emit('bot:status:update', status);
    } catch (err) {
      logger.error('Socket bot status error:', err);
      socket.emit('error', { message: 'Failed to fetch bot status' });
    }
  });

  socket.on('bot:message', async (data) => {
    try {
      const botManager = ViberBotManager.getInstance();
      await botManager.sendMessage(data.botId, data.message);
      socket.emit('bot:message:sent', { success: true });
    } catch (err) {
      logger.error('Socket message error:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Bootstrap + Shutdown
async function initializeServer() {
  try {
    await DatabaseService.initialize();
    logger.info('✅ Database connected');

    const botManager = ViberBotManager.getInstance();
    await botManager.initialize();
    logger.info('🤖 Viber Bot Manager initialized');

    server.listen(PORT, () => {
      logger.info(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('❌ Initialization error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received. Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received. Shutting down...');
  server.close(() => process.exit(0));
});

initializeServer();
