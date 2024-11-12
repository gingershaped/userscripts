// ==UserScript==
// @name              Stack Roulette
// @namespace         http://ginger.rto.community/
// @version           1.0
// @description       Confusion abounds
// @author            Ginger
// @updateURL         https://github.com/gingershaped/userscripts/raw/main/stack-roulette.user.js
// @downloadURL       https://github.com/gingershaped/userscripts/raw/main/stack-roulette.user.js
// @match             https://chat.stackexchange.com/*
// @match             https://chat.stackoverflow.com/*
// @match             https://chat.meta.stackexchange.com/*
// @grant             none
// ==/UserScript==

(() => {
    const VALID_HOSTS = [
        "academia.stackexchange.com",
        "android.stackexchange.com",
        "anime.stackexchange.com",
        "gaming.stackexchange.com",
        "apple.stackexchange.com",
        "patents.stackexchange.com",
        "askubuntu.com",
        "aviation.stackexchange.com",
        "bicycles.stackexchange.com",
        "biology.stackexchange.com",
        "blender.stackexchange.com",
        "chemistry.stackexchange.com",
        "christianity.stackexchange.com",
        "codegolf.stackexchange.com",
        "codereview.stackexchange.com",
        "cs.stackexchange.com",
        "stats.stackexchange.com",
        "crypto.stackexchange.com",
        "dba.stackexchange.com",
        "drupal.stackexchange.com",
        "electronics.stackexchange.com",
        "emacs.stackexchange.com",
        "english.stackexchange.com",
        "ell.stackexchange.com",
        "expressionengine.stackexchange.com",
        "gamedev.stackexchange.com",
        "gis.stackexchange.com",
        "graphicdesign.stackexchange.com",
        "diy.stackexchange.com",
        "security.stackexchange.com",
        "japanese.stackexchange.com",
        "magento.stackexchange.com",
        "mathematica.stackexchange.com",
        "math.stackexchange.com",
        "mathoverflow.net",
        "meta.stackexchange.com",
        "judaism.stackexchange.com",
        "movies.stackexchange.com",
        "music.stackexchange.com",
        "networkengineering.stackexchange.com",
        "money.stackexchange.com",
        "photo.stackexchange.com",
        "physics.stackexchange.com",
        "puzzling.stackexchange.com",
        "raspberrypi.stackexchange.com",
        "rpg.stackexchange.com",
        "salesforce.stackexchange.com",
        "scifi.stackexchange.com",
        "cooking.stackexchange.com",
        "serverfault.com",
        "sharepoint.stackexchange.com",
        "dsp.stackexchange.com",
        "skeptics.stackexchange.com",
        "softwareengineering.stackexchange.com",
        "softwarerecs.stackexchange.com",
        "stackapps.com",
        "stackoverflow.com",
        "superuser.com",
        "tex.stackexchange.com",
        "workplace.stackexchange.com",
        "cstheory.stackexchange.com",
        "travel.stackexchange.com",
        "unix.stackexchange.com",
        "ux.stackexchange.com",
        "webapps.stackexchange.com",
        "webmasters.stackexchange.com",
        "wordpress.stackexchange.com",
        "worldbuilding.stackexchange.com",
        "stackexchange.com",
    ];

    const host = VALID_HOSTS[Math.floor(Math.random() * VALID_HOSTS.length)];
    console.log("Selected host:", host);
    document.head.querySelectorAll("link[rel='stylesheet']").forEach((sheet) => {
        const path = new URL(sheet.href).pathname;
        if (path != "/chat/css/chat.stackexchange.com.css" && path.startsWith("/chat/css/chat.")) {
            sheet.href = `//cdn-chat.sstatic.net/chat/css/chat.${host}.css`;
        }
    })
})();