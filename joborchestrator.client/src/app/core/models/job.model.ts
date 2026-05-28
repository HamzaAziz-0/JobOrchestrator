
export interface Job {
  id: number;
  fileName: string;
  totalRows: number;
  processedRows: number;
  failedRows?: number;        
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  errors?: string[];          
  createdAt: Date;
  updatedAt?: Date;
}



