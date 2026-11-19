/**
 * PriceAnchor storefront renderer (theme app extension asset).
 * Market-adaptive, dependency-free, no network calls; no shopper data
 * leaves the browser.
 *
 * EU mode (default): renders the statutory lowest-price line from the
 * app-owned metafield JSON embedded in data-prior, composed with the
 * theme-locale sentence parts in data-l10n-prefix / data-l10n-infix.
 * % off mirrors the server discountFromPrior algorithm (Aldi rule): it is
 * computed from the 30-day prior price, never from the live compare-at.
 *
 * US mode (data-country="US"): renders §17501-safe former-price framing
 * from data-former — "Previously $98.00 — last offered Oct 2026".
 */
(function () {
  "use strict";

  function parsePayload(raw) {
    if (!raw) return null;
    try {
      var value = JSON.parse(raw);
      if (!value || typeof value.lowestMinor !== "number") return null;
      return value;
    } catch {
      return null;
    }
  }

  function formatMoney(minor, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(minor / 100);
    } catch {
      return (minor / 100).toFixed(2) + " " + (currency || "");
    }
  }

  function formatMonthYear(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(d);
    } catch {
      return null;
    }
  }

  function percentOff(currentMinor, priorMinor) {
    if (
      !priorMinor ||
      priorMinor <= 0 ||
      !currentMinor ||
      currentMinor >= priorMinor
    ) {
      return null;
    }
    return Math.round(((priorMinor - currentMinor) / priorMinor) * 1000) / 10;
  }

  function hide(root) {
    root.setAttribute("data-priceanchor-state", "missing");
  }

  function renderUS(root, line, former, currentMinor, currency) {
    if (!former || currentMinor >= former.lowestMinor) {
      hide(root);
      return;
    }
    var text =
      "Previously " + formatMoney(former.lowestMinor, former.currency || currency);
    var offered = formatMonthYear(former.lastOfferedAt);
    if (offered) text += " \u2014 last offered " + offered;
    line.textContent = text;
    root.setAttribute("data-priceanchor-state", "ready");
  }

  function renderEU(root, line, prior, currentMinor, currency, showPercent, l10nPrefix, l10nInfix) {
    if (!prior || currentMinor >= prior.lowestMinor) {
      // No reduction vs the prior price: nothing to disclose.
      hide(root);
      return;
    }
    var prefix = l10nPrefix || "Lowest price in the last";
    var infix = l10nInfix || "days";
    var text =
      prefix +
      " " +
      (prior.windowDays || 30) +
      " " +
      infix +
      ": " +
      formatMoney(prior.lowestMinor, prior.currency || currency);
    if (showPercent) {
      var pct = percentOff(currentMinor, prior.lowestMinor);
      if (pct !== null) text += " (\u2212" + pct + "%)";
    }
    line.textContent = text;
    root.setAttribute("data-priceanchor-state", "ready");
  }

  function render(root) {
    var line = root.querySelector("[data-priceanchor-line]");
    var currentMinor = Number(root.getAttribute("data-price-minor"));
    if (!line || !Number.isFinite(currentMinor)) {
      hide(root);
      return;
    }
    var currency = root.getAttribute("data-currency") || "USD";
    var isUS =
      String(root.getAttribute("data-country") || "").toUpperCase() === "US";
    if (isUS) {
      renderUS(root, line, parsePayload(root.getAttribute("data-former")), currentMinor, currency);
      return;
    }
    renderEU(
      root,
      line,
      parsePayload(root.getAttribute("data-prior")),
      currentMinor,
      currency,
      root.getAttribute("data-show-percent") !== "false",
      root.getAttribute("data-l10n-prefix"),
      root.getAttribute("data-l10n-infix"),
    );
  }

  function init() {
    var roots = document.querySelectorAll("[data-priceanchor]");
    for (var i = 0; i < roots.length; i += 1) render(roots[i]);
  }

  if (typeof document === "undefined") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-render on variant change (OS 2.0 themes re-render the product form).
  document.addEventListener("priceanchor:variant", function (event) {
    var detail = event.detail || {};
    var roots = document.querySelectorAll("[data-priceanchor]");
    for (var i = 0; i < roots.length; i += 1) {
      if (detail.priceMinor !== undefined) {
        roots[i].setAttribute("data-price-minor", String(detail.priceMinor));
      }
      render(roots[i]);
    }
  });
})();
