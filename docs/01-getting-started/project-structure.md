# Truxe Project Structure

This document outlines the organized structure of the Truxe authentication platform project.

## ⚙️ Configuration Management System

Truxe features a comprehensive configuration management system that eliminates hardcoded values and provides centralized, environment-specific configuration:

### 🎯 Key Components

- **`api/src/config/constants.js`**: Centralized constants with 200+ configurable values
- **`api/src/config/index.js`**: Main configuration loader with validation
- **`api/scripts/validate-config.js`**: Configuration validation and migration tool
- **`api/scripts/migrate-config.js`**: Automatic migration from hardcoded values
- **`api/env.comprehensive.example`**: Complete environment template (597 lines)
- **`docs/05-guides/configuration-management.md`**: Comprehensive documentation

### 🛠️ Configuration Tools

```bash
npm run config:validate      # Validate configurations
npm run config:recommend     # Get recommendations
npm run config:template      # Generate environment templates
npm run config:migrate       # Migrate hardcoded values
npm run config:migrate-dry   # Dry run migration
```

### 📋 Configuration Categories

- **Application Settings**: Ports, hosts, logging, API versions
- **Database Configuration**: Connection strings, pool settings, timeouts
- **Security Settings**: CORS, rate limiting, threat detection
- **Email Configuration**: Multiple providers (Resend, AWS SES, SMTP, Brevo)
- **Monitoring**: Metrics, alerts, dashboards
- **Feature Flags**: Enable/disable features per environment
- **UI/UX Values**: Colors, sizes, styling constants

## 📁 Root Directory Structure

```
Truxe/
├── 📁 api/                    # Backend API service
│   ├── 📁 src/
│   │   ├── 📁 config/         # Configuration management
│   │   │   ├── 📄 index.js    # Main configuration loader
│   │   │   └── 📄 constants.js # Centralized constants
│   │   └── 📁 scripts/        # Configuration tools
│   │       ├── 📄 validate-config.js # Configuration validator
│   │       └── 📄 migrate-config.js  # Configuration migrator
│   ├── 📄 env.example         # Basic environment template
│   └── 📄 env.comprehensive.example # Complete environment template
├── 📁 cli/                    # Command-line interface
├── 📁 config/                 # Configuration files
│   ├── 📁 environments/       # Environment configuration files
│   ├── 📁 consul/            # Consul configuration
│   ├── 📁 redis/             # Redis configuration
│   ├── 📁 traefik/           # Traefik configuration
│   └── dokploy.json          # Dokploy deployment config
├── 📁 database/              # Database service and migrations
├── 📁 deploy/                # Deployment configurations
│   ├── 📁 dokploy/           # Dokploy deployment
│   ├── 📁 kubernetes/        # Kubernetes manifests
│   └── 📁 monitoring/        # Monitoring configurations
├── 📁 docker/                # Docker configurations
│   ├── 📁 environments/      # Environment-specific docker configs
│   ├── 📁 services/          # Service definitions
│   └── 📁 tools/             # Docker tools
├── 📁 docs/                  # Documentation
│   ├── 📁 01-product/        # Product documentation
│   ├── 📁 02-technical/      # Technical documentation
│   ├── 📁 03-implementation/ # Implementation guides
│   ├── 📁 04-adrs/          # Architecture Decision Records
│   ├── 📁 05-guides/        # User guides
│   │   └── 📄 configuration-management.md # Configuration management guide
│   ├── 📁 06-implementation-summaries/ # Implementation summaries
│   ├── 📁 handovers/        # Handover documents
│   ├── 📁 reports/           # Implementation reports
│   └── 📁 status-reports/    # Status reports
├── 📁 logs/                  # Log files
│   ├── 📁 alerts/            # Alert logs
│   └── 📁 monitoring/        # Monitoring reports
├── 📁 scripts/               # Utility scripts
├── 📁 secrets/               # Secret files (gitignored)
├── 📁 tests/                 # Integration tests
├── 📁 ui/                    # Frontend UI components
├── 📁 alpha/                 # Alpha release files
├── 📄 CHANGELOG.md           # Project changelog
├── 📄 README.md              # Project overview
├── 📄 PROJECT-STRUCTURE.md   # This file
├── 📄 docker-compose.yml     # Main docker compose
├── 📄 docker-manager         # Docker management script
├── 📄 package.json           # Root package.json
└── 📄 .gitignore             # Git ignore rules
```

## 🎯 Key Directories

### **Core Services**
- **`api/`** - Backend authentication API service
- **`database/`** - Database service with migrations
- **`ui/`** - Frontend UI components and admin dashboard
- **`cli/`** - Command-line interface tools

### **Configuration**
- **`config/`** - All configuration files organized by service
- **`config/environments/`** - Environment-specific configuration files
- **`docker/`** - Docker and containerization configurations

### **Documentation**
- **`docs/`** - Comprehensive documentation organized by category
- **`docs/handovers/`** - Handover documents for different components
- **`docs/reports/`** - Implementation and compliance reports
- **`docs/status-reports/`** - Project status and completion reports

### **Deployment & Operations**
- **`deploy/`** - Deployment configurations for different platforms
- **`scripts/`** - Utility and automation scripts
- **`logs/`** - Log files and monitoring reports

### **Development**
- **`tests/`** - Integration and end-to-end tests
- **`alpha/`** - Alpha release files and feedback

## 📋 File Organization Principles

1. **Separation of Concerns**: Each directory has a specific purpose
2. **Logical Grouping**: Related files are grouped together
3. **Clear Naming**: Directory and file names are descriptive
4. **Documentation**: Each major directory has appropriate documentation
5. **Version Control**: Sensitive files are properly gitignored

## 🔧 Maintenance

- **Regular Cleanup**: Move new files to appropriate directories
- **Documentation Updates**: Keep this structure document current
- **Git Ignore**: Maintain proper .gitignore rules
- **Naming Conventions**: Follow consistent naming patterns

## 📝 Notes

- All handover documents are now in `docs/handovers/`
- All implementation reports are in `docs/reports/`
- All monitoring reports are in `logs/monitoring/`
- Environment files are in `config/environments/`
- The root directory is kept clean with only essential files

This structure promotes maintainability, discoverability, and professional organization of the Truxe project.
