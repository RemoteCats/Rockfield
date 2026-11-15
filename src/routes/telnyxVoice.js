'use strict';

const router = require('express').Router();
const voiceController = require('../controllers/telnyxVoiceController');

router.post('/voice', voiceController.handle);

module.exports = router;
