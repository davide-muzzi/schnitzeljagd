import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChallengePage } from './challenge.page';

describe('ChallengePage', () => {
  let component: ChallengePage;
  let fixture: ComponentFixture<ChallengePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChallengePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
