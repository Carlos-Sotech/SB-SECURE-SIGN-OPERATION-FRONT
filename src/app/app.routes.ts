import { NgModule } from '@angular/core';
import { Router, RouterModule, Routes } from '@angular/router';
import { RegisterComponent } from './components/register/register.component';
import { SetPasswordComponent } from './components/set-password/set-password.component';
import { LoginComponent } from './components/login/login.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { CompanyListComponent } from './components/company-list/company-list.component';
import { OperationListComponent } from './components/operation-list/operation-list.component';
import { SignaturePageComponent } from './components/signature-page/signature-page.component';
import { AuthGuard } from './guards/auth.guard';
import { Role } from './models/role.enum';
import { UserListComponent } from './components/user-list/user-list.component';
export const routes: Routes = [
  { path: '', redirectTo : 'login',pathMatch:'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'set-password', component: SetPasswordComponent },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent }, // Olvido su contraseña
  { path: 'reset-password', component: ResetPasswordComponent },   // Restablecer contraseña
  { path: 'home', component: UserListComponent, canActivate: [AuthGuard] },
  { path: 'company-list', component: CompanyListComponent, canActivate: [AuthGuard] },
  { path: 'operation-list', component: OperationListComponent, canActivate: [AuthGuard] },
  { path: 'signature/:operationId', component: SignaturePageComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: "login" },
  /*
  {
      path: 'admin',
  // component: TempAdminComponent, // Usa un componente simple y asegúrate que sea standalone o declarado
  canActivate: [AuthGuard],
  //data: { expectedRole: Role.Administrador },
  children: [ // O pon las rutas hijas directamente aquí para probar
      { path: 'user-list', component: UserListComponent ,canActivate: [AuthGuard], data: { expectedRole: Role.Administrador },}, // UserListComponent debe ser standalone o importado
      { path: '', redirectTo: 'user-list', pathMatch: 'full' }
  ]
        loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
    
  }
*/
];

@NgModule({
  imports: [RouterModule.forRoot(routes,{ enableTracing: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
