# Documentation Archive

This directory contains **historical documentation** that is no longer actively maintained but preserved for reference and institutional knowledge.

## Archive Structure

### `/strategic/` - Strategic Planning Documents
Documents related to long-term planning, product vision, and business strategy that are no longer current roadmap items.

**Files:**
- `PRODUCT_MASTER.md` - Original product vision and roadmap (superseded by current implementation)
- `SLA_DEFINITIONS.md` - Service level agreement definitions (pre-production planning)

**Archived**: Dec 2024  
**Reason**: Production system evolved beyond initial strategic planning. Current SLAs and product features documented in operational runbooks.

### `/alternatives/` - Alternative Approaches Not Implemented
Documentation of technical approaches, architectures, or features that were considered but ultimately not adopted.

**Files:**
- `M3U_SYNC_RUNBOOK.md` - Scheduled M3U synchronization system (never implemented)

**Archived**: Dec 2024  
**Reason**: System adopted on-demand M3U import pattern instead of scheduled sync. Real implementation documented in M3U_ACCESS_PATTERN.md.

### `/auth/` - Consolidated Authentication Documentation
Historical authentication architecture documents merged into single source of truth.

**Files:**
- `AUTH_CHANGES_SUMMARY.md` - Authentication changes history
- `AUTH_TESTING_GUIDE.md` - Authentication testing procedures

**Archived**: Dec 2024  
**Reason**: Consolidated into `AUTH_ARCHITECTURE.md` with comprehensive testing and historical sections.

### `/migrations/` - Completed Database Migrations
Documentation for database migrations that have been executed and verified in production.

**Files:**
- `MIGRATION_GUIDE_PHONE_CONSOLIDATION.md` - Phone field consolidation (executed Dec 2024)

**Archive Date**: Jan 2025 (30 days post-execution)  
**Reason**: Migration completed successfully (92% data migration). Keeping for reference during monitoring period.

## Archive Policy

Documents are moved to archive when they meet ANY of these criteria:

1. **Superseded** - Replaced by newer, more accurate documentation
2. **Not Implemented** - Describe features/approaches not adopted in production
3. **Historical** - Valuable for context but no longer operational guidance
4. **Consolidated** - Merged into comprehensive single-source-of-truth documents

## Retention Policy

- **Strategic docs**: Retain indefinitely (institutional knowledge)
- **Technical alternatives**: Retain 2 years (reference for future decisions)
- **Consolidated docs**: Retain 1 year (merge validation period)
- **Migration guides**: Retain 6 months post-execution (verification period)

## Accessing Archived Documentation

Archive documents are **read-only** for reference. If you need to revive or update archived content:

1. Review current active documentation first
2. Determine if archived approach is still relevant
3. Create NEW document in active docs/ with updated information
4. Reference archived doc in "Historical Context" section
5. Do NOT edit archived files directly

## Questions?

If you're unsure whether a document should be archived or if you need to reference archived content, check:
- `docs/AUTH_ARCHITECTURE.md` - Current authentication system
- `docs/M3U_ACCESS_PATTERN.md` - Current M3U implementation
- `docs/EXECUTIVE_ARCHITECTURE.md` - Current system architecture

For strategic questions, review current roadmap in project management tools.
