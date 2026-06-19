# Schibsted Personvernskjold

Liten nettleserutvidelse som automatisk avviser personalisering og
sporing på Schibsted-eide nettsteder uten å gå gjennom betalingsmuren
bak «Avvis personlig tilpassede annonser».

## Hva den gjør

- Injiserer et ferskt «alt avvist»-samtykke i Sourcepoint hver gang
  siden lastes, så banneret aldri vises.
- Nuller ut `_cmp_*` cookies og `CMP:*` localStorage.
- Sletter Pulse-sporingscookies og A/B-bøtter (`_pulse2data`,
  `_pulsesession`, `clientBucket`, `abTestId`, m.fl.).
- Overstyrer tidligere «godta»-valg om du har klikket feil før.
- Gjør alt lokalt i nettleseren. Ingen nettverkskall, ingen telemetri.

## Debug-script for Sourcepoint

Dette skriptet henter og viser relevantt informasjon om Sourcepoint-konfigurasjonen på siden, som eiendoms-ID, meldings-ID og consentdata. Nyttig for feilsøking og utvikling.
```js
(()=>{const k=Object.keys(localStorage).find(k=>/^_sp_user_consent_\d+$/.test(k));const ls=JSON.parse(localStorage._sp_local_state||"{}");const nk=JSON.parse(localStorage._sp_non_keyed_local_state||"{}");console.log(JSON.stringify({domain:location.hostname,propertyId:k&&Number(k.match(/\d+$/)[0]),messageId:ls?.gdpr?.messageId,v1Data:nk?.gdpr?._sp_v1_data,v1P:nk?.gdpr?._sp_v1_p,ssCookie:(ls?.gdpr?.mmsCookies||[])[0]},null,2))})()
```

## Lisens

Se `LICENSE`. Bruk, kopier og endre fritt.
