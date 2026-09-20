import { app } from './app.js';
import { env, APP_CONSTANTS } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/client.js';
import { VoiceGateway, voiceManager, voiceSessionManager } from './voice/index.js';
import { logger } from './utils/logger.js';

/**
 * Server Entrypoint Script
 * Initializes database connectivity, starts HTTP server, initializes VoiceGateway WebSocket, and handles OS shutdown signals.
 */
async function startServer() {
  try {
    // 1. Establish Database Connection
    await connectDatabase();

    // 2. Start Express HTTP Server
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 ${APP_CONSTANTS.APP_NAME} active`);
      logger.info(`📌 Environment : ${env.NODE_ENV}`);
      logger.info(`📌 Listening on : http://localhost:${env.PORT}`);
      logger.info(`📌 Health Check: http://localhost:${env.PORT}${APP_CONSTANTS.API_PREFIX}/health`);
      logger.info(`📌 Voice WS   : ws://localhost:${env.PORT}/ws/voice`);
      logger.info(`=======================================================`);
    });

    // 3. Initialize VoiceGateway WebSocket Server attached to HTTP Server
    const voiceGateway = new VoiceGateway(voiceManager, voiceSessionManager);
    voiceGateway.initialize(server, '/ws/voice');
    logger.info('🎙️ VoiceGateway WebSocket initialized on /ws/voice');

    // 3. Graceful Shutdown Signal Handler
    const shutdown = async (signal: string) => {
      logger.info(`⚠️ Received ${signal}. Initiating graceful shutdown...`);

      server.close(async () => {
        logger.info('🛑 HTTP server closed.');
        try {
          await disconnectDatabase();
          logger.info('👋 Graceful shutdown complete. Exiting.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, '❌ Error during database disconnect');
          process.exit(1);
        }
      });

      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        logger.error('❌ Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    // Listen for OS termination signals (Ctrl+C / Docker stop)
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error during server startup');
    process.exit(1);
  }
}

startServer();
