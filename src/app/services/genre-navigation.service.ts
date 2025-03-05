import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GenreNavigationService {
  private _selectedGenre = new BehaviorSubject<string | null>(null);
  selectedGenre$ = this._selectedGenre.asObservable();

  navigateToGenre(genre: string) {
    this._selectedGenre.next(genre);
  }

  clearSelectedGenre() {
    this._selectedGenre.next(null);
  }

  // NEW: Add a method to get the current genre synchronously
  getCurrentGenre(): string | null {
    return this._selectedGenre.getValue();
  }
}