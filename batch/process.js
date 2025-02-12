const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const os = require("os");
const axios = require("axios");

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// async function uploadToS3(localPath, videoId) {
//   const fileContent = fs.readFileSync(localPath);
//   const key = `processed/video_${videoId}_${Date.now()}.mp4`;

//   await s3Client.send(
//     new PutObjectCommand({
//       Bucket: process.env.AWS_S3_BUCKET,
//       Key: key,
//       Body: fileContent,
//       ContentType: "video/mp4",
//     })
//   );

//   return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
// }

async function processVideo(videoPath, templatePath, text, videoId) {
  //let tempOutputDir = null;
  
  try {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at: ${videoPath}`);
    }
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at: ${templatePath}`);
    }
    
    const outputDir = path.join(__dirname, '../uploads/processed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  
    const outputPath = path.join(outputDir, `processed_${videoId}.mp4`);
    const disclaimerPath = path.join(__dirname, "../templates/disclaimer.jpeg");

    if (!fs.existsSync(disclaimerPath)) {
      throw new Error(`Disclaimer file not found at: ${disclaimerPath}`);
    }
    
    console.log('Using disclaimer image from local templates folder:', disclaimerPath);

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
        const audioStream = metadata.streams.find(
          (stream) => stream.codec_type === "audio"
        );
        const width = videoStream.width;
        const height = videoStream.height;

        // Calculate font sizes based on video dimensions
        const scaleFactor = Math.min(width / 1920, height / 1080);
        const doctorNameSize = Math.round(40 * scaleFactor);
        const regularTextSize = Math.round(28 * scaleFactor);

        let complexFilters = [
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
              fontsize: doctorNameSize,
              x: "(w-text_w)/2",
              y: `h-text_h-${Math.round(160 * scaleFactor)}`,
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
              fontsize: regularTextSize,
              x: "(w-text_w)/2",
              y: `h-text_h-${Math.round(120 * scaleFactor)}`,
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
              fontsize: regularTextSize,
              x: "(w-text_w)/2",
              y: `h-text_h-${Math.round(85 * scaleFactor)}`,
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
              fontsize: regularTextSize,
              x: "(w-text_w)/2",
              y: `h-text_h-${Math.round(55 * scaleFactor)}`,
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
        ];

        let ffmpegCommand = ffmpeg(videoPath)
          .input(templatePath)
          .input(disclaimerPath);

        if (audioStream) {
          // If audio stream exists, add audio processing filters
          complexFilters.push(
            // Create silent audio for disclaimer
            {
              filter: "anullsrc",
              options: "r=44100:cl=stereo",
              outputs: "[disclaimer_audio]",
            },
            // Trim disclaimer audio to match video length
            {
              filter: "atrim",
              options: "duration=5", // 5 seconds for disclaimer
              inputs: "[disclaimer_audio]",
              outputs: "[trimmed_disclaimer_audio]",
            },
            // Concatenate video with disclaimer image and handle audio
            {
              filter: "concat",
              options: "n=2:v=1:a=1",
              inputs: [
                "[v5]", "[0:a]",           // Main video and its audio
                "[looped_disclaimer]", "[trimmed_disclaimer_audio]" // Disclaimer video and audio
              ],
              outputs: ["outv", "outa"],
            }
          );

          ffmpegCommand
            .complexFilter(complexFilters)
            .map("[outv]")
            .map("[outa]")
            .outputOptions([
              "-c:v libx264",
              "-c:a aac",
              "-shortest",  // Add this to ensure audio and video lengths match
              "-preset fast",
              "-movflags +faststart",
            ]);
        } else {
          // If no audio stream, only process video
          complexFilters.push({
            filter: "concat",
            options: "n=2:v=1:a=0",
            inputs: ["[v5]", "[looped_disclaimer]"],
            outputs: ["outv"],
          });

          ffmpegCommand
            .complexFilter(complexFilters)
            .map("[outv]")
            .outputOptions([
              "-c:v libx264",
              "-preset fast",
              "-movflags +faststart",
            ]);
        }

        ffmpegCommand
          .on("start", (commandLine) => {
            console.log("FFmpeg Start");
          })
          .on("progress", (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on("end", () => {
            console.log("FFmpeg processing completed");
            resolve(outputPath);
          })
          .on("error", (err, stdout, stderr) => {
            console.error("FFmpeg error:", err.message);
            console.error("FFmpeg stdout:", stdout);
            console.error("FFmpeg stderr:", stderr);
            reject(err);
          })
          .save(outputPath);
      });
    });
    // Upload processed video to S3
    const s3Url = await uploadToS3(outputPath, videoId);
    return s3Url;
  } catch (error) {
    console.error('Error in processVideo:', error);
    throw error;
  } 
}

module.exports = processVideo;
