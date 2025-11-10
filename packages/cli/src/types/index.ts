// Type definitions for CLI

export interface InitOptions {
  projectName?: string;
  database?: 'postgresql' | 'mysql';
  redis?: boolean;
  emailProvider?: 'smtp' | 'brevo' | 'sendgrid' | 'none';
  oauthProviders?: string[];
}

export interface DevOptions {
  port?: number;
  host?: string;
  watch?: boolean;
}

export interface MigrateOptions {
  action: 'up' | 'down' | 'status' | 'create';
  name?: string;
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

