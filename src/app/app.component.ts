import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { UserReadDto } from './models/user-read.dto';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, MatToolbarModule, MatButtonModule, MatIconModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Sotech-Inmo';
  currentUser$: Observable<UserReadDto | null>;
  isAuthenticated$: Observable<boolean>;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser;
    this.isAuthenticated$ = this.authService.isAuthenticated;
  }

  ngOnInit(): void {
    // Verificar el estado de autenticación al iniciar
    this.isAuthenticated$.subscribe(isAuth => {
      console.log('Estado de autenticación en AppComponent:', isAuth);
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
