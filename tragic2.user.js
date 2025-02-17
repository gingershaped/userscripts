// ==UserScript==
// @name              Tragic Wormhole 2
// @namespace         http://ginger.rto.community/
// @version           1.12
// @description       Send arbitrary files over SE chat!
// @author            Ginger
// @updateURL         https://github.com/gingershaped/userscripts/raw/main/tragic2.user.js
// @downloadURL       https://github.com/gingershaped/userscripts/raw/main/tragic2.user.js
// @match             https://chat.stackexchange.com/rooms/*
// @match             https://chat.stackexchange.com/transcript/*
// @match             https://chat.stackoverflow.com/rooms/*
// @match             https://chat.stackoverflow.com/transcript/*
// @match             https://chat.meta.stackexchange.com/rooms/*
// @match             https://chat.meta.stackexchange.com/transcript/*
// @match             https://i.sstatic.net/*.png
// @icon              https://file.garden/ZkNlfx6KLQ_d2Rp0/wormhole.png
// @resource style    https://cdn-chat.sstatic.net/chat/css/chat.stackexchange.com.css?v=62c10027e0ed
// @resource bg       https://cdn.sstatic.net/Sites/beta/img/bg-noise.png
// @grant             GM_getResourceURL
// @run-at            document-body
// ==/UserScript==

