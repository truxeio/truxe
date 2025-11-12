# Docker Registry Strategy

**Version**: 2.0.0
**Last Updated**: 2025-11-12
**Related**: [Repository Governance](../internal/REPOSITORY_GOVERNANCE.md)

## Overview

Truxe uses a dual-registry strategy aligned with our dual-license model (MIT + BSL). This approach optimizes for:
- Private full-featured (BSL) deployments via GHCR
- Public community (MIT) distribution via Docker Hub
- Zero infrastructure costs ($0/month)

## Critical Licensing Context

**Truxe uses a dual-license model:**
- **Community Edition (MIT)**: 40% of features, open source, free forever
- **Professional/Enterprise (BSL)**: 60% of features, requires license ($79-$499/month)

**Docker images MUST respect this licensing boundary:**
- GHCR → Full features (MIT + BSL), private during development
- Docker Hub → Community features only (MIT), public distribution

## Registry Architecture

### 1. GitHub Container Registry (GHCR) - Private Full-Featured Images

**Purpose**: Production deployment, full features (MIT + BSL), private development

**Images**:
```bash
# API (Full features: MIT + BSL)
ghcr.io/wundam/truxe-api:latest
ghcr.io/wundam/truxe-api:v0.5.6
ghcr.io/wundam/truxe-api:main-abc1234

# Website (Full features: MIT + BSL)
ghcr.io/wundam/truxe-website:latest
ghcr.io/wundam/truxe-website:v0.5.6

# Admin Dashboard (Enterprise only: BSL)
ghcr.io/wundam/truxe-admin:latest
ghcr.io/wundam/truxe-admin:v0.5.6
```

**Features Included**:
- ✅ Community features (MIT): Magic link, password auth, basic OAuth
- ✅ Professional features (BSL): OAuth provider, advanced RBAC
- ✅ Enterprise features (BSL): Passkeys, SAML, SCIM, threat detection

**Advantages**:
- ✅ Free for private repositories ($0/month)
- ✅ Integrated with GitHub Actions (automatic `GITHUB_TOKEN` auth)
- ✅ Fast deployment pipeline (same network as GitHub)
- ✅ No rate limits for authenticated users
- ✅ Version control integration
- ✅ Perfect for private beta and production

**Use Cases**:
- Production deployments (truxe.io)
- Staging environments
- Internal testing
- CI/CD pipelines
- Private beta testing
- Development environments

**Access**: Requires GitHub Personal Access Token (PAT) with `read:packages` scope

---

### 2. Docker Hub - Public Community Edition Images (Future, Q1 2026)

**Purpose**: Community distribution, open source (MIT only), public access

**Images** (when public):
```bash
# Community Edition (MIT license only)
wundam/truxe-community:latest           # Community Edition
wundam/truxe-community:v1.0.0
docker.io/wundam/truxe-community:v1.0.0

# Alias for simplicity
wundam/truxe:latest                     # Points to community edition
wundam/truxe:v1.0.0
```

**Features Included**:
- ✅ Magic Link Authentication
- ✅ Password Authentication
- ✅ Basic OAuth Consumer (GitHub, Google)
- ✅ Basic Sessions (JWT)
- ✅ Basic Organizations
- ✅ Basic RBAC
- ❌ NO OAuth Provider (BSL feature)
- ❌ NO Passkeys/WebAuthn (BSL feature)
- ❌ NO SAML/SCIM (BSL feature)
- ❌ NO Advanced features (BSL)

**Advantages**:
- ✅ Most popular registry (industry standard)
- ✅ Better community visibility and adoption
- ✅ Docker Desktop integration
- ✅ Easy discovery (`docker pull wundam/truxe`)
- ✅ **FREE for public repositories** - $0/month (personal account)
- ✅ No authentication needed for pulls

**Use Cases**:
- Open source community adoption
- Public documentation examples
- Marketing and visibility
- Developer evaluation
- Hobbyist/student projects

**Access**: Public, no authentication needed

**Note**: Using personal Docker Hub account (`wundam`) instead of paid organization to keep costs at $0/month while maintaining professional image distribution.

## Current Status

### Active: GHCR Only
**Phase**: Private Beta / Production
**Status**: ✅ Fully implemented and deployed

```yaml
# docker-compose.production.yml
services:
  api:
    image: ghcr.io/wundam/truxe-api:latest
  website:
    image: ghcr.io/wundam/truxe-website:latest
```

### Planned: GHCR + Docker Hub
**Phase**: Public Release (v1.0+)
**Status**: 📅 Scheduled for public launch

## Authentication

### GHCR Authentication

#### For GitHub Actions (Automatic)
```yaml
- name: Log in to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

#### For Production Server
```bash
# Create GitHub PAT with read:packages scope
export CR_PAT=YOUR_TOKEN

# Login to GHCR
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
docker pull ghcr.io/wundam/truxe-api:latest
```

### Docker Hub Authentication (Future)

#### For GitHub Actions
```yaml
- name: Log in to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

## Image Naming Convention

### GHCR (Current)
```
ghcr.io/{owner}/{image-name}:{tag}

Examples:
- ghcr.io/wundam/truxe-api:v0.5.6
- ghcr.io/wundam/truxe-api:latest
- ghcr.io/wundam/truxe-website:v0.5.6
- ghcr.io/wundam/truxe-website:latest
```

