# Future Features Documentation

This directory contains documentation for **planned but not yet prioritized** features, enhancements, and capabilities.

## Purpose

Documents here represent:
- **Aspirational features** with clear value but no immediate timeline
- **Platform expansion** plans (mobile app stores, new platforms)
- **Advanced capabilities** that depend on production stability first
- **Nice-to-have enhancements** deferred to post-launch phases

## Status: NOT CURRENT PRIORITY

⚠️ **Important**: Documents in this directory are **NOT part of current sprint or roadmap**. They are preserved for:
1. Future planning when resources become available
2. Responding to stakeholder/user requests with prepared plans
3. Maintaining institutional memory of considered enhancements

## Files

### Mobile Platform Distribution

**File**: `STORE_PUBLICATION_GUIDE.md`  
**Description**: Complete guide for publishing mobile apps to Google Play Store and Apple App Store  
**Status**: Future consideration  
**Dependencies**: 
- Production stability achieved
- Web platform proven at scale
- User demand validated
- Resources allocated for mobile-specific optimizations

**Estimated Timeline**: TBD (post-launch, user demand driven)

## Adding Documentation to Future/

When documenting future features:

1. **Template Format**:
   ```markdown
   # Feature Name
   
   **Status**: Future / Not Prioritized
   **Last Updated**: YYYY-MM-DD
   **Dependencies**: List blockers
   **Value Proposition**: Why this matters
   **Estimated Effort**: Small/Medium/Large
   **Target Audience**: Who benefits
   
   ## Overview
   [Feature description]
   
   ## Current Workarounds
   [How users accomplish this today]
   
   ## Proposed Implementation
   [Technical approach when prioritized]
   
   ## Success Metrics
   [How we'll measure success]
   ```

2. **Required Metadata**:
   - Clear dependencies (what must be done first)
   - Effort estimation
   - User value justification

3. **Review Cadence**: 
   - Quarterly review to assess if feature should move to active roadmap
   - Annual cleanup to remove no-longer-relevant future features

## Moving Features from Future to Active

When a future feature is prioritized:

1. Update status in document header
2. Move file from `docs/future/` to appropriate active directory
3. Create implementation milestone/epic
4. Add to current sprint planning
5. Update `docs/future/README.md` with moved feature notice

## Questions?

If you're evaluating whether to implement a future feature:
1. Check production stability metrics
2. Validate user demand (support requests, feedback)
3. Assess resource availability
4. Review dependencies (are blockers resolved?)
5. Propose to product owner with business case

**Do NOT** implement future features without explicit prioritization approval.
