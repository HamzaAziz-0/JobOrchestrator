import { Component, inject, signal, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment.prod';
  @Component({
  selector: 'app-upload',
  standalone: true,
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
})
export class UploadPage {
  private http = inject(HttpClient);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef); 

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Signals for reactive state
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  isDragOver = signal(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile.set(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.selectedFile.set(files[0]);
    }
  }

  removeFile(event: MouseEvent): void {

    event.stopPropagation(); 
    this.selectedFile.set(null);
    this.fileInput.nativeElement.value = '';
  }

  onUpload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ jobId: number }>(`${environment.apiUrl}/api/jobs`, formData).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.selectedFile.set(null);
        this.fileInput.nativeElement.value = '';
        this.router.navigate(['/progress', res.jobId]);
      },
      error: (err) => {
        this.uploading.set(false);
      },
    });
  }
} 
