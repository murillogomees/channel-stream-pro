# IPTVLINK - Governance & Process Policies

## Version 1.0.0 | Corporate Standards

---

## 1. VERSION CONTROL POLICY

### 1.1 Semantic Versioning
```
MAJOR.MINOR.PATCH
  │     │     └── Bug fixes, no API changes
  │     └──────── New features, backward compatible
  └────────────── Breaking changes
```

### 1.2 Version Examples
| Version | Description |
|---------|-------------|
| 1.0.0 | Initial production release |
| 1.1.0 | New feature (EPG support) |
| 1.1.1 | Bug fix in EPG |
| 2.0.0 | Breaking API change |

### 1.3 Release Cadence
| Release Type | Frequency | Approval |
|--------------|-----------|----------|
| Hotfix | As needed | QA Lead |
| Patch | Weekly | Tech Lead |
| Minor | Bi-weekly | Product + Tech |
| Major | Quarterly | Executive Team |

---

## 2. CODE STANDARDS

### 2.1 TypeScript Standards
```typescript
// ✓ CORRECT
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

function handlePlay(state: PlayerState): void {
  // Implementation
}

// ✗ INCORRECT
function handlePlay(state: any) {
  // No types, implicit any
}
```

### 2.2 Component Standards
```tsx
// ✓ CORRECT - Functional component with proper types
interface VideoPlayerProps {
  url: string;
  title?: string;
  onError?: (error: string) => void;
}

export function VideoPlayer({ url, title, onError }: VideoPlayerProps) {
  // Hook declarations first
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Effects second
  useEffect(() => {
    // Setup
  }, [url]);
  
  // Handlers third
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);
  
  // Render last
  return (
    <div className="video-player">
      {/* JSX */}
    </div>
  );
}
```

### 2.3 Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `VideoPlayer` |
| Functions | camelCase | `handlePlay` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| Types | PascalCase | `PlayerState` |
| Files | kebab-case or PascalCase | `video-player.tsx` or `VideoPlayer.tsx` |
| Hooks | camelCase with use prefix | `useRemoteInput` |

---

## 3. DEFINITION OF DONE (DoD)

A feature is **DONE** when:

### Code Quality
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] All `TODO` comments resolved
- [ ] No `console.log` in production code
- [ ] Code reviewed and approved

### Testing
- [ ] Unit tests written (if applicable)
- [ ] Manual testing on Chrome
- [ ] Manual testing on Safari
- [ ] TV navigation tested (if UI)
- [ ] Edge cases documented

### Documentation
- [ ] JSDoc comments on public APIs
- [ ] README updated (if needed)
- [ ] Changelog updated

### Deployment
- [ ] Works in preview environment
- [ ] No console errors
- [ ] Performance acceptable (< 3s load)

---

## 4. DEFINITION OF COMPLETE (DoC)

A feature is **COMPLETE** when:

- [ ] All DoD criteria met
- [ ] Product owner accepted
- [ ] Deployed to production
- [ ] Monitoring in place
- [ ] Support documentation ready
- [ ] Rollback plan documented

---

## 5. CI/CD PIPELINE

### 5.1 Pipeline Stages
```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Commit  │──►│   Build  │──►│   Test   │──►│  Deploy  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
  Lint OK      TS Compile     Unit Tests    Preview/Prod
                               Pass
```

### 5.2 Build Requirements
| Check | Required | Blocking |
|-------|----------|----------|
| TypeScript | ✓ | Yes |
| ESLint | ✓ | Yes |
| Build Success | ✓ | Yes |
| Bundle Size | < 5MB | No |

### 5.3 Deployment Environments
| Environment | URL | Purpose |
|-------------|-----|---------|
| Preview | `*.lovable.app` | Testing |
| Production | Custom domain | Live users |

---

## 6. QA PIPELINE

