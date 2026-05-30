import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private hubConnection: signalR.HubConnection;
  private connectionStateSubject = new Subject<'connected' | 'reconnecting' | 'disconnected'>();
  public connectionState$ = this.connectionStateSubject.asObservable();

  // Track current job ID for reconnection
  private currentJobId: number | null = null;

  constructor() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.onreconnecting(() => {
      this.connectionStateSubject.next('reconnecting');
    });

    this.hubConnection.onreconnected(async () => {
      this.connectionStateSubject.next('connected');
      //  Rejoining job group after reconnect
      if (this.currentJobId !== null) {
        await this.joinJobGroup(this.currentJobId);
      }
    });

    this.hubConnection.onclose(() => {
      this.connectionStateSubject.next('disconnected');
    });

    this.hubConnection.start()
      .then(() => this.connectionStateSubject.next('connected'))
      .catch(() => this.connectionStateSubject.next('disconnected'));
  }

  async joinJobGroup(jobId: number): Promise<void> {
    this.currentJobId = jobId;
    try {
      await this.hubConnection.invoke('JoinJobGroup', jobId);
    } catch (err) {
      console.error('Failed to join job group:', err);
    }
  }

  onRowProcessed(): Observable<any> {
    return new Observable(subscriber => {
      const handler = (data: any) => subscriber.next(data);
      this.hubConnection.on('RowProcessed', handler);
      return () => {
        this.hubConnection.off('RowProcessed', handler);
      };
    });
  }

  onJobCompleted(): Observable<any> {
    return new Observable(subscriber => {
      const handler = (data: any) => subscriber.next(data);
      this.hubConnection.on('JobCompleted', handler);
      return () => {
        this.hubConnection.off('JobCompleted', handler);
      };
    });
  }
} 
