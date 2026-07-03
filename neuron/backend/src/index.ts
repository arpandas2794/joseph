import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import extractorRoutes from './routes/extractor';
import voiceRoutes from './routes/voice';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', extractorRoutes);
app.use('/api', voiceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
