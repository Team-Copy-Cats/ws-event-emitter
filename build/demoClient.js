"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const WSConnection_1 = require("./WSConnection");
// Client
const connection = new WSConnection_1.WSConnection(() => new ws_1.WebSocket("ws://localhost:8080/websocket"));
const clientEvents = connection.createLocalEmitter();
const CLI_ID = Math.round(Math.random() * 1000);
clientEvents.on("pong", () => console.log("recived pong"));
clientEvents.on("statusupdate", id => console.log(id));
connection.on("close", () => {
    console.log("CLOSED");
});
setInterval(() => {
    if (!connection.closed) {
        clientEvents.emit("ping");
        clientEvents.emit("statusupdate", CLI_ID);
    }
}, 1000);
//# sourceMappingURL=demoClient.js.map