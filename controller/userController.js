const Videos = require("../models/videos");
const Form = require("../models/form");
const { Op } = require("sequelize");

const COMMON_VALUES = [
  1141, 1139, 1089, 1088, 1087, 1070, 1054, 1054, 1049, 1041, 1035,
  1019, 1006, 1000, 991, 975, 972, 952, 945, 940, 930, 929, 928, 927,
  913, 910, 909, 897, 889, 884, 883, 882, 881, 880, 875, 869, 867,
  863, 860, 859, 858, 856, 855, 853, 852, 850, 848, 847, 841, 838,
  837, 835, 834, 832, 815, 812, 811, 803, 802, 799, 796, 792, 791,
  789, 782, 773, 772, 758, 757, 756, 755, 754, 753, 751, 750, 743,
  742, 740, 721, 720, 718, 713, 711, 709, 706, 705, 704, 703, 702,
  701, 698, 697, 692, 687, 686, 683, 682, 679, 675, 671, 665, 660,
  651, 649, 630, 624, 623, 622, 621, 615, 613, 612, 611, 610, 609,
  607, 599, 598, 595, 592, 584, 582, 581, 573, 570, 568, 562, 554,
  549, 544, 537, 533, 529, 527, 523, 519, 519, 518, 518, 517, 517,
  516, 502, 501, 496, 490, 488, 481, 474, 472, 471, 467, 462, 455,
  451, 449, 442, 430, 429, 427, 425, 415, 410, 409, 408, 406, 404,
  392, 391, 389, 385, 380, 379, 376, 374, 366, 354, 352, 349, 337,
  332, 327, 322, 318, 313, 310, 305, 289, 277, 271, 270, 267, 263,
  262, 253, 253, 252, 250, 250, 249, 249, 248, 246, 246, 245, 245,
  244, 244, 238, 237, 236, 228, 226, 225, 225, 220, 220, 219, 209,
  206, 203, 183, 182, 177, 174, 165, 164, 162, 156, 153, 153, 149,
  148, 147, 145, 144, 143, 141, 140, 139, 137, 131, 129, 127, 108,
  108, 99, 93, 93, 92, 59, 59, 57, 56, 55, 53, 51, 49, 37, 37, 28, 24,
  15,9,7,6,4,2,1,
]

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
    // Extract pagination params from request query
    let { page, limit } = req.query;
    page = parseInt(page) || 1; // Default to page 1
    limit = parseInt(limit) || 9; // Default to 10 records per page
    const offset = (page - 1) * limit;


    // Fetch total count of all videos (excluding specific form IDs)
    const allVideosCount = await Videos.count({
      where: {
        formId: {
          [Op.notIn]: COMMON_VALUES,
        },
      },
    });

    // Fetch total count of videos (excluding specific form IDs)
    const totalCount = await Videos.count({
      where: {
        formId: {
          [Op.notIn]: COMMON_VALUES,
        },
      },
    });

    // console.log("Total videos count:", totalCount);


    // Fetch videos with pagination
    const videos = await Videos.findAll({
      where: {
        formId: {
          [Op.notIn]: COMMON_VALUES,
        },
      },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // console.log("videos",videos)

    // Extract form IDs from videos
    const formIds = videos.map((video) => video.formId);

    // Fetch corresponding forms
    const forms = await Form.findAll({
      where: { id: formIds },
      attributes: ["id", "name", "hospital", "city"],
    });

    // Convert forms array into a key-value map for easy lookup
    const formMap = {};
    forms.forEach((form) => {
      formMap[form.id] = form;
    });

    // Merge video data with corresponding form data
    const mergedData = videos.map((video) => ({
      ...video.toJSON(),
      form: formMap[video.formId] || null,
    }));

    // Calculate total pages
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

    return res.status(200).json({
      success: true,
      data: mergedData,
      pagination: {
        totalRecords: totalCount,
        totalPages: totalPages > 0 ? totalPages : 1, // Ensure at least 1 page
        currentPage: page,
        limit,
      },
      allVideosCount,
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
    let { page, limit } = req.query;
    page = parseInt(page) || 1; // Default to page 1
    limit = parseInt(limit) || 9; // Default to 9 records per page
    const offset = (page - 1) * limit;

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

    const matchingFormIds = forms.map((form) => form.id);
    if (matchingFormIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          totalRecords: 0,
          totalPages: 1,
          currentPage: page,
          limit,
        },
      });
    }

    // Fetch total count of matching videos
    const totalCount = await Videos.count({
      where: {
        formId: { [Op.in]: matchingFormIds, [Op.notIn]: COMMON_VALUES },
      },
    });

    // Fetch paginated videos
    const videos = await Videos.findAll({
      where: {
        formId: { [Op.in]: matchingFormIds, [Op.notIn]: COMMON_VALUES },
      },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Convert forms array into a key-value map for easy lookup
    const formMap = {};
    forms.forEach((form) => {
      formMap[form.id] = form;
    });

    // Merge video data with corresponding form data
    const mergedData = videos.map((video) => ({
      ...video.toJSON(),
      form: formMap[video.formId] || null,
    }));

    // Calculate total pages
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

    return res.status(200).json({
      success: true,
      data: mergedData,
      pagination: {
        totalRecords: totalCount,
        totalPages: totalPages > 0 ? totalPages : 1,
        currentPage: page,
        limit,
      },
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
