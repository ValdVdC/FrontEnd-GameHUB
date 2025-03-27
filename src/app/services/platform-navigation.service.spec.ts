import { TestBed } from '@angular/core/testing';

import { PlatformNavigationService } from './platform-navigation.service';

describe('PlatformNavigationService', () => {
  let service: PlatformNavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformNavigationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
