export interface HeimdallConfig {
  // Server configuration
  server?: {
    port: number;
    host: string;
    cors?: {
      origin: string | string[];
      credentials: boolean;
    };
  };

  // Database configuration
  database: {
    url: string;
    ssl?: boolean;
    poolSize?: number;
  };

  // Authentication settings
  auth: {
    magicLink: {
      enabled: boolean;
      expiryMinutes: number;
    };
    jwt: {
      algorithm: 'RS256' | 'HS256';
      accessTokenTTL: string;
      refreshTokenTTL: string;
    };
    session: {
      maxConcurrent: number;
      deviceTracking: boolean;
    };
  };

  // Multi-tenancy settings
  multiTenant: {
    enabled: boolean;
    defaultRole: string;
    allowSignup: boolean;
  };

  // Email configuration
  email: {
    provider: 'resend' | 'ses' | 'smtp';
    from: string;
    apiKey?: string;
  };

  // Rate limiting
  rateLimit: {
    magicLink: string;
    apiRequests: string;
  };

  // UI customization
  ui?: {
    theme?: {
      primaryColor?: string;
      borderRadius?: string;
      fontFamily?: string;
    };
    branding?: {
      logo?: string;
      companyName?: string;
    };
  };
}

export interface FrameworkTemplate {
  name: string;
  displayName: string;
  description: string;
  supportedFeatures: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export interface ProjectScaffold {
  template: FrameworkTemplate;
  projectName: string;
  projectPath: string;
  config: Partial<HeimdallConfig>;
}

export interface InitOptions {
  template?: 'nextjs' | 'nuxt' | 'sveltekit';
  projectName?: string;
  database?: 'sqlite' | 'postgresql';
  multiTenant?: boolean;
  skipInstall?: boolean;
  skipGit?: boolean;
}

export interface DevOptions {
  port?: number;
  apiPort?: number; // Separate port for Heimdall API
  db?: 'sqlite' | 'postgresql';
  host?: string;
  open?: boolean;
  watch?: boolean;
}

export interface MigrateOptions {
  env?: 'development' | 'production' | 'staging';
  up?: boolean;
  down?: boolean;
  steps?: number;
  create?: string;
}

export interface StatusOptions {
  checkAll?: boolean;
  checkDb?: boolean;
  checkEmail?: boolean;
  checkJwt?: boolean;
  format?: 'table' | 'json';
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  details?: Record<string, unknown>;
}

export interface ConfigValue {
  key: string;
  value: unknown;
  source: 'file' | 'env' | 'default';
  description?: string | undefined;
}
