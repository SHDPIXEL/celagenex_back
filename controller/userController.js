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
    // Fetch all videos excluding specific form IDs
    const videos = await Videos.findAll({
      where: {
        formId: { [Op.notIn]: [1, 2, 3, 4, 5, 6, 7, 9, 14] } // Exclude these IDs
      },
      order: [['createdAt', 'DESC']]
    });

    // Extract form IDs from videos
    const formIds = videos.map(video => video.formId);

    // Fetch corresponding forms
    const forms = await Form.findAll({
      where: { id: formIds },
      attributes: ['id', 'name', 'speciality', 'hospital','city'] // Fetch only required columns
    });

    // Convert forms array into a key-value map for easy lookup
    const formMap = {};
    forms.forEach(form => {
      formMap[form.id] = form;
    });

    // Merge video data with corresponding form data
    const mergedData = videos.map(video => ({
      ...video.toJSON(),
      form: formMap[video.formId] || null // Attach form data if found, otherwise null
    }));

    return res.status(200).json({
      success: true,
      data: mergedData
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
