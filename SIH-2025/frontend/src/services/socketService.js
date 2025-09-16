import { io } from 'socket.io-client';

/**
 * Socket.IO service for real-time communication
 * Handles connection, authentication, and event management
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect to Socket.IO server with authentication
   * @param {string} token - JWT authentication token
   * @param {string} serverUrl - Server URL (default: localhost:5001)
   */
  connect(token, serverUrl = 'http://localhost:5001') {
    if (this.socket && this.isConnected) {
      console.log('Socket already connected');
      return this.socket;
    }

    try {
      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      this.setupEventHandlers();
      return this.socket;
    } catch (error) {
      console.error('Failed to connect to Socket.IO server:', error);
      // Fail gracefully; keep UI working without socket
      this.socket = null;
      this.isConnected = false;
      return null;
    }
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket.IO server:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      this.isConnected = false;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      } else {
        console.error('❌ Max reconnection attempts reached');
      }
    });

    // Authentication error
    this.socket.on('error', (error) => {
      console.error('❌ Socket.IO error:', error);
    });
  }

  /**
   * Send position update
   * @param {Object} positionData - Position data object
   */
  sendPositionUpdate(positionData) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected. Cannot send position update.');
      return false;
    }

    try {
      this.socket.emit('position:update', positionData);
      console.log('📍 Position update sent:', positionData);
      return true;
    } catch (error) {
      console.error('Failed to send position update:', error);
      return false;
    }
  }

  /**
   * Start watching a user (for authorities)
   * @param {string} userId - User ID to watch
   */
  startWatching(userId) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected. Cannot start watching.');
      return false;
    }

    try {
      this.socket.emit('watch:start', { userId });
      console.log(`👁️ Started watching user: ${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to start watching:', error);
      return false;
    }
  }

  /**
   * Stop watching a user (for authorities)
   * @param {string} userId - User ID to stop watching
   */
  stopWatching(userId) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected. Cannot stop watching.');
      return false;
    }

    try {
      this.socket.emit('watch:stop', { userId });
      console.log(`👁️ Stopped watching user: ${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to stop watching:', error);
      return false;
    }
  }

  /**
   * Listen for location changes
   * @param {Function} callback - Callback function for location updates
   */
  onLocationChanged(callback) {
    if (!this.socket) return;

    this.socket.on('location:changed', (data) => {
      console.log('📍 Location changed:', data);
      callback(data);
    });
  }

  /**
   * Listen for alerts (for authorities)
   * @param {Function} callback - Callback function for alerts
   */
  onAlert(callback) {
    if (!this.socket) return;

    this.socket.on('alert', (data) => {
      console.log('🚨 Alert received:', data);
      callback(data);
    });
  }

  /**
   * Listen for errors
   * @param {Function} callback - Callback function for errors
   */
  onError(callback) {
    if (!this.socket) return;

    this.socket.on('error', (data) => {
      console.error('❌ Socket error:', data);
      callback(data);
    });
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 Disconnected from Socket.IO server');
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create and export a singleton instance
const socketService = new SocketService();
export default socketService;
