const express = require('express')
const router = express.Router()
const { login,verifyUserToken,formSubmit } = require('../controller/authControlleruser');
const { getFormDataByUserId, getAllUsersData,searchUsersData } = require('../controller/userController');

router.post('/login', login);
router.post('/formsubmit',verifyUserToken, formSubmit);
router.get('/getAllVideos',getAllUsersData);
router.get('/getFormDataByUserId/:userId',verifyUserToken, getFormDataByUserId);
router.get('/searchVideos', searchUsersData);

module.exports = router;
