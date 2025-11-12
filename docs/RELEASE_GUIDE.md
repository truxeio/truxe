# Truxe Release Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-12
**Related**: [Repository Governance](internal/REPOSITORY_GOVERNANCE.md), [Docker Registry Strategy](deployment/docker-registry-strategy.md)

---

## Quick Start (TL;DR)

```bash
# 1. Run pre-release checks
./scripts/pre-release-check.sh

# 2. Create release (automated)
./scripts/create-release.sh v0.5.7

# 3. Done! 🎉
```

---

## Table of Contents

1. [Release Types](#release-types)
2. [Automated Release Workflow](#automated-release-workflow)
3. [Manual Release Workflow](#manual-release-workflow)
4. [Hotfix Release](#hotfix-release)
5. [Post-Release](#post-release)
6. [Troubleshooting](#troubleshooting)

---

## Release Types

### Patch Release (v0.5.6 → v0.5.7)

**When to use:**
- Bug fixes only
- Security patches
- Documentation updates
- No new features

**Frequency:** As needed (on-demand)

**Example:**
```bash
./scripts/create-release.sh v0.5.7
```

---

### Minor Release (v0.5.x → v0.6.0)

**When to use:**
- New features (backward compatible)
- Feature enhancements
- New APIs (non-breaking)
- Performance improvements

**Frequency:** Monthly (or when feature complete)

**Example:**
```bash
./scripts/create-release.sh v0.6.0
```

---

### Major Release (v0.x.x → v1.0.0)

**When to use:**
- Breaking changes
- Major architecture changes
- API redesigns
- License changes

**Frequency:** Quarterly

**Example:**
```bash
./scripts/create-release.sh v1.0.0
```

---

## Automated Release Workflow

### Prerequisites

1. **Environment Setup:**
   ```bash
   # Install dependencies
   pnpm install
   
   # Install GitHub CLI (for releases)
   brew install gh  # macOS
   # or: sudo apt install gh  # Linux
   
   # Authenticate GitHub CLI
   gh auth login
   
   # Configure SSH for production server (optional)
   ssh-copy-id truxe-prod-01
   ```

2. **Branch Requirements:**
   - Must be on `main` branch
   - Working directory must be clean
   - In sync with `origin/main`

### Step 1: Pre-Release Checks

Run comprehensive automated checks:

```bash
./scripts/pre-release-check.sh
```

**This script validates:**
- ✅ Git repository status (clean, on main, in sync)
- ✅ Package integrity (pnpm, dependencies)
- ✅ Build success (all packages build)
- ✅ TypeScript compilation (zero errors)
- ✅ Test suite (all tests passing)
- ✅ Security audit (no vulnerabilities)
- ✅ URL consistency (no private repo URLs in public code)
- ✅ Playground build size
- ✅ Version consistency
- ✅ Documentation completeness

**If checks fail:**
- Fix the issues
- Re-run the script
- Do NOT proceed until all checks pass

### Step 2: Update CHANGELOG (Manual)

Edit `CHANGELOG.md`:

```markdown
## [0.5.7] - 2025-11-12

### Fixed
- Fixed OAuth redirect loop in Safari (#123)
- Resolved session timeout issue (#124)

### Changed
- Improved error messages for MFA failures
- Updated dependencies to latest secure versions

### Security
- Patched XSS vulnerability in login form
```

**Commit the changes:**
```bash
git add CHANGELOG.md
git commit -m "docs: Update CHANGELOG for v0.5.7"
git push origin main
```

### Step 3: Create Release (Automated)

Run the automated release script:

```bash
./scripts/create-release.sh v0.5.7
```

**This script will:**

1. **Run pre-release checks** (if not already done)
2. **Verify CHANGELOG** includes the new version
3. **Create Git tag** with release notes
4. **Push to private repo** (wundam/truxe)
5. **Trigger Docker builds** on GitHub Actions
6. **Sync to public repo** (optional, if Community Edition changes)
7. **Create GitHub release** with auto-generated notes
8. **Verify builds** (Docker images)
9. **Deploy to production** (optional, with confirmation)

**The script is interactive** - it will ask for confirmation before:
- Continuing if CHANGELOG is not updated
- Syncing to public repository
- Deploying to production

### Step 4: Verify Release

After the script completes:

```bash
# Check GitHub Actions
gh run list --limit 5

# Check Docker images
gh api /user/packages/container/truxe-api/versions --jq '.[0:3]'

# Check production health (if deployed)
curl -f https://api.truxe.io/health
```

---

## Manual Release Workflow

If you prefer manual control or automation fails:

### 1. Pre-Release Checklist

```bash
# Check git status
git status
git fetch origin
git log origin/main..HEAD  # Should be empty

# Run tests
pnpm install
pnpm build
pnpm type-check
pnpm lint
pnpm test

# Security audit
npm audit --audit-level=moderate
```

### 2. Update Version & CHANGELOG

```bash
# Update CHANGELOG.md manually
vim CHANGELOG.md

# Commit
git add CHANGELOG.md
git commit -m "docs: Update CHANGELOG for v0.5.7"
```

### 3. Create Git Tag

```bash
# Create annotated tag
git tag -a v0.5.7 -m "$(cat <<'TAGMSG'
Release v0.5.7 - Bug Fixes

Fixed:
- OAuth redirect loop in Safari
- Session timeout issue
- MFA error messages

Security:
- Patched XSS vulnerability

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
TAGMSG
)"

# Verify tag
git show v0.5.7
```

### 4. Push to Repositories

```bash
# Push to private repo (always)
git push origin main
git push origin v0.5.7

# Push to public repo (only if Community Edition changes)
./scripts/sync-to-public.sh
git push public v0.5.7
```

### 5. Trigger Docker Builds

```bash
# Builds trigger automatically on tag push
# Monitor progress:
gh run list
gh run watch

# Manual trigger (if needed):
gh workflow run docker-build.yml --ref v0.5.7
```

### 6. Create GitHub Release

```bash
# Create release
gh release create v0.5.7 \
  --title "v0.5.7 - Bug Fixes and Security Patches" \
  --notes-file CHANGELOG.md \
  --repo wundam/truxe

# If synced to public
gh release create v0.5.7 \
  --title "v0.5.7 - Community Edition" \
  --notes-file CHANGELOG.md \
  --repo truxeio/truxe
```

### 7. Deploy to Production

```bash
# SSH into production server
ssh truxe-prod-01

# Navigate to deployment directory
cd /opt/truxe/deployment

# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Verify health
docker-compose ps
curl -f https://api.truxe.io/health
```

---

## Hotfix Release

For **critical production bugs**, use the hotfix workflow:

### 1. Create Hotfix Branch

```bash
# Branch from latest release tag
git checkout -b hotfix/v0.5.7 v0.5.6

# Fix the bug
# ... make changes ...

# Commit
git add .
git commit -m "fix: critical OAuth security vulnerability (CVE-2025-XXXX)"
```

### 2. Test Hotfix

```bash
# Run tests
pnpm test

# Build
pnpm build

# Verify fix
# ... manual testing ...
```

### 3. Create Hotfix Release

```bash
# Tag the hotfix
git tag -a v0.5.7 -m "Hotfix v0.5.7 - Critical OAuth security patch"

# Merge back to main
git checkout main
git merge hotfix/v0.5.7

# Push everything
git push origin main
git push origin v0.5.7

# Delete hotfix branch
git branch -d hotfix/v0.5.7
```

### 4. Deploy Immediately

```bash
# Deploy to production (no delay)
ssh truxe-prod-01 'cd /opt/truxe/deployment && docker-compose pull && docker-compose up -d'

# Verify immediately
curl -f https://api.truxe.io/health
```

### 5. Post-Hotfix Communication

- Update security advisory (if CVE)
- Notify customers via email
- Update documentation
- Create incident report

---

## Post-Release

### Verification Checklist

After every release:

- [ ] GitHub Actions builds completed successfully
- [ ] Docker images published to GHCR
  - [ ] `ghcr.io/wundam/truxe-api:v0.5.7`
  - [ ] `ghcr.io/wundam/truxe-website:v0.5.7`
- [ ] GitHub release created with notes
- [ ] Production deployment successful (if deployed)
- [ ] Production health check passing
- [ ] CHANGELOG committed and pushed
- [ ] No broken links in documentation
- [ ] Roadmap updated (if needed)

### Monitoring (First 24 Hours)

```bash
# Check GitHub Actions status
gh run list

# Check production logs
ssh truxe-prod-01 'cd /opt/truxe/deployment && docker-compose logs --tail=100 --follow api'

# Monitor error rates
# (Set up monitoring dashboard: Grafana, Sentry, etc.)

# Check user reports
# (Monitor GitHub Issues, support channels)
```

### Rollback (If Needed)

If the release causes issues:

```bash
# SSH into production
ssh truxe-prod-01
cd /opt/truxe/deployment

# Stop services
docker-compose down

# Pull previous version
docker pull ghcr.io/wundam/truxe-api:v0.5.6
docker tag ghcr.io/wundam/truxe-api:v0.5.6 ghcr.io/wundam/truxe-api:latest

# Restart
docker-compose up -d

# Verify
curl -f https://api.truxe.io/health
```

---

## Troubleshooting

### Error: "Working directory has uncommitted changes"

```bash
# Check what's uncommitted
git status

# Either commit or stash
git add .
git commit -m "fix: your changes"
# or
git stash
```

### Error: "Not on main branch"

```bash
# Switch to main
git checkout main

# Pull latest
git pull origin main
```

### Error: "Tag already exists"

```bash
# Check existing tags
git tag -l

# Delete local tag
git tag -d v0.5.7

# Delete remote tag (if pushed)
git push --delete origin v0.5.7
```

### Error: "TypeScript compilation failed"

```bash
# Show errors
pnpm type-check

# Fix errors
# ... edit files ...

# Re-run checks
./scripts/pre-release-check.sh
```

### Error: "Tests failed"

```bash
# Run tests with verbose output
pnpm test --verbose

# Run specific test
pnpm test path/to/test.js

# Fix tests
# ... edit files ...
```

### Error: "Docker build failed"

```bash
# Check GitHub Actions logs
gh run list
gh run view <run-id>

# Test build locally
docker build -t truxe-api-test -f apps/api/Dockerfile apps/api

# Fix Dockerfile
# ... edit Dockerfile ...
```

### Error: "Cannot connect to production server"

```bash
# Check SSH configuration
ssh -v truxe-prod-01

# Add SSH key
ssh-copy-id truxe-prod-01

# Or update ~/.ssh/config
# Host truxe-prod-01
#   HostName 1.2.3.4
#   User deploy
#   IdentityFile ~/.ssh/id_rsa
```

---

## Release Checklist Template

Use this checklist for every release:

```markdown
## Release v0.5.7 Checklist

### Pre-Release
- [ ] All tests passing locally
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide created (if needed)

### Release Process
- [ ] Pre-release checks passed
- [ ] Git tag created: v0.5.7
- [ ] Pushed to private repo
- [ ] Synced to public repo (if needed)
- [ ] GitHub release created
- [ ] Docker images built
- [ ] Production deployed

### Post-Release
- [ ] Production health check passing
- [ ] GitHub Actions completed
- [ ] Docker images published
- [ ] Monitoring dashboard checked
- [ ] No new error spikes
- [ ] Team notified

### Communication
- [ ] Release notes published
- [ ] Changelog shared
- [ ] Customers notified (if major)
- [ ] Documentation site updated
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Pre-release check | `./scripts/pre-release-check.sh` |
| Create release | `./scripts/create-release.sh v0.5.7` |
| Manual tag | `git tag -a v0.5.7 -m "Release v0.5.7"` |
| Push tag | `git push origin v0.5.7` |
| Sync to public | `./scripts/sync-to-public.sh` |
| Create GitHub release | `gh release create v0.5.7` |
| Check builds | `gh run list` |
| Deploy production | `ssh truxe-prod-01 'cd /opt/truxe/deployment && docker-compose pull && docker-compose up -d'` |
| Rollback | `docker-compose down && docker tag v0.5.6 latest && docker-compose up -d` |

---

## Related Documentation

- [Repository Governance](internal/REPOSITORY_GOVERNANCE.md) - Overall repo strategy
- [Docker Registry Strategy](deployment/docker-registry-strategy.md) - Docker image management
- [Dual Repo Sync Workflow](internal/DUAL_REPO_SYNC_WORKFLOW.md) - Private/public sync
- [Contributing Guide](../CONTRIBUTING.md) - Contribution workflow

---

**Remember:** The automated workflow (`./scripts/create-release.sh`) handles 95% of the work. Use it for every release to ensure consistency and avoid mistakes.

© 2025 Wundam LLC. Internal use only.
