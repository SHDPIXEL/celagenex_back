const { Worker } = require("bullmq");
const db = require("../connection");
const processVideo = require("./process");
const Form = require("../models/form");
const Video = require("../models/videos");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Redis connection configuration
const redisConfig = {
  host: "127.0.0.1", // Replace with your Redis host (default is localhost)
  port: 6379, // Replace with your Redis port (default is 6379)
};

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// async function downloadFromS3(s3Url, localPath) {
//   const bucketName = process.env.AWS_S3_BUCKET;
//   const key = s3Url.split(".com/")[1];

//   const response = await s3Client.send(
//     new GetObjectCommand({
//       Bucket: bucketName,
//       Key: key,
//     })
//   );

//   return new Promise((resolve, reject) => {
//     const writeStream = fs.createWriteStream(localPath);
//     response.Body.pipe(writeStream)
//       .on("finish", () => resolve())
//       .on("error", reject);
//   });
// }

// Create a Worker
const videoWorker = new Worker(
  "videoProcessing",
  async (job) => {
    const { videoId, videoS3Url, templateS3Url, text } = job.data;
    // const tempDir = path.join(os.tmpdir(), uuidv4());
    // fs.mkdirSync(tempDir, { recursive: true });

    // const tempVideoPath = path.join(tempDir, "input.mp4");
    // const tempTemplatePath = path.join(tempDir, "template.png");
    console.log("Raw data video:",job.data)
    // Debug logging
    console.log("Processed video:", {
      videoId,
      videoS3Url,
      templateS3Url,
      text,
    });

    try {
      // Update form status to "Processing"
      const form = await Form.findByPk(videoId);

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      form.status = "Processing";
      await form.save();

      // Download files from S3
      // await downloadFromS3(videoS3Url, tempVideoPath);
      // await downloadFromS3(templateS3Url, tempTemplatePath);

      // Debug logging
      console.log("Processing video:", {
        videoS3Url,
        templateS3Url,
        text,
        videoId,
      });

      // Process the video
      const processedVideoS3Url = await processVideo(
        videoS3Url,
        templateS3Url,
        text,
        videoId
      );

      // Save the output to the videos table
      await Video.create({
        formId: videoId,
        video: processedVideoS3Url,
      });

      form.status = "Completed";
      await form.save();
    } catch (error) {
      console.error(`Error processing video ${videoId}:`, error);

      // Update form status to "Failed"
      const form = await Form.findByPk(videoId);
      if (form) {
        form.status = "Failed";
        await form.save();
      }

      throw error;
    } finally {
      // Clean up temporary files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Error cleaning up temporary files:', cleanupError);
      }
    }
  },
  { connection: redisConfig } // Pass the Redis configuration here
);

module.exports = videoWorker;
