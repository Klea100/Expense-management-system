import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HttpStateService {
  readonly loading = signal(false);
  private pending = 0;

  async track<T>(promise: Promise<T>): Promise<T> {
    this.pending++;
    if (this.pending === 1) this.loading.set(true);
    try {
      return await promise;
    } finally {
      this.pending--;
      if (this.pending <= 0) {
        this.pending = 0;
        this.loading.set(false);
      }
    }
  }
}
