const redis = require('redis');

// Create a mock Redis client that doesn't actually connect
const createMockRedisClient = () => {
  return {
    isConnected: () => false,
    hSet: async () => {},
    hGetAll: async () => ({}),
    get: async () => null,
    set: async () => {},
    on: () => {},
    connect: async () => {},
    disconnect: async () => {}
  };
};

// Try to create real Redis client, fallback to mock
let redisClient;
try {
  // Redis v4 client configuration
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      reconnectStrategy: () => false // Disable retry
    },
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true
  });

  let redisConnected = false;
  let redisWarningShown = false;

  redisClient.on('connect', () => {
    redisConnected = true;
    console.log('🔗 Connected to Redis');
  });

  redisClient.on('error', (err) => {
    if (!redisWarningShown) {
      console.log('ℹ️ Redis not available - running without Redis cache (this is normal)');
      redisWarningShown = true;
    }
  });

  redisClient.on('end', () => {
    redisConnected = false;
  });

  redisClient.isConnected = () => redisConnected;

  // Try to connect silently with better error handling
  redisClient.connect().catch((error) => {
    if (!redisWarningShown) {
      console.log('ℹ️ Redis not available - running without Redis cache (this is normal)');
      redisWarningShown = true;
    }
    // Set to mock client if connection fails
    redisClient = createMockRedisClient();
  });

} catch (error) {
  console.log('ℹ️ Redis not available - running without Redis cache (this is normal)');
  redisClient = createMockRedisClient();
}

module.exports = redisClient;
