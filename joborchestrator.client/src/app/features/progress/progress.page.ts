import { Component, OnInit, inject, signal, computed, DestroyRef, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SignalrService } from '../../core/services/signalr.service';
import { Job } from '../../core/models/job.model';
import { environment } from '../../../environments/environment.prod';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './progress.page.html',
  styleUrls: ['./progress.page.scss'],
})
export class ProgressPage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private signalrService = inject(SignalrService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('logContainer') logContainer!: ElementRef;

  // Core job signals
  jobId = signal(0);
  fileName = signal('');
  totalRows = signal(0);
  processedRows = signal(0);
  failedRows = signal(0);
  status = signal('Pending');
  duration = signal<number | null>(null);
  connectionStatus = signal<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  // Track start time for speed calculation
  private startTime = signal<number | null>(null);

  // Computed
  statusLower = computed(() => (this.status() || '').toLowerCase());
  isRunning = computed(() => this.statusLower() === 'pending' || this.statusLower() === 'running');

  completedRows = computed(() => this.processedRows() + this.failedRows());

  //  progress calculation: (processed + failed) / total
  progressPercent = computed(() => {
    const total = this.totalRows();
    return total > 0 ? Math.round((this.completedRows() / total) * 100) : 0;
  });

  // Speed calculation
  processingSpeed = computed(() => {
    const elapsedSeconds = this.startTime() !== null
      ? (Date.now() - this.startTime()!) / 1000
      : 0;
    const completed = this.completedRows();
    return elapsedSeconds > 0 ? Math.round(completed / elapsedSeconds) : 0;
  });

  eta = computed(() => {
    const remaining = this.totalRows() - this.completedRows();
    const speed = this.processingSpeed();
    return speed > 0 ? Math.round(remaining / speed) : null;
  });

  // Cancel handling
  cancelRequested = signal(false);

  // Errors and live logs
  errors = signal<string[]>([]);
  logs = signal<{ row: number; success: boolean; message: string; timestamp: Date }[]>([]);

  async ngOnInit(): Promise<void> {
    this.jobId.set(Number(this.route.snapshot.paramMap.get('id')));

    // Setup connection status
    this.signalrService.connectionState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      this.connectionStatus.set(state);
    });

    await this.signalrService.joinJobGroup(this.jobId());

    // Fetching initial job state
    this.http.get<Job>(`${environment.apiUrl}/api/jobs/${this.jobId()}`).subscribe({
      next: (job) => {
        this.fileName.set(job.fileName);
        this.totalRows.set(job.totalRows);
        this.processedRows.set(job.processedRows);
        this.failedRows.set(job.failedRows ?? 0);
        this.status.set(String(job.status));
        this.errors.set(job.errors ?? []);
      },
    });

    // Subscribe 
    this.signalrService
      .onRowProcessed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        if (data.jobId !== this.jobId()) return;

        // Start timing on first row
        if (this.startTime() === null) {
          this.startTime.set(Date.now());
        }

        this.processedRows.set(data.processed);
        this.failedRows.set(data.failed);
        this.totalRows.set(data.total);
        this.status.set(data.status);

        // Add log entry using RecentError if available
        this.logs.update(current => [
          ...current,
          {
            row: data.lastRow,
            success: data.success,
            message: data.recentError ?? data.message,
            timestamp: new Date(data.timestamp)
          }
        ]);

        // Keep only last 100 logs
        if (this.logs().length > 100) {
          this.logs.update(current => current.slice(-100));
        }

        this.cdr.detectChanges();
        setTimeout(() => {
          if (this.logContainer) {
            this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
          }
        }, 50);
      });

    // Subscribe to completion event
    this.signalrService
      .onJobCompleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        if (data.jobId !== this.jobId()) return;
        this.status.set(data.status);
        this.processedRows.set(data.processed);
        this.failedRows.set(data.failed);
        this.totalRows.set(data.total);
        this.duration.set(data.duration);
        this.errors.set(data.errors ?? []);
        this.cdr.detectChanges();
      });
  }

  cancelJob(): void {
    if (this.cancelRequested()) return;
    this.cancelRequested.set(true);
    this.http
      .post(`${environment.apiUrl}/api/jobs/${this.jobId()}/cancel`, {})
      .subscribe({
        next: () => { },
        error: () => this.cancelRequested.set(false),
      });
  }

  downloadErrorReport(): void {
    if (this.errors().length === 0) return;
    const csvContent = 'Row,Error\n' + this.errors().map(e => {
      const match = e.match(/Row (\d+): (.*)/);
      return match ? `${match[1]},"${match[2]}"` : `,"${e}"`;
    }).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors_job_${this.jobId()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }
} 
