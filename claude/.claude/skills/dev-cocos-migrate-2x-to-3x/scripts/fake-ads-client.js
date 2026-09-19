/* fake-ads-client.js — grants every rewarded/interstitial ad instantly.
 *
 * A local research mirror has no ad inventory: the real SDK either 404s or hangs
 * on a promise, and the reward flow dies with it. This replaces the ad surface
 * so "watch ad -> get reward" always completes, offline, with no network call.
 *
 * Used by serve-local.py --fake-ads and by ported projects (call
 * window.__installFakeAds() before the first scene).
 *
 * Covers: WeChat/Douyin minigame ads, GameDistribution, Poki, CrazyGames,
 * Google H5 adBreak, plus a generic FakeAds facade for hand-written calls.
 */
(function (global) {
  var LOG = (global.__fakeAdsLog = []);
  var installed = false;
  var DELAY = 0;

  function log(kind, detail) {
    var row = { t: Date.now(), kind: kind, detail: detail || null };
    LOG.push(row);
    console.log("[fake-ads]", kind, detail || "");
    return row;
  }

  function later(fn) {
    setTimeout(fn, DELAY);
  }

  /* Reward granted. Keys cover the payload shapes the covered SDKs check. */
  function rewardResult() {
    return { isEnded: true, errCode: 0, errMsg: "ok", code: 0, rewarded: true, watched: true };
  }

  // --------------------------------------------- minigame-style ad objects --
  function makeAdObject(kind) {
    var closeHandlers = [];
    var loadHandlers = [];
    var ad = {
      load: function () { later(fireLoad); return Promise.resolve(); },
      show: function () {
        log(kind + ".show");
        later(function () {
          for (var i = 0; i < closeHandlers.length; i++) closeHandlers[i](rewardResult());
        });
        return Promise.resolve();
      },
      hide: function () { return Promise.resolve(); },
      destroy: function () { closeHandlers = []; loadHandlers = []; },
      onClose: function (fn) { if (typeof fn === "function") closeHandlers.push(fn); },
      offClose: function (fn) {
        closeHandlers = closeHandlers.filter(function (h) { return h !== fn; });
      },
      onLoad: function (fn) { if (typeof fn === "function") loadHandlers.push(fn); },
      offLoad: function () { loadHandlers = []; },
      onError: function () {},
      offError: function () {},
      style: { left: 0, top: 0, width: 0, height: 0, realWidth: 0, realHeight: 0 },
    };
    function fireLoad() {
      for (var i = 0; i < loadHandlers.length; i++) loadHandlers[i]();
    }
    later(fireLoad);
    return ad;
  }

  function patchMinigame(name) {
    var sdk = global[name];
    if (!sdk) return;
    sdk.createRewardedVideoAd = function () { log(name + ".createRewardedVideoAd"); return makeAdObject("rewardedVideo"); };
    sdk.createInterstitialAd = function () { log(name + ".createInterstitialAd"); return makeAdObject("interstitial"); };
    sdk.createBannerAd = function () { log(name + ".createBannerAd"); return makeAdObject("banner"); };
  }

  // --------------------------------------------------------- portal SDKs ---
  function patchGameDistribution() {
    var sdk = global.gdsdk || {};
    sdk.showAd = function (type) { log("gdsdk.showAd", type); return Promise.resolve(rewardResult()); };
    sdk.preloadAd = function () { return Promise.resolve(); };
    sdk.openConsole = sdk.openConsole || function () {};
    global.gdsdk = sdk;
  }

  function patchPoki() {
    var sdk = global.PokiSDK || {};
    sdk.init = function () { return Promise.resolve(); };
    sdk.gameLoadingStart = sdk.gameLoadingFinished = function () {};
    sdk.gameplayStart = sdk.gameplayStop = function () {};
    // Poki resolves a boolean: true means the reward was earned.
    sdk.rewardedBreak = function () { log("PokiSDK.rewardedBreak"); return Promise.resolve(true); };
    sdk.commercialBreak = function () { log("PokiSDK.commercialBreak"); return Promise.resolve(); };
    sdk.displayAd = function () { return Promise.resolve(); };
    global.PokiSDK = sdk;
  }

  function patchCrazyGames() {
    var cg = global.CrazyGames || {};
    var sdk = cg.SDK || {};
    sdk.ad = {
      requestAd: function (type, callbacks) {
        log("CrazyGames.ad.requestAd", type);
        callbacks = callbacks || {};
        later(function () {
          if (typeof callbacks.adStarted === "function") callbacks.adStarted();
          if (typeof callbacks.adFinished === "function") callbacks.adFinished();
        });
      },
      hasAdblock: function () { return Promise.resolve(false); },
    };
    sdk.game = sdk.game || { gameplayStart: function () {}, gameplayStop: function () {} };
    sdk.init = function () { return Promise.resolve(); };
    cg.SDK = sdk;
    global.CrazyGames = cg;
  }

  function patchH5AdBreak() {
    // Google H5 Games Ads: adBreak({ type, beforeAd, afterAd, adBreakDone }).
    global.adConfig = function () {};
    global.adBreak = function (options) {
      options = options || {};
      log("adBreak", options.type || options.name);
      later(function () {
        if (typeof options.beforeAd === "function") options.beforeAd();
        if (typeof options.adViewed === "function") options.adViewed();
        if (typeof options.afterAd === "function") options.afterAd();
        if (typeof options.adBreakDone === "function") {
          options.adBreakDone({ breakType: options.type, breakName: options.name, breakStatus: "viewed" });
        }
      });
    };
    global.adsbygoogle = global.adsbygoogle || [];
  }

  function install(options) {
    if (installed) return global.__fakeAdsReport;
    installed = true;
    DELAY = (options && options.delayMs) || 0;

    ["wx", "tt", "swan", "qq", "qg"].forEach(patchMinigame);
    patchGameDistribution();
    patchPoki();
    patchCrazyGames();
    patchH5AdBreak();

    /* Neutral facade: ported code calls this instead of any vendor SDK.
       Keep the same name in the 2.x and 3.x projects so ad code stays portable. */
    global.FakeAds = {
      showRewarded: function (placement) {
        log("FakeAds.showRewarded", placement);
        return new Promise(function (resolve) { later(function () { resolve(true); }); });
      },
      showInterstitial: function (placement) {
        log("FakeAds.showInterstitial", placement);
        return new Promise(function (resolve) { later(function () { resolve(true); }); });
      },
      isReady: function () { return true; },
    };

    global.__fakeAdsReport = function () {
      console.table(LOG);
      return LOG;
    };
    console.log("[fake-ads] ready — every ad resolves as watched. Call __fakeAdsReport().");
    return global.__fakeAdsReport;
  }

  global.__installFakeAds = install;
  if (global.__FAKE_ADS_AUTO__ !== false) install(global.__FAKE_ADS__ || {});
})(typeof window !== "undefined" ? window : globalThis);
