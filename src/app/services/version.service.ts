import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private frontendVersion: string = 'v2025.11.02.1949'; // Valor por defecto
  private backendVersion: string = '';

  constructor(private http: HttpClient) {}

  getFrontendVersion(): string {
    return this.frontendVersion;
  }

  getBackendVersion(): Observable<string> {
    if (this.backendVersion) {
      return of(this.backendVersion);
    }

    // Obtener la versión del backend desde la API
    return this.http.get<{version: string}>(`${environment.apiUrl}/auth/version`).pipe(
      map(response => {
        this.backendVersion = response.version;
        console.log('Backend version loaded:', response.version);
        return response.version;
      }),
      catchError((error) => {
        console.error('Error loading backend version:', error);
        return of('Unknown');
      })
    );
  }

  loadFrontendVersion(): Observable<string> {
    return this.http.get<any>('./assets/version.json').pipe(
      map(versionInfo => {
        this.frontendVersion = versionInfo.version || 'v2025.11.02.1949';
        console.log('Frontend version loaded:', this.frontendVersion);
        return this.frontendVersion;
      }),
      catchError((error) => {
        console.error('Error loading frontend version:', error);
        return of(this.frontendVersion);
      })
    );
  }

  getAllVersions(): Observable<{frontend: string, backend: string}> {
    return new Observable(observer => {
      const frontend = this.getFrontendVersion();
      
      this.getBackendVersion().subscribe({
        next: (backend) => {
          observer.next({
            frontend: frontend,
            backend: backend
          });
          observer.complete();
        },
        error: (error) => {
          observer.next({
            frontend: frontend,
            backend: 'Unknown'
          });
          observer.complete();
        }
      });
    });
  }
}
