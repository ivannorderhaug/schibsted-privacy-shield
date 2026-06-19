const DEFAULT_SS_COOKIE =
  "_sp_v1_ss=1:H4sIAAAAAAAAAItWqo5RKimOUbKKxs_IAzEMamN1YpRSQcy80pwcILsErKC6lpoSSrEA-EAOLpYAAAA%3D";

const SHIELD_CONFIG = {
  ttlSeconds: 60 * 60 * 24 * 180,

  domains: [
    "vg.no",
    "e24.no",
    "aftenposten.no",
    "bt.no",
    "aftenbladet.no",
    "aftonbladet.se",
    "svd.se",
    "godt.no",
    "minmote.no",
  ],

  cookiesToZero: [
    "_cmp_advertising",
    "_cmp_marketing",
    "_cmp_analytics",
    "_cmp_personalisation",
  ],

  cookiesToDelete: [
    "_pulse2data",
    "_pulsesession",
    "clientBucket",
  ],

  consentStateCookies: [
    "consentUUID",
    "consentDate",
    "_sp_su",
  ],

  cookiePrefixesToDelete: [
    "_sp_",
    "euconsent",
  ],

  localStorageToZero: [
    "CMP:advertising",
    "CMP:marketing",
    "CMP:analytics",
    "CMP:personalisation",
  ],

  localStorageToDelete: [
    "_pulse.internal.identity.cis",
  ],

  localStoragePrefixesToDelete: [
    "_sp_",
    "CMP:",
    "_pulse",
    "euconsent",
  ],

  sessionStorageToDelete: [
    "abTestId",
  ],

  sessionStoragePrefixesToDelete: [
    "_pulse",
  ],

  sourcepointPropertyByDomain: {
    "vg.no": 8876,
    "e24.no": 16052,
    "aftenposten.no": 4607,
    "bt.no": 8885,
    "aftenbladet.no": 8886,
    "aftonbladet.se": 4595,
    "svd.se": 8888,
    "godt.no": 14053,
    "minmote.no": 14054,
  },

  sourcepointTemplates: {
    8876: { messageId: 1485787, v1Data: "1289587", v1P: "68", ssCookie: DEFAULT_SS_COOKIE },
    16052: { messageId: 1486133, v1Data: "1289985", v1P: "280", ssCookie: DEFAULT_SS_COOKIE },
    4607: { messageId: 1486131, v1Data: "1289981", v1P: "825", ssCookie: DEFAULT_SS_COOKIE },
    8885: { messageId: 1486132, v1Data: "1289983", v1P: "525", ssCookie: DEFAULT_SS_COOKIE },
    8886: { messageId: 1486130, v1Data: "1289979", v1P: "915", ssCookie: DEFAULT_SS_COOKIE },
    4595: { messageId: 1484555, v1Data: "1288229", v1P: "459", ssCookie: DEFAULT_SS_COOKIE },
    8888: { messageId: 1484558, v1Data: "1288235", v1P: "48", ssCookie: DEFAULT_SS_COOKIE },
    14053: { messageId: 1486134, v1Data: "1289987", v1P: "629", ssCookie: DEFAULT_SS_COOKIE },
    14054: { messageId: 1489178, v1Data: "1293436", v1P: "820", ssCookie: DEFAULT_SS_COOKIE },
  },
};

function shieldRegisteredDomain(hostname) {
  const host = (hostname || "").toLowerCase();
  for (const domain of SHIELD_CONFIG.domains) {
    if (host === domain || host.endsWith("." + domain)) return domain;
  }
  return null;
}

function shieldKeyMatches(name, exactNames, prefixes) {
  if (exactNames.indexOf(name) !== -1) return true;
  for (const prefix of prefixes) {
    if (name.indexOf(prefix) === 0) return true;
  }
  return false;
}

globalThis.SHIELD_CONFIG = SHIELD_CONFIG;
globalThis.shieldRegisteredDomain = shieldRegisteredDomain;
globalThis.shieldKeyMatches = shieldKeyMatches;
