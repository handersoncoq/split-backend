import express from 'express';
import cors from 'cors';
import { processController } from './controllers/ProcessController.js';
import ytdl from "ytdl-core";
import path from 'path';  // Make sure to import 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

process.on('uncaughtException', (error) => {
  console.error('There was an uncaught error', error);
  process.exit(1);
});


const PORT = process.env.PORT || 4000;

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.get('/process', processController);


// Start
app.listen(PORT, () => {
  console.log('\x1b[92m%s\x1b[0m', `Server running on port ${PORT}`);
});

