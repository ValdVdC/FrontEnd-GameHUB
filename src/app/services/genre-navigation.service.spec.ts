import { TestBed } from '@angular/core/testing';

import { GenreNavigationService } from './genre-navigation.service';

describe('GenreNavigationService', () => {
  let service: GenreNavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GenreNavigationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
