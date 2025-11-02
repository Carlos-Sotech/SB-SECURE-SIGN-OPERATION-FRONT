 import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
 import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
 
export interface ConfirmDialogData {
   title: string;
   message: string;
 }

 @Component({
   selector: 'app-confirm-dialog',
   standalone: true,
   imports: [MatDialogModule, MatButtonModule],
   template: `
     <h1 mat-dialog-title>{{ data.title }}</h1>
     <div mat-dialog-content>
       <p>{{ data.message }}</p>
     </div>
     <div mat-dialog-actions align="end">
       <button mat-button (click)="onNoClick()">Cancelar</button>
       <button mat-button (click)="onConfirm()" color="warn" cdkFocusInitial>Confirmar</button>
     </div>
   `
 })
 export class ConfirmDialogComponent {
   constructor(
     public dialogRef: MatDialogRef<ConfirmDialogComponent>,
     @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
   ) {}

   onNoClick(): void {
     this.dialogRef.close(false);
   }

   onConfirm(): void {
     this.dialogRef.close(true);
   }
 }