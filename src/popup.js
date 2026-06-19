const statusEl = document.getElementById("status");
const btn = document.getElementById("refresh");

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

async function refresh(tab, regDomain) {
  const cookieExactNames = [
    ...SHIELD_CONFIG.cookiesToZero,
    ...SHIELD_CONFIG.cookiesToDelete,
    ...SHIELD_CONFIG.consentStateCookies,
  ];
  const cookiePrefixes = SHIELD_CONFIG.cookiePrefixesToDelete;

  const cookies = await chrome.cookies.getAll({ domain: regDomain });
  for (const c of cookies) {
    if (!shieldKeyMatches(c.name, cookieExactNames, cookiePrefixes)) continue;
    const details = {
      url: `https://${c.domain.replace(/^\./, "")}${c.path || "/"}`,
      name: c.name,
    };
    if (c.storeId) details.storeId = c.storeId;
    if (c.firstPartyDomain !== undefined && c.firstPartyDomain !== "") {
      details.firstPartyDomain = c.firstPartyDomain;
    }
    if (c.partitionKey) details.partitionKey = c.partitionKey;
    try {
      await chrome.cookies.remove(details);
    } catch (e) {
      console.warn("[shield] cookie remove failed for", c.name, "—", e?.message || e);
    }
  }

  const localStorageExactNames = [
    ...SHIELD_CONFIG.localStorageToZero,
    ...SHIELD_CONFIG.localStorageToDelete,
    ...SHIELD_CONFIG.sessionStorageToDelete,
  ];

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    args: [
      localStorageExactNames,
      SHIELD_CONFIG.localStoragePrefixesToDelete,
      SHIELD_CONFIG.sessionStorageToDelete,
      SHIELD_CONFIG.sessionStoragePrefixesToDelete,
    ],
    func: (lsExact, lsPrefixes, ssExact, ssPrefixes) => {
      const matches = (name, exact, prefixes) =>
        exact.indexOf(name) !== -1 || prefixes.some((p) => name.indexOf(p) === 0);
      const clearStore = (store, label, exact, prefixes) => {
        try {
          for (const key of Object.keys(store)) {
            if (matches(key, exact, prefixes)) store.removeItem(key);
          }
        } catch (e) {
          console.warn("[shield/cs]", label, "clear failed —", e?.message || e);
        }
      };
      clearStore(localStorage, "localStorage", lsExact, lsPrefixes);
      clearStore(sessionStorage, "sessionStorage", ssExact, ssPrefixes);
    },
  });

  await chrome.tabs.reload(tab.id);
  window.close();
}

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.url) {
    setStatus("Ingen aktiv fane", "inactive");
    return;
  }
  let host;
  try {
    host = new URL(tab.url).hostname;
  } catch (e) {
    console.warn("[shield] could not parse tab URL —", e?.message || e);
    setStatus("Ikke en nettside", "inactive");
    return;
  }
  const regDomain = shieldRegisteredDomain(host);
  if (!regDomain) {
    setStatus(`Ikke aktiv på ${host}`, "inactive");
    return;
  }
  setStatus(`Aktiv på ${host}`, "active");
  btn.disabled = false;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Oppdaterer…";
    try {
      await refresh(tab, regDomain);
    } catch (e) {
      console.error(e);
      btn.textContent = "Oppdater";
      btn.disabled = false;
      setStatus("Feil — se konsollen", "error");
    }
  });
}

init();
