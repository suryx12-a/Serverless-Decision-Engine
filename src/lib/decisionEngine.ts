import fs from 'fs-extra';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'history.json');

export interface JobHistory {
  fileSizeMB: number;
  fileType: string;
  service: 'Lambda' | 'Glue';
  duration: number;
  cost: number;
  timestamp: string;
}

export interface Decision {
  service: 'Lambda' | 'Glue';
  memoryAllocation: string;
  estimatedCost: number;
  explanation: string;
}

export class DecisionEngine {
  private static async getHistory(): Promise<JobHistory[]> {
    if (!(await fs.pathExists(HISTORY_FILE))) {
      return [];
    }
    return fs.readJson(HISTORY_FILE);
  }

  public static async saveToHistory(history: JobHistory) {
    const data = await this.getHistory();
    data.push(history);
    await fs.writeJson(HISTORY_FILE, data, { spaces: 2 });
  }

  public static async decide(fileSizeMB: number, fileType: string): Promise<Decision> {
    const history = await this.getHistory();
    
    // Base Rules
    const BASE_THRESHOLD = 100; // MB
    let service: 'Lambda' | 'Glue' = fileSizeMB < BASE_THRESHOLD ? 'Lambda' : 'Glue';
    let explanation = `Standard rule applied: ${fileSizeMB < BASE_THRESHOLD ? '< 100MB' : '>= 100MB'}.`;

    // Adaptive Learning Logic
    // Look for similar sized files in history (+/- 20% range)
    const similarJobs = history.filter(h => 
      h.fileSizeMB >= fileSizeMB * 0.8 && 
      h.fileSizeMB <= fileSizeMB * 1.2
    );

    if (similarJobs.length >= 3) {
      const lambdaPerf = similarJobs.filter(j => j.service === 'Lambda');
      const gluePerf = similarJobs.filter(j => j.service === 'Glue');

      if (lambdaPerf.length > 0 && gluePerf.length > 0) {
        const avgLambdaCost = lambdaPerf.reduce((acc, curr) => acc + curr.cost, 0) / lambdaPerf.length;
        const avgGlueCost = gluePerf.reduce((acc, curr) => acc + curr.cost, 0) / gluePerf.length;
        
        const avgLambdaTime = lambdaPerf.reduce((acc, curr) => acc + curr.duration, 0) / lambdaPerf.length;
        const avgGlueTime = gluePerf.reduce((acc, curr) => acc + curr.duration, 0) / gluePerf.length;

        // Optimization: If Glue is significantly cheaper for this size, switch even if < 100MB
        if (avgGlueCost < avgLambdaCost * 0.8 && service === 'Lambda') {
          service = 'Glue';
          explanation = "Adaptive optimization: Glue is historically 20% cheaper for this data volume.";
        } 
        // Optimization: If Lambda is significantly faster and cost is comparable, switch even if > 100MB
        else if (avgLambdaTime < avgGlueTime * 0.5 && service === 'Glue' && avgLambdaCost < avgGlueCost * 1.5) {
          service = 'Lambda';
          explanation = "Adaptive optimization: Lambda is historically 50% faster with acceptable cost overhead.";
        }
      }
    }

    const memoryAllocation = service === 'Lambda' ? '1024MB' : '2 DPU';
    const estimatedCost = service === 'Lambda' ? (fileSizeMB * 0.00001) : (0.44 + fileSizeMB * 0.001);

    return {
      service,
      memoryAllocation,
      estimatedCost,
      explanation
    };
  }
}
