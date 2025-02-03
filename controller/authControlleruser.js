const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Import the User model
const Form = require("../models/form"); // Import the User model
const fs = require("fs");
const path = require("path");
const sharp = require("sharp"); // For image validation
const videoMeta = require("fluent-ffmpeg"); // For video validation
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Initialize S3 client
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// Ensure uploads directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

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
    const { name, speciality, hospital, city } = req.body;
    const imageFile = req.files?.image;
    const videoFile = req.files?.video;

    if (!speciality || !hospital || !city) {
      return res
        .status(400)
        .json({ error: "Speciality, hospital, and city are required fields." });
    }

    let imagePath = null;
    let videoPath = null;

    const imageDir = path.join(__dirname, "../uploads/images");
    const videoDir = path.join(__dirname, "../uploads/videos");

    ensureDirectoryExists(imageDir);
    ensureDirectoryExists(videoDir);

    // Save image to local storage
    if (imageFile) {
      const allowedImageTypes = ["image/jpeg", "image/png"];
      if (!allowedImageTypes.includes(imageFile.mimetype)) {
        return res.status(400).json({ error: "Image must be in JPEG or PNG format." });
      }

      const imageFileName = `image_${Date.now()}_${user.id}.jpg`;
      const imageFilePath = path.join(imageDir, imageFileName);

      await sharp(imageFile.data).jpeg({ quality: 80 }).toFile(imageFilePath);
      imagePath = `/uploads/images/${imageFileName}`;
    }

    // Save and validate video
    if (videoFile) {
      const allowedVideoTypes = ["video/mp4"];
      if (!allowedVideoTypes.includes(videoFile.mimetype)) {
        return res.status(400).json({ error: "Video must be in MP4 format." });
      }

      const videoFileName = `video_${Date.now()}_${user.id}.mp4`;
      const videoFilePath = path.join(videoDir, videoFileName);
      const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.mp4`);

      try {
        fs.writeFileSync(tempFilePath, videoFile.data);

        // Validate video properties
        await new Promise((resolve, reject) => {
          videoMeta.ffprobe(tempFilePath, (err, metadata) => {
            if (err) return reject(err);

            const { duration, size } = metadata.format;
            const streams = metadata.streams || [];
            const videoStream = streams.find((s) => s.codec_type === "video");

            if (size > 100 * 1024 * 1024) return reject(new Error("Video exceeds 100MB."));
            if (duration > 60) return reject(new Error("Video exceeds 60 seconds."));
            if (videoStream) {
              const { width, height } = videoStream;
              const ratio = width / height;
              if (Math.abs(ratio - 16 / 9) > 0.01) {
                return reject(new Error("Video must have a 16:9 aspect ratio."));
              }
            }
            resolve();
          });
        });

        // Move validated video to local storage
        fs.renameSync(tempFilePath, videoFilePath);
        videoPath = `/uploads/videos/${videoFileName}`;
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    // Create form entry
    const form = await Form.create({
      emdId: user.id,
      name,
      speciality,
      hospital,
      city,
      image: imagePath,
      video: videoPath,
      status: "Pending",
    });

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
