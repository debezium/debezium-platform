import express from 'express';
import cors from 'cors';
import { config } from './config';
import { chatRouter } from './routes/chat';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/', chatRouter);

app.listen(config.port, () => {
  console.log(`Chat service running on port ${config.port}`);
  console.log(`LLM provider: ${config.llmProvider}`);
});
