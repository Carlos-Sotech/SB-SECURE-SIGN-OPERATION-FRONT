import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthTokenInterceptor } from './app/services/auth-token.interceptor'; 
//import { AdminModule } from './app/admin/admin.module';
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
