'use strict'

const {
    remote
} = require("electron");
const dialog = remote.dialog,
    fs = require("fs"),
    path = require("path"),
    ss = require('socket.io-stream'),
    _ = require("lodash"),
    crypto = require("crypto"),
    serverUtil = require("./helperModuls/ServerUtil"),
    shell = remote.shell,
    clipboard = remote.clipboard;
let filePath = undefined;

window.onload = () => {
    const server = require("./server");

    let dirSelector = document.getElementById("selecter");
    let lbl_dir = document.getElementById("path");
    let lbl_url = document.getElementById("url");
    let link = document.getElementById("link");
    let startButton = document.getElementById("start");
    let lbl_room = document.getElementById("room");
    let serverOnlineState = false;
    let storedFiles = [];
    let roomNR = undefined;
    let timer = undefined;
    let roomPass = undefined;

    let socket = require('socket.io-client')('http://sharator.com/');
    //let socket = io('http://sharator.com/');
    

    socket.on('connect', function () {
        socket.emit("Ihost");
    });
    socket.on('room', function (roomNr) {
        roomNR = roomNr;
        lbl_room.innerHTML = `Your room name: <strong>${roomNR}</strong> \nURL: www.sharator.com/?roomid=${roomNr}`;
    });

    socket.on("ask", (obj) => {
        if (serverOnlineState && _.find(storedFiles, {
                name: obj.filename
            })) {

            let bobECDH = crypto.createECDH("secp256k1");
            bobECDH.generateKeys();

            let bobPublicKey = bobECDH.getPublicKey("base64", "compressed");
            let secret = bobECDH.computeSecret(obj.key, "base64", "base64");

            let encrypt = crypto.createCipher('aes-256-ctr', secret);
            let stream = ss.createStream();
            let hmac = crypto.createHmac("sha256", secret);

            let filepath = path.join(filePath, obj.filename);
            const fileSizeInBytes = fs.statSync(filepath).size;

            ss(socket).emit("download", stream, {
                id: obj.id,
                key: bobPublicKey,
                size: fileSizeInBytes,
            });
            let crs = fs.createReadStream(filepath);
            let isChecked = false;

            crs.on("data", (chuck) => {
                if (!isChecked) {
                    hmac.write(chuck);
                    hmac.end();
                    socket.emit("verify", {
                        hmac: hmac.read().toString("hex"),
                        id: obj.id
                    });
                    isChecked = true;
                }
            });
            crs.pipe(encrypt).pipe(stream);
        }
    });

    socket.on("Pvalidate", (obj)=>{
        if(obj.p == roomPass){
            socket.emit("Pisvalidated", {id: obj.id, isvalid: true});
        }else{
            socket.emit("Pisvalidated", {id: obj.id, isvalid: false});
        }
    });

    socket.on('disconnect', function () {
        stopTimer(timer);
    });

    socket.on("reconnect", () => {
        stopTimer(timer);
        timer = fileTimer((files) => {
            socket.emit("filelist", {
                filelist: files,
                room: roomNR
            });
        });
    });

    dirSelector.addEventListener("click", () => {
        if (!serverOnlineState) {
            dialog.showOpenDialog({
                properties: ['openDirectory']
            }, (path) => {
                if (path != undefined) {
                    lbl_dir.innerText = `You are Sharing: ${path}`;
                    server.setPath(path);
                    filePath = path[0];
                    getAllfiles(path[0]).then((data) => {
                        storedFiles = data;
                        server.setData(storedFiles);

                        let listDiv = document.getElementById("filelist-div");
                        while (listDiv.firstChild) {
                            listDiv.removeChild(listDiv.firstChild);
                        }
                        for (let i = 0; i < data.length; i++) {
                            genItemDiv(data[i], i);
                        }
                    });
                }
            });
        } else {
            dialog.showErrorBox("Error", "Please stop the server before editing the folder.");
        }
    });

    startButton.addEventListener("click", () => {
        if (serverOnlineState) {
            serverOnlineState = false;
            roomPass = undefined;
            startButton.innerText = "Start Sharing";
            lbl_url.innerText = "Sharing hasn't started";
            link.style.display = "none";
            lbl_room.style.display = "none";
            stopTimer(timer);
            server.closeServer();
        } else {
            serverUtil.prompt("Enter a password for your room", "").then((res) => {
                if (res != null) {
                    console.log(res)
                    roomPass = serverUtil.createHASH(res);
                    if (server.startServer()) {
                        serverOnlineState = true;
                        startButton.innerText = "Stop Sharing";
                        lbl_url.innerText = `Sharing files on: `;
                        link.textContent = `http://${server.exportIP()}:9000/`;
                        link.onclick = (e) => {
                            e.preventDefault();
                            shell.openExternal(e.srcElement.textContent);
                        }
                        link.style.display = "inline";
                        lbl_room.style.display = "inline";
                        timer = fileTimer((files) => {
                            socket.emit("filelist", {
                                filelist: files,
                                room: roomNR
                            });
                        });
                    }
                }
            });
        }
    });

    function stopTimer(timerVar) {
        clearInterval(timerVar);
        socket.emit("filelist", {
            filelist: [],
            room: roomNR
        });
    }

    function fileTimer(callback) {
        return setInterval(() => {
            callback(storedFiles);
        }, 1000)
    }

    function genItemDiv(data, id) {
        const a = document.getElementById('filelist-div');
        const div = document.createElement("div");
        div.className = "item";
        div.onclick = (e) => {
            if (e.srcElement.childNodes[0] instanceof HTMLElement) {
                if (storedFiles[e.srcElement.childNodes[0].id].add) {
                    storedFiles[e.srcElement.childNodes[0].id].add = undefined;
                    e.srcElement.childNodes[0].style.textDecoration = "line-through";
                } else {
                    storedFiles[e.srcElement.childNodes[0].id].add = true;
                    e.srcElement.childNodes[0].style.textDecoration = "none";
                }
                server.setData(storedFiles);
            }
        };
        a.appendChild(div);
        let lbl = document.createElement("label");
        lbl.textContent = data.name;
        lbl.className = "name";
        lbl.id = id;
        lbl.onclick = (e) => {
            if (storedFiles[e.srcElement.id].add) {
                storedFiles[e.srcElement.id].add = undefined;
                e.srcElement.style.textDecoration = "line-through";
            } else {
                storedFiles[e.srcElement.id].add = true;
                e.srcElement.style.textDecoration = "none";
            }
            server.setData(storedFiles);
        };
        div.appendChild(lbl);
    }
}

function getAllfiles(path) {
    return new Promise((resolve, reject) => {
        let returnArray = [];
        let files = fs.readdir(path, (err, files) => {
            if (err) {
                reject(err);
            }
            for (let i = 0; i < files.length; i++) {
                let e = files[i];
                if (!e.startsWith(".") && e.includes(".") && !fs.lstatSync(filePath + "\\" + e).isDirectory() && !e.endsWith(".lnk") && e !== "desktop.ini") {
                    returnArray.push({
                        name: e,
                        add: true
                    });
                }
            }
            resolve(returnArray);
        });
    });
}