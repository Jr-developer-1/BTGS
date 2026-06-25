/**
 * useEligibility — React hook for employee entitlement soft-warnings.
 *
 * Fetches GET /api/masters/my-eligibility/ once on mount.
 * Exposes:
 *   eligibility      — raw response object
 *   loading          — boolean
 *   error            — error string or null
 *   checkTravel(mode)        → { allowed, warn, label, class }
 *   checkAccommodation(amount, cityType) → { exceeds, limit, warn, note }
 *   checkDA(amount)          → { exceeds, limit, warn }
 *   getEntitlementNote(category, extra) → string | null
 */

import { useState, useEffect, useRef } from 'react';
import api from '../api/api';

// Session-level cache so we don't re-fetch on every re-render
let _cachedEligibility = null;
let _fetchPromise = null;

async function fetchEligibility() {
  if (_cachedEligibility) return _cachedEligibility;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = api.get('/api/masters/my-eligibility/')
    .then(res => {
      _cachedEligibility = res.data;
      _fetchPromise = null;
      return res.data;
    })
    .catch(err => {
      _fetchPromise = null;
      return null;
    });

  return _fetchPromise;
}

export function clearEligibilityCache() {
  _cachedEligibility = null;
  _fetchPromise = null;
}

// ---------------------------------------------------------------------------
export function useEligibility() {
  const [eligibility, setEligibility] = useState(_cachedEligibility);
  const [loading, setLoading] = useState(!_cachedEligibility);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cachedEligibility) {
      setEligibility(_cachedEligibility);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEligibility().then(data => {
      if (data) {
        setEligibility(data);
        setError(data.error || null);
      } else {
        setError('Could not load entitlement policy.');
      }
      setLoading(false);
    });
  }, []);

  // -------------------------------------------------------------------
  // Helper: normalize travel mode key from string like "Airways", "Train", "Bus"
  const _modeKey = (mode) => {
    const m = (mode || '').toLowerCase();
    if (m.includes('air') || m.includes('flight') || m.includes('fly')) return 'air';
    if (m.includes('train') || m.includes('rail')) return 'train';
    if (m.includes('bus') || m.includes('sleeper')) return 'bus';
    if (m.includes('car') || m.includes('cab') || m.includes('jeep') || m.includes('van')) return 'car';
    if (m.includes('local') || m.includes('conve') || m.includes('2 wheel') || m.includes('3 wheel') || m.includes('auto')) return 'local_conveyance';
    return null;
  };

  // -------------------------------------------------------------------
  /**
   * checkTravel(mode) → { allowed, warn, warnMessage, entitledClass }
   * mode: "Airways" | "Train" | "Bus" | "Car / Jeep / Van" | etc.
   */
  const checkTravel = (mode) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false) {
      return { allowed: true, warn: false, warnMessage: null, entitledClass: null };
    }
    const key = _modeKey(mode);
    if (!key) return { allowed: true, warn: false, warnMessage: null, entitledClass: null };

    const t = eligibility.travel?.[key];
    if (!t) return { allowed: true, warn: false, warnMessage: null, entitledClass: null };

    const warn = t.warn === true;
    return {
      allowed: t.allowed,
      warn,
      warnMessage: warn
        ? `Your cadre (${eligibility.cadre}) is not entitled to ${mode} travel. You may still submit, but HR may cap or question this expense.`
        : null,
      entitledClass: t.class || t.notes || t.type || null,
    };
  };

  // -------------------------------------------------------------------
  /**
   * checkAccommodation(amount, cityType)
   * cityType: "State HQ" | "Districts" | "Others"
   */
  const checkAccommodation = (amount, cityType) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false) {
      return { exceeds: false, limit: null, warn: false, note: null };
    }
    const acc = eligibility.accommodation;
    if (!acc) return { exceeds: false, limit: null, warn: false, note: null };

    const ct = (cityType || 'others').toLowerCase().replace(/\s+/g, '_');
    let limit = null;
    if (ct === 'state_hq' || ct === 'state hq') limit = acc.state_hq;
    else if (ct === 'districts') limit = acc.districts;
    else limit = acc.others;

    if (limit === null || limit === undefined) return { exceeds: false, limit: null, warn: false, note: null };

    const amt = parseFloat(amount) || 0;
    const lim = parseFloat(limit);
    const exceeds = amt > lim;

    return {
      exceeds,
      limit: lim,
      warn: exceeds,
      note: exceeds
        ? `Accommodation exceeds entitlement limit of ₹${lim.toLocaleString()} for ${cityType || 'this city type'}.`
        : null,
    };
  };

  // -------------------------------------------------------------------
  /**
   * checkDA(amount) — check daily allowance
   */
  const checkDA = (amount) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false) return { exceeds: false, limit: null, warn: false };
    const limit = eligibility.daily_allowance;
    if (limit === null || limit === undefined) return { exceeds: false, limit: null, warn: false };
    const amt = parseFloat(amount) || 0;
    const lim = parseFloat(limit);
    return { exceeds: amt > lim, limit: lim, warn: amt > lim };
  };

  // -------------------------------------------------------------------
  /**
   * checkMileage(distance) — check if distance/mileage exceeds maximum permitted limit
   */
  const checkMileage = (distance) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false) return { exceeds: false, limit: null, warn: false };
    const limit = eligibility.max_mileage_km;
    if (limit === null || limit === undefined || limit <= 0) return { exceeds: false, limit: null, warn: false };
    const dist = parseFloat(distance) || 0;
    const lim = parseFloat(limit);
    const exceeds = dist > lim;
    return {
      exceeds,
      limit: lim,
      warn: exceeds,
      warnMessage: exceeds
        ? `Mileage of ${dist.toFixed(2)} km exceeds your cadre entitlement limit of ${lim} km.`
        : null
    };
  };

  // -------------------------------------------------------------------
  /**
   * getEntitlementNote(category) — returns a human-readable note for the
   * expense category field when the entitlement has a restriction.
   */
  const getEntitlementNote = (category) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false || !eligibility.travel) return null;
    const key = _modeKey(category);
    if (!key) return null;
    const t = eligibility.travel[key];
    if (!t) return null;
    if (t.allowed === false) {
      const label = key === 'air' ? 'Air travel' : key === 'car' ? 'Car hire' : key.replace('_', ' ');
      return `⚠ ${label} is not in your entitlement (${eligibility.cadre}). HR may cap this claim.`;
    }
    const cls = t.class || t.notes || t.type;
    if (cls && cls !== 'NA') {
      const label = key === 'air' ? 'Air' : key === 'train' ? 'Train' : key === 'bus' ? 'Bus' : 'Travel';
      return `ℹ Your entitled ${label} class: ${cls}`;
    }
    return null;
  };

  return {
    eligibility,
    loading,
    error,
    checkTravel,
    checkAccommodation,
    checkDA,
    checkMileage,
    getEntitlementNote,
  };
}
