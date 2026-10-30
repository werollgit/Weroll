# WeRoll 5E • Cloud Persistence & Google Auth Integration Plan (Updated)

This document provides a comprehensive audit of what is currently saved in Firebase vs. what needs to be added, along with the specification for Google Sign-In onboarding, account approval requirement, Google account linking, and account management indicators.

---

## Audit: Current State vs. Missing Implementations

### What is Currently Working in Firebase
- **Users Collection (`/users/{userId}`)**: Basic user profile sync (`id`, `email`, `displayName`, `role`, `playerType`, `userTagId`, `avatarUrl`).
- **Characters Collection (`/characters/{characterId}`)**: Character sheet JSON documents synced to Firestore.
- **Campaigns Collection (`/campaigns/{campaignId}`)**: DM workspace campaign JSON documents synced to Firestore.

### What is NOT Yet Persisted in Firebase (Needs Implementation)
1. **Forum Posts (`/forumPosts/{postId}`) & Forum Comments (`/forumComments/{commentId}`)**: Currently saved only in local JSON files on the server; must be synchronized with Firestore real-time collections.
2. **Friend Direct Messages (`/friendMessages/{messageId}`)**: Currently saved in local server JSON; must be synced in real time to Firestore.
3. **Custom Skins (`/skins/{skinId}`)**: Created in Visual Skin Designer; must be stored in Firestore so custom skins persist across app republishes.
4. **Master Unified App Snapshot (`/masterData/global`)**: Server snapshot for zero-delay boot recovery when republishing.
5. **Google Linked Status (`isGoogleLinked`)**: Tracking whether a user account was registered or linked with Google.

---

## User Review & Critical Requirements

> [!IMPORTANT]
> Key requirements confirmed by the user in this revision:

1. **Google Sign-In Pending Approval & Onboarding**:
   - Signing in with Google for a new account MUST NOT automatically grant approval or admin status.
   - New Google users must go through onboarding: choosing a display name, 3-character `@ID`, player type (`player`, `dm`, or `both`), and entering `'pending'` approval status until approved by a Moderator or Admin.
2. **Google Account Linking in Security Panel**:
   - Existing email/password accounts can link a Google account from the Security Modal.
   - Displays a explicit warning modal prior to linking: *"Attention: Linking your Google account will permanently update your WeRoll account email to your Google email (<google_email>). This action cannot be undone."*
3. **Google Linked Account Indicator in Admin Panel**:
   - In the Registered Accounts & Role Management panel, accounts linked to Google display a Google Icon with a checkmark badge (`isGoogleLinked === true`).
4. **Manual JSON Import Priority**:
   - Importing a manual JSON file overwrites active local state and updates Firestore as the active truth.

---

## 1. Overview & Core Concept

### Unified Cloud Synchronization + Google Auth Discipline
This update secures WeRoll 5E against data loss across app republications by backing up all 7 core entities to Firebase Firestore. Simultaneously, it strictly standardizes Google Sign-In so that Google users go through the standard onboarding and approval queue, preventing unauthorized privilege escalation.

---

## 2. User Experience & Visual Design

### Google Sign-In & Onboarding Flow
1. **Sign-In Action**: User clicks "Iniciar Sesión con Google".
2. **First-Time Google Registration Check**:
   - If account exists in Firebase/Server: Loads account state. If status is `'pending'`, displays the "Cuenta Pendiente de Aprobación" screen.
   - If new account: Prompts user to choose `displayName`, `@ID` tag, and `playerType` (`Jugador`, `DM`, or `Ambos`). Saves account with `role: 'player'`, `status: 'pending'`, `isGoogleLinked: true`.
3. **Account Security Modal (Google Linking)**:
   - Includes "Vincular Cuenta de Google" button.
   - Shows confirmation modal warning about permanent email update.
4. **Admin / Moderator Account Panel**:
   - Each registered user card shows badges for Role, Player Type, Status (`Aprobada`/`Pendiente`), and a **Google Badge** (Google icon + checkmark) if `isGoogleLinked` is true.

---

## 3. Key Technical Decisions & Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         WeRoll 5E Client Engine                        │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │   Auth & Onboarding    │  │ Player & World   │  │ Forum, Messages │ │
│  │ (Google + Email/Pass)  │  │  Sheets Engine   │  │    & Skins     │ │
│  └───────────┬────────────┘  └────────┬─────────┘  └────────┬────────┘ │
└──────────────┼────────────────────────┼─────────────────────┼──────────┘
               │                        │                     │
               ▼                        ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Firebase Service Layer & Adapters                     │
│    (saveUserProfileAsync, saveSkinsAsync, saveForumAsync, etc.)        │
└──────────────┬────────────────────────┬─────────────────────┬──────────┘
               │                        │                     │
               ▼                        ▼                     ▼
┌───────────────────────────────────────────────┐   ┌────────────────────┐
│              Firebase Firestore               │   │ Server DataStore   │
│  (/users, /characters, /campaigns, /skins,    │───│  & Manual JSON     │
│   /forumPosts, /forumComments, /friendMsg)    │   │  Import Overwrite  │
└───────────────────────────────────────────────┘   └────────────────────┘
```

### Entity Blueprints Expansion (`firebase-blueprint.json`)
- Add `isGoogleLinked` (boolean) to `UserProfile`.
- Add `skins` collection schema (`/skins/{skinId}`).
- Add `forumPosts`, `forumComments`, and `friendMessages` collection schemas.

### Firestore Rules Hardening (`firestore.rules`)
- Validate `isGoogleLinked` property on `UserProfile`.
- Add security rules for `/skins/{skinId}`, `/forumPosts/{postId}`, `/forumComments/{commentId}`, and `/friendMessages/{messageId}`.

---

## 4. Implementation Steps for Next Turn

1. **Update Firebase Blueprint & Security Rules**: Expand `firebase-blueprint.json` and `firestore.rules` to include `isGoogleLinked`, `skins`, `forumPosts`, `forumComments`, and `friendMessages`.
2. **Google Onboarding & Approval Enforcement in `App.tsx` & `RoleSelectionModal.tsx`**:
   - Intercept Google auth logins: check if profile exists; if new, open Onboarding Modal to pick `userTagId` & `playerType`, setting `status: 'pending'`.
3. **Google Account Linking with Warning Modal in `UserSecurityModal.tsx`**:
   - Add Google Link button, warning dialog explaining permanent email migration, and backend account merge handler.
4. **Google Badge in `ModeratorPanelModal.tsx`**:
   - Render Google Icon + Checkmark badge for accounts with `isGoogleLinked: true`.
5. **Full Firestore Sync Service Layer in `src/services/firebaseService.ts`**:
   - Add Firestore sync methods for skins, forum posts, forum comments, and friend direct messages.
