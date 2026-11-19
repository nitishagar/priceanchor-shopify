/* Live demo wiring — drives the vendored storefront engine, nothing else. */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function toMinor(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function render() {
    var block = $("demo-block");
    var priceMinor = toMinor($("d-price").value);
    var priorMinor = toMinor($("d-prior").value);
    var market = $("d-market") ? $("d-market").value : "DE";
    if (!block || priceMinor === null || priorMinor === null) return;
    block.setAttribute(
      "data-prior",
      JSON.stringify({
        lowestMinor: priorMinor,
        currency: "EUR",
        capturedAt: "2026-11-10T10:00:00.000Z",
        windowDays: 30,
      }),
    );
    block.setAttribute(
      "data-former",
      JSON.stringify({
        lowestMinor: priorMinor,
        currency: "EUR",
        lastOfferedAt: "2026-10-04T10:00:00.000Z",
        windowDays: 90,
      }),
    );
    block.setAttribute("data-country", market);
    document.dispatchEvent(
      new CustomEvent("priceanchor:variant", {
        detail: { priceMinor: priceMinor },
      }),
    );
  }

  ["d-price", "d-prior"].forEach(function (id) {
    $(id).addEventListener("input", render);
    $(id).addEventListener("change", render);
  });
  if ($("d-market")) $("d-market").addEventListener("change", render);
  render();

  var toggle = $("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var root = document.documentElement;
      var next =
        root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      toggle.textContent = next === "dark" ? "light" : "dark";
    });
  }
})();
