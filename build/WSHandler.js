"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusError = exports.WSHandler = void 0;
const path_1 = require("path");
const ws_1 = require("ws");
const events_1 = require("events");
const WSConnection_1 = require("./WSConnection");
const WSErrors_1 = require("./WSErrors");
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
        if (typeof eventEmitter._originalEmit == "object")
            throw new Error("Emitter is bound. Cannot bind again");
        var emit = eventEmitter.emit.bind(eventEmitter);
        eventEmitter._originalEmit = emit;
        eventEmitter.emit = (eventName, ...args) => {
            this.distributeEventPartA(eventEmitter, { type: "event", event: eventName, args });
            return emit(eventName, ...args);
        };
        this.localEmitters.push(eventEmitter);
        return eventEmitter;
    }
    /**
     * Will remove Event Emitter from this handler and repair the emit method
     */
    unbindLocalEmitter(eventEmitter) {
        if (typeof eventEmitter._originalEmit != "object")
            throw new Error("Emitter is not bound. Cannot unbind");
        eventEmitter.emit = eventEmitter._originalEmit;
        eventEmitter._originalEmit = undefined;
        this.localEmitters = this.localEmitters.filter(e => e !== eventEmitter);
        return eventEmitter;
    }
    onConnection(ws, req) {
        var con = new WSConnection_1.WSConnection(ws, req);
        var filterResult = Promise.all(this.connectionFilter.map(filter => filter(con, req)));
        // Error Condition
        filterResult.catch(err => {
            if (err instanceof StatusError)
                con.send({ type: "error", code: err.code, message: err.message });
            else
                con.send({ type: "error", ...WSErrors_1.WS_ERRORS.CONNECTION_REFUSED });
            con.close();
        });
        filterResult.then(res => {
            if (res.some(r => r instanceof StatusError)) {
                var statusError = res.find(r => r instanceof StatusError);
                con.send({ type: "error", code: statusError.code, message: statusError.message });
                con.close();
            }
            else if (res.some(r => !!r)) {
                con.send({ type: "error", ...WSErrors_1.WS_ERRORS.CONNECTION_REFUSED });
                con.close();
            }
            else {
                // Sucessful connection
                con.on("close", this.cleanUpConList.bind(this));
                con.on("event", message => this.distributeEventPartA(con, message));
                this.connections.push(con);
            }
        });
    }
    /** Internal method!
     * Distribute a event in the system part A
     * => Check if the event is permitted to be send
     * @param sender The sender of the event
     * @param message The event message
     */
    distributeEventPartA(sender, message) {
        if (sender instanceof WSConnection_1.WSConnection) {
            // If sender is Remote, first check asyncronosly if sender is allowed to send
            this.runEventDistributionFilters("send", sender, message.event, message.args, () => this.distributeEventPartB(sender, message));
        }
        else {
            // If sender is local, jump to Part B instantly
            this.distributeEventPartB(sender, message);
        }
    }
    /** Internal method!
     * Distribute a event in the system part B
     * => Filter out all connections that are allowed to recive the event
     * @param sender The sender of the event
     * @param message The event message
     */
    distributeEventPartB(sender, message) {
        // Emit (without backloop) event to each local emitter if it was not the sender
        this.localEmitters.forEach(e => e !== sender && e._originalEmit(message.event, ...message.args));
        // Send event to each connection that is permitted to recieve event
        for (const con of this.connections)
            this.runEventDistributionFilters("recive", con, message.event, message.args, () => {
                con.send(message);
            });
    }
    /** Internal method!
     * Chains a list of filters and runs them in order
     * @param direction "send" or "recive" from remote perspective (remote is sending / reciving)
     * @param connection The Connection that is sending or reciving
     * @param eventName The event that is being sent or recived
     * @param eventArgs The arguments of the event
     * @param allowedCallback Callback that is called if the event is allowed by all filters
     * @param i Should not be set manually! Recursive counter
     */
    runEventDistributionFilters(direction, connection, eventName, eventArgs, allowedCallback, i = 0) {
        if (this.eventDistibutionFilter.length <= i)
            allowedCallback();
        else
            this.eventDistibutionFilter[i](() => this.runEventDistributionFilters(direction, connection, eventName, eventArgs, allowedCallback, i + 1), direction, connection, eventName, ...eventArgs);
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
        this.status = status;
        this.name = "StatusError";
        this.code = status;
    }
}
exports.StatusError = StatusError;
//# sourceMappingURL=WSHandler.js.map