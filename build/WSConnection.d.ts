/// <reference types="node" />
import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { WSEventMessage } from "./index";
/** ### WSConnection class
 * This class represents a connection.\
 * The conPara represents a Custom Parameter. You can assign connection specific data
 * like a user and it will be availabel later (Example: User Auth Data)\
 * On a client you should create a instance of this class like this:
 * ```javascript
 * new WSConnection(() => new WebSocket("ws://localhost:8080/websocket"))
 * ```
 * This will enable auto reconnect, as the given function will be executed
 * if a websocket closes unexpectedly
 * @param ws Actual WebSocket to transfere JSON data
 * @param req The IncomingMessage of the http server for headers and other http related functions
 */
export interface WSConnection<conParaT> {
    /** ### Message Event
     * This event will fire if a WSEventMessage is recieved from this client.
     * It will fire without any permission checks as they are done in a WSHandler!
     * You should not use this event if you need the EventDistibutionFilter to work!
     * @param eventName
     * @param listener
     */
    on(eventName: "message", listener: (message: WSEventMessage) => void): this;
    emit(eventName: "message", message: WSEventMessage): boolean;
    /** ### Close Event
     * This event will fire if a connection is closed.
     * Code and Message is taken from the ws module. See docs for more Info
     * @param eventName
     * @param listener
     */
    on(eventName: "close", listener: (code: number, message?: string) => void): this;
    emit(eventName: "close", code?: number, message?: string): boolean;
    /** ### close_reconnect Event
     * This event will fire if a connection is closed from remote and auto reconnect is active.
     * The instance will try to recreate the websocket after 5s
     * You need to give the web socket as a function for this to work
     * Samle:
     * ```javascript
     * new WSConnection(() => new WebSocket("ws://localhost:8080/websocket"))
     * ```
     * @param eventName
     * @param listener
     */
    on(eventName: "close_reconnect", listener: () => void): this;
    emit(eventName: "close_reconnect"): boolean;
}
export declare class WSConnection<conParaT> extends EventEmitter {
    ws: WebSocket | null;
    req: IncomingMessage | undefined;
    conPara: conParaT | null;
    closed: boolean;
    closedClean: boolean;
    localEmitters: EventEmitter[];
    autoReconnectTimeout: NodeJS.Timeout | null;
    constructor(ws: WebSocket | (() => WebSocket), req?: IncomingMessage);
    private reconnect;
    /** Returns a new Event Emitter that is bound to this Connection */
    createLocalEmitter(): EventEmitter;
    /**
     * Binds a existing Event Emitter to this Connection\
     * !!! Will modify the emit method of the emitter !!!
     */
    bindLocalEmitter(eventEmitter: EventEmitter): EventEmitter;
    unbindLocalEmitter(eventEmitter: EventEmitter): EventEmitter;
    /** Internal ws.message handler */
    private onRawMessage;
    /** Internal message handler */
    private onMessage;
    /** Send a WSEventMessage to this connection */
    send(message: WSEventMessage): void;
    /** Close this connection */
    close(): void;
    /** Set Custom Parameters (Can be any)*/
    setParameter(para: conParaT): void;
    /** Get Custom Parameters (Can be any)*/
    getParameter(): conParaT | null;
}
