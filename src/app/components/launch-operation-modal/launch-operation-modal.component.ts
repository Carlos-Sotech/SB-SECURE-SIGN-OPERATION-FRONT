import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OperationTypeEnum } from '../../models/operation.model';
import { OperationService } from '../../services/operation.service';
import { environment } from '../../../environments/environment';

export interface LaunchOperationModalData {
  message: string;
  operationId: number;
  externalId?: string; // ID externo que viene del backend
  operationType?: OperationTypeEnum; // Tipo de operación (LOCAL o REMOTA)
  completeSignLink?: string; // URL completa del backend para WebSocket
}

@Component({
  selector: 'app-launch-operation-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="launch-modal-container">
      <h2 mat-dialog-title>
        <mat-icon>rocket_launch</mat-icon>
        Operación Lanzada
        <button mat-icon-button type="button" (click)="onClose()" style="float: right;" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </h2>

      <mat-dialog-content>
        <mat-card class="message-card">
          <mat-card-content>
            <div class="message-content">
              <mat-icon class="success-icon">check_circle</mat-icon>
              <p class="message-text">{{ data.message }}</p>
              <p class="operation-id">Operación #{{ data.operationId }}</p>
              <p class="external-id" *ngIf="data.externalId" (dblclick)="toggleCommandBox()" style="cursor: pointer; user-select: none;">ID Externo: {{ data.externalId }}</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="uri-card" *ngIf="sotechUri && data.operationType === OperationTypeEnum.LOCAL && wsError && !wsConnected && showCommandBox">
          <mat-card-content>
            <h4>
              <mat-icon>warning</mat-icon>
              No Hay Dispositivo de Firma Conectado
            </h4>
            <p class="uri-info">No se pudo conectar al WebSocket. No hay ningún dispositivo de firma conectado. Usando URI sotech como respaldo.</p>
            <div class="uri-container">
              <code class="uri-text">{{ sotechUri }}</code>
              <button mat-icon-button color="primary" (click)="copyToClipboard()" matTooltip="Copiar URI">
                <mat-icon>content_copy</mat-icon>
              </button>
            </div>
            <p class="uri-info">Esta URI se abrirá automáticamente</p>
          </mat-card-content>
        </mat-card>



        <mat-card class="websocket-card" *ngIf="data.operationType === OperationTypeEnum.LOCAL && wsConnected">
          <mat-card-content>
            <h4>
              <mat-icon>wifi</mat-icon>
              Conexión WebSocket Exitosa
            </h4>
            <p class="websocket-info">Conectado al WebSocket. El dispositivo de firma está listo para usar.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="connecting-card" *ngIf="data.operationType === OperationTypeEnum.LOCAL && !wsConnected && !wsError">
          <mat-card-content>
            <h4>
              <mat-icon>sync</mat-icon>
              Conectando al WebSocket...
            </h4>
            <p class="connecting-info">Intentando conectar al WebSocket. Espere un momento...</p>
            <mat-progress-spinner mode="indeterminate" diameter="30"></mat-progress-spinner>
          </mat-card-content>
        </mat-card>

        <mat-card class="info-card" *ngIf="data.operationType === OperationTypeEnum.REMOTA">
          <mat-card-content>
            <h4>
              <mat-icon>email</mat-icon>
              Operación Remota
            </h4>
            <p class="info-text">La URL de acceso se enviará por email al firmante. </p>
          </mat-card-content>
        </mat-card>


      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-raised-button color="accent" (click)="openSotechUri()" *ngIf="sotechUri && data.operationType === OperationTypeEnum.LOCAL && wsError && !wsConnected && showCommandBox">
          <mat-icon>open_in_new</mat-icon>
          Abrir Sotech
        </button>
        <button mat-raised-button color="accent" (click)="openWebSocketUrl()" *ngIf="completeSignLink && data.operationType === OperationTypeEnum.REMOTA">
          <mat-icon>open_in_new</mat-icon>
          Abrir URL Remota
        </button>
        <button mat-raised-button color="primary" (click)="onClose()">
          <mat-icon>check</mat-icon>
          Aceptar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .launch-modal-container {
      padding: 20px;
      max-width: 600px;
    }

    .message-card {
      margin: 20px 0;
      border: 2px solid #4CAF50;
      background-color: #f8fff8;
    }

    .uri-card {
      margin: 20px 0;
      border: 2px solid #2196F3;
      background-color: #f8fbff;
    }

    .warning-card {
      margin: 20px 0;
      border: 2px solid #FF9800;
      background-color: #fff8f0;
    }

    .info-card {
      margin: 20px 0;
      border: 2px solid #4CAF50;
      background-color: #f0fff0;
    }

    .websocket-card {
      margin: 20px 0;
      border: 2px solid #4CAF50;
      background-color: #f0fff8;
    }

    .connecting-card {
      margin: 20px 0;
      border: 2px solid #2196F3;
      background-color: #f0f8ff;
      text-align: center;
    }

    .uri-card h4, .warning-card h4, .info-card h4, .websocket-card h4, .connecting-card h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      font-size: 16px;
    }

    .uri-card h4 {
      color: #FF9800;
    }

    .warning-card h4 {
      color: #FF9800;
    }

    .info-card h4 {
      color: #4CAF50;
    }

    .websocket-card h4 {
      color: #4CAF50;
    }

    .connecting-card h4 {
      color: #2196F3;
    }

    .message-content {
      text-align: center;
      padding: 20px;
    }

    .success-icon {
      font-size: 48px;
      color: #4CAF50;
      margin-bottom: 16px;
    }

    .message-text {
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 12px;
      color: #333;
    }

    .operation-id {
      font-size: 14px;
      color: #666;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .external-id {
      font-size: 12px;
      color: #888;
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.2s ease;
    }

    .external-id:hover {
      background-color: #e0e0e0;
    }

    .uri-container {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
      margin-bottom: 12px;
    }

    .uri-text {
      flex: 1;
      font-size: 12px;
      color: #333;
      word-break: break-all;
      font-family: monospace;
      background-color: white;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    .uri-info {
      font-size: 12px;
      color: #666;
      margin: 0;
      font-style: italic;
    }

    .warning-text {
      font-size: 14px;
      color: #666;
      margin: 0;
      line-height: 1.4;
    }

    .info-text {
      font-size: 14px;
      color: #666;
      margin: 0;
      line-height: 1.4;
    }

    .websocket-info {
      font-size: 14px;
      color: #666;
      margin: 0;
      line-height: 1.4;
    }

    .connecting-info {
      font-size: 14px;
      color: #666;
      margin: 0;
      line-height: 1.4;
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
      gap: 8px;
    }
  `]
})
export class LaunchOperationModalComponent implements OnInit {
  sotechUri: string = '';
  completeSignLink: string = '';
  OperationTypeEnum = OperationTypeEnum;
  
  // Variables para WebSocket
  private ws: WebSocket | null = null;
  wsConnected = false; // Público para el template
  wsError = false; // Público para el template
  websocketFuncionando=false;
  showCommandBox = false; // Controla si mostrar la caja de comando

  private wsTimeout: any = null;

  constructor(
    public dialogRef: MatDialogRef<LaunchOperationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LaunchOperationModalData,
    private operationService: OperationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    console.log('🔍 ngOnInit - Operation type:', this.data.operationType);
    console.log('🔍 ngOnInit - External ID:', this.data.externalId);
    
    // Para operaciones locales, intentar WebSocket primero
    if (this.data.operationType === OperationTypeEnum.LOCAL) {
      console.log('🔍 Es operación LOCAL, intentando WebSocket primero...');
      
      // Solo intentar conectar al WebSocket si tenemos el ID externo
      if (this.data.externalId && this.data.externalId.trim() !== '') {
        console.log('🔍 Hay externalId, intentando conectar al WebSocket...');
        // Intentar conectar al WebSocket
        this.tryWebSocketConnection();
      } else {
        // Si no hay externalId, marcar como error y usar URI sotech
        console.log('🔍 No hay externalId disponible, usando URI sotech');
        this.wsError = true;
        this.useSotechUri();
      }
    } else {
      console.log('🔍 No es operación LOCAL, no se procesa');
    }
  }

  private generateSotechUri(): void {
    console.log('🔍 Generating Sotech URI for operation type:', this.data.operationType);
    console.log('🔍 WebSocket falló, usando variables de entorno del FRONTEND');
    
    // Construir la URI sotech con los parámetros desde variables de entorno del FRONTEND
    // (solo cuando el WebSocket no funciona)
    const params = new URLSearchParams({
      id: this.data.externalId!, // Usar el externalId (UUID) del backend
      protocolo_sss: environment.sotech.protocolo_sss,
      nombre_servidor_sss: environment.sotech.nombre_servidor_sss,
      aplicacion_sss: environment.sotech.aplicacion_sss,
      protocolo_ssls: environment.sotech.protocolo_ssls,
      nombre_servidor_ssls: environment.sotech.nombre_servidor_ssls,
      aplicacion_ssls: this.data.operationType === OperationTypeEnum.REMOTA ? 
        environment.sotech.aplicacion_ssls_remota : '',
      protocolo_otp: environment.sotech.protocolo_otp,
      nombre_servidor_otp: environment.sotech.nombre_servidor_otp,
      aplicacion_otp: ''
    });
    
    // Agregar puertos solo si están definidos (no vacíos)
    if (environment.sotech.puerto_sss && environment.sotech.puerto_sss.trim() !== '') {
      params.append('puerto_sss', environment.sotech.puerto_sss);
    }
    if (environment.sotech.puerto_ssls && environment.sotech.puerto_ssls.trim() !== '') {
      params.append('puerto_ssls', environment.sotech.puerto_ssls);
    }
    if (environment.sotech.puerto_otp && environment.sotech.puerto_otp.trim() !== '') {
      params.append('puerto_otp', environment.sotech.puerto_otp);
    }

    this.sotechUri = `sotech://workflow/?${params.toString()}`;
    console.log('🔍 Generated Sotech URI (usando variables del frontend):', this.sotechUri);
  }

  private generateWebSocketUrl(): void {
    console.log('🔍 Generating WebSocket URL for operation type:', this.data.operationType);
    
    // Construir la URL correcta usando variables de entorno
    const frontendBaseUrl = environment.frontend.baseUrl;
    const protocoloOtp = environment.sotech.protocolo_otp;
    const nombreServidorOtp = environment.sotech.nombre_servidor_otp;
    const protocoloSss = environment.sotech.protocolo_sss;
    const nombreServidorSss = environment.sotech.nombre_servidor_sss;
    const protocoloSsls = environment.sotech.protocolo_ssls;
    const nombreServidorSsls = environment.sotech.nombre_servidor_ssls;
    const aplicacionSsls = this.data.operationType === OperationTypeEnum.REMOTA ? environment.sotech.aplicacion_ssls_remota : "";
    // Construir la URL base sin puertos
    let url = `${frontendBaseUrl}/?id=${this.data.externalId}&protocolo_otp=${protocoloOtp}&nombre_servidor_otp=${nombreServidorOtp}&protocolo_sss=${protocoloSss}&nombre_servidor_sss=${nombreServidorSss}&protocolo_ssls=${protocoloSsls}&nombre_servidor_ssls=${nombreServidorSsls}&aplicacion_ssls=${aplicacionSsls}`;
    
    // Agregar puertos solo si están definidos (no vacíos)
    if (environment.sotech.puerto_otp && environment.sotech.puerto_otp.trim() !== '') {
      url += `&puerto_otp=${environment.sotech.puerto_otp}`;
    }
    if (environment.sotech.puerto_sss && environment.sotech.puerto_sss.trim() !== '') {
      url += `&puerto_sss=${environment.sotech.puerto_sss}`;
    }
    if (environment.sotech.puerto_ssls && environment.sotech.puerto_ssls.trim() !== '') {
      url += `&puerto_ssls=${environment.sotech.puerto_ssls}`;
    }
    
    this.completeSignLink = url;
    console.log('🔍 Generated WebSocket URL:', this.completeSignLink);
  }

  openSotechUri(): void {
    if (this.sotechUri) {
      // Abrir en una nueva pestaña
      window.open(this.sotechUri, '_blank');
    }
  }

  openWebSocketUrl(): void {
    if (this.completeSignLink) {
      // Abrir en una nueva pestaña
      window.open(this.completeSignLink, '_blank');
    }
  }

  copyToClipboard(): void {
    if (this.sotechUri) {
      navigator.clipboard.writeText(this.sotechUri).then(() => {
        // Opcional: mostrar un mensaje de confirmación
        console.log('URI copiada al portapapeles');
      }).catch(err => {
        console.error('Error al copiar al portapapeles:', err);
      });
    }
  }

  copyWebSocketUrl(): void {
    if (this.completeSignLink) {
      navigator.clipboard.writeText(this.completeSignLink).then(() => {
        // Opcional: mostrar un mensaje de confirmación
        console.log('URL del WebSocket copiada al portapapeles');
      }).catch(err => {
        console.error('Error al copiar al portapapeles:', err);
      });
    }
  }

  onClose(): void {
    this.closeWebSocket();
    this.dialogRef.close();
  }

  // Métodos para WebSocket
  private tryWebSocketConnection(): void {
    console.log('🔍 Intentando conectar al WebSocket...');
    
    try {
      this.ws = new WebSocket(environment.websocket.url);
      
      // Configurar timeout desde variables de entorno
      this.wsTimeout = setTimeout(() => {
        if (!this.wsConnected) {
          console.log('🔍 WebSocket timeout, usando URI sotech');
          this.wsError = true;
          this.useSotechUri();
        }
      }, environment.websocket.timeout);
      
      this.ws.onopen = () => {
        console.log('🔍 WebSocket conectado exitosamente');
        this.wsConnected = true;
        this.wsError = false;
        clearTimeout(this.wsTimeout);
        this.websocketFuncionando=true;
        this.useWebSocketUrl();
      };
      
      this.ws.onmessage = (event) => {
        console.log('🔍 Mensaje recibido del WebSocket:', event.data);
      };
      
      this.ws.onclose = (event) => {
        console.log('🔍 WebSocket cerrado:', event.code, event.reason);
        this.wsConnected = false;
        // Solo usar Sotech si no se conectó exitosamente antes
        if (!this.wsConnected && !this.wsError) {
          this.wsError = true;
          this.useSotechUri();
        }
      };
      
      this.ws.onerror = (error) => {
        console.log('🔍 Error en WebSocket:', error);
        this.wsError = true;
        this.wsConnected = false;
        clearTimeout(this.wsTimeout);
        this.useSotechUri();
      };
      
    } catch (error) {
      console.log('🔍 Error al crear WebSocket:', error);
      this.wsError = true;
      this.useSotechUri();
    }
  }

  private useWebSocketUrl(): void {
    console.log('🔍 Usando URL del WebSocket');
    
    // Para operaciones locales, ejecutar el comando WebSocket directamente
    if (this.data.operationType === OperationTypeEnum.LOCAL) {
      this.executeLocalOperationPad(this.data.externalId!);
      console.log('🔍 WebSocket funcionando, NO generando URL ni abriendo URI de Sotech');
      // NO generar URL ni guardar cuando WebSocket funciona
      return;
    } else if (this.data.operationType === OperationTypeEnum.REMOTA) {
      // Solo para operaciones remotas, generar la URL
      this.generateWebSocketUrl();
      this.saveWorkflowUrl(this.completeSignLink);
      // Abrir la URL en una nueva pestaña después de 2 segundos
      setTimeout(() => {
        window.open(this.completeSignLink, '_blank');
      }, 2000);
    }
  }

  private useSotechUri(): void {
    console.log('🔍 ===== useSotechUri METHOD CALLED =====');
    console.log('🔍 Current sotechUri:', this.sotechUri);
    console.log('🔍 wsError:', this.wsError);
    console.log('🔍 wsConnected:', this.wsConnected);
    
    // Solo usar Sotech si hay un error del WebSocket Y no está conectado
    if (!this.wsError || this.wsConnected) {
      console.log('🔍 WebSocket funcionando o conectado, NO usando URI sotech');
      return;
    }
    
    // Solo generar la URI sotech si no existe
    if (!this.sotechUri) {
      console.log('🔍 Generando URI sotech porque no existe...');
      this.generateSotechUri();
    }
    
    console.log('🔍 Final sotechUri:', this.sotechUri);
    
    // Guardar la URI en el backend
    this.saveWorkflowUrl(this.sotechUri);
    if (!this.websocketFuncionando){
          // Mostrar mensaje informativo
    this.snackBar.open('WebSocket falló. Abriendo URI sotech automáticamente...', 'Cerrar', {
      duration: 2000,
      panelClass: ['info-snackbar']
    });
    
    console.log('🔍 Programando apertura automática en 2 segundos...');
    setTimeout(() => {
      console.log('🔍 Ejecutando apertura automática de URI sotech...');
      this.openSotechUri();
    }, 2000);
    }

    
  }

  private saveWorkflowUrl(workflowUrl: string): void {
    console.log('🔍 Guardando workflow URL:', workflowUrl);
    
    this.operationService.updateWorkflowUrl(this.data.operationId, workflowUrl).subscribe({
      next: () => {
        console.log('🔍 Workflow URL guardada exitosamente');
        this.snackBar.open('URL de la operación guardada exitosamente', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      },
      error: (err) => {
       /*
        console.error('🔍 Error al guardar workflow URL:', err);
        this.snackBar.open('Error al guardar la URL de la operación', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        */
      }
    });
  }

  private closeWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.wsTimeout) {
      clearTimeout(this.wsTimeout);
      this.wsTimeout = null;
    }
    this.wsConnected = false;
    this.wsError = false;
  }

  // Método para ejecutar operación local con WebSocket
  executeLocalOperationPad(workflowId: string): void {
    if (this.ws && this.wsConnected) {
      const commandJSON = `{ "Command" : "Start", "Argument" : "${workflowId}" }`;
      this.ws.send(commandJSON);
      console.log('🔍 Comando enviado al WebSocket:', commandJSON);
    } else {
      console.log('🔍 WebSocket no disponible, pero no usando URI sotech como fallback');
      // No usar Sotech como fallback aquí, ya que se maneja en useSotechUri
    }
  }

  // Método para alternar la visibilidad de la caja de comando
  toggleCommandBox(): void {
    this.showCommandBox = !this.showCommandBox;
    console.log('🔍 Command box visibility toggled:', this.showCommandBox);
  }
} 