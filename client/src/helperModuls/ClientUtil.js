const {
    has
} = require("lodash"),
    ipcRenderer = require('electron').ipcRenderer,
    crypto = require("crypto");

exports.prompt = async(title, val) => {
    let res = await promisePrompt(title, val);
    return res;
}

function promisePrompt(title, val) {
    return new Promise((resolve, reject) => {
        let result = ipcRenderer.sendSync('prompt', {
            title,
            val
        });
        if (result != null) {
            resolve(result);
        }
    });
}

exports.createHASH = (data) => {
    let hash = crypto.createHash("sha256");
    hash.write(data);
    hash.end();
    return hash.read().toString("hex");
}

exports.genItemDiv = (data, i, askFile) => {
    if (data[i].add) {
        let a = document.getElementById('item-list');
        let div = document.createElement("div");
        div.className = "item";
        if (!has(data[i], "isServerMSG")) {
            div.onclick = function (e) {
                if (e.target.childNodes[0] instanceof HTMLElement) {
                    askFile(e.target.childNodes[0].textContent);
                }
            };
        }
        a.appendChild(div);
        let lbl = document.createElement("label");
        lbl.textContent = data[i].name;
        lbl.className = "name";
        lbl.id = i;
        if (!has(data[i], "isServerMSG")) {
            lbl.onclick = function (e) {
                askFile(e.target.textContent);
            };
        }
        div.appendChild(lbl);
    }
}


exports.isNotEquals = (a1, a2) => {
    if (a1.length != a2.length)
        return true;

    for (let i = 0, l = a1.length; i < l; i++) {
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