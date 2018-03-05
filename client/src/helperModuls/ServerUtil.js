var ipcRenderer = require('electron').ipcRenderer,
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