const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', (req, res) => {
  const { message, topic } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Message is required',
    });
  }

  const trimmedMessage = message.trim();
  const safeTopic = typeof topic === 'string' && topic.trim() ? topic.trim() : 'Общий';

  return res.json({
    reply: `Тема "${safeTopic}": получил вопрос "${trimmedMessage}". Это демо-ответ от backend на Express.`,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
