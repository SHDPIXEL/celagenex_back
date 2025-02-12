const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin"); // Import the Admin model
const User = require("../models/user");
const Form = require("../models/form");
const Video = require("../models/videos");
const ExcelJS = require('exceljs');
const path = require('path');

async function login(req, res) {
  try {
    const { user_id_ent, password_ent } = req.body;
    // Validate request body
    if (!user_id_ent || !password_ent) {
      return res
        .status(400)
        .json({ message: "User emailId and password are required" });
    }

    // Fetch admin details from the database
    const admin = await Admin.findOne({ where: { user_id: user_id_ent } });

    // Check if admin exists
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials (User ID)" });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password_ent, admin.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid credentials (Password)" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin.id, adminName: admin.name }, // Payload
      process.env.JWT_SECRET, // Secret
      { expiresIn: "1h" } // Options
    );

    // Successful response
    return res.status(200).json({ message: "Login Successful", token });
  } catch (error) {
    console.error("Error during admin login:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function verifyAdminToken(req, res, next) {
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

      // Extract user ID (or other parameters) from the decoded token
      const id = decoded.adminId;

      const admin = await Admin.findByPk(id);

      if (!admin) {
        return res.status(404).json({ error: "Admin not found" });
      }

      next();
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function getDashboardStats(req, res) {
  try {
    // Get counts from each model
    const totalUsers = await User.count();
    const totalForms = await Form.count();
    const totalVideos = await Video.count();

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalForms,
        totalVideos
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ 
      success: false,
      message: "Error fetching dashboard statistics"
    });
  }
}

async function createUserA(req, res) {
  try {
    const { name, emp_code, title } = req.body;
    const password = "$2a$12$z6BTfzZ7GtApoAhbuXtndeBkMMBuq8r6K7ism3WNUc72Jl1qV1JeW";

    // Check if user already exists
    const existingUser = await User.findOne({ where: { emp_code } });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists", status: "error" });
    }
    // Create new user with hashed password
    await User.create({ 
      name, 
      emp_code, 
      password, 
      title 
    });

    return res.status(201).json({ message: "User created successfully", status: "success" });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function downloadData(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Get all forms
    const forms = await Form.findAll({
      order: [['createdAt', 'DESC']]
    });

    // Define columns
    worksheet.columns = [
      { header: 'Form ID', key: 'formId', width: 10 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Speciality', key: 'speciality', width: 20 },
      { header: 'Hospital', key: 'hospital', width: 20 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'Uploaded Video', key: 'video', width: 40 },
      { header: 'Uploaded Image', key: 'image', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Processed Video', key: 'video_p', width: 40 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];
    
    // Add data rows
    for (let form of forms) {
      // Get the processed video based on formId from the Video model
      const video = await Video.findOne({
        where: { formId: form.id }
      });

      const video_p = video ? `https://api.cholinationdrive.needsunleashed.com/${video.video.replace('/var/www/back', '')}` : null;

      worksheet.addRow({
        formId: form.id,
        name: form.name,
        speciality: form.speciality,
        hospital: form.hospital,
        city: form.city,
        video: `https://api.cholinationdrive.needsunleashed.com/${form.video}`, 
        image: `https://api.cholinationdrive.needsunleashed.com/${form.image}`,
        status: form.status,
        video_p: video_p,
        createdAt: form.createdAt.toISOString().split('T')[0]
      });
    }

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=data-export.xlsx'
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error downloading data:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating excel file"
    });
  }
}

async function getPendingVideos(req, res) {
  try {
    // Fetch all forms with pending status
    // const pendingForms = await Form.findAll({
    //   where: {
    //     status: 'Pending'
    //   },
    //   order: [['createdAt', 'DESC']]
    // });

    const pendingForms = await Form.findAll({
      where: {
        id: 249
      },
      order: [['createdAt', 'DESC']]
    });


    if (!pendingForms || pendingForms.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending videos found",
        data: []
      });
    }

    console.log(pendingForms);

    for (const form of pendingForms) {
      if (form.video) {
        const videoQueue = require('../batch/queue');
        console.log('Video path:', form.video); // Debug log

      await videoQueue.add("processVideo", {
        videoId: form.id,
        videoPath: path.join(__dirname, "..", form.video),
        templatePath: path.join(__dirname, "../templates/overlay.png"),
          text: `Dr.${form.name} - ${form.speciality} - ${form.hospital} - ${form.city}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Process Initiated",
    });

  } catch (error) {
    console.error("Error fetching pending videos:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching pending videos",
      error: error.message
    });
  }
}

module.exports = {
  login,
  verifyAdminToken,
  getDashboardStats,
  createUserA,
  downloadData,
  getPendingVideos
};
