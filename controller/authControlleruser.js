const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Import the User model
const Form = require("../models/form"); // Import the User model
const fs = require("fs");
const path = require("path");
const sharp = require("sharp"); // For image validation
const videoMeta = require("fluent-ffmpeg"); // For video validation

// User Login Function
async function login(req, res) {
  try {
    const { emp_code, password } = req.body;

    // Validate request body
    if (!emp_code || !password) {
      return res
        .status(400)
        .json({ message: "Employee code and password are required" });
    }

    // Fetch user details from the database
    const user = await User.findOne({ where: { emp_code } });

    // Check if user exists
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid credentials (Employee Code)" });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid credentials (Password)" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id }, // Payload
      process.env.JWT_SECRET, // Secret
      { expiresIn: "1h" } // Options
    );

    // Successful response
    return res.status(200).json({ message: "Login Successful", token });
  } catch (error) {
    console.error("Error during user login:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Token Verification Middleware
async function verifyUserToken(req, res, next) {
  try {
    // Get the token from the Authorization header
    const token = req.headers.authorization?.split(" ")[1]; // Assuming format: "Bearer <token>"
    if (!token) {
      return res.status(403).json({ message: "Token is required" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Extract user ID from the decoded token
      const id = decoded.userId;
      // Find user by ID
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Attach user to the request object for downstream use
      req.user_logged = user;

      // Proceed to the next middleware or route
      next();
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function formSubmit(req, res) {
  try {
    const user = req.user_logged;
    // Extract form data from request body
    const { name, speciality, hospital, city } = req.body;
    const imageFile = req.files?.image; // Assuming the frontend sends an image file with `image` key
    const videoFile = req.files?.video; // Assuming the frontend sends a video file with `video` key

    // Validate required fields
    if (!speciality || !hospital || !city) {
      return res
        .status(400)
        .json({ error: "Speciality, hospital, and city are required fields." });
    }

    let imagePath = null;
    let videoPath = null;

    // Save image to folder and validate
    if (imageFile) {
      const allowedImageTypes = ["image/jpeg", "image/png"];
      if (!allowedImageTypes.includes(imageFile.mimetype)) {
        return res
          .status(400)
          .json({ error: "Image must be in JPEG or PNG format." });
      }

      const imageDir = path.join(__dirname, "../uploads/images");
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true }); // Ensure directory exists
      }

      const imageFileName = `image_${Date.now()}_${user.id}.jpg`;
      imagePath = path.join(imageDir, imageFileName);
      await sharp(imageFile.data).toFile(imagePath); // Save image to folder
      imagePath = `/uploads/images/${imageFileName}`; // Relative path for storing in DB
    }

    // Save video to folder and validate
    if (videoFile) {
      const allowedVideoTypes = ["video/mp4"];
      if (!allowedVideoTypes.includes(videoFile.mimetype)) {
        return res.status(400).json({ error: "Video must be in MP4 format." });
      }

      const videoDir = path.join(__dirname, "../uploads/videos");
      if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true }); // Ensure directory exists
      }

      const videoFileName = `video_${Date.now()}_${user.id}.mp4`;
      videoPath = path.join(videoDir, videoFileName);
      fs.writeFileSync(videoPath, videoFile.data); // Save video to folder

      // Validate video properties (size, duration, aspect ratio)
      await new Promise((resolve, reject) => {
        videoMeta.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            console.error("Error while running ffprobe:", err);
            return;
          }

          const { duration, size } = metadata.format;
          const streams = metadata.streams || [];
          const videoStream = streams.find((s) => s.codec_type === "video");

          // Check size
          if (size > 100 * 1024 * 1024) {
            return reject(
              new Error("Video exceeds the maximum size of 100MB.")
            );
          }

          // Check duration
          if (duration > 60) {
            return reject(
              new Error("Video exceeds the maximum duration of 60 seconds.")
            );
          }

          // Check aspect ratio (16:9)
          if (videoStream) {
            const { width, height } = videoStream;
            const ratio = width / height;
            if (Math.abs(ratio - 16 / 9) > 0.01) {
              return reject(
                new Error("Video must have an aspect ratio of 16:9.")
              );
            }
          }

          resolve();
        });
      });

      videoPath = `/uploads/videos/${videoFileName}`; // Relative path for storing in DB
    }

    // Create the form
    const form = await Form.create({
      emdId: user.id,
      name,
      speciality,
      hospital,
      city,
      image: imagePath,
      video: videoPath,
      status: 'Pending', // Add status field
    });

    // Add video to processing queue
    if (videoPath) {
      const videoQueue = require('../batch/queue');
      const absoluteVideoPath = path.join(__dirname, '..', videoPath);
      const templatePath = path.join(__dirname, '../templates/overlay.png');
      
      // Ensure template exists
      if (!fs.existsSync(templatePath)) {
        console.error('Template file missing:', templatePath);
        return res.status(500).json({ 
          error: "Video processing configuration error" 
        });
      }

      await videoQueue.add('processVideo', {
        videoId: form.id,
        videoPath: absoluteVideoPath,
        templatePath: templatePath,
        text: `Dr.${name} - ${speciality} - ${hospital} - ${city}`
      });
    }

    // Return success response
    return res.status(201).json({ 
      message: "Form submitted successfully",
      status: "Video processing queued"
    });
  } catch (error) {
    console.error("Error during form submission:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  login,
  verifyUserToken,
  formSubmit,
};
