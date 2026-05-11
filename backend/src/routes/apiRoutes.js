const { Router } = require('express');
const { getHealth } = require('../controllers/healthController');
const { postChat } = require('../controllers/chatController');

const router = Router();

router.get('/health', getHealth);
router.post('/chat', postChat);

module.exports = router;
