import fs from 'fs-extra';
import path from 'path';

export interface ETLResult {
  status: 'Completed' | 'Failed';
  duration: number;
  processedPath?: string;
  error?: string;
}

export class ETLProcessor {
  public static async process(
    jobId: string, 
    filePath: string, 
    service: 'Lambda' | 'Glue'
  ): Promise<ETLResult> {
    const startTime = Date.now();
    const delay = service === 'Lambda' ? 1000 : 3000;

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // 1. Extract
      const content = await fs.readFile(filePath, 'utf-8');

      // 2. Transform
      // Normalize: Remove extra spaces and trim
      const transformed = content
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .join('\n');

      // 3. Load
      const fileName = path.basename(filePath);
      const processedDir = path.join(process.cwd(), 'storage', 'processed');
      await fs.ensureDir(processedDir);
      
      const processedPath = path.join(processedDir, `processed_${jobId}_${fileName}`);
      await fs.writeFile(processedPath, transformed);

      const duration = Date.now() - startTime;
      return {
        status: 'Completed',
        duration,
        processedPath
      };
    } catch (error) {
      console.error(`ETL Error for job ${jobId}:`, error);
      return {
        status: 'Failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
