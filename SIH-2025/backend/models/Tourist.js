const mongoose = require('mongoose');

const touristSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  status: { type: String, enum: ['safe', 'risk', 'sos'], default: 'safe' },
  geofenceStatus: { type: String, enum: ['inside', 'outside'], default: 'inside' },
  lastUpdate: { type: Date, default: Date.now },
  emergencyContacts: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tourist', touristSchema);
