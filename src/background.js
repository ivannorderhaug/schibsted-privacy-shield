if (typeof importScripts === "function") {
  importScripts("./config.js");
}

const cookiesToZero = new Set(SHIELD_CONFIG.cookiesToZero);
const cookiesToDelete = new Set(SHIELD_CONFIG.cookiesToDelete);
const targetDomains = SHIELD_CONFIG.domains;
const ttlSeconds = SHIELD_CONFIG.ttlSeconds;

const recentlySetByUs = new Set();
const SELF_WRITE_TTL_MS = 1500;

function markSelfWrite(key) {
  recentlySetByUs.add(key);
  setTimeout(() => recentlySetByUs.delete(key), SELF_WRITE_TTL_MS);
}

function eventKey(cookie, action) {
  return `${cookie.domain}|${cookie.name}|${action}`;
}

function urlForCookie(cookie) {
  const host = cookie.domain.replace(/^\./, "");
  const path = cookie.path || "/";
  return `https://${host}${path}`;
}

function isTargetDomain(cookieDomain) {
  return shieldRegisteredDomain(cookieDomain.replace(/^\./, "")) !== null;
}

function buildSetDetails(cookie, value, ttlSeconds) {
  const details = {
    url: urlForCookie(cookie),
    name: cookie.name,
    value,
    path: cookie.path || "/",
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    expirationDate: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  if (cookie.domain && cookie.domain.startsWith(".")) {
    details.domain = cookie.domain;
  }
  if (cookie.sameSite && cookie.sameSite !== "unspecified") {
    details.sameSite = cookie.sameSite;
  }
  if (cookie.storeId) {
    details.storeId = cookie.storeId;
  }
  if (cookie.firstPartyDomain !== undefined && cookie.firstPartyDomain !== "") {
    details.firstPartyDomain = cookie.firstPartyDomain;
  }
  if (cookie.partitionKey) {
    details.partitionKey = cookie.partitionKey;
  }
  return details;
}

function buildRemoveDetails(cookie) {
  const details = {
    url: urlForCookie(cookie),
    name: cookie.name,
  };
  if (cookie.storeId) details.storeId = cookie.storeId;
  if (cookie.firstPartyDomain !== undefined && cookie.firstPartyDomain !== "") {
    details.firstPartyDomain = cookie.firstPartyDomain;
  }
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  return details;
}

async function setCookieToZero(cookie) {
  markSelfWrite(eventKey(cookie, "set"));
  const details = buildSetDetails(cookie, "0", ttlSeconds);
  try {
    const result = await chrome.cookies.set(details);
    if (!result) {
      console.warn("[shield] set returned null for", cookie.name, "@", cookie.domain, details);
    }
  } catch (e) {
    console.warn("[shield] set failed for", cookie.name, "@", cookie.domain, "—", e?.message || e);
  }
}

async function deleteCookie(cookie) {
  markSelfWrite(eventKey(cookie, "remove"));
  try {
    const result = await chrome.cookies.remove(buildRemoveDetails(cookie));
    if (!result) {
      console.warn("[shield] remove returned null for", cookie.name, "@", cookie.domain);
    }
  } catch (e) {
    console.warn("[shield] remove failed for", cookie.name, "@", cookie.domain, "—", e?.message || e);
  }
}

async function enforcePolicyOnCookie(cookie) {
  if (cookiesToDelete.has(cookie.name)) {
    await deleteCookie(cookie);
    return;
  }
  if (cookiesToZero.has(cookie.name) && cookie.value !== "0") {
    await setCookieToZero(cookie);
  }
}

async function sweepAllDomains() {
  console.log("[shield] sweep starting for", targetDomains.length, "domains");
  let touched = 0;
  for (const domain of targetDomains) {
    let cookies;
    try {
      cookies = await chrome.cookies.getAll({ domain, firstPartyDomain: null });
    } catch (e) {
      console.debug("[shield] getAll with firstPartyDomain:null unsupported for", domain, "— retrying without it");
      try {
        cookies = await chrome.cookies.getAll({ domain });
      } catch (e) {
        console.warn("[shield] getAll failed for", domain, "—", e?.message || e);
        continue;
      }
    }
    for (const cookie of cookies) {
      if (cookiesToDelete.has(cookie.name) ||
          (cookiesToZero.has(cookie.name) && cookie.value !== "0")) {
        touched++;
      }
      await enforcePolicyOnCookie(cookie);
    }
  }
  console.log("[shield] sweep done —", touched, "cookies touched");
}

console.log("[shield] background loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("[shield] onInstalled fired");
  sweepAllDomains();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[shield] onStartup fired");
  sweepAllDomains();
});

sweepAllDomains();

chrome.cookies.onChanged.addListener(async ({ cookie, removed, cause }) => {
  if (!isTargetDomain(cookie.domain)) return;

  if (recentlySetByUs.has(eventKey(cookie, removed ? "remove" : "set"))) return;

  if (cookiesToDelete.has(cookie.name)) {
    if (!removed) await deleteCookie(cookie);
    return;
  }

  if (cookiesToZero.has(cookie.name)) {
    if (removed) return;
    if (cookie.value !== "0") await setCookieToZero(cookie);
  }
});
