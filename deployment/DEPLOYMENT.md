# Truxe Production Deployment Guide

## Prerequisites

1. **Server Requirements**:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker 20.10+ installed
   - Docker Compose 2.0+ installed
   - Root or sudo access
   - Minimum 2GB RAM, 2 CPU cores
   - 20GB free disk space

2. **Domain & DNS**:
   - Domain name configured (e.g., truxe.io)
   - DNS A records pointing to server IP
   - SSL certificates (Let's Encrypt recommended)

3. **GitHub Access**:
   - Personal Access Token (PAT) with `read:packages` scope
   - Access to private repository `wundam/truxe`

---

## Initial Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. GitHub Container Registry Authentication

```bash
# Login to GHCR with your Personal Access Token
echo YOUR_PAT_HERE | docker login ghcr.io -u wundam --password-stdin
```

### 3. Clone Deployment Files

```bash
# Create deployment directory
sudo mkdir -p /opt/truxe
sudo chown $USER:$USER /opt/truxe
cd /opt/truxe

# Copy deployment files from local machine
# Run this from your local machine:
rsync -avz deployment/ your-server:/opt/truxe/deployment/
```

### 4. Configure Environment Variables

```bash
cd /opt/truxe/deployment

# Copy template and edit
cp .env.production.example .env.production
nano .env.production  # Edit with your actual secrets

# Generate secrets
openssl rand -base64 32  # Run this for each secret
```

**Required Environment Variables**:
- `DB_PASSWORD` - PostgreSQL database password
- `REDIS_PASSWORD` - Redis password
- `JWT_PRIVATE_KEY_BASE64` - Base64 encoded JWT private key
- `JWT_PUBLIC_KEY_BASE64` - Base64 encoded JWT public key
- `BREVO_API_KEY` - Brevo/SendinBlue API key for emails
- `COOKIE_SECRET`, `SESSION_SECRET`, `OAUTH_STATE_SECRET` - Random 32+ char strings

---

## Deployment

### First-Time Deployment

```bash
cd /opt/truxe/deployment

# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f
```

### Update Deployment

```bash
cd /opt/truxe/deployment

# Pull latest images
docker-compose -f docker-compose.production.yml pull api

# Restart API service (zero-downtime)
docker-compose -f docker-compose.production.yml up -d api

# Verify
docker-compose -f docker-compose.production.yml ps
```

---

## CI/CD Integration

Every push to `main` branch automatically:
1. Builds Docker image
2. Pushes to `ghcr.io/wundam/truxe:latest`
3. Ready for deployment

**Manual deployment after CI/CD build**:
```bash
ssh your-server 'cd /opt/truxe/deployment && docker-compose -f docker-compose.production.yml pull api && docker-compose -f docker-compose.production.yml up -d api'
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f api
docker-compose -f docker-compose.production.yml logs -f database
docker-compose -f docker-compose.production.yml logs -f redis

# Check API health endpoint
curl http://localhost:3001/health
```

### Database Backup

```bash
# Backup PostgreSQL
docker-compose -f docker-compose.production.yml exec database pg_dump -U truxe truxe_prod > backup_$(date +%Y%m%d).sql

# Restore from backup
cat backup_20250112.sql | docker-compose -f docker-compose.production.yml exec -T database psql -U truxe truxe_prod
```

### Container Management

```bash
# Restart a service
docker-compose -f docker-compose.production.yml restart api

# Stop all services
docker-compose -f docker-compose.production.yml down

# Remove volumes (CAUTION: Data loss!)
docker-compose -f docker-compose.production.yml down -v
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs api

# Verify environment variables
docker-compose -f docker-compose.production.yml config

# Check if ports are in use
sudo lsof -i :3001
```

### Database connection issues

```bash
# Test database connection
docker-compose -f docker-compose.production.yml exec database psql -U truxe -d truxe_prod -c "SELECT 1"

# Check database logs
docker-compose -f docker-compose.production.yml logs database
```

### Image pull authentication failure

```bash
# Re-login to GHCR
echo YOUR_PAT_HERE | docker login ghcr.io -u wundam --password-stdin

# Verify credentials
cat ~/.docker/config.json
```

---

## Security Best Practices

1. **Secrets Management**:
   - Never commit `.env.production` to git
   - Use strong, random secrets (32+ characters)
   - Rotate secrets every 90 days
   - Use environment variables, not hardcoded values

2. **Server Security**:
   - Keep server updated: `sudo apt update && sudo apt upgrade`
   - Configure firewall (UFW): Only allow ports 80, 443, 22
   - Use SSH key authentication, disable password login
   - Enable automatic security updates

3. **Docker Security**:
   - Run containers as non-root user (already configured)
   - Use specific image tags in production, not `:latest`
   - Regularly update base images
   - Scan images for vulnerabilities

4. **Monitoring**:
   - Set up log aggregation (ELK, Loki, etc.)
   - Configure alerts for errors and downtime
   - Monitor resource usage (CPU, RAM, disk)
   - Track API response times

---

## Support

- **Documentation**: https://docs.truxe.io
- **Issues**: https://github.com/wundam/truxe/issues  
- **Email**: support@truxe.io

---

**Last Updated**: 2025-01-12  
**Version**: v0.5.1
