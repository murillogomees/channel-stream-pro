# QA Master Checklist - IPTV Player

## Pre-Release Testing Protocol

### Version: 1.0.0
### Date: 2024
### Status: [ ] Pass / [ ] Fail

---

## 1. PLAYBACK STABILITY

### 1.1 Startup Performance
| Test | Target | Actual | Pass |
|------|--------|--------|------|
| Cold start to first frame | < 3.0s | _____ | [ ] |
| Warm start (cached) | < 1.5s | _____ | [ ] |
| Manifest load time | < 1.0s | _____ | [ ] |
| First segment load | < 2.0s | _____ | [ ] |

### 1.2 Playback Quality
| Test | Target | Actual | Pass |
|------|--------|--------|------|
| Rebuffer events per hour | < 2 | _____ | [ ] |
| Average rebuffer duration | < 3s | _____ | [ ] |
| Frame drop rate | < 1% | _____ | [ ] |
| Audio sync | < 50ms | _____ | [ ] |

### 1.3 Channel Switching
| Test | Target | Actual | Pass |
|------|--------|--------|------|
| Switch to adjacent channel | < 1.5s | _____ | [ ] |
| Switch across categories | < 2.0s | _____ | [ ] |
| Rapid switching (5 in 10s) | No crash | _____ | [ ] |

### 1.4 Error Recovery
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Network disconnect/reconnect | Auto-retry 3x | _____ | [ ] |
| Invalid stream URL | Error message shown | _____ | [ ] |
| 403 from server | Graceful error | _____ | [ ] |
| Timeout (20s) | Retry or error | _____ | [ ] |

---

## 2. USER INTERFACE

### 2.1 Focus Management
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Initial focus on load | First item focused | _____ | [ ] |
| Focus visible at all times | Ring/highlight shown | _____ | [ ] |
| Focus trap in modal | Focus stays in modal | _____ | [ ] |
| Tab order logical | Left-right, top-bottom | _____ | [ ] |

### 2.2 Navigation
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Arrow Up | Move focus up | _____ | [ ] |
| Arrow Down | Move focus down | _____ | [ ] |
| Arrow Left | Move focus left | _____ | [ ] |
| Arrow Right | Move focus right | _____ | [ ] |
| Enter/OK | Activate/Select | _____ | [ ] |
| Back/Escape | Go back/Close | _____ | [ ] |
| Space | Play/Pause | _____ | [ ] |

### 2.3 Player Controls
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Play button | Starts playback | _____ | [ ] |
| Pause button | Pauses playback | _____ | [ ] |
| Mute toggle | Mutes/unmutes | _____ | [ ] |
| Fullscreen toggle | Enters/exits FS | _____ | [ ] |
| Overlay auto-hide | Hides after 3.5s | _____ | [ ] |
| Overlay on movement | Shows on any input | _____ | [ ] |

### 2.4 Responsive Layout
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Desktop (1920x1080) | Grid 5-6 columns | _____ | [ ] |
| Tablet (1024x768) | Grid 3-4 columns | _____ | [ ] |
| Mobile (375x667) | Grid 2 columns | _____ | [ ] |
| TV (3840x2160) | 10-foot UI, large text | _____ | [ ] |

---

## 3. PROXY VALIDATION

### 3.1 Request Handling
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| GET request | Returns stream | _____ | [ ] |
| HEAD request | Returns headers | _____ | [ ] |
| OPTIONS (CORS) | Returns 200 | _____ | [ ] |
| Missing URL param | 400 error | _____ | [ ] |

### 3.2 HLS Processing
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Master playlist rewrite | URLs proxied | _____ | [ ] |
| Media playlist rewrite | URLs proxied | _____ | [ ] |
| Key URI rewrite | URI in tag proxied | _____ | [ ] |
| Relative URLs | Resolved correctly | _____ | [ ] |

### 3.3 Headers
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| CORS headers present | All CORS headers | _____ | [ ] |
| Content-Type correct | mpegurl or mp2t | _____ | [ ] |
| Range support | Accept-Ranges: bytes | _____ | [ ] |
| Cache control | Appropriate caching | _____ | [ ] |

### 3.4 Error Handling
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Upstream 403 | Proxy returns 403 | _____ | [ ] |
| Upstream 404 | Proxy returns 502 | _____ | [ ] |
| Upstream timeout | Retry then 504 | _____ | [ ] |
| TLS error | Fallback to HTTP | _____ | [ ] |

