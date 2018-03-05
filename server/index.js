var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    helmet = require("helmet"),
    _ = require("lodash"),
    io = require('socket.io')(server),
    uid = require("uid"),
    ss = require('socket.io-stream'),
    RateLimit = require('express-rate-limit'),
    fs = require("fs"),
    os = require("os"),
    path = require("path"),
    RoomList = [],
    RequestList = [],
    ValidateList = [];

var sticky = require('sticky-listen');

const MAX_MEMBERS = 3;

let limiter = new RateLimit({
    windowMs: 30 * 1000, // 0.5 minutes
    max: 60, // limit each IP to 60 requests per windowMs
    delayMs: 0, // disable delaying - full speed until the max limit is reached
    message: "Your request has been blocked please try again later.",
    onLimitReached: (req, res, options) => {
        fs.writeFile("./rate-limit.log", `${req.ip} has been blocked for too many request`, (err) => {
            if (err) console.error(err);
        });
    }
});
//app.enable('trust proxy'); //enable for when the server is behind a proxy 

app.use(limiter);
app.use(helmet());
app.use(express.static("public")); //enable this if in dev or if the website works

//this is the 404 route this has to be the last app.use
app.use(function (req, res, next) {
    res.status(404);
    res.sendFile(path.join(__dirname, "/public/404.html"));
});

io.on("connect", (socket) => {

    socket.on("Ihost", () => {
        let roomNr = uid(10);
        RoomList.push({
            host: socket,
            nr: roomNr,
            members: 0
        });
        socket.join(roomNr);
        socket.emit("room", roomNr);
    });

    socket.on("Pvali", (obj) => {
        let isLegitRoom = _.find(RoomList, {
            nr: obj.name.trim()
        });
        if (_.has(socket, "inRoom")) {
            socket.leave(socket.inRoom);
        }
        if (isLegitRoom) {
            let id = uid(5);
            ValidateList.push({
                client: socket,
                id: id
            });
            isLegitRoom.host.emit("Pvalidate", {
                p: obj.p,
                id: id
            });
        }else{
            socket.emit("files", [{
                name: "Room Not Found",
                add: true,
                isServerMSG: true
            }]);
        }
    });

    socket.on("Pisvalidated", (obj) => {
        let isLegit = _.find(ValidateList, {
            id: obj.id
        });
        if (isLegit) {
            if (obj.isvalid) {
                isLegit.client.emit("Pvalidated");
                isLegit.client.isValid = true;
            } else {
                isLegit.client.emit("files", [{
                    name: "Password incorrect",
                    add: true,
                    isServerMSG: true
                }]);
            }
        }
        _.remove(ValidateList, isLegit);
    });

    socket.on("Ijoin", (roomNr) => {
        let isLegitRoom = _.find(RoomList, {
            nr: roomNr
        });
        if (_.has(socket, "inRoom")) {
            socket.leave(socket.inRoom);
            if (isLegitRoom != undefined) {
                isLegitRoom.members--;
            }
        }
        console.log(roomNr)
        if (isLegitRoom && socket.isValid) {
            if (isLegitRoom.members < MAX_MEMBERS) {
                socket.join(roomNr);
                socket.inRoom = roomNr;
                isLegitRoom.members++;
            } else {
                socket.emit("files", [{
                    name: "Room Is Full",
                    add: true,
                    isServerMSG: true
                }]);
            }
        } else {
            socket.emit("files", [{
                name: "Room Not Found",
                add: true,
                isServerMSG: true
            }]);
        }
    });

    socket.on("filelist", (obj) => {
        let RoomlistObj = _.find(RoomList, {
            nr: obj.room
        });
        if (!_.has(RoomlistObj, "host")) return;
        if (socket === RoomlistObj.host) {
            socket.in(RoomlistObj.nr).emit("files", obj.filelist);
        }
    });

    socket.on("ask", (obj) => {
        let RoomlistObj = _.find(RoomList, {
            nr: obj.room
        });
        let id = uid(5);

        RequestList.push({
            id: id,
            reqSocket: socket,
            filename: obj.filename
        });

        RoomlistObj.host.emit("ask", {
            filename: obj.filename,
            id: id,
            key: obj.key
        });
    });

    socket.on("verify", (obj) => {
        let reqObj = _.find(RequestList, {
            id: obj.id
        });
        reqObj.reqSocket.emit("verify", obj.hmac);
    });

    ss(socket).on("download", (stream, obj) => {
        let reqObj = _.find(RequestList, {
            id: obj.id
        });
        let streamclient = ss.createStream();

        ss(reqObj.reqSocket).emit("downloadclient", streamclient, {
            filename: reqObj.filename,
            key: obj.key,
            size: obj.size,
        });
        stream.pipe(streamclient)
    });

    socket.on("disconnect", () => {
        if (socket.inRoom != undefined) {
            let RoomlistObj = _.find(RoomList, {
                nr: socket.inRoom
            });
            if (RoomlistObj != undefined) {
                RoomlistObj.members--;
            }
            socket.leave(socket.inRoom);
        }
    });

    socket.on("reconnect", () => {
        //this may have to do with the room closed bug
        console.log("socket has recconected");
    });
});

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

setInterval(() => {
    _.forEach(RoomList, (obj) => {
        if (!_.has(obj, "host")) return;
        if (obj.host.disconnected) {
            _.forEach(io.to(obj.nr).sockets, (s) => {
                s.emit("files", [{
                    name: "Room Closed",
                    add: true,
                    isServerMSG: true
                }]);
                s.leave(obj.nr);
                s.inRoom = undefined;
            });
            _.remove(RoomList, obj);
        }
    });
}, 7000);

sticky.listen(server)

process.send({
    cmd: 'ready'
})
//server.listen(9000, "localhost");