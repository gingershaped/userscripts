// ==UserScript==
// @name         SE Header Fix
// @namespace    https://codegolf.stackexchange.com/
// @version      0.3
// @description  Revert the style of the Stack Exchange header to its original form
// @author       Ginger
// @match        https://*.stackexchange.com/*
// @match        https://stackoverflow.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stackexchange.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (document.location.hostname == "chat.stackexchange.com") { // Don't run on the chat site
        return
    }
    for (let e of document.querySelectorAll(".s-topbar--content .svg-icon")) {
        e.style.color = "#a1a6ae"
    }
    for (let e of document.querySelectorAll(".js-inbox-button .s-activity-indicator, .js-achievements-button .s-activity-indicator")) {
        e.style.borderRadius = "4px"
        e.style.boxShadow = "none"
        e.style.right = "2px"
        e.style.padding = "6px 4px"
        e.style.paddingBottom = "1px"
        e.style.height = "16px"
        e.style.lineHeight = "0"
        e.style.border = "2px solid var(--theme-topbar-background-color)"
        if (!e.classList.contains("d-none") && e.previousElementSibling.classList.contains("iconAchievements")) {
            e.previousElementSibling.style.color = "var(--green-500)"
        }
        e.parentElement.addEventListener("mouseenter", function() {
            e.style.borderColor = "var(--theme-topbar-item-background-hover)"
        })
        e.parentElement.addEventListener("mouseleave", function() {
            if (!e.parentElement.classList.contains("is-selected")) {
                e.style.borderColor = "var(--theme-topbar-background-color)"
            }
        })
        var observer = new MutationObserver(function (event) {
            if (e.parentElement.classList.contains("is-selected")) {
                e.style.borderColor = "var(--theme-topbar-item-background-hover)"
            }
            else {
                e.style.borderColor = "var(--theme-topbar-background-color)"
                e.previousElementSibling.style.color = "#a1a6ae"
            }
        })

        observer.observe(e.parentElement, {
            attributes: true,
            attributeFilter: ['class'],
            childList: false,
            characterData: false
        })
    }
})();
