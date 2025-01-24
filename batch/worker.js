const { Worker } = require("bullmq");
const db = require("../connection"); // Your database connection
const processVideo = require("./process");
const Form = require("../models/form");
const Video = require("../models/videos");
const fs = require('fs');

// Redis connection configuration
const redisConfig = {
  host: "127.0.0.1", 
  port: 6379,
};

// Create a Worker
const videoWorker = new Worker(
  "videoProcessing",
  async (job) => {
    const { videoId, videoPath, templatePath, text } = job.data;

    // Debug logging
    console.log('Processing video:', {
      videoId,
      videoPath,
      templatePath,
      text,
      exists: {
        video: fs.existsSync(videoPath),
        template: fs.existsSync(templatePath)
      }
    });

    try {
      // Update form status to "Processing"
      const form = await Form.findByPk(videoId);

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      form.status = "Processing";
      await form.save();

      //await db.query('UPDATE form SET status = ? WHERE id = ?', ['Processing', videoId]);

      // Process the video
      const outputPath = await processVideo(
        videoPath,
        templatePath,
        text,
        videoId
      );

      // Save the output to the videos table
      //await db.query('INSERT INTO videos (form_id, path) VALUES (?, ?)', [videoId, outputPath]);
      await Video.create({
        formId: videoId,
        video: outputPath,
      });

      // Update form status to "Completed"
      //await db.query('UPDATE form SET status = ? WHERE id = ?', ['Completed', videoId]);
      form.status = "Completed";
      await form.save();
    } catch (error) {
      console.error(`Error processing video ${videoId}:`, error);

      // Update form status to "Failed"
      await db.query("UPDATE form SET status = ? WHERE id = ?", [
        "Failed",
        videoId,
      ]);
    }
  },
  { connection: redisConfig } // Pass the Redis configuration here
);

module.exports = videoWorker;
