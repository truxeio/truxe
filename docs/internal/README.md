# Internal Documentation

**🔒 This directory is PRIVATE and will NOT sync to public repository.**

This directory contains internal documentation for the Truxe development team, including:

- Repository management workflows
- Development strategies
- Internal processes and procedures
- Business planning documents
- Sensitive technical documentation

## Current Documents

### Repository Management
- [DUAL_REPO_SYNC_WORKFLOW.md](DUAL_REPO_SYNC_WORKFLOW.md) - Private/Public repository sync procedures

## Adding New Internal Documents

All files in this directory are automatically ignored by git when syncing to public repository.

To add a new internal document:

1. Create your markdown file in this directory
2. Use SCREAMING_SNAKE_CASE naming (e.g., `INTERNAL_STRATEGY.md`)
3. Add entry to this README
4. Commit normally - automatic gitignore handling

## Security Notes

- ✅ **Entire directory ignored:** `docs/internal/` in `.gitignore`
- ✅ **Automatic protection:** No manual file-by-file management needed
- ✅ **Safe commits:** All files here stay private automatically

## Related Documentation

For public documentation:
- [Main README](../../README.md)
- [Documentation Index](../README.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
