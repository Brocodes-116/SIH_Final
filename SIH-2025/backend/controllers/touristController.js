const Tourist = require('../models/Tourist');

// Get all tourists
const getAllTourists = async (req, res) => {
  try {
    const tourists = await Tourist.find().populate('userId', 'name email role');
    res.json({ tourists });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new tourist
const createTourist = async (req, res) => {
  try {
    const tourist = await Tourist.create(req.body);
    res.status(201).json({ message: 'Tourist created', tourist });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update tourist location
const updateLocation = async (req, res) => {
  try {
    const { touristId } = req.params;
    const { latitude, longitude } = req.body;
    
    const tourist = await Tourist.findByIdAndUpdate(
      touristId,
      { 
        location: { latitude, longitude },
        lastUpdate: new Date()
      },
      { new: true }
    );
    
    res.json({ message: 'Location updated', tourist });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getAllTourists, createTourist, updateLocation };
