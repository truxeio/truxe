# Docker Configuration Management

This directory contains all Docker-related configurations for Truxe, organized by purpose and environment.

## 📁 Directory Structure

```
docker/
├── README.md                           # This file
├── docker-compose.base.yml             # Base configuration (copy of root docker-compose.yml)
├── docker-manager.sh                   # Management script for easy operations
├── environments/                       # Environment-specific configurations
│   ├── docker-compose.dev.yml          # Development environment
│   ├── docker-compose.staging.yml      # Staging environment  
│   ├── docker-compose.prod.yml         # Production environment
│   ├── docker-compose.production.yml   # Alternative production config
│   ├── docker-compose.testing.yml      # Testing environment
│   └── docker-compose.alpha.yml        # Alpha release environment
├── services/                          # Service-specific Dockerfiles
│   ├── Dockerfile.port-monitor        # Port monitoring service
│   └── Dockerfile.port-validator      # Port validation service
└── tools/                            # Enhanced/specialized configurations
    ├── docker-compose.enhanced.yml    # Enhanced features configuration
    ├── docker-compose.enhanced-validation.yml  # Enhanced validation setup
    └── docker-compose.optimized.yml   # Performance-optimized configuration
```

## 🚀 Quick Start

### Using the Management Script
```bash
# Make the script executable
chmod +x docker/docker-manager.sh

# Start development environment
./docker/docker-manager.sh start dev

# Start production environment  
./docker/docker-manager.sh start prod

# Stop all services
./docker/docker-manager.sh stop

# View logs for specific environment
./docker/docker-manager.sh logs dev

# Clean up everything
./docker/docker-manager.sh clean
```

### Manual Docker Compose Commands

#### Development Environment
```bash
# Start development stack
docker-compose -f docker/environments/docker-compose.dev.yml up -d

# View logs
docker-compose -f docker/environments/docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker/environments/docker-compose.dev.yml down
```

#### Production Environment
```bash
# Start production stack
docker-compose -f docker/environments/docker-compose.prod.yml up -d

# Start with resource monitoring
docker-compose -f docker/environments/docker-compose.prod.yml -f docker/tools/docker-compose.optimized.yml up -d

# Stop services
docker-compose -f docker/environments/docker-compose.prod.yml down
```

#### Testing Environment
```bash
# Start testing stack with enhanced validation
docker-compose -f docker/environments/docker-compose.testing.yml -f docker/tools/docker-compose.enhanced-validation.yml up -d

# Run tests
docker-compose -f docker/environments/docker-compose.testing.yml exec api npm test

# Stop testing services
docker-compose -f docker/environments/docker-compose.testing.yml down
```

## 🔧 Environment Configurations

### Development (`docker-compose.dev.yml`)
- **Purpose**: Local development with hot reloading
- **Features**: 
  - Volume mounts for live code changes
  - Debug ports exposed
  - Development database with sample data
  - MailHog for email testing
- **Ports**: 3000 (API), 3001 (Frontend), 5432 (DB), 8025 (MailHog)

### Staging (`docker-compose.staging.yml`)
- **Purpose**: Pre-production testing environment
- **Features**:
  - Production-like configuration
  - Staging database
  - Performance monitoring
  - SSL certificates
- **Ports**: 443 (HTTPS), 80 (HTTP redirect)

### Production (`docker-compose.prod.yml`)
- **Purpose**: Production deployment
- **Features**:
  - Optimized for performance and security
  - Health checks and restart policies
  - Resource limits and reservations
  - Production database with backups
  - SSL/TLS encryption
- **Ports**: 443 (HTTPS), 80 (HTTP redirect)

### Testing (`docker-compose.testing.yml`)
- **Purpose**: Automated testing and CI/CD
- **Features**:
  - Test database with fixtures
  - Test runners and coverage tools
  - Integration test services
  - Ephemeral containers
- **Ports**: Dynamic allocation

### Alpha (`docker-compose.alpha.yml`)
- **Purpose**: Alpha release testing
- **Features**:
  - Feature flags enabled
  - Enhanced logging and monitoring
  - User feedback collection
  - A/B testing infrastructure
- **Ports**: 3000 (API), 3001 (Frontend)

## 🛠️ Specialized Tools

### Enhanced Configuration (`docker-compose.enhanced.yml`)
- **Purpose**: Development with advanced features
- **Features**:
  - Redis for caching and sessions
  - Elasticsearch for logging
  - Grafana for monitoring
  - Advanced debugging tools

### Enhanced Validation (`docker-compose.enhanced-validation.yml`)
- **Purpose**: Comprehensive validation and testing
- **Features**:
  - Security scanning tools
  - Performance testing
  - Code quality analysis
  - Compliance checking

### Optimized Configuration (`docker-compose.optimized.yml`)
- **Purpose**: Performance-optimized deployment
- **Features**:
  - Resource optimization
  - Caching layers
  - Load balancing
  - Performance monitoring

## 🏗️ Service Dockerfiles

### Port Monitor (`Dockerfile.port-monitor`)
- **Purpose**: Real-time port monitoring service
- **Base Image**: Node.js Alpine
- **Features**:
  - Lightweight monitoring agent
  - WebSocket support for real-time updates
  - Health check endpoints
  - Metrics collection

