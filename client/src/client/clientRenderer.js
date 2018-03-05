'use strict'
const {
    remote
} = require("electron");
const dialog = remote.dialog;

let ss = require('socket.io-stream'),
    fs = require("fs"),
    crypto = require("crypto"),
    _ = require("lodash"),
    clientUtil = require("../helperModuls/clientUtil");

window.onload = function () {
    let socket = require('socket.io-client')('http://localhost:9000/');
    //let socket = io('http://sharator.com/');
    let ps = require('pause-stream')();

    let joinButton = document.getElementById("join-btn");
    let roomInput = document.getElementById("roomid-input");
    let info_lbl = document.getElementById("info");
    let overlay = document.getElementById("overlay");
    let overlay_txt = document.getElementById("overlay-text");
    let cancel_div = document.getElementById("cancel-div");
    document.getElementById("item-list").style.display = "none";
    let prevFiles = [];
    let room = undefined;
    let aliceECDH = undefined;
    let isDownloading = false;
    let cws = undefined;
    let ServerHMAC = undefined;

    joinButton.addEventListener("click", () => {
        if (roomInput.value) {
            clientUtil.prompt("Please enter room password", "").then((res) => {
                if (res != null) {
                    room = roomInput.value.trim();
                    socket.emit("Pvali", {
                        p: clientUtil.createHASH(res),
                        name: room,
                    });
                }
            });
        }
    });

    cancel_div.addEventListener("click", () => {
        if (isDownloading) {
            isDownloading = false;
        }
    });

    socket.on("Pvalidated", () => {
        socket.emit("Ijoin", room);
    });

    socket.on("files", (files) => {
        if (clientUtil.isNotEquals(prevFiles, files)) {
            let listDiv = document.getElementById("item-list");
            while (listDiv.firstChild) {
                listDiv.removeChild(listDiv.firstChild);
            }
            for (let i = 0; i < files.length; i++) {
                clientUtil.genItemDiv(files, i, askFile);
            }
            prevFiles = files;
            document.getElementById("item-list").style.display = "block";
            info_lbl.style.display = "inline";
        }
    });

    socket.on("verify", (hmac) => {
        try {
            ServerHMAC = hmac.toString("hex");
        } catch (e) {
            ServerHMAC = "";
        }
    });

    ss(socket).on("downloadclient", (stream, obj) => {
        let expectedFileSize = obj.size;
        let fileLength = 0;
        let isChecked = false;

        let secret = aliceECDH.computeSecret(obj.key, "base64", "base64");
        let hmac = crypto.createHmac("sha256", secret);

        isDownloading = true;
        document.getElementById("overlay-filename").textContent = "Downloading: " + obj.filename;

        let decrypt = crypto.createDecipher('aes-256-ctr', secret);

        stream.pipe(decrypt).pipe(ps.pause());

        decrypt.on('data', (chunk) => {
            if (!isDownloading) {
                stream.destroy();
                overlay.style.display = "none";
            } else {
                if (!isChecked) {
                    hmac.write(chunk);
                    hmac.end();
                    if (ServerHMAC == hmac.read().toString("hex")) {
                        ps.pipe(cws);
                        ps.resume();
                        isChecked = true;
                    } else {
                        stream.destroy();
                        cws.close();
                        fs.unlink(cws.path, (err) => {
                            console.error(err)
                        });
                        overlay.style.display = "none";
                        dialog.showErrorBox("Error", "the file has been corrupted please try again.");
                    }
                }
                fileLength += chunk.length;
                overlay_txt.textContent = Math.ceil((fileLength / expectedFileSize) * 100) + " %";
            }
        });

        decrypt.on('end', () => {
            overlay.style.display = "none";
        });
    });

    var askFile = function askFile(filename) {
        overlay.style.display = "block";
        aliceECDH = crypto.createECDH("secp256k1");
        aliceECDH.generateKeys();

        let alicePublicKey = aliceECDH.getPublicKey("base64", "compressed");

        dialog.showSaveDialog({
            defaultPath: `~/${filename}`,
        }, (path) => {
            if (typeof path == Buffer || typeof path == "string") {
                cws = fs.createWriteStream(path);
                cws.on("error", (err) => {
                    console.log(err)
                });
                socket.emit("ask", {
                    filename: filename,
                    room: room,
                    key: alicePublicKey
                });
            } else {
                overlay.style.display = "none";
            }
        });
    }
}