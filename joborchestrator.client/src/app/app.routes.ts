import { Routes } from '@angular/router';
import { UploadPage } from './features/upload/upload.page';
import { ProgressPage } from './features/progress/progress.page';

export const routes: Routes = [
  { path: '', component: UploadPage },
  { path: 'progress/:id', component: ProgressPage },
];
