// Modelo para configuración de SharePoint

export interface SharePointConfiguration {
  companyId: number;
  tenantId: string;
  clientId: string;
  clientSecret?: string; // No se devuelve en GET
  siteId: string;
  folder: string;
}

export interface SharePointConfigurationReadDto {
  companyId: number;
  tenantId: string | null;
  clientId: string | null;
  siteId: string | null;
  folder: string | null;
}

export interface SharePointConfigurationCreateDto {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  folder: string;
}

export interface SharePointConfigurationUpdateDto {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  folder: string;
}

// Tipo de integración disponible
export interface IntegrationType {
  id: string;
  name: string;
  description: string;
  icon: string;
  isConfigured: boolean;
}
