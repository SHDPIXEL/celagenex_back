const Videos = require('../models/videos');
const Form = require('../models/form');
const { Op } = require("sequelize");

async function getFormDataByUserId(req, res) {
  try {
    const userId = req.params.userId;

    // Find all forms for the given user ID
    const forms = await Form.findAll({
      where: { emdId: userId },
      order: [['createdAt', 'DESC']]
    });

    if (!forms || forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No forms found for this user"
      });
    }

    return res.status(200).json({
      success: true,
      data: forms
    });

  } catch (error) {
    console.error("Error fetching user forms:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user forms"
    });
  }
}

async function getAllUsersData(req, res) {
  try {
    // Get all videos excluding specific IDs
    const videos = await Videos.findAll({
      where: {
        id: { [Op.notIn]: [1, 2, 3, 4, 5, 6, 7, 9, 14] } // Exclude these IDs
      },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: videos
    });

  } catch (error) {
    console.error("Error fetching all data:", error);
    return res.status(500).json({
      success: false, 
      message: "Error fetching data"
    });
  }
}


module.exports = {
  getFormDataByUserId,
  getAllUsersData
};
