// ==UserScript==
// @name        Stack Exchange Pronoun Assistant Reloaded
// @namespace   https://github.com/gingershaped/
// @description Displays users' pronouns (mentioned in their profiles)
// @author      Ginger
// @author      Glorfindel
// @author      ArtOfCode
// @version     1.8
// @updateURL   https://github.com/gingershaped/userscripts/raw/main/pronouns2.user.js
// @downloadURL https://github.com/gingershaped/userscripts/raw/main/pronouns2.user.js
// @match       *://chat.stackexchange.com/rooms/*
// @match       *://chat.stackoverflow.com/rooms/*
// @match       *://chat.meta.stackexchange.com/rooms/*
// @match       *://chat.stackexchange.com/transcript/*
// @match       *://chat.stackoverflow.com/transcript/*
// @match       *://chat.meta.stackexchange.com/transcript/*
// @match       *://chat.stackexchange.com/users/*?tab=prefs
// @match       *://chat.stackoverflow.com/users/*?tab=prefs
// @match       *://chat.meta.stackexchange.com/users/*?tab=prefs
// @match       *://*.stackexchange.com/questions/*
// @match       *://*.stackoverflow.com/questions/*
// @match       *://*.superuser.com/questions/*
// @match       *://*.serverfault.com/questions/*
// @match       *://*.askubuntu.com/questions/*
// @match       *://*.stackapps.com/questions/*
// @match       *://*.mathoverflow.net/questions/*
// @match       *://*.stackexchange.com/users/preferences/*
// @match       *://*.stackoverflow.com/users/preferences/*
// @match       *://*.superuser.com/users/preferences/*
// @match       *://*.serverfault.com/users/preferences/*
// @match       *://*.askubuntu.com/users/preferences/*
// @match       *://*.stackapps.com/users/preferences/*
// @match       *://*.mathoverflow.net/users/preferences/*
// @exclude     *://*.stackexchange.com/questions/ask
// @exclude     *://*.stackoverflow.com/questions/ask
// @exclude     *://*.superuser.com/questions/ask
// @exclude     *://*.serverfault.com/questions/ask
// @exclude     *://*.askubuntu.com/questions/ask
// @exclude     *://*.stackapps.com/questions/ask
// @exclude     *://*.mathoverflow.net/questions/ask
// @grant       GM_addStyle
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @run-at document-body
// ==/UserScript==

