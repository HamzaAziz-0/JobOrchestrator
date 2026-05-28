
  export interface JobProgress {
    jobId: number;
    processed: number;
    total: number;
    failed?: number;
    status: string;
    errors?: string[];    
  }
