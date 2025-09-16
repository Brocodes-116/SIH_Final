const { DataTypes } = require('../config/postgres');
const { sequelize } = require('../config/postgres');

/**
 * Location History Model
 * Stores historical location data with PostGIS support
 */
const LocationHistory = sequelize.define('LocationHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // PostGIS geometry point (longitude, latitude)
  location: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    allowNull: false
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      min: -90,
      max: 90
    }
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      min: -180,
      max: 180
    }
  },
  accuracy: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  altitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  heading: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: {
      min: 0,
      max: 360
    }
  },
  speed: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    index: true
  },
  // Additional metadata
  deviceInfo: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  networkInfo: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  // Privacy settings at time of capture
  anonymized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  retentionDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  // Zone information
  zoneId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  zoneName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  zoneType: {
    type: DataTypes.ENUM('restricted', 'safe', 'none'),
    defaultValue: 'none'
  },
  // Movement analysis
  distanceFromPrevious: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  timeFromPrevious: {
    type: DataTypes.INTEGER, // seconds
    allowNull: true
  },
  // Data quality indicators
  qualityScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: {
      min: 0,
      max: 1
    }
  },
  // Flags
  isEmergency: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isAnomalous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'location_history',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'timestamp']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['zoneId']
    },
    {
      fields: ['isEmergency']
    },
    {
      fields: ['isAnomalous']
    },
    // PostGIS spatial index
    {
      fields: ['location'],
      using: 'GIST'
    }
  ]
});

// Add PostGIS methods
LocationHistory.addHook('beforeCreate', (instance) => {
  // Create PostGIS point from lat/lng
  if (instance.latitude && instance.longitude) {
    instance.location = {
      type: 'Point',
      coordinates: [instance.longitude, instance.latitude]
    };
  }
});

LocationHistory.addHook('beforeUpdate', (instance) => {
  // Update PostGIS point if coordinates changed
  if (instance.changed('latitude') || instance.changed('longitude')) {
    instance.location = {
      type: 'Point',
      coordinates: [instance.longitude, instance.latitude]
    };
  }
});

// Instance methods
LocationHistory.prototype.getDistanceFrom = function(otherLocation) {
  // Calculate distance using PostGIS ST_Distance
  return sequelize.query(
    'SELECT ST_Distance(ST_GeogFromText(?), ST_GeogFromText(?)) as distance',
    {
      replacements: [
        `POINT(${this.longitude} ${this.latitude})`,
        `POINT(${otherLocation.longitude} ${otherLocation.latitude})`
      ],
      type: sequelize.QueryTypes.SELECT
    }
  );
};

LocationHistory.prototype.getBearingTo = function(otherLocation) {
  // Calculate bearing using PostGIS ST_Azimuth
  return sequelize.query(
    'SELECT ST_Azimuth(ST_GeogFromText(?), ST_GeogFromText(?)) * 180 / PI() as bearing',
    {
      replacements: [
        `POINT(${this.longitude} ${this.latitude})`,
        `POINT(${otherLocation.longitude} ${otherLocation.latitude})`
      ],
      type: sequelize.QueryTypes.SELECT
    }
  );
};

// Class methods
LocationHistory.getLocationsInRadius = function(centerLat, centerLng, radiusMeters) {
  return sequelize.query(
    `SELECT * FROM location_history 
     WHERE ST_DWithin(
       location::geography, 
       ST_GeogFromText('POINT(${centerLng} ${centerLat})'), 
       ${radiusMeters}
     )
     ORDER BY timestamp DESC`,
    {
      type: sequelize.QueryTypes.SELECT
    }
  );
};

LocationHistory.getLocationsInPolygon = function(polygonCoordinates) {
  const polygonWKT = `POLYGON((${polygonCoordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ')}))`;
  
  return sequelize.query(
    `SELECT * FROM location_history 
     WHERE ST_Within(location, ST_GeomFromText('${polygonWKT}', 4326))
     ORDER BY timestamp DESC`,
    {
      type: sequelize.QueryTypes.SELECT
    }
  );
};

LocationHistory.getMovementPath = function(userId, startTime, endTime) {
  return sequelize.query(
    `SELECT 
       ST_AsGeoJSON(location) as geojson,
       latitude,
       longitude,
       timestamp,
       accuracy,
       speed
     FROM location_history 
     WHERE userId = :userId 
       AND timestamp BETWEEN :startTime AND :endTime
     ORDER BY timestamp ASC`,
    {
      replacements: { userId, startTime, endTime },
      type: sequelize.QueryTypes.SELECT
    }
  );
};

LocationHistory.getHeatmapData = function(bounds, startTime, endTime) {
  const { north, south, east, west } = bounds;
  
  return sequelize.query(
    `SELECT 
       ST_X(location) as lng,
       ST_Y(location) as lat,
       COUNT(*) as density
     FROM location_history 
     WHERE timestamp BETWEEN :startTime AND :endTime
       AND ST_Within(location, ST_MakeEnvelope(:west, :south, :east, :north, 4326))
     GROUP BY ST_SnapToGrid(location, 0.001)
     ORDER BY density DESC`,
    {
      replacements: { startTime, endTime, north, south, east, west },
      type: sequelize.QueryTypes.SELECT
    }
  );
};

LocationHistory.getAnalytics = function(userId, startTime, endTime) {
  return sequelize.query(
    `SELECT 
       COUNT(*) as total_points,
       AVG(accuracy) as avg_accuracy,
       MIN(accuracy) as min_accuracy,
       MAX(accuracy) as max_accuracy,
       AVG(speed) as avg_speed,
       MAX(speed) as max_speed,
       SUM(distanceFromPrevious) as total_distance,
       AVG(distanceFromPrevious) as avg_step_distance,
       COUNT(CASE WHEN isEmergency = true THEN 1 END) as emergency_count,
       COUNT(CASE WHEN isAnomalous = true THEN 1 END) as anomalous_count
     FROM location_history 
     WHERE userId = :userId 
       AND timestamp BETWEEN :startTime AND :endTime`,
    {
      replacements: { userId, startTime, endTime },
      type: sequelize.QueryTypes.SELECT
    }
  );
};

module.exports = LocationHistory;
