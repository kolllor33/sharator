'use strict';

const {
    remote
} = require("electron"),
    dialog = remote.dialog,
    os = require("os"),
    path = require("path"),
    cors = require("cors"),
    _ = require("lodash"),
    helmet = require("helmet");

var express = require('express'),
    app = express(),
    server = undefined,
    syncPath = undefined,
    storedFiles = undefined,
    ip = undefined;

app.use(cors());
app.use(helmet());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "webindex.html"));
});

app.get("/img", (req, res) => {
    res.sendFile(path.join(__dirname, "/assets/icon.svg"));
});

app.get("/js", (req, res) => {
    res.sendFile(path.join(__dirname, "webcore.js"));
});

app.get("/files", (req, res) => {
    res.json(_.filter(storedFiles, {
        add: true
    }));
});

app.get("/download/:filename", (req, res) => {
    if (find(req.params.filename)) {
        let file = `${syncPath}\\${req.params.filename}`;
        res.download(file);
    }
});

exports.setPath = (path) => {
    if (path) {
        syncPath = path[0];
    }
}

exports.closeServer = () => {
    if (server) {
        server.close();
        server = null;
    }
}

exports.startServer = () => {
    if (!server) {
        if (syncPath) {
            server = app.listen(9000, getIP(), () => {});
            return true;
        } else {
            dialog.showErrorBox("Select a directory", "you didn't set a location where to share from.");
            return false;
        }
    }
}

exports.setData = (data) => {
    storedFiles = data;
}

exports.exportIP = () => {
    if (ip) {
        return ip;
    }
    return null;
}

function find(title) {
    for (var i = 0; i < storedFiles.length; i++) {
        if (storedFiles[i].name == title && storedFiles[i].add) {
            return true;
        }
    }
    return false;
}


function getIP() {
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    ip = addresses[0]
    return addresses[0];
}