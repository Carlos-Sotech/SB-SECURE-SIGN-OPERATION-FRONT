// src/app/material.module.ts
import { NgModule } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog'; // Si usas MatDialog
import { MatTooltipModule } from '@angular/material/tooltip'; // Si usas matTooltip
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';

const MaterialComponents = [
  MatButtonModule,
  MatInputModule,
  MatFormFieldModule, // Necesario para mat-form-field, mat-label, mat-error
  MatCardModule,      // Necesario para mat-card, mat-card-title, mat-card-content, mat-card-header
  MatCheckboxModule,
  MatSelectModule,
  MatToolbarModule,
  MatIconModule,      // Necesario para mat-icon
  MatProgressSpinnerModule, // Necesario para mat-spinner
  MatSnackBarModule,
  MatListModule,
  MatTableModule,
  MatDialogModule,
  MatTooltipModule,
];

@NgModule({
  imports: [MaterialComponents],
  exports: [MaterialComponents] // ¡MUY IMPORTANTE EXPORTARLOS!
})
export class MaterialModule { }