### Port Validator (`Dockerfile.port-validator`)
- **Purpose**: Port validation and conflict detection
- **Base Image**: Node.js Alpine  
- **Features**:
  - Port availability checking
  - Conflict resolution algorithms
  - Validation reporting
  - Integration with main API

## 🔄 Common Operations

### Multi-Environment Deployment
```bash
# Deploy to multiple environments simultaneously
docker-compose -f docker/environments/docker-compose.dev.yml up -d
docker-compose -f docker/environments/docker-compose.staging.yml up -d

# Use different project names to avoid conflicts
docker-compose -p truxe.io -f docker/environments/docker-compose.dev.yml up -d
docker-compose -p truxe-staging -f docker/environments/docker-compose.staging.yml up -d
```

### Combining Configurations
```bash
# Production with enhanced monitoring
docker-compose \
  -f docker/environments/docker-compose.prod.yml \
  -f docker/tools/docker-compose.optimized.yml \
  up -d

# Development with enhanced features
docker-compose \
  -f docker/environments/docker-compose.dev.yml \
  -f docker/tools/docker-compose.enhanced.yml \
  up -d
```

### Service-Specific Operations
```bash
# Build custom services
docker build -f docker/services/Dockerfile.port-monitor -t truxe/port-monitor .
docker build -f docker/services/Dockerfile.port-validator -t truxe/port-validator .

# Run individual services
docker run -d --name port-monitor truxe/port-monitor
docker run -d --name port-validator truxe/port-validator
```

## 📊 Monitoring and Logs

### View Logs by Environment
```bash
# Development logs
docker-compose -f docker/environments/docker-compose.dev.yml logs -f api

# Production logs with timestamps
docker-compose -f docker/environments/docker-compose.prod.yml logs -f --timestamps

# All services logs
docker-compose -f docker/environments/docker-compose.prod.yml logs -f
```

### Health Checks
```bash
# Check service health
docker-compose -f docker/environments/docker-compose.prod.yml ps

# Detailed health information
docker inspect $(docker-compose -f docker/environments/docker-compose.prod.yml ps -q api) | jq '.[0].State.Health'
```

## 🧹 Cleanup Operations

### Remove Specific Environment
```bash
# Stop and remove development environment
docker-compose -f docker/environments/docker-compose.dev.yml down -v

# Remove with images
docker-compose -f docker/environments/docker-compose.dev.yml down -v --rmi all
```

### Complete Cleanup
```bash
# Remove all Truxe containers, networks, and volumes
docker system prune -f
docker volume prune -f
docker network prune -f

# Remove Truxe-specific resources
docker ps -a | grep truxe | awk '{print $1}' | xargs docker rm -f
docker images | grep truxe | awk '{print $3}' | xargs docker rmi -f
```

## 🔐 Security Considerations

### Production Security
- All production configurations use non-root users
- Secrets are managed via Docker secrets or environment variables
- Network isolation between services
- Resource limits to prevent DoS
- Health checks for automatic recovery

### Development Security
- Development configurations expose additional ports for debugging
- Use separate databases and credentials
- Enable CORS for local development
- Mock external services for testing

## 🚀 Deployment Strategies

### Blue-Green Deployment
```bash
# Deploy to blue environment
docker-compose -p truxe-blue -f docker/environments/docker-compose.prod.yml up -d

# Test blue environment
curl -f http://blue.truxe.local/health

# Switch traffic to blue (update load balancer)
# Then stop green environment
docker-compose -p truxe-green -f docker/environments/docker-compose.prod.yml down
```

### Rolling Updates
```bash
# Update API service only
docker-compose -f docker/environments/docker-compose.prod.yml up -d --no-deps api

# Update with zero downtime
docker-compose -f docker/environments/docker-compose.prod.yml up -d --scale api=2
# Wait for new container to be healthy
docker-compose -f docker/environments/docker-compose.prod.yml up -d --scale api=1
```

## 📝 Configuration Management

### Environment Variables
Each environment configuration supports these key variables:
- `TRUXE_ENV`: Environment name (dev, staging, prod)
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: JWT signing secret
- `EMAIL_PROVIDER`: Email service configuration
- `LOG_LEVEL`: Logging verbosity
- `FEATURE_FLAGS`: Enabled features

### Secrets Management
```bash
# Create Docker secrets for production
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-db-password" | docker secret create db_password -

# Use in docker-compose.yml
services:
  api:
    secrets:
      - jwt_secret
      - db_password
```

## 🤝 Contributing

When adding new Docker configurations:

1. **Environment configs** go in `environments/`
2. **Service Dockerfiles** go in `services/`
3. **Specialized tools** go in `tools/`
4. **Update this README** with new configurations
5. **Test configurations** before committing
6. **Follow naming conventions**: `docker-compose.{purpose}.yml`

## 📞 Support

For Docker configuration issues:
- Check service logs: `docker-compose logs [service]`
- Verify network connectivity: `docker network ls`
- Check resource usage: `docker stats`
- Review health checks: `docker-compose ps`

For more help, see the main project documentation or contact the development team.

