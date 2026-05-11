const { createApp } = require('./src/app');
const PORT = process.env.PORT || 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
