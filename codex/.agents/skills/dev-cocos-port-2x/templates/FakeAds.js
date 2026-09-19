// FakeAds.js (Cocos Creator 2.4.x) — every ad completes, reward always granted.
//
// Why: a local build has no ad inventory. The original SDK call either 404s or
// never fires its close callback, so "watch ad -> get reward" dies there.
//
// Setup: copy <mirror>/api-mock/client/fake-ads-client.js into
// assets/Script/vendor/, then replace every original ad call with FakeAds.

require("fake-ads-client"); // side effect: defines window.FakeAds

var FakeAds = {
    // Returns a Promise<boolean>. true = watched to the end, grant the reward.
    showRewarded: function (placement) {
        return window.FakeAds.showRewarded(placement || "default");
    },

    showInterstitial: function (placement) {
        return window.FakeAds.showInterstitial(placement || "default");
    },

    isReady: function () {
        return true;
    },

    // Callback form, for original code shaped like sdk.showAd(onDone).
    showRewardedCb: function (onDone) {
        this.showRewarded().then(function (granted) {
            if (onDone) onDone(granted);
        });
    },
};

module.exports = FakeAds;

// Porting pattern — keep the reward branch, drop the failure branch:
//
//   // before (original SDK)
//   sdk.rewardVideo({ onClose: function (res) { if (res.isEnded) grant(); } });
//
//   // after
//   FakeAds.showRewarded("double_coin").then(function () { grant(); });
