import Fastify from 'fastify';
import { spawn, ChildProcess } from 'child_process';

const fastify = Fastify({ logger: { level: 'info' } });

// Get service type from command line arguments
const SERVICE_TYPE = process.argv[2] || 'api';
const SERVICE_NAME = SERVICE_TYPE === 'api' ? 'SENDPAY-API' : 'SENDPAY-INDEXER';
const PORT = Number(process.env.PORT) || (SERVICE_TYPE === 'api' ? 10000 : 10001);

let serviceProcess: ChildProcess | null = null;
let serviceStats = {
  status: 'initializing',
  startTime: new Date().toISOString(),
  restarts: 0,
  lastRestart: null as string | null,
  lastError: null as string | null,
  pid: null as number | null
};

// Health monitoring endpoints
fastify.get('/', async (request, reply) => {
  return {
    service: `${SERVICE_NAME}-deployment-service`,
    status: serviceStats.status,
    uptime: Math.floor(process.uptime()),
    managedService: {
      name: SERVICE_NAME,
      type: SERVICE_TYPE,
      pid: serviceStats.pid,
      status: serviceStats.status,
      restarts: serviceStats.restarts,
      startTime: serviceStats.startTime,
      lastRestart: serviceStats.lastRestart,
      lastError: serviceStats.lastError
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'production',
      port: PORT,
      mongodbUri: process.env.MONGODB_URI ? '***configured***' : 'not configured',
      contractAddress: process.env.SENDPAY_CONTRACT_ADDRESS,
      streamUrl: process.env.APIBARA_STREAM_URL,
      preset: process.env.APIBARA_PRESET || 'mainnet'
    },
    timestamp: new Date().toISOString()
  };
});

// Load balancer health check
fastify.get('/health', async (request, reply) => {
  if (serviceStats.status === 'running' || serviceStats.status === 'starting') {
    reply.code(200);
    return { status: 'healthy', service: serviceStats.status };
  } else {
    reply.code(503);
    return { status: 'unhealthy', service: serviceStats.status, error: serviceStats.lastError };
  }
});

// Manual restart endpoint
fastify.post('/restart', async (request, reply) => {
  fastify.log.info('Manual restart requested');
  restartService();
  return { message: 'Service restart initiated', timestamp: new Date().toISOString() };
});

// Service status endpoint
fastify.get('/status', async (request, reply) => {
  return {
    service: SERVICE_NAME,
    status: serviceStats.status,
    pid: serviceStats.pid,
    restarts: serviceStats.restarts,
    uptime: Math.floor(process.uptime()),
    lastError: serviceStats.lastError
  };
});

const startService = async () => {
  try {
    fastify.log.info(`Starting ${SERVICE_NAME}...`);
    serviceStats.status = 'starting';
    serviceStats.lastError = null;

    // Build the project first
    fastify.log.info('Building project...');
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    });

    buildProcess.on('close', (buildCode) => {
      if (buildCode === 0) {
        fastify.log.info('Build successful, starting service...');
        
        // Start the actual service
        const startCommand = SERVICE_TYPE === 'api' ? 'start:api' : 'start:indexer';
        serviceProcess = spawn('npm', ['run', startCommand], {
          stdio: ['inherit', 'pipe', 'pipe'],
          env: { ...process.env, PORT: PORT.toString() }
        });

        serviceStats.status = 'running';
        serviceStats.pid = serviceProcess.pid || null;
        
        // Handle service process events
        serviceProcess.on('close', (code, signal) => {
          fastify.log.warn(`Service process exited with code ${code}, signal: ${signal}`);
          serviceStats.status = 'stopped';
          serviceStats.pid = null;
          
          // Auto-restart if process crashed (not manual shutdown)
          if (code !== 0 && code !== null && signal !== 'SIGTERM') {
            fastify.log.error(`Service crashed with code ${code}, restarting in 5 seconds...`);
            serviceStats.restarts++;
            serviceStats.lastRestart = new Date().toISOString();
            serviceStats.lastError = `Process exited with code ${code}`;
            
            setTimeout(() => startService(), 5000);
          }
        });

        serviceProcess.on('error', (err) => {
          fastify.log.error(`Service process error: ${err.message}`);
          serviceStats.status = 'error';
          serviceStats.lastError = err.message;
          serviceStats.restarts++;
          serviceStats.lastRestart = new Date().toISOString();
          
          // Retry after error
          setTimeout(() => startService(), 5000);
        });

        // Log service output
        if (serviceProcess.stdout) {
          serviceProcess.stdout.on('data', (data) => {
            fastify.log.info(`[${SERVICE_NAME}] ${data.toString().trim()}`);
          });
        }

        if (serviceProcess.stderr) {
          serviceProcess.stderr.on('data', (data) => {
            fastify.log.error(`[${SERVICE_NAME} ERROR] ${data.toString().trim()}`);
          });
        }

      } else {
        fastify.log.error(`Build failed with code ${buildCode}, retrying in 10 seconds...`);
        serviceStats.status = 'build_failed';
        serviceStats.lastError = `Build failed with code ${buildCode}`;
        setTimeout(() => startService(), 10000);
      }
    });

  } catch (error) {
    fastify.log.error(`Error starting service: ${error}`);
    serviceStats.status = 'error';
    serviceStats.lastError = error instanceof Error ? error.message : String(error);
    setTimeout(() => startService(), 10000);
  }
};

const restartService = () => {
  if (serviceProcess) {
    fastify.log.info('Stopping current service...');
    serviceProcess.kill('SIGTERM');
    serviceProcess = null;
  }
  
  setTimeout(() => {
    startService();
  }, 2000);
};

const gracefulShutdown = () => {
  fastify.log.info('Shutting down gracefully...');
  serviceStats.status = 'shutting_down';
  
  if (serviceProcess) {
    fastify.log.info('Terminating service process...');
    serviceProcess.kill('SIGTERM');
    
    // Force kill after 5 seconds if it doesn't exit gracefully
    setTimeout(() => {
      if (serviceProcess && !serviceProcess.killed) {
        fastify.log.warn('Force killing service process...');
        serviceProcess.kill('SIGKILL');
      }
    }, 5000);
  }

  // Close Fastify server
  fastify.close(() => {
    fastify.log.info('Deployment service shutdown complete');
    process.exit(0);
  });
};

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the service
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Deployment service listening on port ${PORT}`);
    
    // Start the managed service after a short delay
    setTimeout(() => {
      startService();
    }, 2000);
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
