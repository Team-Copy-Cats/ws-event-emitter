"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSConnection = void 0;
const events_1 = require("events");
const WSHandler_1 = require("./WSHandler");
class WSConnection extends events_1.EventEmitter {
    constructor(ws, req) {
        super({ captureRejections: true });
        this.ws = null;
        this.conPara = null;
        this.closed = false;
        this.closedClean = false;
        this.localEmitters = [];
        this.autoReconnectTimeout = null;
        // WS is passed as function (autoReconnect: on)
        if (typeof ws == "function")
            this.reconnect(ws);
        // WS is passed as function (autoReconnect: off)
        else {
            this.ws = ws;
            this.ws.on("close", this.close.bind(this));
            this.ws.on("message", this.onRawMessage.bind(this));
        }
        this.req = req;
    }
    reconnect(func) {
        var reconnectHandler = () => {
            if (this.closedClean)
                return;
            console.warn("[WSConnection] WS lost connection, reconnecting in 5s...");
            this.closed = true;
            this.emit("close_reconnect");
            this.autoReconnectTimeout = setTimeout(() => {
                this.reconnect(func);
            }, 5000);
        };
        try {
            this.ws = func()
                .on("open", () => {
                this.closed = false;
                if (this.ws)
                    this.ws.on("error", (err) => this.emit("error", err, this.ws));
            })
                .on("close", reconnectHandler)
                .on("message", this.onRawMessage.bind(this));
        }
        catch (err) {
            reconnectHandler();
        }
    }
    /** Returns a new Event Emitter that is bound to this Connection */
    createLocalEmitter() {
        return this.bindLocalEmitter(new events_1.EventEmitter({ captureRejections: true }));
    }
    /**
     * Binds a existing Event Emitter to this Connection\
     * !!! Will modify the emit method of the emitter !!!
     */
    bindLocalEmitter(eventEmitter) {
        if (typeof eventEmitter._WSHandler_originalEmit == "object")
            throw new Error("Emitter is bound. Cannot bind again");
        var emit = eventEmitter.emit.bind(eventEmitter);
        eventEmitter._WSHandler_originalEmit = emit;
        eventEmitter.emit = (eventName, ...args) => {
            this.send({
                type: "event",
                event: eventName,
                args: args,
            });
            return true;
        };
        this.localEmitters.push(eventEmitter);
        return eventEmitter;
    }
    unbindLocalEmitter(eventEmitter) {
        if (typeof eventEmitter._WSHandler_originalEmit != "object")
            throw new Error("Emitter is not bound. Cannot unbind");
        eventEmitter.emit = eventEmitter._WSHandler_originalEmit;
        eventEmitter._WSHandler_originalEmit = undefined;
        this.localEmitters = this.localEmitters.filter((e) => e != eventEmitter);
        return eventEmitter;
    }
    /** Internal ws.message handler */
    onRawMessage(raw, isBinary) {
        if (isBinary)
            return; // TODO: Send ERROR
        var data = null;
        try {
            data = JSON.parse(raw);
        }
        catch (err) {
            return; // TODO: Send ERROR
        }
        finally {
            if (data === null)
                return; // TODO: Send ERROR
            if (typeof data != "object")
                return; // TODO: Send ERROR
            if (Array.isArray(data))
                return; // TODO: Send ERROR
            if (typeof data.type != "string")
                return; // TODO: Send ERROR
            this.onParsedMessage(data);
        }
    }
    /** Internal message handler */
    onParsedMessage(message) {
        switch (message.type) {
            case "event":
                if (typeof message.event != "string")
                    return;
                if (typeof message.args != "object")
                    return;
                if (!Array.isArray(message.args))
                    return;
                var event = message;
                this.emit("event", event);
                this.localEmitters.forEach(e => e._WSHandler_originalEmit(event.event, ...event.args));
                break;
            case "error":
                if (typeof message.code != "number")
                    return;
                if (typeof message.message != "string")
                    return;
                this.emit("error", new WSHandler_1.StatusError(message.code, message.message));
                break;
            default:
                this.emit("error", new Error("Unknown message type: " + message.type));
                break;
        }
    }
    /** Send a WSEventMessage to this connection */
    send(message) {
        if (!this.closed && this.ws)
            this.ws.send(JSON.stringify(message));
        else {
            console.error("Event was lost due to web scoket being closed.");
        }
    }
    /** Close this connection */
    close() {
        this.closed = true;
        this.closedClean = true;
        if (this.ws)
            this.ws.close();
        this.emit("close");
        this.ws = null;
    }
    /** Set Custom Parameters (Can be any)*/
    setParameter(para) {
        this.conPara = para;
    }
    /** Get Custom Parameters (Can be any)*/
    getParameter() {
        return this.conPara;
    }
}
exports.WSConnection = WSConnection;
//# sourceMappingURL=WSConnection.js.map