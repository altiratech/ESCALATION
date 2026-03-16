# Altira Flashpoint — Suite Alignment Note

**Date:** 2026-03-16  
**Scope:** Identity, access, roles, billing, and entitlement compatibility  
**Related:** `/Users/ryanjameson/Desktop/Lifehub/SYSTEM/DECISIONS.md` D-179; `/Users/ryanjameson/Desktop/Lifehub/Business Ideas/Altira-Platform/Altira-Identity-and-Billing-Model.md`

## Purpose

This note keeps Flashpoint aligned with the shared Altira suite identity and billing direction without forcing an early rewrite.

Flashpoint is still primarily a single-player scenario product with temporary run bootstrapping. The goal here is to keep the repo compatible with the future Altira workspace layer, not to build that whole layer locally inside Wargames.

## Current Flashpoint State

### What exists today

- codename-based temporary run profiles via `POST /api/profiles`
- episode ownership tied to `profile_id`
- local episode persistence, score history, and report lookup tied to that temporary profile
- no customer account system
- no workspace membership model
- no suite role model
- no product billing system
- no product subscription system
- no module entitlement model

### Important clarification

Flashpoint uses the word `role` heavily in scenario content, but that means the in-scenario perspective:
- `National Security Advisor`
- later `Global Macro Trader`
- later other scenario lenses

That is not the same thing as suite access control.

## Evaluation Against D-179

### Already aligned

- Flashpoint does not currently own billing logic.
- Flashpoint does not currently assume enterprise SSO as the default access path.
- Flashpoint can still evolve into a workspace-based module without rewriting the simulation engine.
- The current run-profile bootstrap is small enough that it can later be replaced or resolved into shared suite identity.

### Not yet aligned

- current `profiles` / `profileId` naming can be misread as durable customer identity even though it is only a playtest run bootstrap
- there is no shared workspace or entitlement consumption yet
- repo docs did not previously make the D-179 compatibility rule explicit for Flashpoint

## What Should Change Now

These are the changes Flashpoint should make immediately.

### 1. Treat the current profile model as temporary

The current `profiles` table and `episodes.profile_id` link are acceptable for now, but they should be treated as temporary run ownership only.

They should not become:
- Flashpoint’s permanent customer identity model
- a product-local user system
- the base for product-local billing or subscriptions

### 2. Keep visible suite roles simple

If Flashpoint adds real multi-user access later, visible suite roles should stay:
- `user`
- `manager`
- `admin`

Any Flashpoint-specific powers should sit underneath that as product capabilities, not as new top-level suite roles.

### 3. Avoid product-local billing and entitlement drift

Until the shared Altira layer exists, Flashpoint should avoid adding:
- product-local `users` tables for customer identity
- product-local `organizations` tables
- product-local `subscriptions` tables
- product-local billing logic
- product-local entitlement logic
- a separate Flashpoint-specific top-level RBAC taxonomy

## What Should Change Later

These are the things Flashpoint should adopt only when the shared suite layer is ready.

### Shared suite identity objects

Flashpoint should eventually consume:
- `user_account`
- `workspace`
- `workspace_membership`
- `session`
- `subscription`
- `module_entitlement`

### Run ownership and attribution

Current temporary run ownership should later resolve to shared workspace membership identity rather than a product-local `profile` abstraction.

### Billing and entitlements

Flashpoint access should later derive from workspace-level plan state and module entitlements, not from Flashpoint-local billing or subscription rules.

### Enterprise SSO

Enterprise SSO should be added only as a later layer on the shared workspace model.

It should not become a separate Flashpoint-specific identity model.

## Practical Build Rules For Flashpoint

Until shared Altira identity exists, Flashpoint should follow these rules:

1. Keep the current run bootstrap lightweight and temporary.
2. Do not add product-local billing.
3. Do not add Flashpoint-specific top-level suite roles.
4. Treat scenario viewpoint roles as content, not access control.
5. If collaboration or saved multi-user workflows appear before shared suite auth is ready, use workspace-compatible bridge objects rather than a new standalone customer-auth architecture.

## Non-Goals For Now

This alignment note does not require Flashpoint to build:
- shared suite auth right now
- workspace management right now
- Stripe right now
- enterprise SSO right now
- a monolith
- a rewrite of unrelated scenario or engine logic

## Bottom Line

Flashpoint should keep shipping scenario product work.

But from this point forward, any future auth, collaboration, reviewer attribution, billing, or access work should stay compatible with:
- workspace-based access
- workspace-based billing
- shared module entitlements
- visible roles `user`, `manager`, `admin`
- enterprise SSO as a later layer rather than the default assumption
