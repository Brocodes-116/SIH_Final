const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  touristId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tourist', required: true },
  touristName: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  status: { type: String, enum: ['active', 'responded', 'resolved'], default: 'active' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
  description: String,
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  responseTime: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SOS', sosSchema);
