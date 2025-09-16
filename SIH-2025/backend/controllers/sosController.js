const SOS = require('../models/SOS');

// Create SOS alert
const createSOS = async (req, res) => {
  try {
    const { touristId, touristName, location, priority, description } = req.body;
    
    // Find the tourist profile by userId
    const Tourist = require('../models/Tourist');
    const tourist = await Tourist.findOne({ userId: touristId });
    
    if (!tourist) {
      return res.status(404).json({ message: 'Tourist profile not found' });
    }
    
    // Create SOS alert with the correct touristId
    const sosData = {
      touristId: tourist._id, // Use the Tourist model's _id
      touristName: touristName || tourist.name,
      location,
      priority: priority || 'high',
      description: description || 'Emergency SOS triggered by tourist'
    };
    
    const sos = await SOS.create(sosData);
    
    // Update tourist status to 'sos'
    await Tourist.findByIdAndUpdate(tourist._id, { status: 'sos' });
    
    res.status(201).json({ message: 'SOS alert created', sos });
  } catch (error) {
    console.error('Error creating SOS:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all SOS alerts (only active ones)
const getAllSOS = async (req, res) => {
  try {
    const alerts = await SOS.find({ status: 'active' })
      .populate('touristId', 'name email')
      .populate('respondedBy', 'name email role')
      .sort({ createdAt: -1 });
    
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Respond to SOS alert
const respondToSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    const { respondedBy } = req.body;
    
    const sos = await SOS.findByIdAndUpdate(
      sosId,
      { 
        status: 'responded',
        respondedBy,
        responseTime: new Date()
      },
      { new: true }
    );
    
    res.json({ message: 'SOS alert responded', sos });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete SOS alert
const deleteSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    
    console.log('Attempting to delete SOS with ID:', sosId);
    
    // Try to find and delete the SOS alert
    let deletedSOS;
    
    // First try with the exact ID
    deletedSOS = await SOS.findByIdAndDelete(sosId);
    
    // If not found, try to find by any field that might match
    if (!deletedSOS) {
      console.log('SOS not found with exact ID, trying to find by other fields...');
      deletedSOS = await SOS.findOneAndDelete({ 
        $or: [
          { _id: sosId },
          { id: sosId }
        ]
      });
    }
    
    if (!deletedSOS) {
      console.log('SOS alert not found with ID:', sosId);
      return res.status(404).json({ message: 'SOS alert not found' });
    }
    
    // Update tourist status back to 'safe' when SOS is resolved
    const Tourist = require('../models/Tourist');
    await Tourist.findByIdAndUpdate(deletedSOS.touristId, { status: 'safe' });
    
    console.log('SOS alert deleted successfully:', deletedSOS._id);
    res.json({ message: 'SOS alert deleted successfully', deletedId: sosId });
  } catch (error) {
    console.error('Error deleting SOS:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createSOS, getAllSOS, respondToSOS, deleteSOS };
