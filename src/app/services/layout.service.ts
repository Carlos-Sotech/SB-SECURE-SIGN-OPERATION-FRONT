import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  // BehaviorSubject para controlar la visibilidad del navbar
  private showNavbar = new BehaviorSubject<boolean>(true); // Por defecto, mostrar
  public showNavbar$ = this.showNavbar.asObservable();

  constructor() { }

  setShowNavbar(visible: boolean): void {
    this.showNavbar.next(visible);
  }
}