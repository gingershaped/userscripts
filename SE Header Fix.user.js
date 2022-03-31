// ==UserScript==
// @name         SE Header Fix
// @namespace    https://codegolf.stackexchange.com/
// @version      0.1
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
    for (let e of document.querySelectorAll(".svg-icon")) {
        e.style.color = "#a1a6ae"
    }
    for (let e of document.querySelectorAll(".s-activity-indicator")) {
        e.style.borderRadius = "4px"
        e.style.boxShadow = "none"
        e.style.right = "4px"
        e.style.padding = "5px 3px"
        e.style.height = "16px"
        e.style.lineHeight = "0.2"
        e.style.border = "2px solid var(--theme-topbar-background-color)"
        if (!e.classList.contains("d-none") && e.previousElementSibling.classList.contains("iconAchievements")) {
            e.previousElementSibling.style.color = "var(--green-500)"
        }
        e.parentElement.addEventListener("mouseenter", function() {
            e.style.padding = "3px 3px"
            e.style.borderRadius = "2px"
            e.style.border = "none"
            e.style.height = "14px"
            e.style.right = "6px"
            e.style.lineHeight = "0.55"
        })
        e.parentElement.addEventListener("mouseleave", function() {
            e.style.padding = "5px 3px"
            e.style.borderRadius = "4px"
            e.style.border = "2px solid var(--theme-topbar-background-color)"
            e.style.height = "16px"
            e.style.right = "4px"
            e.style.lineHeight = "0.2"
        })
    }
})();