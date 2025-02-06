import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {

  constructor() { }
  private activeSection = new BehaviorSubject<string>('');
  activeSectionId = this.activeSection.asObservable();
  
  setActiveSection(sectionId: string) {
    this.activeSection.next(sectionId);
  }
}
