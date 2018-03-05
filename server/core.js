window.onload = function () {
    var socket = io("68.66.246.81");
    var joinButton = document.getElementById("join-btn");
    var roomInput = document.getElementById("roomid-input");
    var overlay = document.getElementById("overlay");
    var overlay_txt = document.getElementById("overlay-text");
    var cancel_div = document.getElementById("cancel-div");
    document.getElementById("item-list").style.display = "none";
    var prevFiles = [];
    var room = undefined;
    var aliceECDH = undefined;
    var isDownloading = false;
    var ServerHMAC = undefined;

    var queryStringMatch = window.location.search.match(/\?([^&$]+)/);
    if (queryStringMatch != null) {
        queryStringMatch = queryStringMatch.splice(1).toString();
        var sliceOfParam = queryStringMatch.split("=");
        if (queryStringMatch && sliceOfParam[0] == "roomid") {
            roomInput.value = sliceOfParam[1];
        }
    }

    joinButton.addEventListener("click", function () {
        if (roomInput.value) {
            joinButton.disabled = true;
            roomInput.disabled = true;
            window.pw_prompt({
                lm:"Please enter room password", 
                bm: "Ok",
                callback: function(res) {
                    if (res != "") {
                        room = roomInput.value.trim();
                        socket.emit("Pvali", {
                            p: sha256(res),
                            name: room,
                        });
                    }
                    joinButton.disabled = false;
                    roomInput.disabled = false;
                }
            });
        }
    });

    cancel_div.addEventListener("click", function () {
        if (isDownloading) {
            isDownloading = false;
        }
    });

    socket.on("Pvalidated", function () {
        socket.emit("Ijoin", room);
    });

    socket.on("files", function (files) {
        if (isNotEquals(prevFiles, files)) {
            var listDiv = document.getElementById("item-list");
            while (listDiv.firstChild) {
                listDiv.removeChild(listDiv.firstChild);
            }
            for (var i = 0; i < files.length; i++) {
                genItemDiv(files, i);
            }
            prevFiles = files;
            document.getElementById("item-list").style.display = "block";
        }
    });

    socket.on("verify", function (hmac) {
        try {
            ServerHMAC = hmac;
        } catch (e) {
            ServerHMAC = "";
        }
    });

    window.ss(socket).on("downloadclient", function (stream, obj) {
        var fileBuffer = [],
            fileLength = 0,
            expectedFileSize = obj.size,
            firstChucklength = undefined;

        var secret = aliceECDH.computeSecret(obj.key, "base64", "base64");
        var hmac = window.createHMAC("sha256", secret);

        isDownloading = true;
        document.getElementById("overlay-filename").textContent = "Downloading: " + obj.filename;

        var decrypt = window.cipher.createDecipher('aes-256-ctr', secret);

        stream.on('data', function (chunk) {
            if (!isDownloading) {
                stream.destroy();
                overlay.style.display = "none";
            } else {
                if (!firstChucklength) {
                    firstChucklength = chunk.length;
                }
                fileLength += chunk.length;
                fileBuffer.push(chunk);
                overlay_txt.textContent = Math.ceil((fileLength / expectedFileSize) * 100) + " %";
            }
        });

        stream.on('end', function () {
            var filedata = new Uint8Array(fileLength),
                i = 0;

            fileBuffer.forEach(function (buff) {
                for (var j = 0; j < buff.length; j++) {
                    filedata[i] = buff[j];
                    i++;
                }
            });
            decrypt.on("error", function (err) {
                console.error(err);
            })
            var newDataArray = Buffer.concat([decrypt.update(filedata), decrypt.final()]);
            hmac.write(newDataArray.slice(0, firstChucklength));
            hmac.end();
            if (hmac.read().toString("hex") == ServerHMAC) {
                newDataArray = newDataArray.toString("binary");
                downloadFileFromBlob([newDataArray], obj.filename);
                overlay.style.display = "none";
            } else {
                alert("the file has been corrupted please try again.");
            }
        });
    });

    var downloadFileFromBlob = (function () {
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        return function (data, fileName) {
            var blob = new Blob(data, {
                    type: "octet/stream"
                }),
                url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }());

    function toArrayBuffer(buf) {
        var ab = new Array(buf.length);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return view;
    }

    function isNotEquals(a1, a2) {
        if (a1.length != a2.length)
            return true;

        for (var i = 0, l = a1.length; i < l; i++) {
            if (!((a1[i].add && a2[i].add) || (a1[i].add == undefined && a2[i].add == undefined))) {
                return true;
            } else if (a1[i].isServerMSG && a2[i].isServerMSG) {
                if (a1[i].name != a2[i].name) {
                    return true;
                }
            }
        }
        return false;
    }

    function genItemDiv(data, i) {
        if (data[i].add) {
            var a = document.getElementById('item-list');
            var div = document.createElement("div");
            div.className = "item";
            if (data[i].isServerMSG == undefined) {
                div.onclick = function (e) {
                    if (e.target.childNodes[0] instanceof HTMLElement) {
                        askFile(e.target.childNodes[0].textContent);
                    }
                };
            }
            a.appendChild(div);
            var lbl = document.createElement("label");
            lbl.textContent = data[i].name;
            lbl.className = "name";
            lbl.id = i;
            if (data[i].isServerMSG == undefined) {
                lbl.onclick = function (e) {
                    askFile(e.target.textContent);
                };
            }
            div.appendChild(lbl);
        }
    }

    function askFile(filename) {
        overlay.style.display = "block";
        aliceECDH = window.createECDH("secp256k1");
        aliceECDH.generateKeys();

        var alicePublicKey = aliceECDH.getPublicKey("base64", "compressed");
        socket.emit("ask", {
            filename: filename,
            room: room,
            key: alicePublicKey
        });
    }
}