(() => {
    GM_addStyle(`
    .tiny-signature {
        display: inline-flex;
        flex-direction: row-reverse;
        align-items: center;
        width: 100%;
    }
    .username {
        height: unset !important;
    }
    .pronouns, .pronouns a {
        color: #777;
    }
    .pronouns {
        word-break: keep-all;
    }
    .pronouns a:hover {
        text-decoration: underline;
    }
    .username.bot {
        font-family: monospace;
    }
    .username.bot::before {
        content: "⚙";
        margin-right: 2px;
    }
    `);

    const USER_URL_REGEX = /\/users\/(-?\d+)/;
    const QA_SELECTOR = "div.user-details > a, a.comment-user";
    const CACHE_EXPIRY_SECS = 60 * 60 * 24;
    const CACHED_PRONOUNS_LIST_KEY = "pronouns/cachedPronounsList";
    const CACHED_PRONOUNS_KEY = "pronouns/cachedPronouns";
    const CACHE_VERSION = 1;
    const BLACKLISTED = [
        578513, // The_AH
        540406, // The Empty String Photographer
    ]
    const BOT_MANIFEST = fetch("https://raw.githubusercontent.com/gingershaped/userscripts/main/bots.json").then((r) => r.json());

    class PronounCache {
        #map = new Map();

        static #loadCache() {
            let cache = JSON.parse(localStorage.getItem(CACHED_PRONOUNS_KEY) ?? "null");
            if (cache == null || cache.version != CACHE_VERSION) {
                cache = { version: CACHE_VERSION, data: {} };
            }
            return cache;
        }

        constructor() {
            for (const [userId, [pronoun, cachedAt]] of Object.entries(PronounCache.#loadCache().data)) {
                if ((Date.now() - cachedAt) / 1000 <= CACHE_EXPIRY_SECS) {
                    this.#map.set(Number.parseInt(userId), pronoun);
                }
            }
        }

        set(userId, pronoun) {
            this.#map.set(userId, pronoun);
            const cache = PronounCache.#loadCache();
            cache.data[userId] = [pronoun, Date.now()];
            localStorage.setItem(CACHED_PRONOUNS_KEY, JSON.stringify(cache));
        }
        get(userId) {
            return this.#map.get(userId);
        }
        has(userId) {
            return this.#map.has(userId);
        }
    }

    const cachedPronouns = new PronounCache();

    const DEFAULT_PRONOUNS = [
        { morphemes: {"pronoun_subject":"he","pronoun_object":"him","possessive_determiner":"his","possessive_pronoun":"his","reflexive":"himself"} },
        { morphemes: {"pronoun_subject":"she","pronoun_object":"her","possessive_determiner":"her","possessive_pronoun":"hers","reflexive":"herself"} },
        { morphemes: {"pronoun_subject":"they","pronoun_object":"them","possessive_determiner":"their","possessive_pronoun":"theirs","reflexive":"themself"} }
    ];
    const pronouns = new Promise((resolve) => {
        const cachedPronounsList = JSON.parse(localStorage.getItem(CACHED_PRONOUNS_LIST_KEY) ?? "null");
        if (cachedPronounsList == null || (Date.now() - cachedPronounsList.cachedAt) / 1000 > CACHE_EXPIRY_SECS) {
            fetch("https://en.pronouns.page/api/pronouns").then((r) => r.json()).then(Object.values).then((data) => {
                localStorage.setItem(CACHED_PRONOUNS_LIST_KEY, JSON.stringify({ cachedAt: Date.now(), data }));
                resolve(data);
            });
        } else {
            resolve(cachedPronounsList.data);
        }
    });
    const pronounsListRegex = pronouns.then((data) => {
        const parts = [...new Set(data.concat(DEFAULT_PRONOUNS).flatMap(({ morphemes }) => [morphemes.pronoun_subject, morphemes.pronoun_object]))].join("|");
        return new RegExp(String.raw`\b((${parts})(\s*/\s*(${parts}))+)\b`, "i");
    });
    const explicitPronounsRegex = /pronouns:\s*([^.\n)\]}<]*)(\.|\n|\)|]|}|<|$)/im;
    const pronounsSiteRegex = /https?:\/\/(?<site>en\.pronouns\.page|pronouns.cc)\/@(?<user>\w+)/i;
    const pronounIslandRegex = /https?:\/\/((my\.)?pronoun\.is|pronouns\.alysbrooks\.com)\/(?<pronouns>[\w/]+)/i;

    function clearCaches(event) {
        if (event.ctrlKey && event.altKey && event.shiftKey) {
            event.preventDefault();
            if (confirm("Clear pronoun cache?")) {
                localStorage.removeItem(CACHED_PRONOUNS_LIST_KEY);
                localStorage.removeItem(CACHED_PRONOUNS_KEY);
                window.location.reload();
            }
        }
    }

    async function findPronouns(bio) {
        const explicitPronouns = explicitPronounsRegex.exec(bio);
        if (explicitPronouns != null && explicitPronouns[1].length > 0) {
            return explicitPronouns[1];
        }

        const pronounsSiteLink = pronounsSiteRegex.exec(bio);
        if (pronounsSiteLink != null) {
            const { site, user } = pronounsSiteLink.groups;
            let fullPronouns;
            if (site == "en.pronouns.page") {
                fullPronouns = await fetch(`https://en.pronouns.page/api/profile/get/${user}?version=2&props=pronouns`)
                    .then((r) => r.json())
                    .then(({ profiles }) => profiles.en?.pronouns?.find(({ opinion }) => opinion == "yes")?.value);
            } else if (site == "pronouns.cc") {
                fullPronouns = await fetch(`https://pronouns.cc/api/v1/users/${user}`)
                    .then((r) => r.json())
                    .then(({ pronouns }) => pronouns.find(({ opinion }) => opinion == "favourite" || opinion == "yes")?.pronouns);
            }
            if (fullPronouns != null) {
                const shortPronouns = await fetch(`https://en.pronouns.page/api/pronouns/${fullPronouns}`)
                    .then((r) => r.json())
                    .then((r) => r?.name);
                if (shortPronouns != null) {
                    return shortPronouns;
                }
            }
        }

        const pronounIslandLink = pronounIslandRegex.exec(bio);
        if (pronounIslandLink != null) {
            const shortPronouns = await fetch(`https://en.pronouns.page/api/pronouns/${pronounIslandLink.groups.pronouns}`)
                .then((r) => r.json())
                .then((r) => r?.name);
            if (shortPronouns != null) {
                return shortPronouns;
            }
        }

        const pronounsList = (await pronounsListRegex).exec(bio);
        if (pronounsList != null) {
            return pronounsList[1];
        }

        return null;
    }

    function createChatPronounsElement(monologue, pronouns) {
        function create() {
            for (const usernameContainer of monologue.querySelectorAll(".username")) {
                const pronounsSpan = document.createElement("span");
                pronounsSpan.classList.add("pronouns");
                pronounsSpan.innerText = pronouns;
                pronounsSpan.addEventListener("click", clearCaches);
                usernameContainer.appendChild(document.createElement("br"));
                usernameContainer.appendChild(pronounsSpan);
            }
        }
        new MutationObserver((mutations, observer) => {
            if (!monologue.querySelector(".pronouns")) {
                create();
            }
        }).observe(monologue, { childList: true, subtree: true });
        create();
    }

    function createQAPronounsElement(element, pronouns) {
        if (element.classList.contains("comment-user")) {
            element = element.parentElement;
        }
        while (true) {
            const next = element.nextElementSibling;
            if (!next.classList.contains("mod-flair") && !next.classList.contains("s-badge")) {
                break;
            }
            element = next;
        }
        const pronounsSpan = document.createElement("span");
        pronounsSpan.classList.add("pronouns");
        pronounsSpan.innerText = pronouns;
        pronounsSpan.addEventListener("click", clearCaches);
        element.after(" ", pronounsSpan);
    }

    function extractUserIdFromMonologue(monologue) {
        return Number.parseInt([...monologue.classList.values()].find((v) => /user--?\d+/.test(v)).substring(5));
    }

    function extractParentSiteIdFromThumb(thumb) {
        return Number.parseInt(USER_URL_REGEX.exec(thumb.profileUrl)[1]);
    }

    async function fetchQAPronouns(site, userIds) {
        const pronounsMap = new Map();
        for (let i = 0; i < userIds.length; i += 100) {
            const chunk = userIds.slice(i, i + 100);
            await fetch(`https://api.stackexchange.com/2.3/users/${chunk.join(";")}?order=desc&sort=reputation&pagesize=100&site=${site}&filter=!*VDmGxAPXut*IhJkwuUQNzIg5A`)
                .then((r) => { if (r.ok) return r.json(); else throw new Error("Failed to perform SE API query") })
                .then(async ({ items, backoff }) => {
                    for (const user of items) {
                        const pronouns = await findPronouns(user.about_me);
                        if (pronouns != null) {
                            pronounsMap.set(user.user_id, [pronouns, user.display_name]);
                        }
                    }
                    if (backoff) {
                        // Respect rate limits, not just pronouns.
                        await new Promise((resolve) => setTimeout(resolve, backoff * 1000));
                    }
                }, (error) => {
                    console.error(error);
                });
        }
        return pronounsMap;
    }

    async function processChatTranscript() {
        const userMonologues = new Map();
        for (const monologue of document.getElementsByClassName("monologue")) {
            const userId = extractUserIdFromMonologue(monologue);
            if (userId < 0) {
                continue;
            }
            if (!userMonologues.has(userId)) {
                userMonologues.set(userId, []);
            }
            userMonologues.get(userId).push(monologue);
        }
        const userMonologuesBySite = new Map();
        await Promise.all([...userMonologues.entries()].map(async ([userId, monologues]) => {
            if (BLACKLISTED.includes(userId)) {
                return;
            }
            if (cachedPronouns.has(userId)) {
                const pronouns = cachedPronouns.get(userId);
                if (pronouns != null) {
                    console.log(`Pronouns for ${userId}: ${pronouns} (from cache)`);
                    for (const monologue of monologues) {
                        createChatPronounsElement(monologue, pronouns);
                    }
                }
            } else {
                await fetch(`/users/thumbs/${userId}`).then((r) => r.json()).then(async (thumb) => {
                    const pronouns = await findPronouns(thumb.user_message);
                    if (pronouns != null) {
                        console.log(`Pronouns for ${thumb.name}: ${pronouns} (from chat bio)`);
                        cachedPronouns.set(userId, pronouns);
                        for (const monologue of monologues) {
                            createChatPronounsElement(monologue, pronouns);
                        }
                    } else {
                        const parentSiteId = extractParentSiteIdFromThumb(thumb);
                        if (!userMonologuesBySite.has(thumb.host)) {
                            userMonologuesBySite.set(thumb.host, new Map());
                        }
                        userMonologuesBySite.get(thumb.host).set(userId, [parentSiteId, thumb.name, monologues]);
                    }
                });

            }
        }));
        await Promise.all([...userMonologuesBySite.entries()].map(async ([site, map]) => {
            const pronounsMap = await fetchQAPronouns(site, [...map.values()].map(([parentSiteId, name, monologues]) => parentSiteId));
            for (const [userId, [parentSiteId, name, monologues]] of map.entries()) {
                if (pronounsMap.has(parentSiteId)) {
                    const pronouns = pronounsMap.get(parentSiteId)[0];
                    console.log(`Pronouns for ${name}: ${pronouns} (from parent site)`);
                    cachedPronouns.set(userId, pronouns);
                    for (const monologue of monologues) {
                        createChatPronounsElement(monologue, pronouns);
                    }
                } else {
                    cachedPronouns.set(userId, null);
                }
            }
        }));
    }

    async function chatInit() {
        await processChatTranscript();
        new MutationObserver(async (mutations) => {
            for (const monologue of mutations.flatMap((mutation) => [...mutation.addedNodes]).filter((node) => node.classList.contains("monologue"))) {
                const userId = extractUserIdFromMonologue(monologue);
                if (userId < 0 || BLACKLISTED.includes(userId)) {
                    return;
                }
                if (cachedPronouns.has(userId)) {
                    if (cachedPronouns.get(userId) != null) {
                        console.log(`Pronouns for ${userId}: ${cachedPronouns.get(userId)} (cached)`);
                        createChatPronounsElement(monologue, cachedPronouns.get(userId));
                    }
                } else {
                    const thumb = await fetch(`/users/thumbs/${userId}`).then((r) => r.json());
                    const pronouns = await findPronouns(thumb.user_message);
                    if (pronouns != null) {
                        cachedPronouns.set(userId, pronouns);
                        console.log(`Pronouns for ${thumb.name}: ${pronouns} (from chat bio)`);
                        createChatPronounsElement(monologue, pronouns);
                    } else {
                        const parentSiteId = extractParentSiteIdFromThumb(thumb);
                        const pronouns = await fetchQAPronouns(thumb.host, [parentSiteId]).then((map) => map.get(parentSiteId)?.[0])
                        if (pronouns != null) {
                            cachedPronouns.set(userId, pronouns);
                            console.log(`Pronouns for ${thumb.name}: ${pronouns} (from parent site)`);
                            createChatPronounsElement(monologue, pronouns);
                        } else {
                            cachedPronouns.set(userId, null);
                        }
                    }
                }
            }
        }).observe(document.getElementById("chat"), { childList: true });
    }

    async function qaInit() {
        const userElements = new Map();
        for (const element of document.querySelectorAll(QA_SELECTOR)) {
            const link = new URL(element.href);
            if (!link.pathname.startsWith("/users/")) {
                continue;
            }
            const userId = Number.parseInt(USER_URL_REGEX.exec(link.pathname)[1]);
            if (userId < 1 || BLACKLISTED.includes(userId)) {
                continue;
            }
            if (cachedPronouns.has(userId)) {
                if (cachedPronouns.get(userId) != null) {
                    console.log(`Pronouns for ${userId}: ${cachedPronouns.get(userId)} (cached)`);
                    createQAPronounsElement(element, cachedPronouns.get(userId));
                }
                continue;
            }
            if (!userElements.has(userId)) {
                userElements.set(userId, []);
            }
            userElements.get(userId).push(element);
        }

        const qaPronouns = await fetchQAPronouns(location.host, [...userElements.keys()]);
        for (const [userId, elements] of userElements.entries()) {
            if (qaPronouns.has(userId)) {
                const [pronouns, name] = qaPronouns.get(userId);
                cachedPronouns.set(userId, pronouns);
                console.log(`Pronouns for ${name}: ${pronouns}`);
                for (const element of elements) {
                    createQAPronounsElement(element, pronouns);
                }
            } else {
                cachedPronouns.set(userId, null);
            }
        }

        new MutationObserver(async (mutations, observer) => {
            for (const mutation of mutations) {
                for (const element of mutation.addedNodes) {
                    if (element instanceof HTMLElement) {
                        for (const child of element.querySelectorAll(QA_SELECTOR)) {
                            if (child.querySelector(".pronouns")) {
                                continue;
                            }
                            const link = new URL(child.href);
                            if (!link.pathname.startsWith("/users/")) {
                                continue;
                            }
                            const userId = Number.parseInt(USER_URL_REGEX.exec(link.pathname)[1]);
                            if (userId < 1 || BLACKLISTED.includes(userId)) {
                                continue;
                            }
                            if (cachedPronouns.has(userId)) {
                                if (cachedPronouns.get(userId) != null) {
                                    console.log(`Pronouns for ${userId}: ${cachedPronouns.get(userId)} (cached)`);
                                    createQAPronounsElement(child, cachedPronouns.get(userId));
                                }
                                continue;
                            }
                            const [pronouns, _] = await fetchQAPronouns(location.host, [userId]).then((m) => m.get(userId));
                            if (pronouns != null) {
                                cachedPronouns.set(userId, pronouns);
                                console.log(`Pronouns for ${userId}: ${cachedPronouns.get(userId)} (cached)`);
                                createQAPronounsElement(child, pronouns);
                            } else {
                                cachedPronouns.set(userId, null);
                            }
                        }
                    }
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    function insertCacheClearButton(chat) {
        if (chat) {
            document.getElementById("content").insertAdjacentHTML("beforeend", `
                <p style="margin-top: 1em;">
                    <button id="clear-pronouns-cache" class="button">clear pronouns cache</button>
                </p>
            `);
        } else {
            document.getElementById("mainbar").lastElementChild.insertAdjacentHTML("beforeend", `
                <button id="clear-pronouns-cache" class="s-btn s-btn__outlined m16">clear pronouns cache</button>
            `);
        }
        document.getElementById("clear-pronouns-cache").addEventListener("click", () => {
            localStorage.removeItem(CACHED_PRONOUNS_LIST_KEY);
            localStorage.removeItem(CACHED_PRONOUNS_KEY);
            alert("Pronouns cache cleared for this site.");
            window.location.assign("/");
        });
    }

    if (document.readyState == "complete") {
        if (location.host.startsWith("chat.")) {
            if (location.search == "?tab=prefs") {
                insertCacheClearButton(true);
            } else if (document.body.id == "transcript-body") {
                processChatTranscript();
            } else {
                chatInit();
            }
        } else {
            if (/\/users\/preferences/.test(location.pathname)) {
                insertCacheClearButton(false);
            } else {
                qaInit();
            }
        }
    } else {
        document.addEventListener("readystatechange", () => {
            if (document.readyState != "complete") {
                return;
            }
            if (location.host.startsWith("chat.")) {
                if (location.search == "?tab=prefs") {
                    insertCacheClearButton(true);
                } else if (document.body.id == "transcript-body") {
                    processChatTranscript();
                } else {
                    CHAT.Hub.roomReady.add(() => {
                        chatInit();
                    });
                }
            } else {
                StackExchange.initialized.then(() => {
                    if (/\/users\/preferences/.test(location.pathname)) {
                        insertCacheClearButton(false);
                    } else {
                        qaInit();
                    }
                })
            }
        });
    }
})();
