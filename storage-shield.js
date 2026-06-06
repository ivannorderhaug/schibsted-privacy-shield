(function () {
  const cfg = globalThis.SHIELD_CONFIG;
  if (!cfg) return;

  const warn = (...args) => console.warn("[shield/cs]", ...args);

  const lsZero = new Set(cfg.localStorageToZero);
  const lsDelete = new Set(cfg.localStorageToDelete);
  const ssDelete = new Set(cfg.sessionStorageToDelete);
  const cZero = new Set(cfg.cookiesToZero);
  const cDelete = new Set(cfg.cookiesToDelete);

  const host = (location.hostname || "").toLowerCase();
  const regDomain = globalThis.shieldRegisteredDomain(host);

  const ttlSeconds = cfg.ttlSeconds;
  const ttlMs = ttlSeconds * 1000;

  function encodeTcfString() {
    const TCF_VERSION = 2;
    const CMP_ID_SOURCEPOINT = 6;
    const CMP_VERSION = 1;
    const CONSENT_SCREEN = 1;
    const CONSENT_LANGUAGE = "EN";
    const VENDOR_LIST_VERSION = 159;
    const TCF_POLICY_VERSION = 5;
    const IS_SERVICE_SPECIFIC = 1;
    const USE_NON_STANDARD_STACKS = 0;
    const NO_SPECIAL_FEATURE_OPT_INS = 0;
    const NO_PURPOSE_CONSENTS = 0;
    const NO_PURPOSE_LEGITIMATE_INTERESTS = 0;
    const PURPOSE_ONE_TREATMENT = 0;
    const PUBLISHER_COUNTRY = "NO";
    const NO_VENDORS = 0;
    const BITFIELD_ENCODING = 0;
    const NO_PUBLISHER_RESTRICTIONS = 0;

    const FIELD_BITS = {
      version: 6,
      created: 36,
      lastUpdated: 36,
      cmpId: 12,
      cmpVersion: 12,
      consentScreen: 6,
      vendorListVersion: 12,
      tcfPolicyVersion: 6,
      isServiceSpecific: 1,
      useNonStandardStacks: 1,
      specialFeatureOptIns: 12,
      purposeConsents: 24,
      purposeLegitimateInterests: 24,
      purposeOneTreatment: 1,
      maxVendorId: 16,
      rangeEncodingFlag: 1,
      numPublisherRestrictions: 12,
    };

    const createdDeciseconds = BigInt(Math.floor(Date.now() / 100));
    const bits = [];
    const pushBits = (value, length) => {
      const big = BigInt(value);
      for (let i = length - 1; i >= 0; i--) {
        bits.push(Number((big >> BigInt(i)) & 1n));
      }
    };
    const pushSixBitChar = (char) => pushBits(char.charCodeAt(0) - 65, 6);
    const pushString = (text) => {
      for (const char of text) pushSixBitChar(char);
    };

    pushBits(TCF_VERSION, FIELD_BITS.version);
    pushBits(createdDeciseconds, FIELD_BITS.created);
    pushBits(createdDeciseconds, FIELD_BITS.lastUpdated);
    pushBits(CMP_ID_SOURCEPOINT, FIELD_BITS.cmpId);
    pushBits(CMP_VERSION, FIELD_BITS.cmpVersion);
    pushBits(CONSENT_SCREEN, FIELD_BITS.consentScreen);
    pushString(CONSENT_LANGUAGE);
    pushBits(VENDOR_LIST_VERSION, FIELD_BITS.vendorListVersion);
    pushBits(TCF_POLICY_VERSION, FIELD_BITS.tcfPolicyVersion);
    pushBits(IS_SERVICE_SPECIFIC, FIELD_BITS.isServiceSpecific);
    pushBits(USE_NON_STANDARD_STACKS, FIELD_BITS.useNonStandardStacks);
    pushBits(NO_SPECIAL_FEATURE_OPT_INS, FIELD_BITS.specialFeatureOptIns);
    pushBits(NO_PURPOSE_CONSENTS, FIELD_BITS.purposeConsents);
    pushBits(NO_PURPOSE_LEGITIMATE_INTERESTS, FIELD_BITS.purposeLegitimateInterests);
    pushBits(PURPOSE_ONE_TREATMENT, FIELD_BITS.purposeOneTreatment);
    pushString(PUBLISHER_COUNTRY);

    pushBits(NO_VENDORS, FIELD_BITS.maxVendorId);
    pushBits(BITFIELD_ENCODING, FIELD_BITS.rangeEncodingFlag);

    pushBits(NO_VENDORS, FIELD_BITS.maxVendorId);
    pushBits(BITFIELD_ENCODING, FIELD_BITS.rangeEncodingFlag);

    pushBits(NO_PUBLISHER_RESTRICTIONS, FIELD_BITS.numPublisherRestrictions);

    while (bits.length % 8) bits.push(0);
    const bytes = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
      bytes[i] = b;
    }
    let s = "";
    for (const byte of bytes) s += String.fromCharCode(byte);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function zeroCookieString(name) {
    let s = `${name}=0; Path=/; Max-Age=${ttlSeconds}; SameSite=Lax`;
    if (regDomain) s += `; Domain=.${regDomain}`;
    return s;
  }

  function rawSetCookie(value) {
    try {
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      if (desc && desc.set) desc.set.call(document, value);
      else document.cookie = value;
    } catch (e) {
      warn("cookie write failed:", value, "—", e?.message || e);
    }
  }

  for (const name of cZero) rawSetCookie(zeroCookieString(name));
  for (const name of cDelete) {
    rawSetCookie(`${name}=; Path=/; Max-Age=0`);
    if (regDomain) {
      rawSetCookie(`${name}=; Path=/; Max-Age=0; Domain=.${regDomain}`);
      rawSetCookie(`${name}=; Path=/; Max-Age=0; Domain=${regDomain}`);
    }
  }

  function injectSourcepointConsent() {
    const propertyId = cfg.sourcepointPropertyByDomain[regDomain];
    if (!propertyId) return false;
    const tpl = cfg.sourcepointTemplates[propertyId];
    if (!tpl) return false;

    const userKey = `_sp_user_consent_${propertyId}`;
    let needsInject = true;
    const existing = localStorage.getItem(userKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        const cs = parsed?.gdpr?.consentStatus;
        const exp = parsed?.gdpr?.expirationDate;
        const stillFresh =
          exp && new Date(exp).getTime() > Date.now() + 86400000;
        const isOurReject =
          cs && cs.rejectedAny === true && cs.consentedAll === false;
        if (stillFresh && isOurReject) needsInject = false;
      } catch (e) {
        warn("could not parse existing consent state for", userKey, "—", e?.message || e);
      }
    }
    if (!needsInject) return false;

    const uuid =
      (crypto && crypto.randomUUID && crypto.randomUUID()) ||
      "00000000-0000-4000-8000-000000000000";
    const fullUuid = `${uuid}_56`;
    const now = new Date();
    const exp = new Date(now.getTime() + ttlMs);
    const tcString = encodeTcfString();

    const userConsent = {
      gdpr: {
        authId: null,
        uuid: fullUuid,
        getMessageAlways: false,
        applies: true,
        actions: [],
        euconsent: tcString,
        grants: {},
        addtlConsent: "2~~dv.",
        customVendorsResponse: {
          consentedVendors: [],
          consentedPurposes: [],
          legIntPurposes: [],
        },
        dateCreated: now.toISOString(),
        expirationDate: exp.toISOString(),
        consentStatus: {
          rejectedAny: true,
          rejectedLI: false,
          consentedAll: false,
          granularStatus: {
            vendorConsent: "NONE",
            vendorLegInt: "EMPTY_VL",
            purposeConsent: "NONE",
            purposeLegInt: "EMPTY_VL",
            previousOptInAll: false,
            defaultConsent: false,
          },
          hasConsentData: true,
          consentedToAny: true,
        },
        specialFeatures: [],
        legIntCategories: [],
        legIntVendors: [],
        vendors: [],
        categories: [],
        euconsentWithDisclosedVendors: tcString,
      },
      version: 1,
    };

    const localState = {
      gdpr: {
        mmsCookies: tpl.ssCookie ? [tpl.ssCookie] : [],
        propertyId,
        messageId: tpl.messageId,
      },
      custom: { mmsCookies: [], propertyId },
    };

    const nonKeyed = {
      gdpr: { _sp_v1_data: tpl.v1Data, _sp_v1_p: tpl.v1P },
      custom: {},
    };

    try {
      localStorage.setItem(userKey, JSON.stringify(userConsent));
      localStorage.setItem("_sp_local_state", JSON.stringify(localState));
      localStorage.setItem(
        "_sp_non_keyed_local_state",
        JSON.stringify(nonKeyed),
      );
    } catch (e) {
      warn("could not write Sourcepoint consent state —", e?.message || e);
    }

    rawSetCookie(
      `consentUUID=${fullUuid}; Path=/; Max-Age=${ttlSeconds}; SameSite=Lax` +
        (regDomain ? `; Domain=.${regDomain}` : ""),
    );
    rawSetCookie(
      `consentDate=${now.toISOString()}; Path=/; Max-Age=${ttlSeconds}; SameSite=Lax` +
        (regDomain ? `; Domain=.${regDomain}` : ""),
    );
    rawSetCookie(
      `_sp_su=false; Path=/; Max-Age=${ttlSeconds}; SameSite=Lax` +
        (regDomain ? `; Domain=.${regDomain}` : ""),
    );
    return true;
  }

  const injected = injectSourcepointConsent();

  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
  if (cookieDesc && cookieDesc.set && cookieDesc.get) {
    const origSet = cookieDesc.set;
    const origGet = cookieDesc.get;
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      enumerable: cookieDesc.enumerable,
      get() {
        return origGet.call(this);
      },
      set(value) {
        const m = String(value).match(/^\s*([^=;\s]+)\s*=/);
        if (m) {
          const name = m[1];
          if (cDelete.has(name)) return;
          if (cZero.has(name)) return origSet.call(this, zeroCookieString(name));
        }
        return origSet.call(this, value);
      },
    });
  }

  function cleanup(store, storeName, zeroSet, deleteSet) {
    try {
      for (const k of zeroSet) {
        if (store.getItem(k) !== "0") store.setItem(k, "0");
      }
      for (const k of deleteSet) {
        if (store.getItem(k) !== null) store.removeItem(k);
      }
    } catch (e) {
      warn(storeName, "cleanup failed —", e?.message || e);
    }
  }

  cleanup(localStorage, "localStorage", lsZero, lsDelete);
  cleanup(sessionStorage, "sessionStorage", new Set(), ssDelete);

  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (this === localStorage) {
      if (lsDelete.has(key)) return;
      if (lsZero.has(key)) return origSetItem.call(this, key, "0");
    } else if (this === sessionStorage) {
      if (ssDelete.has(key)) return;
    }
    return origSetItem.call(this, key, value);
  };

  console.log(
    "[shield/cs] active on",
    host,
    "regDomain:",
    regDomain,
    "consent-injected:",
    injected,
  );

  try {
    delete globalThis.SHIELD_CONFIG;
  } catch (e) {
    warn("could not remove SHIELD_CONFIG from global scope —", e?.message || e);
  }
})();
