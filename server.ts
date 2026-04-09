import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';
import { createServer as createViteServer } from 'vite';
import { DecisionEngine, Decision } from './src/lib/decisionEngine.ts';
import { ETLProcessor } from './src/lib/etlProcessor.ts';

const app = express();
const PORT = 3000;
const pipelineEvents = new EventEmitter();

// Ensure storage directories exist
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const UPLOAD_DIR = path.join(STORAGE_DIR, 'uploads');
fs.ensureDirSync(UPLOAD_DIR);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Job Status Store (In-memory for this prototype)
interface JobStatus {
  id: string;
  status: 'Uploading' | 'Processing' | 'Completed' | 'Failed';
  fileName: string;
  fileSizeMB: number;
  fileType: string;
  decision?: Decision;
  result?: {
    duration: number;
    cost: number;
    processedPath?: string;
    error?: string;
  };
  retryCount: number;
}
const jobs = new Map<string, JobStatus>();

// Event Pipeline Logic
pipelineEvents.on('fileUploaded', async (jobId: string) => {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'Processing';
    
    // 1. Decision Engine
    const decision = await DecisionEngine.decide(job.fileSizeMB, job.fileType);
    job.decision = decision;

    // 2. ETL Processing
    const filePath = path.join(UPLOAD_DIR, job.fileName);
    let result = await ETLProcessor.process(jobId, filePath, decision.service);

    // 3. Retry Mechanism (1 retry max)
    if (result.status === 'Failed' && job.retryCount < 1) {
      console.log(`Retrying job ${jobId}...`);
      job.retryCount++;
      result = await ETLProcessor.process(jobId, filePath, decision.service);
    }

    // 4. Update Status and History
    if (result.status === 'Completed') {
      job.status = 'Completed';
      job.result = {
        duration: result.duration,
        cost: decision.estimatedCost,
        processedPath: result.processedPath
      };

      // Save to history for adaptive learning
      await DecisionEngine.saveToHistory({
        fileSizeMB: job.fileSizeMB,
        fileType: job.fileType,
        service: decision.service,
        duration: result.duration,
        cost: decision.estimatedCost,
        timestamp: new Date().toISOString()
      });
    } else {
      job.status = 'Failed';
      job.result = {
        duration: result.duration,
        cost: 0,
        error: result.error
      };
    }
  } catch (error) {
    console.error(`Pipeline error for job ${jobId}:`, error);
    job.status = 'Failed';
  }
});

// API Endpoints
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const jobId = Math.random().toString(36).substring(7);
  const fileSizeMB = req.file.size / (1024 * 1024);
  const fileType = path.extname(req.file.originalname).substring(1);

  const job: JobStatus = {
    id: jobId,
    status: 'Uploading',
    fileName: req.file.filename,
    fileSizeMB,
    fileType,
    retryCount: 0
  };

  jobs.set(jobId, job);
  
  // Trigger event-driven processing
  pipelineEvents.emit('fileUploaded', jobId);

  res.json({ jobId });
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
