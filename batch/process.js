const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const os = require("os");
const axios = require("axios");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadToS3(localPath, videoId) {
  const fileContent = fs.readFileSync(localPath);
  const key = `processed/video_${videoId}_${Date.now()}.mp4`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: "video/mp4",
    })
  );

  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

async function processVideo(videoPath, templatePath, text, videoId) {
  let tempOutputDir = null;
  
  try {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at: ${videoPath}`);
    }
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at: ${templatePath}`);
    }
    
    // Create temporary output directory
    tempOutputDir = path.join(os.tmpdir(), `processed_${videoId}`);
    fs.mkdirSync(tempOutputDir, { recursive: true });

    const tempOutputPath = path.join(tempOutputDir, `processed_${videoId}.mp4`);
    
    // Download disclaimer image from S3 to temp directory
    const disclaimerTempPath = path.join(tempOutputDir, 'disclaimer.jpeg');
    
     try {
      console.log('Downloading disclaimer image from:', process.env.DISCLAIMER_S3_URL);
      const response = await axios({
        method: 'get',
        url: process.env.DISCLAIMER_S3_URL,
        responseType: 'arraybuffer',
        timeout: 5000, // 5-second timeout
      });
    
      await fs.promises.writeFile(disclaimerTempPath, response.data);
    
      // Verify the file exists and is accessible
      if (!fs.existsSync(disclaimerTempPath)) {
        throw new Error('Disclaimer file was not created or inaccessible');
      }
    
      console.log('Disclaimer image downloaded successfully to:', disclaimerTempPath);
    } catch (error) {
      throw new Error(`Error downloading disclaimer image: ${error.message}. URL: ${process.env.DISCLAIMER_S3_URL}`);
    }

    const fontPath = path.join(__dirname, "../templates/font/Poppins-Bold.ttf");
    const regularFontPath = path.join(
      __dirname,
      "../templates/font/Poppins-Regular.ttf"
    );

    if (!fs.existsSync(fontPath)) {
      throw new Error(`Font file not found at: ${fontPath}`);
    }
    if (!fs.existsSync(regularFontPath)) {
      throw new Error(`Regular font file not found at: ${regularFontPath}`);
    }

    return new Promise((resolve, reject) => {
      // Ensure text is safe for FFmpeg
      const safeText = text.replace(/['"]/g, "").replace(/[\n\r]/g, " ");
      const [doctorName, speciality, hospital, city] = safeText
        .split("-")
        .map((t) => t.trim());

      // First get video dimensions
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video"
        );
        const width = videoStream.width;
        const height = videoStream.height;

        ffmpeg(videoPath)
          .input(templatePath)
          .input(disclaimerTempPath)
          .complexFilter([
            // Scale the template to match video dimensions
            {
              filter: "scale",
              options: `${width}:${height}`,
              inputs: "[1:v]",
              outputs: "[scaled]",
            },
            // Scale disclaimer image
            {
              filter: "scale",
              options: `${width}:${height}`,
              inputs: "[2:v]",
              outputs: "[scaled_disclaimer]",
            },
            // Overlay the scaled template onto the video
            {
              filter: "overlay",
              options: "0:0",
              inputs: ["[0:v]", "[scaled]"],
              outputs: "[v1]",
            },
            // Add doctor name (bold)
            {
              filter: "drawtext",
              options: {
                text: doctorName,
                fontfile: fontPath,
                fontcolor: "white",
                fontsize: 50,
                x: "(w-text_w)/2",
                y: "h-text_h-150",
              },
              inputs: "[v1]",
              outputs: "[v2]",
            },
            // Add speciality
            {
              filter: "drawtext",
              options: {
                text: speciality,
                fontfile: regularFontPath,
                fontcolor: "white",
                fontsize: 34,
                x: "(w-text_w)/2",
                y: "h-text_h-100",
              },
              inputs: "[v2]",
              outputs: "[v3]",
            },
            // Add hospital
            {
              filter: "drawtext",
              options: {
                text: hospital,
                fontfile: regularFontPath,
                fontcolor: "white",
                fontsize: 34,
                x: "(w-text_w)/2",
                y: "h-text_h-60",
              },
              inputs: "[v3]",
              outputs: "[v4]",
            },
            // Add city
            {
              filter: "drawtext",
              options: {
                text: city,
                fontfile: regularFontPath,
                fontcolor: "white",
                fontsize: 34,
                x: "(w-text_w)/2",
                y: "h-text_h-20",
              },
              inputs: "[v4]",
              outputs: "[v5]",
            },
            // Create a 5 second loop of the disclaimer image
            {
              filter: "loop",
              options: "150:1", // 5 seconds at 30fps
              inputs: "[scaled_disclaimer]",
              outputs: "[looped_disclaimer]",
            },
            // Concatenate video with disclaimer image
            {
              filter: "concat",
              options: "n=2:v=1:a=0",
              inputs: ["[v5]", "[looped_disclaimer]"],
              outputs: "[outv]",
            },
          ])
          .map("[outv]")
          .outputOptions([
            "-c:v libx264",
            "-preset fast",
            "-movflags +faststart",
          ])
          .on("start", (commandLine) => {
            console.log("FFmpeg Start");
          })
          .on("progress", (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on("end", () => {
            console.log("FFmpeg processing completed");
            resolve(tempOutputPath);
          })
          .on("error", (err, stdout, stderr) => {
            console.error("FFmpeg error:", err.message);
            console.error("FFmpeg stdout:", stdout);
            reject(err);
          })
          .save(tempOutputPath);
      });
    });
    // Upload processed video to S3
    const s3Url = await uploadToS3(tempOutputPath, videoId);
    return s3Url;
  } catch (error) {
    console.error('Error in processVideo:', error);
    throw error;
  } finally {
    if (tempOutputDir) {
      try {
        // Delay cleanup slightly to ensure FFmpeg releases file handles
        setTimeout(() => {
          fs.rmSync(tempOutputDir, { recursive: true, force: true });
          console.log('Cleaned up temporary directory:', tempOutputDir);
        }, 1000);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary output directory:', cleanupError);
      }
    }
  }
}

module.exports = processVideo;
