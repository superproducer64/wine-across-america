// Subscription purchasing is not yet implemented — RevenueCat is stubbed
// (see subscriptionStore.ts) and there is no working In-App-Purchase flow.
// Keep every paid-tier / upgrade / "Pro" UI element hidden until a real
// purchase flow ships, so the app never displays a locked feature it can't
// actually sell (App Store Guideline 2.1(b)).
export const SHOW_SUBSCRIPTION_UI = false;
