# ADR-006: Mobile Application Strategy — React Native Expo Managed Workflow

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

HouseholdOS requires native mobile applications for both iOS (App Store) and Android (Play Store). The platform's target users — South African households — primarily interact with financial and domestic services via mobile. A mobile-first experience is not optional; it is a primary product surface.

The platform already uses Next.js 14 (TypeScript, React) for the web application. The mobile app needs to share business logic, type definitions, API client code, and design system components where possible, reducing duplication and keeping web and mobile in sync as features are added.

Key mobile requirements include: camera access for document scanning, push notifications for HITL approvals and proactive alerts, biometric authentication, secure local storage, and App Store/Play Store compliance including Apple's privacy manifest and ATT framework requirements.

---

## Decision

**React Native with Expo managed workflow, built and distributed via EAS Build (Expo Application Services).**

React Native allows the team to share TypeScript types, API client modules, Supabase client configuration, and core business logic with the Next.js web app. The Expo managed workflow provides a curated set of native modules with pre-built binaries, eliminating the need to manage native build toolchains (Xcode project files, Gradle configs) directly.

EAS Build handles CI/CD for both iOS and Android binaries — submitting to App Store Connect and Google Play via EAS Submit. OTA (over-the-air) updates via Expo Updates allow non-native JS changes to be pushed without app store review cycles.

---

## Alternatives Considered

- **Native iOS (Swift) + Native Android (Kotlin):** Maximum performance and platform integration. Requires two separate codebases, two separate teams, and doubles the development and maintenance cost. Ruled out — engineering capacity is insufficient to maintain two native codebases alongside the web platform.
- **Flutter (Dart):** Single codebase, strong performance, good UI consistency. Does not share code with the React/TypeScript web codebase — all business logic would need to be reimplemented in Dart. No ecosystem overlap with the existing stack. Rejected.
- **Capacitor (Ionic):** Wraps a web app in a native shell. Shares maximum code with the web app but produces a WebView-based app, not a truly native experience. Performance on lower-end Android devices (common in SA market) is noticeably worse. App Store reviewers increasingly scrutinise WebView-only apps. Rejected.
- **PWA only (no native app):** Lowest development cost — the Next.js app is already PWA-capable. However, PWAs cannot access the full notification stack required for HITL approval alerts, lack biometric auth integration, and are not listed in the App Store. Rejected as the sole mobile strategy; PWA remains as a complementary offline-capable web experience.

---

## Consequences

**Positive:**
- Single React Native codebase for iOS and Android — one team, one language, shared types
- Significant code sharing with Next.js web app (API clients, TypeScript types, Supabase client)
- EAS Build handles App Store and Play Store submission automation
- Expo managed workflow abstracts native toolchain complexity — faster iteration
- OTA updates allow rapid JS-layer fixes without app store review

**Negative:**
- Expo managed workflow limits access to custom native modules — modules outside Expo's ecosystem require ejecting to bare workflow or using development builds
- React Native performance is below native for animation-heavy or compute-intensive screens
- App size is larger than equivalent native apps due to the React Native runtime
- App Store compliance (ATT framework, privacy manifest) still requires careful configuration even in managed workflow

**Mitigations:**
- Camera, biometric auth, push notifications, and secure storage are all available via Expo's first-party modules — no ejection needed for Phase 1 requirements
- Performance-sensitive screens (document scanner, real-time Q&A) are optimised with `React.memo`, `useCallback`, and FlatList virtualisation
- EAS Build configuration is maintained in version control — reproducible builds with pinned Expo SDK versions