---

## 4. PLATFORM COMPATIBILITY

### 4.1 Desktop Browsers
| Browser | Version | HLS | Controls | Pass |
|---------|---------|-----|----------|------|
| Chrome | Latest | [ ] | [ ] | [ ] |
| Firefox | Latest | [ ] | [ ] | [ ] |
| Safari | Latest | [ ] | [ ] | [ ] |
| Edge | Latest | [ ] | [ ] | [ ] |

### 4.2 Smart TVs
| Platform | Version | HLS | Remote | Pass |
|----------|---------|-----|--------|------|
| Samsung Tizen | 5.0+ | [ ] | [ ] | [ ] |
| LG webOS | 4.0+ | [ ] | [ ] | [ ] |
| Android TV | 9+ | [ ] | [ ] | [ ] |
| Fire TV | Latest | [ ] | [ ] | [ ] |

### 4.3 Mobile
| Platform | Browser | HLS | Touch | Pass |
|----------|---------|-----|-------|------|
| iOS | Safari | [ ] | [ ] | [ ] |
| iOS | Chrome | [ ] | [ ] | [ ] |
| Android | Chrome | [ ] | [ ] | [ ] |
| Android | Firefox | [ ] | [ ] | [ ] |

### 4.4 WebView
| Platform | Framework | HLS | Pass |
|----------|-----------|-----|------|
| Android | WebView | [ ] | [ ] |
| iOS | WKWebView | [ ] | [ ] |
| Capacitor | Both | [ ] | [ ] |

---

## 5. PERFORMANCE BENCHMARKS

### 5.1 Memory Usage
| Scenario | Target | Actual | Pass |
|----------|--------|--------|------|
| Idle (no playback) | < 100MB | _____ | [ ] |
| Playing 1080p | < 200MB | _____ | [ ] |
| 1 hour continuous | < 250MB | _____ | [ ] |
| After channel switch | Memory released | _____ | [ ] |

### 5.2 CPU Usage
| Scenario | Target | Actual | Pass |
|----------|--------|--------|------|
| Idle | < 5% | _____ | [ ] |
| Playing (HW decode) | < 15% | _____ | [ ] |
| Playing (SW decode) | < 50% | _____ | [ ] |
| UI navigation | < 20% | _____ | [ ] |

### 5.3 Network
| Test | Target | Actual | Pass |
|------|--------|--------|------|
| M3U load (1000 ch) | < 3s | _____ | [ ] |
| Manifest fetch | < 500ms | _____ | [ ] |
| Segment fetch | < 1s | _____ | [ ] |

---

## 6. SECURITY

### 6.1 Content Security
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| XSS protection | Sanitized inputs | _____ | [ ] |
| CORS properly configured | Strict origin | _____ | [ ] |
| No credential leakage | Tokens not logged | _____ | [ ] |

### 6.2 Data Privacy
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| No PII in logs | Clean logs | _____ | [ ] |
| Telemetry anonymized | No user IDs | _____ | [ ] |

---

## 7. ACCESSIBILITY

### 7.1 Keyboard Navigation
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Full keyboard access | All features reachable | _____ | [ ] |
| Logical tab order | Sequential | _____ | [ ] |
| Skip links | Present | _____ | [ ] |

### 7.2 Visual
| Test | Expected | Result | Pass |
|------|----------|--------|------|
| Focus indicators | Visible | _____ | [ ] |
| Color contrast | WCAG AA | _____ | [ ] |
| Text scaling | 200% readable | _____ | [ ] |

---

## Test Environment

### Hardware Used
- **Desktop**: _____________________
- **TV**: _____________________
- **Mobile**: _____________________

### Network Conditions
- **Bandwidth**: _____________________
- **Latency**: _____________________
- **Connection**: _____________________

### M3U Source
- **Provider**: _____________________
- **Channel Count**: _____________________
- **Stream Type**: _____________________

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | _____ | _____ | _____ |
| Dev Lead | _____ | _____ | _____ |
| Product | _____ | _____ | _____ |

---

## Notes & Issues Found

```
Issue #1:
Description:
Severity:
Reproduction Steps:
Resolution:

Issue #2:
Description:
Severity:
Reproduction Steps:
Resolution:
```
