const express = require('express');
const videoController = require('../controller/videoController');
const router = express.Router();

router.post('/add-to-queue', videoController.addVideoToQueue);

module.exports = router;