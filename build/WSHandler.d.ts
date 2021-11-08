/// <reference types="node" />
import { Server as HttpServer } from "http";
import { Server as WebSocketServer } from "ws";
import { EventEmitter } from "events";
import { WSConnection } from "./WSConnection";
import { ConnectionFilter, EventDistibutionFilter } from "./index";
/**
 * Contains a WS Server and can be bound to a http server
 * Will handel event communication between clients and server
 */
export declare class WSHandler<conParaT = unknown> extends WebSocketServer {
    /** Will store the last instance created */
    static instance: WebSocketServer;
    localEmitters: EventEmitter[];
    connections: WSConnection<conParaT>[];
    connectionFilter: ConnectionFilter<conParaT>[];
    eventDistibutionFilter: EventDistibutionFilter<conParaT>[];
    private static normalisePath;
    /**
     * Returns a new Event Emitter that is bound to this Handler
     */
    createLocalEmitter(): EventEmitter;
    /**
     * Binds a existing Event Emitter to this Handler\
     * !!! Will modify the emit method of the emitter !!!
     */
    bindLocalEmitter(eventEmitter: EventEmitter): EventEmitter;
    /**
     * Will remove Event Emitter from this handler and repair the emit method
     */
    unbindLocalEmitter(eventEmitter: EventEmitter): EventEmitter;
    constructor();
    private onConnection;
    /**
     * Distribute a event in the system by using  added filters
     * @param sender
     * @param message
     * @returns True if event was not dropped
     */
    private distributeMessage;
    /** Internal method!
     * Remove closed connections from the connection list
     */
    private cleanUpConList;
    /** ### Add a ConnectionFilter handler.
     * The handler should return null if connection is valid, and a StatusError if connection should be rejected.
     * You can set parameters on a connection using `connection.setParameter()` and later get then back
     * using `connection.getParameter()`. This allows storing user auth data or other things consistantly
     * on a connection.
     */
    addConnectionFilter(filter: ConnectionFilter<conParaT>): void;
    /** ### Add a addEventDistibutionFilter handler.
     * Read jsdocs for `type EventDistibutionFilter` for more info.
     * You can set parameters on a connection using `connection.setParameter()` and later get then back
     * using `connection.getParameter()`. This allows storing user auth data or other things consistantly
     * on a connection.
     */
    addEventDistibutionFilter(filter: EventDistibutionFilter<conParaT>): void;
    /**
     * Attach a http server to this Handler
     * @param srv
     * @param path
     */
    listen(srv: HttpServer, path?: string): void;
}
/** A Status error includes a status number and can be used as a statusCode in http protocol */
export declare class StatusError extends Error {
    name: string;
    status: number;
    constructor(status: number, message: string);
}
