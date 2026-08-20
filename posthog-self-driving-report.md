# PostHog Self-driving Setup Report

**Date:** 2026-08-19  
**Project:** Cadence Club (PostHog project 252830)  
**Inbox:** https://eu.posthog.com/project/252830/inbox

## Summary

PostHog Self-driving was configured for Cadence Club, a React Native fitness app. Session Replay, Error Tracking, and Support signal sources were enabled; the GitHub App was connected to give Self-driving code access; and a 5-scout troop tuned to this product's surfaces was armed. Findings will start appearing in the [Self-driving inbox](https://eu.posthog.com/project/252830/inbox) within approximately 30 minutes.

---

## AI Data Processing

**Status:** Approved at the organization level (enforced by the wizard before this run started).

---

## GitHub

**Status:** Connected during this run.  
**Account:** `akcelgraca`  
**Integration ID:** 78938  
**Connected at:** 2026-08-19T18:18:19Z

Self-driving uses this connection to research findings in the codebase and open fix PRs. Grant it additional repos in [GitHub App settings](https://github.com/apps) if needed.

---

## Products Enabled

The `products-enable` MCP tool was not available on this PostHog deploy. Products were not enabled automatically. Manual action required (see Follow-ups).

| Product | Status |
|---|---|
| Session Replay | Enabled but inert — server toggle not reachable via MCP; also needs React Native SDK config |
| Error Tracking | Enabled but inert — server toggle not reachable via MCP; also needs React Native SDK config |
| Support (Conversations) | Enabled but inert — server toggle not reachable via MCP; also needs an inbound channel connected |

**Note:** Cadence Club is a pure mobile app (Expo/React Native). Even with the server toggles on, Session Replay and Error Tracking require SDK-level configuration in `posthog-react-native` before they capture data. The products-enable call is a follow-up.

---

## Signal Sources

All rows were created during this run (no pre-existing source configs).

| source_product | source_type | Action |
|---|---|---|
| `health_checks` | `health_issue` | Enabled (id: 01a01b40-1f55-7b6f-b9aa-b767cf26a478) |
| `error_tracking` | `issue_created` | Enabled (id: 01a01b40-2451-731c-aae1-3d9a472b6bc2) |
| `error_tracking` | `issue_reopened` | Enabled (id: 01a01b40-29c0-7076-9095-163c881b9b9a) |
| `error_tracking` | `issue_spiking` | Enabled (id: 01a01b40-2c92-78cb-882f-f3e5232d3809) |
| `session_replay` | `session_analysis_cluster` | Enabled, sample rate 0.1 (id: 01a01b40-31ee-79d6-b1d6-6e6999243bad) |
| `conversations` | `ticket` | Enabled (id: 01a01b40-341d-70af-b009-37b9af05e5fc) |
| `signals_scout` | `cross_source_issue` | On by default — no row needed |
| `replay_vision` | *(all)* | Self-authorizing via scanner `emits_signals` flag — no row created |
| `llm_analytics` | *(all)* | Skipped — no LLM SDK in this project |
| `logs` | *(all)* | Skipped — PostHog logs product not in use |

---

## Connected Tools

**User selection:** None of these — no external issue tracker, support desk, or error tracker connected.

| Tool | Status |
|---|---|
| GitHub Issues | Not used |
| Linear | Not used |
| Jira | Not used |
| Sentry | Not used |
| Zendesk | Not used |

---

## Scout Troop

**Run budget:** 100 runs/day (early access default), 3 runs/tick max. 0 runs used today.  
**Banner:** "Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."

### Enabled (5 scouts)

| Scout | Why enabled |
|---|---|
| `signals-scout-general` | Always on — cross-product correlations and surfaces no specialist covers |
| `signals-scout-product-analytics` | 17 product events instrumented (`app_opened`, `activity_recorded`, `signed_up`, `onboarding_completed`, etc.) — funnels and retention are the primary product question |
| `signals-scout-revenue-analytics` | RevenueCat integration in `src/services/purchases/`; `paywall_viewed` and `premium_purchased` events tracked — monetization decisions depend on this data |
| `signals-scout-health-checks` | Fresh setup with API key not yet activated — instrumentation health findings are immediately actionable |
| `signals-scout-observability-gaps` | 17 events but no dashboards or insights exist yet — gap recommendations are immediately actionable |

### Disabled (22 scouts, intentional)

| Scout | Reason |
|---|---|
| `signals-scout-error-tracking` | Covered by the native error_tracking signal source (3 rows enabled above) |
| `signals-scout-session-replay` | Covered by the native session_replay signal source (enabled above) |
| `signals-scout-web-analytics` | Mobile app — no web traffic or pageviews |
| `signals-scout-web-vitals` | Mobile app — no Core Web Vitals |
| `signals-scout-csp-violations` | Mobile app — no Content Security Policy |
| `signals-scout-surveys` | No PostHog surveys in use (0 surveys confirmed) |
| `signals-scout-feature-flags` | PostHog feature flags not in use (app uses Supabase `app_flags` table, not PostHog flags) |
| `signals-scout-experiments` | No A/B experiments running |
| `signals-scout-ai-observability` | No LLM SDK or `$ai_*` events in this project |
| `signals-scout-logs` | PostHog logs product not in use |
| `signals-scout-apm` | No OpenTelemetry/APM instrumentation |
| `signals-scout-customer-analytics` | B2C fitness app — no group/accounts analytics |
| `signals-scout-data-pipelines` | No CDP destinations, batch exports, or hog flows |
| `signals-scout-data-warehouse` | No warehouse sources connected |
| `signals-scout-anomaly-detection` | No dashboards or insights exist yet — nothing to detect anomalies in |
| `signals-scout-inbox-validation` | Fresh setup — no resolved reports to validate yet |
| `signals-scout-conversations` | Support product not yet producing ticket events |
| `signals-scout-replay-vision` | No Replay Vision scanners with accumulated observations yet |
| `signals-scout-insight-alerts` | No insight alerts configured yet |
| `signals-scout-mcp-tool-calls` | Not applicable |
| `signals-scout-skills-store` | Not applicable |
| `signals-scout-tasks` | Not applicable |

**Re-enable suggestions:** Turn on `signals-scout-feature-flags` if you migrate to PostHog feature flags; `signals-scout-surveys` if you add PostHog surveys; `signals-scout-experiments` when running A/B tests; `signals-scout-anomaly-detection` once dashboards exist.

---

## Custom Scouts

Proposed but declined by user:

| Proposed Scout | Surface | Why proposed | User decision |
|---|---|---|---|
| Signup-to-first-activity funnel | `signed_up` → `activity_recorded` conversion | `product-analytics` watches saved funnels — none exist yet, so this chain was genuinely uncovered | Declined |
| Paywall conversion | `paywall_viewed` → `premium_purchased` rate | `revenue-analytics` watches sync health, not conversion rate; conversion drives pricing decisions | Declined |

**Noise escape hatch:** If any enabled scout turns noisy, set `emit: false` on its config in PostHog to switch it to dry-run mode (runs and logs, but writes nothing to the inbox).

---

## Replay Vision Scanners

Both skeleton scanners were **skipped** — this is a pure mobile app (Expo/React Native) with no web surface.

| Scanner | Status | Reason |
|---|---|---|
| Broken experiences | Skipped | Uses `$current_url` filter — mobile recordings have no URL paths |
| User frustration | Skipped | Gated on `$rageclick` — a web mouse gesture event not present in mobile touch sessions |

**What Replay Vision scanners are:** LLMs that watch individual session recordings on a schedule and push what they find directly to the Self-driving inbox. They are the only thing in this setup that spends Replay Vision quota. Findings arrive at half weight and need corroboration before being promoted to a full inbox report.

**Follow-up:** Once PostHog expands Replay Vision to support native mobile session recordings, revisit this step and create scanners scoped to key flows (activity recording, onboarding).

---

## Follow-ups

- [ ] **Enable products manually** — go to PostHog → Settings and turn on: **Session Replay** ("Record user sessions"), **Error Tracking** ("Enable exception autocapture"), and **Support** (Conversations) from the product sidebar. The `products-enable` MCP tool was unavailable on this deploy.
- [ ] **Configure PostHog API key** — set `EXPO_PUBLIC_POSTHOG_KEY=phc_mTdwdwzbXZvoy5GemBRyPkRzktUA33TdEKqRa7c5tfnK` in `.env` and in `eas.json` profiles. Run `npm run analytics:check` to verify. Nothing is captured until this key is in place.
- [ ] **Enable Session Replay in React Native SDK** — after turning on the product, configure `posthog-react-native` to record mobile sessions. See [PostHog React Native docs](https://posthog.com/docs/session-replay/mobile) for setup.
- [ ] **Enable Error Tracking in React Native SDK** — configure exception autocapture in `posthog-react-native` init. See [PostHog error tracking docs](https://posthog.com/docs/error-tracking).
- [ ] **Connect a Support inbound channel** — Conversations is armed but produces no tickets until an inbound channel (email, inbox, or Slack) is connected in PostHog Settings → Support.
- [ ] **Revisit Replay Vision scanners** — once PostHog supports native mobile session recording in Replay Vision, create "Broken experiences" and "User frustration" scanners scoped to the activity recording and onboarding flows.
- [ ] **Build dashboards and funnels** — once the API key is live and events arrive, create funnels (`signed_up → onboarding_completed → activity_recorded`) and retention insights. The `observability-gaps` scout will flag missing coverage, and `product-analytics` scout will start finding regressions once funnels exist.
- [ ] **Revisit custom scouts** — the proposed activation funnel and paywall conversion scouts are available to create later if you want proactive monitoring before building dashboards.

---

## What Happens Next

1. The scout coordinator picks up the fresh configs **within ~30 minutes** and fires the first runs.
2. Scout runs draw from the 100-run daily budget (3 per coordinator tick). The 5-scout troop uses ~5 runs/day.
3. Findings cluster into reports in the [Self-driving inbox](https://eu.posthog.com/project/252830/inbox).
4. Immediately-actionable reports can kick off coding tasks automatically.
5. The `health-checks` scout will surface any instrumentation issues as soon as the API key is active and events start flowing.
