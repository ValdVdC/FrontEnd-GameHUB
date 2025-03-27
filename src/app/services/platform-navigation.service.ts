import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PlatformNavigationService {
  private _selectedPlatform = new BehaviorSubject<string | null>(null);
  selectedGenre$ = this._selectedPlatform.asObservable();

  navigateToPlatform(platform: string) {
    this._selectedPlatform.next(platform);
  }

  clearSelectedPlatform() {
    this._selectedPlatform.next(null);
  }

  // NEW: Add a method to get the current platform synchronously
  getCurrentPlatform(): string | null {
    return this._selectedPlatform.getValue();
  }
}
