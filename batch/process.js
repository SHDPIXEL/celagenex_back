const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

async function processVideo(videoPath, templatePath, text, videoId) {
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
  const disclaimerPath = path.join(__dirname, '../templates/disclaimer.jpeg');
  const fontPath = path.join(__dirname, '../templates/font/Poppins-Bold.ttf');
  const regularFontPath = path.join(__dirname, '../templates/font/Poppins-Regular.ttf');

  if (!fs.existsSync(disclaimerPath)) {
    throw new Error(`Disclaimer image not found at: ${disclaimerPath}`);
  }
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font file not found at: ${fontPath}`);
  }
  if (!fs.existsSync(regularFontPath)) {
    throw new Error(`Regular font file not found at: ${regularFontPath}`);
  }

  return new Promise((resolve, reject) => {
    // Ensure text is safe for FFmpeg
    const safeText = text.replace(/['"]/g, '').replace(/[\n\r]/g, ' ');
    const [doctorName, speciality, hospital, city] = safeText.split('-').map(t => t.trim());

    // First get video dimensions
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      const width = videoStream.width;
      const height = videoStream.height;

      ffmpeg(videoPath)
        .input(templatePath)
        .input(disclaimerPath)
        .complexFilter([
          // Scale the template to match video dimensions
          {
            filter: 'scale',
            options: `${width}:${height}`,
            inputs: '[1:v]',
            outputs: '[scaled]'
          },
          // Scale disclaimer image
          {
            filter: 'scale',
            options: `${width}:${height}`,
            inputs: '[2:v]',
            outputs: '[scaled_disclaimer]'
          },
          // Overlay the scaled template onto the video
          {
            filter: 'overlay',
            options: '0:0',
            inputs: ['[0:v]', '[scaled]'],
            outputs: '[v1]'
          },
          // Add doctor name (bold)
          {
            filter: 'drawtext',
            options: {
              text: doctorName,
              fontfile: fontPath,
              fontcolor: 'white',
              fontsize: 50,
              x: '(w-text_w)/2',
              y: 'h-text_h-150',
            },
            inputs: '[v1]',
            outputs: '[v2]'
          },
          // Add speciality
          {
            filter: 'drawtext',
            options: {
              text: speciality,
              fontfile: regularFontPath,
              fontcolor: 'white',
              fontsize: 34,
              x: '(w-text_w)/2',
              y: 'h-text_h-100',
            },
            inputs: '[v2]',
            outputs: '[v3]'
          },
          // Add hospital
          {
            filter: 'drawtext',
            options: {
              text: hospital,
              fontfile: regularFontPath,
              fontcolor: 'white',
              fontsize: 34,
              x: '(w-text_w)/2',
              y: 'h-text_h-60',
            },
            inputs: '[v3]',
            outputs: '[v4]'
          },
          // Add city
          {
            filter: 'drawtext',
            options: {
              text: city,
              fontfile: regularFontPath,
              fontcolor: 'white',
              fontsize: 34,
              x: '(w-text_w)/2',
              y: 'h-text_h-20',
            },
            inputs: '[v4]',
            outputs: '[v5]'
          },
          // Create a 5 second loop of the disclaimer image
          {
            filter: 'loop',
            options: '150:1', // 5 seconds at 30fps
            inputs: '[scaled_disclaimer]',
            outputs: '[looped_disclaimer]'
          },
          // Concatenate video with disclaimer image
          {
            filter: 'concat',
            options: 'n=2:v=1:a=0',
            inputs: ['[v5]', '[looped_disclaimer]'],
            outputs: '[outv]'
          }
        ])
        .map('[outv]')
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-movflags +faststart'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg Start');
        })
        .on('progress', (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          console.log('FFmpeg processing completed');
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stdout:', stdout);
          reject(err);
        })
        .save(outputPath);
    });
  });
}

module.exports = processVideo;