(() => {
    const LENGTH_SIZE = 4;
    const TYPE_SIZE = 4;
    const CRC_SIZE = 4;
    const FORMAT_VERSION = 1;
    const MAX_FILE_SIZE = 2097152;
    const TW_CHUNK_TYPE = [0x77, 0x4F, 0x52, 0x6D]; // wORm
    const TW_CHUNK_TYPE_STR = String.fromCodePoint(...TW_CHUNK_TYPE);

    const crcTable = [];
    let c = 0;
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xEDB88320 ^ (c >>> 1);
            } else {
                c >>>= 1;
            }
        }
        crcTable[n] = c;
    }

    function crc32(data) {
        let crc = 0xFFFFFFFF;
        for (const byte of data) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xFF];
        }
        crc ^= 0xFFFFFFFF;
        return BigInt.asUintN(32, BigInt(crc));
    }

    function extractPNGChunks(png) {
        const view = new DataView(png);
        const decoder = new TextDecoder();
        const chunks = [];
        let cursor = 8;
        while (cursor < png.byteLength) {
            const length = view.getUint32(cursor);
            const dataOffset = cursor + LENGTH_SIZE + TYPE_SIZE;
            const chunkType = decoder.decode(png.slice(cursor + LENGTH_SIZE, dataOffset));
            const data = png.slice(dataOffset, dataOffset + length);
            const crc = view.getUint32(dataOffset + length);
            chunks.push({ chunkType, data: new Uint8Array(data), crc });
            cursor += LENGTH_SIZE + TYPE_SIZE + length + CRC_SIZE;
        }
        return chunks;
    }

    function generateCarrier(fileNames) {
        const canvas = new OffscreenCanvas(150, 150);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 150, 150);
        ctx.fillStyle = "black";
        ctx.font = "15px sans-serif";
        ctx.fillText("Attached files:", 0, 15);
        ctx.font = "12px monospace";
        fileNames.slice(0, 9).forEach((name, index) => {
            ctx.fillText(`• ${name}`, 5, index * 10 + 30, 145);
        });
        if (fileNames.length > 9) {
            ctx.font = "12px sans-serif";
            ctx.fillText(`and ${fileNames.length - 9} more`, 5, 122, 150);
        }
        ctx.font = "10px sans-serif";
        ctx.fillText("Download with Tragic Wormhole 2", 0, 138, 150);
        ctx.fillText("github.com/gingershaped/userscripts", 0, 148, 150);
        return canvas.convertToBlob().then((blob) => blob.arrayBuffer()).then((buf) => new Uint8Array(buf));
    }

    function createTWChunk(meta, data) {
        const fileMeta = { version: FORMAT_VERSION, ...meta };
        const payload = [...new TextEncoder().encode(JSON.stringify(fileMeta)), 0, ...data];
        const crc = crc32(TW_CHUNK_TYPE.concat(payload));
        const view = new DataView(new ArrayBuffer(LENGTH_SIZE + TYPE_SIZE + payload.length + CRC_SIZE));
        view.setUint32(0, payload.length);
        TW_CHUNK_TYPE.concat(payload).map((byte, n) => view.setUint8(LENGTH_SIZE + n, byte));
        view.setUint32(LENGTH_SIZE + TYPE_SIZE + payload.length, Number(crc));
        return new Uint8Array(view.buffer);
    }


    async function upload(files) {
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                throw new Error(`File ${file.name} is too big! Max size is approximately 2MiB`);
            }
        }
        const carrier = await generateCarrier(files.map((file) => file.name));
        const chunks = await Promise.all(files.map(async (file) => createTWChunk(
            { name: file.name, type: file.type, modified: file.lastModified }, [...new Uint8Array(await file.arrayBuffer())]
        )));
        const data = new Uint8Array(carrier.byteLength + chunks.map((chunk) => chunk.byteLength).reduce((p, c) => p + c));
        data.set(carrier, 0);
        let cursor = carrier.byteLength;
        for (const chunk of chunks) {
            data.set(chunk, cursor);
            cursor += chunk.byteLength;
        }

        if (data.byteLength > MAX_FILE_SIZE) {
            throw new Error(`Combined filesize is too big! Max size is approximately 2MiB`);
        }
        const uploadForm = new FormData();
        uploadForm.set("shadow-filename", "tragic2.png");
        uploadForm.set("filename", new Blob([data], { type: "image/png" }), "tragic2.png");
        const uploadResponse = await fetch("/upload/image", { method: "POST", body: uploadForm });
        if (!uploadResponse.ok) {
            throw new Error("Failed to upload the image somehow!")
        }
        const uploadBody = await uploadResponse.text();
        const imageUrl = uploadBody.match(/var result = '(.*)'/)[1];
        const error = uploadBody.match(/var error = (?:null|'(.*)')/)[1];
        if (error != undefined) {
            throw new Error(error);
        }
        const messageForm = new FormData();
        messageForm.set("text", imageUrl);
        messageForm.set("fkey", document.getElementById("fkey").value);
        const messageResponse = await fetch(`/chats/${CHAT.CURRENT_ROOM_ID}/messages/new`, {
            method: "POST",
            body: messageForm
        });
        if (!messageResponse.ok) {
            throw new Error("Failed to send the message!")
        }
    }

    function extractFilesFromImage(imageBuffer) {
        return extractPNGChunks(imageBuffer)
            .filter(({ chunkType }) => chunkType == TW_CHUNK_TYPE_STR)
            .map((chunk) => {
                const chunkBuffer = chunk.data;
                const expectedCrc = Number(crc32(TW_CHUNK_TYPE.concat([...chunk.data])));
                if (expectedCrc != chunk.crc) {
                    return { status: "bad-crc", expectedCrc, chunk };
                }
                const metadata = JSON.parse(new TextDecoder().decode(chunkBuffer.slice(0, chunkBuffer.indexOf(0))));
                if (metadata.version != FORMAT_VERSION) {
                    return { status: "bad-version", version: metadata.version, chunk };
                }
                return {
                    status: "okay", file: new File(
                        [chunkBuffer.slice(chunkBuffer.indexOf(0) + 1)],
                        metadata.name,
                        { type: metadata.type, lastModified: metadata.lastModified }
                    )
                };
            });
    }

    function createDownloadElement(files) {
        const body = document.createElement("div");
        body.style.margin = "10px 0";
        const header = document.createElement("div");
        header.innerHTML = `<b>${files.length} uploaded ${files.length == 1 ? "file" : "files"}</b>`;
        header.style.marginBottom = "5px";
        body.appendChild(header);
        const buttons = document.createElement("div");
        body.appendChild(buttons);
        const video = document.createElement("video");
        video.hidden = true;
        video.controls = true;
        video.loop = true;
        video.style.width = "100%";
        video.style.padding = "5px";
        video.style.boxSizing = "border-box";
        body.appendChild(video);
        const hideVideo = document.createElement("button");
        hideVideo.innerText = "Close player";
        hideVideo.hidden = true;
        hideVideo.classList.add("button");
        hideVideo.addEventListener("click", () => {
            video.hidden = true;
            hideVideo.hidden = true;
        });
        body.appendChild(document.createElement("div")).appendChild(hideVideo);

        files.forEach((file, index) => {
            switch (file.status) {
                case "okay": {
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(file.file);
                    link.download = file.file.name;
                    link.innerText = `Download ${file.file.name}`;
                    link.classList.add("button");
                    link.style.margin = index == 0 ? "0 5px 0 0" : "0 5px";
                    link.style.textDecoration = "none";
                    buttons.appendChild(link);
                    if (video.canPlayType(file.file.type) != "") {
                        const playButton = document.createElement("button");
                        playButton.innerText = `Play ${file.file.name}`;
                        playButton.classList.add("button");
                        playButton.addEventListener("click", () => {
                            video.src = link.href;
                            video.hidden = false;
                            hideVideo.hidden = false;
                            video.play();
                        });
                        buttons.appendChild(playButton);
                    }
                    break;
                }
                case "bad-crc": {
                    const error = document.createElement("p");
                    error.innerText = `File ${index + 1} could not be extracted: bad CRC`;
                    body.appendChild(error);
                    break;
                }
                case "bad-version": {
                    const error = document.createElement("p");
                    error.innerText = `File ${index + 1} could not be extracted: unsupported version ${file.version}`;
                    body.appendChild(error);
                    break;
                }
            }
        });
        return body;
    }

    async function handleMessage(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            const files = extractFilesFromImage(await response.arrayBuffer());
            if (files.length) {
                console.log(`Files in ${imageUrl}: `, files);
                return createDownloadElement(files);
            }
        } catch (e) {
            console.warn(`Failed to process image ${imageUrl}: ${e}`);
        }
        return null;
    }

    function processTranscript() {
        return Promise.all([...document.querySelectorAll(".user-image")].map(async (imageElement) => {
            const messageElement = imageElement.parentElement.parentElement.parentElement;
            const newContent = await handleMessage(imageElement.parentElement.href);
            if (newContent != null) {
                messageElement.replaceChildren(newContent);
            }
        }));
    }

    async function init() {
        await processTranscript();
        new MutationObserver(async (mutations) => {
            for (const monologue of mutations.flatMap((mutation) => [...mutation.addedNodes])) {
                for (const imageElement of monologue.querySelectorAll(".user-image")) {
                    const messageElement = imageElement.parentElement.parentElement.parentElement;
                    const newContent = await handleMessage(imageElement.parentElement.href);
                    if (newContent != null) {
                        messageElement.replaceChildren(newContent);
                    }
                }
            }
        }).observe(document.getElementById("chat"), { childList: true });
    }

    async function sstaticInit() {
        const element = await handleMessage(window.location.toString());
        if (element != null) {
            element.style.position = "absolute";
            element.style.top = "50%";
            element.style.left = "50%";
            element.style.transform = "translate(-50%, -50%)";
            element.style.boxShadow = "0 1px 15px #9c9c9c";
            element.style.background = "white";
            element.style.padding = "2%";
            const stylesheet = document.createElement("link");
            stylesheet.rel = "stylesheet";
            await GM_getResourceURL("bg");
            stylesheet.href = await GM_getResourceURL("style");
            document.head.appendChild(stylesheet)
            document.body.replaceChildren(element);
        }
    }

    if (window.location.host == "i.sstatic.net") {
        sstaticInit();
    } else {
        const uploadLabel = document.createElement("label");
        uploadLabel.appendChild(new Text("send file"));
        uploadLabel.classList.add("button");
        const uploadInput = document.createElement("input");
        uploadInput.type = "file";
        uploadInput.multiple = true;
        uploadInput.hidden = true;
        uploadInput.addEventListener("change", () => {
            upload([...uploadInput.files]).catch((reason) => Notifier().notify(`Failed to send files: ${reason}`));
        });
        uploadLabel.appendChild(uploadInput);
        if (document.readyState == "complete") {
            if (document.body.id == "transcript-body") {
                processTranscript();
            } else {
                document.getElementById("chat-buttons").appendChild(uploadLabel);
                init();
            }
        } else {
            document.addEventListener("readystatechange", () => {
                if (document.readyState != "complete") {
                    return;
                }
                if (document.body.id == "transcript-body") {
                    processTranscript();
                } else {
                    document.getElementById("chat-buttons").appendChild(uploadLabel);
                    CHAT.Hub.roomReady.add(() => {
                        init();
                    });
                }
            })
        }
    }
})();
