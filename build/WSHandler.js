"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusError = exports.WSHandler = void 0;
const path_1 = require("path");
const ws_1 = require("ws");
const events_1 = require("events");
const WSConnection_1 = require("./WSConnection");
/**
 * Contains a WS Server and can be bound to a http server
 * Will handel event communication between clients and server
 */
class WSHandler extends ws_1.Server {
    constructor() {
        super({
            noServer: true,
            clientTracking: false,
        });
        this.localEmitters = [];
        this.connections = [];
        this.connectionFilter = [];
        this.eventDistibutionFilter = [];
        WSHandler.instance = this;
        this.on("connection", this.onConnection.bind(this));
        if (process) {
            process.on("exit", () => {
                this.connections.forEach(con => con.close());
            });
        }
    }
    static normalisePath(path) {
        return (0, path_1.normalize)(path).replace(/\/{0,1}(\?.*){0,1}$/, "");
    }
    /**
     * Returns a new Event Emitter that is bound to this Handler
     */
    createLocalEmitter() {
        return this.bindLocalEmitter(new events_1.EventEmitter({ captureRejections: true }));
    }
    /**
     * Binds a existing Event Emitter to this Handler\
     * !!! Will modify the emit method of the emitter !!!
     */
    bindLocalEmitter(eventEmitter) {
        if (typeof eventEmitter._WSHandler_originalEmit == "object")
            throw new Error("Emitter is bound. Cannot bind again");
        var emit = eventEmitter.emit.bind(eventEmitter);
        eventEmitter._WSHandler_originalEmit = emit;
        eventEmitter.emit = (eventName, ...args) => {
            this.distributeMessage(eventEmitter, { event: eventName, args });
            return emit(eventName, ...args);
        };
        this.localEmitters.push(eventEmitter);
        return eventEmitter;
    }
    /**
     * Will remove Event Emitter from this handler and repair the emit method
     */
    unbindLocalEmitter(eventEmitter) {
        if (typeof eventEmitter._WSHandler_originalEmit != "object")
            throw new Error("Emitter is not bound. Cannot unbind");
        eventEmitter.emit = eventEmitter._WSHandler_originalEmit;
        eventEmitter._WSHandler_originalEmit = undefined;
        return eventEmitter;
    }
    onConnection(ws, req) {
        var con = new WSConnection_1.WSConnection(ws, req);
        var results = this.connectionFilter.map(filter => filter(con, req));
        var ret = results.find(res => !!res);
        if (ret instanceof StatusError)
            return ws.close(); // TODO: Do something different with StatusError. WS Error codes are fixed and stupidly documented! See: https://github.com/websockets/ws/blob/HEAD/doc/ws.md#ws-error-codes
        con.on("close", this.cleanUpConList.bind(this));
        con.on("message", message => this.distributeMessage(con, message));
        this.connections.push(con);
    }
    /**
     * Distribute a event in the system by using  added filters
     * @param sender
     * @param message
     * @returns True if event was not dropped
     */
    distributeMessage(sender, message) {
        if (sender instanceof WSConnection_1.WSConnection &&
            this.eventDistibutionFilter.some(filter => !filter(sender, sender.req, "send", message.event, ...message.args)))
            return false; // Silently filter event out if sender is not permitted to send event (LocalEventEmitter is allways permitted)
        // Emit (without backloop) event to each local emitter if it was not send by this one
        this.localEmitters.forEach(e => e !== sender && e._WSHandler_originalEmit(message.event, ...message.args));
        // Send event to each connection that is permitted to recieve event
        for (const con of this.connections)
            if (!this.eventDistibutionFilter.some(filter => !filter(con, con.req, "recive", message.event, ...message.args)))
                con.send(message);
        return true;
    }
    /** Internal method!
     * Remove closed connections from the connection list
     */
    cleanUpConList() {
        this.connections = this.connections.filter(con => !con.closed);
    }
    /** ### Add a ConnectionFilter handler.
     * The handler should return null if connection is valid, and a StatusError if connection should be rejected.
     * You can set parameters on a connection using `connection.setParameter()` and later get then back
     * using `connection.getParameter()`. This allows storing user auth data or other things consistantly
     * on a connection.
     */
    addConnectionFilter(filter) {
        this.connectionFilter.push(filter);
    }
    /** ### Add a addEventDistibutionFilter handler.
     * Read jsdocs for `type EventDistibutionFilter` for more info.
     * You can set parameters on a connection using `connection.setParameter()` and later get then back
     * using `connection.getParameter()`. This allows storing user auth data or other things consistantly
     * on a connection.
     */
    addEventDistibutionFilter(filter) {
        this.eventDistibutionFilter.push(filter);
    }
    /**
     * Attach a http server to this Handler
     * @param srv
     * @param path
     */
    listen(srv, path) {
        const normalisedPath = path ? WSHandler.normalisePath(path) : null;
        srv.on("upgrade", (request, socket, head) => {
            if (!request.url)
                return socket.destroy();
            const pathname = WSHandler.normalisePath(request.url);
            if (!path || pathname == normalisedPath)
                this.handleUpgrade(request, socket, head, ws => this.emit("connection", ws, request));
            else
                return socket.destroy();
        });
    }
}
exports.WSHandler = WSHandler;
/** A Status error includes a status number and can be used as a statusCode in http protocol */
class StatusError extends Error {
    constructor(status, message) {
        super(`${status} - ${message}`);
        this.name = "StatusError";
        this.status = status;
    }
}
exports.StatusError = StatusError;
//# sourceMappingURL=WSHandler.js.map