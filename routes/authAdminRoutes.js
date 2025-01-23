const express = require('express')
const router = express.Router()
const { login,getDashboardStats, verifyAdminToken,createUserA, downloadData } = require('../controller/authControlleradmin');

router.post('/login', login);
router.get('/dashboard-stats',verifyAdminToken, getDashboardStats);
router.post('/create-user',verifyAdminToken, createUserA);
router.get('/download-data',verifyAdminToken, downloadData);

module.exports = router;