const Videos = require("../models/videos");
const Form = require("../models/form");
const { Op } = require("sequelize");

async function getFormDataByUserId(req, res) {
  try {
    const userId = req.params.userId;

    // Find all forms for the given user ID
    const forms = await Form.findAll({
      where: { emdId: userId },
      order: [["createdAt", "DESC"]],
    });

    if (!forms || forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No forms found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      data: forms,
    });
  } catch (error) {
    console.error("Error fetching user forms:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user forms",
    });
  }
}

async function getAllUsersData(req, res) {
  try {
    // Fetch all videos excluding specific form IDs
    const videos = await Videos.findAll({
      where: {
        formId: {
          [Op.notIn]: [
            1, 2, 3, 4, 5, 6, 7, 9, 14, 1141, 1139, 1054, 1006, 929, 928, 909,
            875, 869, 742, 706, 705, 704, 703, 702, 675, 630, 607, 582, 523,
            519, 518, 517, 502, 501, 488, 472, 462, 455, 442, 406, 404, 385,
            379, 366, 337, 327, 322, 313, 305, 277, 262, 253, 250, 249, 248,
            246, 245, 244, 225, 220, 209, 206, 203, 165, 164, 153, 137, 108, 99,
            93, 59, 55, 53, 49, 37, 28, 24, 15, 220, 244, 245, 246, 249, 250,
          ],
        }, // Exclude these IDs
      },
      order: [["createdAt", "DESC"]],
    });

    // Extract form IDs from videos
    const formIds = videos.map((video) => video.formId);

    // Fetch corresponding forms
    const forms = await Form.findAll({
      where: { id: formIds },
      attributes: ["id", "name", "hospital", "city"], // Fetch only required columns
    });

    // Convert forms array into a key-value map for easy lookup
    const formMap = {};
    forms.forEach((form) => {
      formMap[form.id] = form;
    });

    // Merge video data with corresponding form data
    const mergedData = videos.map((video) => ({
      ...video.toJSON(),
      form: formMap[video.formId] || null, // Attach form data if found, otherwise null
    }));

    return res.status(200).json({
      success: true,
      data: mergedData,
    });
  } catch (error) {
    console.error("Error fetching all data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching data",
    });
  }
}

async function searchUsersData(req, res) {
  try {
    const searchText = req.query.q; // Get search text from query params

    if (!searchText) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Fetch forms that match the search text
    const forms = await Form.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${searchText}%` } },
          { hospital: { [Op.like]: `%${searchText}%` } },
          { city: { [Op.like]: `%${searchText}%` } },
        ],
      },
      attributes: ["id", "name", "hospital", "city"],
    });

    // Extract matching form IDs
    const matchingFormIds = forms.map((form) => form.id);

    if (matchingFormIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [], // No matching data found
      });
    }

    // Fetch videos that are linked to the matching form IDs
    const videos = await Videos.findAll({
      where: {
        formId: { [Op.in]: matchingFormIds }, // Only fetch videos related to found forms
        formId: {
          [Op.notIn]: [
            1, 2, 3, 4, 5, 6, 7, 9, 14, 1141, 1139, 1054, 1006, 929, 928, 909,
            875, 869, 742, 706, 705, 704, 703, 702, 675, 630, 607, 582, 523,
            519, 518, 517, 502, 501, 488, 472, 462, 455, 442, 406, 404, 385,
            379, 366, 337, 327, 322, 313, 305, 277, 262, 253, 250, 249, 248,
            246, 245, 244, 225, 220, 209, 206, 203, 165, 164, 153, 137, 108, 99,
            93, 59, 55, 53, 49, 37, 28, 24, 15, 220, 244, 245, 246, 249, 250,
          ],
        }, // Exclude specific IDs
      },
      order: [["createdAt", "DESC"]],
    });

    // Convert forms array into a key-value map for easy lookup
    const formMap = {};
    forms.forEach((form) => {
      formMap[form.id] = form;
    });

    // Merge video data with corresponding form data
    const mergedData = videos
      .map((video) => ({
        ...video.toJSON(),
        form: formMap[video.formId] || null, // Attach form data if found, otherwise null
      }))
      .filter((video) => video.form !== null); // Remove entries where form is null

    return res.status(200).json({
      success: true,
      data: mergedData,
    });
  } catch (error) {
    console.error("Error searching data:", error);
    return res.status(500).json({
      success: false,
      message: "Error searching data",
    });
  }
}

module.exports = {
  getFormDataByUserId,
  getAllUsersData,
  searchUsersData,
};
