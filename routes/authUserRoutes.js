const express = require('express')
const router = express.Router()
const { login,verifyUserToken,formSubmit } = require('../controller/authControlleruser');
const { getFormDataByUserId, getAllUsersData } = require('../controller/userController');

router.post('/login', login);
router.post('/formsubmit',verifyUserToken, formSubmit);
router.get('/getAllVideos',verifyUserToken, getAllUsersData);
router.get('/getFormDataByUserId/:userId',verifyUserToken, getFormDataByUserId);

module.exports = router;