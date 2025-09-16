const { Sequelize } = require('sequelize');
const { DataTypes } = require('sequelize');

// PostgreSQL connection configuration
const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'tourist_tracking',
  process.env.POSTGRES_USER || 'postgres',
  process.env.POSTGRES_PASSWORD || 'password',
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
);

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('🗄️ PostgreSQL connection established successfully');
    
    // Enable PostGIS extension
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('🗺️ PostGIS extension enabled');
    
    return true;
  } catch (error) {
    console.log('ℹ️ PostgreSQL not available - running without analytics (this is normal)');
    return false;
  }
};

// Initialize database and create tables
const initializeDatabase = async () => {
  try {
    const connected = await testConnection();
    
    if (connected) {
      // Sync all models
      await sequelize.sync({ alter: true });
      console.log('📊 Database tables synchronized');
    } else {
      console.log('📊 Running without PostgreSQL - analytics features disabled');
    }
    
    return true; // Always return true to allow server to start
  } catch (error) {
    console.log('ℹ️ Database initialization failed - running without analytics (this is normal)');
    return true; // Allow server to start even without database
  }
};

module.exports = {
  sequelize,
  DataTypes,
  testConnection,
  initializeDatabase
};
