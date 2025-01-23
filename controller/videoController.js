const videoQueue = require('../batch/queue');
const db = require('../connection');

// Add a job to the queue
exports.addVideoToQueue = async (req, res) => {
  try {
    const { videoId } = req.body; // Assume videoId comes from the request
    const video = await db.query('SELECT * FROM form WHERE id = ?', [videoId]);

    if (video[0].status !== 'Pending') {
      return res.status(400).json({ message: 'Video already processed or in progress' });
    }

    await videoQueue.add('processVideo', {
      videoId,
      videoPath: video[0].video_path,
      templatePath: 'path/to/template.png',
      text: video[0].text,
    });

    res.status(200).json({ message: 'Video added to queue for processing' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add video to queue' });
  }
};