### 6.1 Test Levels
```
┌─────────────────────────────────────────────────────┐
│                    E2E Tests                        │
│  ┌───────────────────────────────────────────────┐ │
│  │              Integration Tests                │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │           Unit Tests                    │ │ │
│  │  │  ┌───────────────────────────────────┐ │ │ │
│  │  │  │        Static Analysis            │ │ │ │
│  │  │  └───────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.2 Test Coverage Targets
| Area | Target | Current |
|------|--------|---------|
| Core Player | 80% | TBD |
| Services | 70% | TBD |
| Hooks | 70% | TBD |
| Components | 50% | TBD |

---

## 7. ROLLBACK POLICY

### 7.1 Rollback Triggers
| Trigger | Action | Owner |
|---------|--------|-------|
| Critical bug | Immediate rollback | On-call |
| Performance degradation > 50% | Investigate, rollback if needed | Tech Lead |
| Security vulnerability | Immediate rollback | Security |
| Data corruption | Immediate rollback | DBA |

### 7.2 Rollback Procedure
```
1. Identify issue
2. Notify stakeholders
3. Revert to last known good version
4. Verify rollback successful
5. Post-mortem within 24 hours
```

---

## 8. LOGGING & AUDIT POLICY

### 8.1 Log Levels
| Level | Use Case | Retention |
|-------|----------|-----------|
| DEBUG | Development only | None |
| INFO | Normal operations | 7 days |
| WARN | Potential issues | 30 days |
| ERROR | Failures | 90 days |
| FATAL | System crashes | 1 year |

### 8.2 Audit Events
| Event | Logged | Retention |
|-------|--------|-----------|
| User login | ✓ | 90 days |
| Role change | ✓ | 1 year |
| Data deletion | ✓ | 1 year |
| Settings change | ✓ | 90 days |
| API key usage | ✓ | 30 days |

### 8.3 Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "module": "PlayerEngine",
  "message": "Channel switched",
  "data": {
    "fromChannel": "ch-001",
    "toChannel": "ch-002",
    "switchTimeMs": 1234
  },
  "context": {
    "sessionId": "sess-abc123",
    "deviceId": "dev-xyz789"
  }
}
```

---

## 9. INCIDENT POLICY

### 9.1 Severity Levels
| Level | Definition | Response Time |
|-------|------------|---------------|
| P0 | Complete outage | < 15 min |
| P1 | Major feature broken | < 1 hour |
| P2 | Minor feature broken | < 4 hours |
| P3 | Cosmetic/minor issue | < 24 hours |

### 9.2 Incident Process
```
Detection → Classification → Response → Resolution → Post-mortem
    │            │              │            │            │
    ▼            ▼              ▼            ▼            ▼
 Monitoring   Severity      Fix/Rollback   Verify     Document
```

---

## 10. PERFORMANCE POLICY

### 10.1 Performance Budgets
| Metric | Budget | Action if Exceeded |
|--------|--------|-------------------|
| First Contentful Paint | < 1.5s | Block release |
| Time to Interactive | < 3.5s | Block release |
| Bundle Size | < 5MB | Warning |
| Memory Usage | < 200MB | Warning |

### 10.2 Performance Monitoring
- Core Web Vitals tracking
- Real User Monitoring (RUM)
- Synthetic monitoring
- Performance regression alerts

---

## 11. SECURITY POLICY

### 11.1 Security Requirements
| Requirement | Implementation |
|-------------|----------------|
| Authentication | Supabase Auth + JWT |
| Authorization | RLS policies |
| Data encryption | HTTPS everywhere |
| Input validation | Zod schemas |
| Rate limiting | Edge function limits |

### 11.2 Security Review
- Code review for security issues
- Dependency vulnerability scanning
- Regular penetration testing
- Security incident response plan

---

## 12. APPROVAL MATRIX

| Action | Developer | Tech Lead | Product | Executive |
|--------|-----------|-----------|---------|-----------|
| Bug fix | ✓ | Notify | - | - |
| New feature | Propose | ✓ | ✓ | - |
| Breaking change | Propose | ✓ | ✓ | ✓ |
| Security fix | Implement | ✓ | Notify | Notify |
| Rollback | Execute | ✓ | Notify | Notify |

---

*Document Version: 1.0.0*
*Effective Date: 2024*
*Review Frequency: Quarterly*