### Docker Hub (Future)
```
{organization}/{image-name}:{tag}

Examples:
- truxeio/truxe:v1.0.0
- truxeio/truxe:latest
- truxeio/truxe-api:v1.0.0
- truxeio/truxe-website:v1.0.0
```

## Tagging Strategy

### Version Tags
```bash
# Semantic versioning
v0.5.6          # Full version
v0.5            # Minor version
v0              # Major version

# Special tags
latest          # Latest stable release
main            # Latest main branch build
develop         # Latest development build
```

### Branch Tags
```bash
main-abc1234    # Commit on main branch
develop-xyz9876 # Commit on develop branch
```

## Build and Push Workflow

### Current: GHCR Only

```yaml
# .github/workflows/docker-build.yml
env:
  REGISTRY: ghcr.io
  API_IMAGE: ${{ github.repository_owner }}/truxe-api
  WEBSITE_IMAGE: ${{ github.repository_owner }}/truxe-website

- name: Build and push API image
  uses: docker/build-push-action@v5
  with:
    context: ./apps/api
    push: true
    tags: ${{ steps.api-meta.outputs.tags }}
    cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.API_IMAGE }}:buildcache
```

### Future: Multi-Registry

```yaml
# Build once, push to both registries
- name: Extract metadata
  uses: docker/metadata-action@v5
  with:
    images: |
      ghcr.io/wundam/truxe-api
      truxeio/truxe-api
    tags: |
      type=semver,pattern={{version}}
      type=raw,value=latest,enable={{is_default_branch}}

- name: Build and push to both registries
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: ${{ steps.meta.outputs.tags }}
```

## Migration Plan

### Phase 1: Private Beta (Current) ✅
- GHCR only
- Private repositories
- Production deployment working
- Status: **Complete**

### Phase 2: Docker Hub Setup (Future)
- Create `truxeio` organization on Docker Hub
- Add Docker Hub credentials to GitHub Secrets
- Test dual-registry push
- Status: **Planned for v1.0**

### Phase 3: Public Release (Future)
- Push to both GHCR and Docker Hub
- Update documentation with Docker Hub examples
- Community adoption phase
- Status: **Planned for v1.0+**

## Best Practices

### 1. Use GHCR for Development
```bash
# Fast, integrated with GitHub
docker pull ghcr.io/wundam/truxe-api:latest
```

### 2. Use Docker Hub for Production (Future)
```bash
# Industry standard, widely trusted
docker pull truxeio/truxe:latest
```

### 3. Keep Both in Sync
- Same image content
- Same version tags
- Automatic sync via CI/CD

### 4. Security
- Private images on GHCR (enterprise features)
- Public images on Docker Hub (community features)
- Never expose private credentials
- Use separate PATs for different environments

## Cost Analysis

### GHCR
- **Private repos**: Free
- **Storage**: Free (unlimited for public)
- **Bandwidth**: Free
- **Build minutes**: Included in GitHub Actions

### Docker Hub
- **Free tier**: 1 private repo
- **Pro**: $7/month (unlimited private repos)
- **Team**: $9/user/month
- **Pull rate limits**:
  - Anonymous: 100 pulls/6h
  - Authenticated: 200 pulls/6h
  - Pro: Unlimited

### Recommendation
- **Current (Private Beta)**: GHCR only - $0/month ✅
- **Public Release**: GHCR + Docker Hub Free - $0/month
- **Enterprise**: GHCR + Docker Hub Pro - $7/month

## Monitoring

### Registry Health
```bash
# Check GHCR images
gh api /user/packages/container/truxe-api/versions

# Check Docker Hub images (future)
curl https://hub.docker.com/v2/repositories/truxeio/truxe/tags/
```

### Pull Statistics
- GHCR: GitHub Insights → Packages
- Docker Hub: Hub Dashboard → Analytics

## Troubleshooting

### GHCR Authentication Issues
```bash
# Verify PAT has correct scopes
# Required: read:packages, write:packages

# Re-authenticate
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

### Image Not Found
```bash
# Check if image exists
docker manifest inspect ghcr.io/wundam/truxe-api:latest

# Check if you have access
gh api /user/packages/container/truxe-api
```

### Rate Limiting
- GHCR: Very high limits (rarely hit)
- Docker Hub: Use authenticated pulls
- Solution: Implement local registry cache

## References

- [GHCR Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [Multi-Platform Images](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions Docker](https://docs.docker.com/build/ci/github-actions/)

## Summary

**Current Strategy (Q4 2025)**: GHCR-only for optimal integration and zero cost during private beta. Full features (MIT + BSL).

**Future Strategy (Q1 2026+)**: Dual-registry with licensing boundary:
- GHCR → Private, full-featured (MIT + BSL), production
- Docker Hub → Public, community edition (MIT only), open source

**Timeline**:
- ✅ Phase 1 (Private Beta): GHCR only, full features - Complete
- 📅 Phase 2 (Community Split): Extract MIT features to separate build - Q1 2026
- 📅 Phase 3 (Public Release): Add Docker Hub for community edition - Q1 2026
- 📅 Phase 4 (License Enforcement): Add license key validation - Q2 2026

**Cost Impact**: $0/month (avoided $16/month Docker Hub org cost by using personal account)

**Critical Reminder**: Always respect the licensing boundary. Docker Hub images MUST contain ONLY MIT licensed features. BSL features stay private on GHCR.
