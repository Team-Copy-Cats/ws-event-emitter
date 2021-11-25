"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const WSHandler_1 = require("./WSHandler");
const http = require("http");
const server = http.createServer(function (req, res) {
    res.writeHead(200);
    res.end("Hello, World!");
});
server.listen(8080);
// Server
const handler = new WSHandler_1.WSHandler();
handler.listen(server, "/websocket");
handler.addConnectionFilter((con, req) => {
    // Very unsafe!!! Just an example
    con.setParameter({
        user: req.headers["user-agent"],
    });
    return false;
});
handler.addEventDistibutionFilter((allow, dir, con, event) => {
    var _a;
    // Very unsafe!!! Just an example
    if (((_a = con.getParameter()) === null || _a === void 0 ? void 0 : _a.user) == "admin")
        return allow();
    // Allow client to recive event pong and statusupdate
    if (dir == "recive" && ["pong", "statusupdate"].includes(event))
        return allow();
    // Allow client to send event ping and statusupdate
    if (dir == "send" && ["ping", "statusupdate"].includes(event))
        return allow();
    return false;
});
const ev = new stream_1.EventEmitter();
const serverEvents = handler.bindLocalEmitter(ev);
serverEvents.on("ping", () => {
    console.log("Server recived ping");
    serverEvents.emit("pong");
});
serverEvents.on("statusupdate", () => {
    console.log("Server recived statusupdate");
});
//# sourceMappingURL=demoServer.js.map