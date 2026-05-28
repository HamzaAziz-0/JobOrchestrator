import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
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

  jobId = signal(0);
  fileName = signal('');
  totalRows = signal(0);
  processedRows = signal(0);
  failedRows = signal(0);
  status = signal('Pending');

  statusLower = computed(() => (this.status() || '').toLowerCase());

  cancelRequested = signal(false);

  errors = signal<string[]>([]);

  isRunning = computed(() => {
    const s = this.statusLower();
    return s === 'pending' || s === 'running';
  });

  progressPercent = computed(() => {
    const total = this.totalRows();
    return total > 0 ? Math.round((this.processedRows() / total) * 100) : 0;
  });

  async ngOnInit(): Promise<void> {
    this.jobId.set(Number(this.route.snapshot.paramMap.get('id')));

    await this.signalrService.joinJobGroup(this.jobId());

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

    this.signalrService
      .onJobProgress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((progress) => {
        if (progress.jobId === this.jobId()) {
          this.processedRows.set(progress.processed);
          this.totalRows.set(progress.total);
          this.failedRows.set(progress.failed ?? 0);
          this.status.set(String(progress.status));
          this.errors.set(progress.errors ?? []);
        }
      });
  }

  cancelJob(): void {
    if (this.cancelRequested()) return;

    this.cancelRequested.set(true);
    this.http.post(`${environment.apiUrl}/api/jobs/${this.jobId()}/cancel`, {}).subscribe({
      next: () => { },
      error: () => {
        this.cancelRequested.set(false);
      },
    });
  }
} 
