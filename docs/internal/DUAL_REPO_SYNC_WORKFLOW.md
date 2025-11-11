# Private/Public Repository Sync Workflow

This document describes the workflow for managing code between the private development repository (Wundam/truxe) and the public repository (truxeio/truxe).

## Repository Structure

```
Private (Development):  https://github.com/Wundam/truxe.git  (origin)
Public (Production):    https://github.com/truxeio/truxe.git (public)
```

## Daily Development Workflow

### 1. Normal Development (Private Only)

When working on features, bug fixes, or experiments:

```bash
# Make changes
git add .
git commit -m "feat: your feature description"

# Push to private repo
git push origin main
```

**This is your default workflow.** Private repo is for all development work.

### 2. Syncing to Public Repository

When you're ready to release changes publicly (e.g., for a version release):

```bash
# Automated sync (recommended)
./scripts/sync-to-public.sh
```

The script will:
- ✅ Check for uncommitted changes
- ✅ Show commits to be synced
- ✅ Run security checks (sensitive files, hardcoded secrets)
- ✅ Create dated sync branch
- ✅ Push to public repository
- ✅ Verify sync completed
- ✅ Clean up temporary branch

### 3. Manual Sync (If Script Fails)

If the automated script doesn't work:

```bash
# 1. Fetch latest from both remotes
git fetch origin
git fetch public

# 2. Check what's different
git log public/main..main --oneline

# 3. Security check
git diff public/main..HEAD | grep -i "password\|secret\|key"

# 4. Create sync branch
git checkout -b public-sync-$(date +%Y%m%d)

# 5. Push to public
git push public public-sync-$(date +%Y%m%d):main

# 6. Cleanup
git checkout main
git branch -D public-sync-$(date +%Y%m%d)
```

## Best Practices

### ✅ DO

1. **Always push to private (origin) first**
   ```bash
   git push origin main
   ```

2. **Sync to public only for releases**
   - Version releases (v0.5.0, v1.0.0)
   - Major feature completions
   - Production-ready milestones

3. **Run security checks before public sync**
   - No `.env` files with real credentials
   - No API keys or tokens
   - No private/sensitive configuration

4. **Use descriptive commit messages**
   - Follow conventional commits (feat:, fix:, docs:)
   - Public repo is visible to everyone

5. **Test builds before syncing**
   ```bash
   pnpm build  # Ensure no errors
   pnpm test   # Ensure tests pass
   ```

### ❌ DON'T

1. **Never push directly to public/main**
   ```bash
   # ❌ DON'T DO THIS
   git push public main
   ```

2. **Don't sync work-in-progress**
   - Sync only completed, tested features
   - Public repo should always be production-ready

3. **Don't commit secrets**
   - Check `.gitignore` includes:
     - `.env` (not `.env.example`)
     - `*.pem`, `*.key`
     - Any private configuration

4. **Don't force push to public**
   ```bash
   # ❌ NEVER DO THIS
   git push --force public main
   ```

## Security Checklist

Before every public sync, verify:

- [ ] No `.env` files with real credentials
- [ ] No hardcoded API keys or tokens
- [ ] No private keys or certificates
- [ ] No internal documentation with sensitive info
- [ ] No database credentials
- [ ] No third-party API keys
- [ ] `.gitignore` is comprehensive

## Troubleshooting

### Issue: "Working directory has uncommitted changes"

```bash
# Check what's uncommitted
git status

# Either commit or stash
git add .
git commit -m "fix: your changes"

# Or stash temporarily
git stash
```

### Issue: "Failed to push to public repository"

```bash
# Check if public is ahead of local
git fetch public
git log HEAD..public/main

# If public has commits you don't have
git pull public main --rebase
git push origin main
```

### Issue: "Sensitive files detected"

```bash
# Review the files
git diff public/main..HEAD --name-only

# If truly sensitive, remove from history
git filter-branch --tree-filter 'rm -f path/to/sensitive/file' HEAD

# Or just don't sync yet, remove the file
git rm --cached path/to/sensitive/file
git commit -m "chore: remove sensitive file"
```

## Git Remote Configuration

Verify your remotes are configured correctly:

```bash
git remote -v
```

Should show:

```
origin  https://github.com/Wundam/truxe.git (fetch)
origin  https://github.com/Wundam/truxe.git (push)
public  https://github.com/truxeio/truxe.git (fetch)
public  https://github.com/truxeio/truxe.git (push)
```

If not configured:

```bash
# Add public remote
git remote add public https://github.com/truxeio/truxe.git

# Verify
git remote -v
```

## Example Complete Workflow

```bash
# 1. Feature development (private)
git checkout -b feature/api-playground-phase5
# ... make changes ...
git add .
git commit -m "feat(playground): implement phase 5 features"
git push origin feature/api-playground-phase5

# 2. Merge to main (private)
git checkout main
git merge feature/api-playground-phase5
git push origin main

# 3. Test everything
pnpm build
pnpm test
pnpm type-check

# 4. Sync to public (when ready for release)
./scripts/sync-to-public.sh

# 5. Create release tag
git tag -a v0.5.0 -m "Release v0.5.0 - API Playground Complete"
git push origin v0.5.0
git push public v0.5.0
```

## Quick Reference

| Action | Command |
|--------|---------|
| Daily commit | `git push origin main` |
| Public sync | `./scripts/sync-to-public.sh` |
| Check diff | `git log public/main..main --oneline` |
| Security check | `git diff public/main..HEAD \| grep -i secret` |
| Verify remotes | `git remote -v` |

---

**Remember:** Private repo (origin) is for development, public repo (public) is for releases. Always sync through the script to ensure safety checks are performed.
