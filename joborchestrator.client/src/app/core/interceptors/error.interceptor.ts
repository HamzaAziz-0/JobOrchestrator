import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let userMessage = 'Something went wrong. Please try again.';
      
      if (error.status === 0) {
        userMessage = 'Cannot connect to the server. Please check your connection.';
      } else if (error.status === 400) {
        //  Log the full error response to see what the backend sent
        console.error('Full 400 error response:', error);
        console.error('Backend response body:', error.error);
        userMessage = error.error?.error || error.error?.message || 'Invalid request.';
      } else if (error.status === 500) {
        userMessage = 'Server error. Please try again later.';
      }
      
      console.error(`[HTTP ${error.status}]`, error.message);
      return throwError(() => new Error(userMessage));
    })
  );
};
