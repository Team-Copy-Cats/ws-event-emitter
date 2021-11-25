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
    localEmitters: (EventEmitter & {
        _originalEmit: any;
    })[];
    connections: WSConnection<conParaT>[];
    connectionFilter: ConnectionFilter<conParaT>[];
    eventDistibutionFilter: EventDistibutionFilter<conParaT>[];
    private static normalisePath;
    /**
     * Returns a new Event Emitter that is bound to this Handler
     */
    createLocalEmitter(): EventEmitter & {
        _originalEmit: any;
    };
    /**
     * Binds a existing Event Emitter to this Handler\
     * !!! Will modify the emit method of the emitter !!!
     */
    bindLocalEmitter<ev extends EventEmitter>(eventEmitter: ev): ev & {
        _originalEmit: any;
    };
    /**
     * Will remove Event Emitter from this handler and repair the emit method
     */
    unbindLocalEmitter<ev extends EventEmitter>(eventEmitter: ev & {
        _originalEmit: any;
    }): ev;
    constructor();
    private onConnection;
    /** Internal method!
     * Distribute a event in the system part A
     * => Check if the event is permitted to be send
     * @param sender The sender of the event
     * @param message The event message
     */
    private distributeEventPartA;
    /** Internal method!
     * Distribute a event in the system part B
     * => Filter out all connections that are allowed to recive the event
     * @param sender The sender of the event
     * @param message The event message
     */
    private distributeEventPartB;
    /** Internal method!
     * Chains a list of filters and runs them in order
     * @param direction "send" or "recive" from remote perspective (remote is sending / reciving)
     * @param connection The Connection that is sending or reciving
     * @param eventName The event that is being sent or recived
     * @param eventArgs The arguments of the event
     * @param allowedCallback Callback that is called if the event is allowed by all filters
     * @param i Should not be set manually! Recursive counter
     */
    private runEventDistributionFilters;
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
    status: number;
    name: string;
    code: number;
    constructor(status: number, message: string);
}
