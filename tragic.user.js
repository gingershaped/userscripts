// ==UserScript==
// @name         Tragic Wormhole
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  A hacky file-transfer protocol over Stack Exchange chat. Don't try this at home!
// @author       Ginger
// @match        https://chat.stackexchange.com/rooms/*
// @match        https://chat.stackexchange.com/transcript/*
// @grant        GM.getValue
// ==/UserScript==

(() => {
    var decode = (string) => string.split("").map(c => c.charCodeAt(0).toString(2).padStart(16, 0).slice(2)).join("").replace(/10+$/, "").match(/.{8}/g).map(x => parseInt(x, 2))
    var encode = (bytes) => (bytes.map(b => b.toString(2).padStart(8, 0)).join("") + "10000000000000").match(/.{14}/g).map(x => String.fromCharCode(parseInt(x, 2) + 0x8000)).join("")

    const CHAT = unsafeWindow?.CHAT ?? window.CHAT
    
    function fkey() {
        return document.getElementById("fkey").value
    }
    function createDownloadMessage(msg) {
        var fileData = decode(msg)
        var filename = new TextDecoder().decode(Uint8Array.from(fileData.slice(0, 32))).replace(/\0/g, '')
        console.debug("Name: " + filename)

        var container = document.createElement("div")
        //container.classList.add("onebox")
        container.style.padding = "5px"
        var header = document.createElement("b")
        header.textContent = "Downloadable file: " + filename
        container.append(header)
        container.append(document.createElement("br"))

        var downloadButton = document.createElement("a")
        downloadButton.classList.add("button")
        downloadButton.textContent = "Download"
        downloadButton.href = URL.createObjectURL(new Blob([Uint8Array.from(fileData.slice(32))], { type: "octet/stream" }))
        downloadButton.download = filename
        container.append(downloadButton)
        return container
    }

    function upload(_) {
        var name = Array.from(new TextEncoder().encode(this.files[0].name)).slice(undefined, 32)
        this.files[0].arrayBuffer().then((data) => fetch(
            "https://chat.stackexchange.com/chats/" + CHAT.CURRENT_ROOM_ID + "/messages/new",
            {
                method: "POST",
                body: new URLSearchParams({
                    fkey: fkey(),
                    text: "😭🪱🕳️\n" + encode(name.concat(new Array(32 - name.length).fill(0)).concat(Array.from(new Uint8Array(data))))
                })
            }
        ))
    }

    function handleEvent(event) {
        if ([1, 2].includes(event.event_type)) {
            var doc = document.createElement("html")
            doc.innerHTML = event.content
            if (doc.querySelector(".partial, .full")) {
                var msg = doc.querySelector(".partial, .full").innerText
                if (msg.startsWith("😭🪱🕳️  ")) {
                    console.debug("New file recieved!")
                    return fetch("https://chat.stackexchange.com/messages/" + CHAT.CURRENT_ROOM_ID + "/" + event.message_id)
                        .then((d) => d.text())
                        .then((msg) => document.querySelector("#message-" + event.message_id + " .content")?.replaceWith(createDownloadMessage(msg.substring(7).trim())))
                }
            }
        }
        return null
    }

    function injectUploadButton() {
        var uploadInput = document.createElement("input")
        var uploadLabel = document.createElement("label")
        var uploadLabelText = document.createElement("span")
        uploadLabelText.textContent = "Loading..."
        uploadInput.type = "file"
        uploadInput.style.display = "none"
        uploadInput.id = "tragic-upload"
        uploadInput.disabled = true
        uploadInput.addEventListener("change", upload)
        uploadLabel.classList.add("button")
        uploadLabel.classList.add("disabled")
        uploadLabel.id = "tragic-label"
        uploadLabel.appendChild(uploadInput)
        uploadLabel.appendChild(uploadLabelText)
        document.getElementById("chat-buttons").appendChild(uploadLabel)
    }

    function injectHook() {
        CHAT.addEventHandlerHook((event, _1, _2) => {
            handleEvent(event)
        })
    }

    function processOldMessages() {
        return fetch("https://chat.stackexchange.com/chats/" + CHAT.CURRENT_ROOM_ID + "/events", {
            method: "POST",
            body: new URLSearchParams("since=0&mode=Messages&msgCount=500&fkey=" + fkey())
        })
            .then((r) => r.json())
            .then((data) => Promise.all(data.events.map(handleEvent).filter((r) => r != null)))
    }

    function main() {
        console.log("Tragic Wormhole is loading...")
        if (document.getElementById("transcript-body") == null) {
            injectUploadButton()
            injectHook()
            processOldMessages().then((_) => {
                document.getElementById("tragic-upload").disabled = false
                document.getElementById("tragic-label").classList.remove("disabled")
                document.querySelector("#tragic-label span").innerText = "Tragic Wormhole"
                console.log("Ready!")
            })
        }
        else {
            console.log("This is a transcript page, skipping injection.")
            CHAT.CURRENT_ROOM_ID = new URL(document.URL).pathname.split("/")[2]
            processOldMessages().then((_) => console.log("Ready!"))
        }
    }
    
    main()
    
})()
