import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';
import { JobProgress } from '../models/jobprogress.model';
import { environment } from '../../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private hubConnection: signalR.HubConnection;
  private connectionPromise: Promise<void>;

  constructor() {
   this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl)
      .withAutomaticReconnect()
      .build();
    this.connectionPromise = this.hubConnection.start();
  }

  async joinJobGroup(jobId: number): Promise<void> {
    await this.connectionPromise;
    await this.hubConnection.invoke('JoinJobGroup', jobId);
  }

  onJobProgress(): Observable<JobProgress> {
    return new Observable<JobProgress>(subscriber => {
      this.hubConnection.on('UpdateProgress',
        (jobId: number, processed: number, failed: number, total: number, status: string) => {
          subscriber.next({ jobId, processed, failed, total, status });
        });
    });
  }
} 
