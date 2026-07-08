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
  const checkMileage = (distance, travelMode = null, vehicleType = null) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false) return { exceeds: false, limit: null, warn: false };
    
    let limit = eligibility.max_mileage_km;
    const mode = (travelMode || '').trim().toLowerCase();
    const subType = (vehicleType || '').trim().toLowerCase();

    if (mode === 'bike' && subType === 'own bike') {
      limit = eligibility.max_mileage_bike_km !== undefined && eligibility.max_mileage_bike_km !== null && eligibility.max_mileage_bike_km > 0
        ? eligibility.max_mileage_bike_km 
        : eligibility.max_mileage_km;
    } else if (mode === 'car' && subType === 'own car') {
      limit = eligibility.max_mileage_car_km !== undefined && eligibility.max_mileage_car_km !== null && eligibility.max_mileage_car_km > 0 
        ? eligibility.max_mileage_car_km 
        : eligibility.max_mileage_km;
    }

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

  /**
   * checkLocalTravel(mode, subType) → { allowed }
   * mode: "Car / Cab" | "Bike" | "Public Transport" | "Walk"
   * subType: "Own Bike" | "Own Car" | "Company Car" | "Ride Hailing" | "Auto" | etc.
   */
  const checkLocalTravel = (mode, subType) => {
    if (!eligibility || eligibility.error || eligibility.policy_enforced === false) {
      return { allowed: true };
    }

    const selectedMode = (mode || '').trim().toLowerCase();
    const selectedSubType = (subType || '').trim().toLowerCase();

    // Walk is always allowed
    if (selectedMode === 'walk') {
      return { allowed: true };
    }

    const localRules = eligibility.travel_rules?.local_conveyance;

    // Helper to check if a specific db allowed subtype matches selected subtype
    const subtypeMatches = (allowedStr, selSub) => {
      const allowedClean = allowedStr.toLowerCase();
      const selClean = selSub.toLowerCase();
      
      if (allowedClean.includes(selClean)) return true;

      // Map ride hailing / rented car / online cab
      if ((selClean.includes('ride') || selClean.includes('hail') || selClean.includes('rent') || selClean.includes('cab')) &&
          (allowedClean.includes('cab') || allowedClean.includes('hire') || allowedClean.includes('online') || allowedClean.includes('taxi'))) {
        return true;
      }

      // Map bike / 2-wheeler
      if ((selClean.includes('bike') || selClean.includes('2 wheel') || selClean.includes('two')) &&
          (allowedClean.includes('bike') || allowedClean.includes('2 wheel') || allowedClean.includes('2-wheel') || allowedClean.includes('two'))) {
        return true;
      }

      // Map auto / metro / bus / 3-wheeler / public
      if ((selClean.includes('auto') || selClean.includes('metro') || selClean.includes('bus') || selClean.includes('local') || selClean.includes('pt') || selClean.includes('public')) &&
          (allowedClean.includes('auto') || allowedClean.includes('metro') || allowedClean.includes('bus') || allowedClean.includes('3 wheel') || allowedClean.includes('3-wheel') || allowedClean.includes('conveyance') || allowedClean.includes('wheeler'))) {
        return true;
      }

      return false;
    };

    // If we have configured local conveyance rules for this cadre in the master
    if (localRules && localRules.length > 0) {
      for (const rule of localRules) {
        if (!rule.allowed) continue;

        const ruleMode = (rule.mode || '').toLowerCase();
        let modeMatches = false;

        if (ruleMode === 'local travel' || ruleMode === 'local conveyance') {
          modeMatches = true;
        } else if (ruleMode.includes('bike') && selectedMode.includes('bike')) {
          modeMatches = true;
        } else if (ruleMode.includes('car') && selectedMode.includes('car')) {
          modeMatches = true;
        } else if (ruleMode.includes('public') && selectedMode.includes('public')) {
          modeMatches = true;
        } else if (ruleMode === selectedMode) {
          modeMatches = true;
        }

        if (modeMatches) {
          // If no specific subtypes list is defined, then all subtypes of this mode are allowed
          if (!rule.subtypes || rule.subtypes.length === 0) {
            return { allowed: true };
          }
          // Otherwise, check if the selected subtype matches any allowed subtype
          for (const allowedSubtype of rule.subtypes) {
            if (subtypeMatches(allowedSubtype, selectedSubType)) {
              return { allowed: true };
            }
          }
        }
      }
      // If we checked all rules and none matched, then it is NOT allowed by cadre policy
      return { allowed: false };
    }

    // Default Fallback Policy if no rules are configured in local_conveyance for this cadre:
    // Only "Bike" with "Own Bike" or "Walk" is allowed by default. Everything else requires reason/approval.
    const isDefaultDefault = (selectedMode === 'bike' && selectedSubType === 'own bike') || selectedMode === 'walk';
    return { allowed: isDefaultDefault };
  };

  const calculateDAEligibility = (startTime, endTime, startDate = null, endDate = null, isLocal = false) => {
    if (!startTime || !endTime) {
      return {
        hours: 0,
        eligiblePct: 0,
        eligibleAmount: 0,
        message: "no DA is allowed for you based on hours"
      };
    }
    const sDate = startDate || "2000-01-01";
    const eDate = endDate || sDate;
    
    const startDt = new Date(`${sDate}T${startTime}`);
    const endDt = new Date(`${eDate}T${endTime}`);
    
    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      return {
        hours: 0,
        eligiblePct: 0,
        eligibleAmount: 0,
        message: "no DA is allowed for you based on hours"
      };
    }
    
    let diffMs = endDt.getTime() - startDt.getTime();
    if (diffMs < 0) {
      if (sDate === eDate) {
        const nextDay = new Date(startDt);
        nextDay.setDate(nextDay.getDate() + 1);
        const correctedEnd = new Date(`${nextDay.toISOString().split('T')[0]}T${endTime}`);
        diffMs = correctedEnd.getTime() - startDt.getTime();
      } else {
        return {
          hours: 0,
          eligiblePct: 0,
          eligibleAmount: 0,
          message: "no DA is allowed for you based on hours"
        };
      }
    }
    
    const hours = diffMs / (1000 * 60 * 60);
    const limitKey = isLocal ? 'monthly_tour_daily_allowance' : 'daily_allowance';
    const limit = eligibility?.[limitKey] !== undefined && eligibility?.[limitKey] !== null ? parseFloat(eligibility[limitKey]) : 0;
    
    let eligiblePct = 0;
    let message = "";
    if (hours < 12) {
      eligiblePct = 0;
      message = "no DA is allowed for you based on hours";
    } else if (hours >= 12 && hours <= 18) {
      eligiblePct = 50;
      message = "50% based on hours";
    } else {
      eligiblePct = 100;
      message = "100% based on hours";
    }
    
    const eligibleAmount = (limit * eligiblePct) / 100;
    return {
      hours,
      eligiblePct,
      eligibleAmount,
      message
    };
  };

  return {
    eligibility,
    loading,
    error,
    checkTravel,
    checkAccommodation,
    checkDA,
    checkMileage,
    checkLocalTravel,
    getEntitlementNote,
    calculateDAEligibility,
  };
}
