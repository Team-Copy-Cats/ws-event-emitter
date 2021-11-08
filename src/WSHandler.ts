import {IncomingMessage, Server as HttpServer} from "http";
import {Socket} from "net";
import {normalize} from "path";
import {Server as WebSocketServer, WebSocket} from "ws";
import {EventEmitter} from "events";
import {WSConnection} from "./WSConnection";
import {ConnectionFilter, EventDistibutionFilter, JSONTypes, WSEventMessage} from "./index";

/**
 * Contains a WS Server and can be bound to a http server
 * Will handel event communication between clients and server
 */
export class WSHandler<conParaT = unknown> extends WebSocketServer {
  /** Will store the last instance created */
  public static instance: WebSocketServer;

  localEmitters: EventEmitter[] = [];
  connections: WSConnection<conParaT>[] = [];
  connectionFilter: ConnectionFilter<conParaT>[] = [];
  eventDistibutionFilter: EventDistibutionFilter<conParaT>[] = [];

  private static normalisePath(path: string): string {
    return normalize(path).replace(/\/{0,1}(\?.*){0,1}$/, "");
  }

  /**
   * Returns a new Event Emitter that is bound to this Handler
   */
  createLocalEmitter(): EventEmitter {
    return this.bindLocalEmitter(new EventEmitter({captureRejections: true}));
  }

  /**
   * Binds a existing Event Emitter to this Handler\
   * !!! Will modify the emit method of the emitter !!!
   */
  bindLocalEmitter(eventEmitter: EventEmitter): EventEmitter {
    if(typeof (eventEmitter as any)._WSHandler_originalEmit == "object") throw new Error("Emitter is bound. Cannot bind again")
    var emit = eventEmitter.emit.bind(eventEmitter);
    (eventEmitter as any)._WSHandler_originalEmit = emit;
    eventEmitter.emit = (eventName: string, ...args: JSONTypes[]) => {
      this.distributeMessage(eventEmitter, {event: eventName, args});
      return emit(eventName, ...args);
    };
    this.localEmitters.push(eventEmitter);
    return eventEmitter;
  }

  /**
   * Will remove Event Emitter from this handler and repair the emit method
   */
  unbindLocalEmitter(eventEmitter: EventEmitter): EventEmitter {
    if(typeof (eventEmitter as any)._WSHandler_originalEmit != "object") throw new Error("Emitter is not bound. Cannot unbind")
    eventEmitter.emit = (eventEmitter as any)._WSHandler_originalEmit as (eventName: string | symbol, ...args: any[]) => boolean;
    (eventEmitter as any)._WSHandler_originalEmit = undefined;
    return eventEmitter;
  }

  constructor() {
    super({
      noServer: true,
      clientTracking: false,
    });
    WSHandler.instance = this;
    this.on("connection", this.onConnection.bind(this));

    if(process) {
      process.on("exit", () => {
        this.connections.forEach(con => con.close());
      });
    }
  }

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    var con = new WSConnection<conParaT>(ws, req);
    var results = this.connectionFilter.map(filter => filter(con, req));
    var ret = results.find(res => !!res);
    if (ret instanceof StatusError) return ws.close(); // TODO: Do something different with StatusError. WS Error codes are fixed and stupidly documented! See: https://github.com/websockets/ws/blob/HEAD/doc/ws.md#ws-error-codes
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
  private distributeMessage(sender: WSConnection<conParaT> | EventEmitter, message: WSEventMessage): boolean {
    if (
      sender instanceof WSConnection &&
      this.eventDistibutionFilter.some(filter => !filter(sender, sender.req as IncomingMessage, "send", message.event, ...message.args))
    )
      return false; // Silently filter event out if sender is not permitted to send event (LocalEventEmitter is allways permitted)

    // Emit (without backloop) event to each local emitter if it was not send by this one
    this.localEmitters.forEach(e => e !== sender && (e as any)._WSHandler_originalEmit(message.event, ...message.args));

    // Send event to each connection that is permitted to recieve event
    for (const con of this.connections)
      if (!this.eventDistibutionFilter.some(filter => !filter(con, con.req as IncomingMessage, "recive", message.event, ...message.args)))
        con.send(message);

    return true;
  }

  /** Internal method!
   * Remove closed connections from the connection list
   */
  private cleanUpConList() {
    this.connections = this.connections.filter(con => !con.closed);
  }

  /** ### Add a ConnectionFilter handler.
   * The handler should return null if connection is valid, and a StatusError if connection should be rejected.
   * You can set parameters on a connection using `connection.setParameter()` and later get then back
   * using `connection.getParameter()`. This allows storing user auth data or other things consistantly
   * on a connection.
   */
  addConnectionFilter(filter: ConnectionFilter<conParaT>) {
    this.connectionFilter.push(filter);
  }

  /** ### Add a addEventDistibutionFilter handler.
   * Read jsdocs for `type EventDistibutionFilter` for more info.
   * You can set parameters on a connection using `connection.setParameter()` and later get then back
   * using `connection.getParameter()`. This allows storing user auth data or other things consistantly
   * on a connection.
   */
  addEventDistibutionFilter(filter: EventDistibutionFilter<conParaT>) {
    this.eventDistibutionFilter.push(filter);
  }

  /**
   * Attach a http server to this Handler
   * @param srv
   * @param path
   */
  listen(srv: HttpServer, path?: string) {
    const normalisedPath = path ? WSHandler.normalisePath(path) : null;
    srv.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
      if (!request.url) return socket.destroy();
      const pathname = WSHandler.normalisePath(request.url);
      if (!path || pathname == normalisedPath) this.handleUpgrade(request, socket, head, ws => this.emit("connection", ws, request));
      else return socket.destroy();
    });
  }
}

/** A Status error includes a status number and can be used as a statusCode in http protocol */
export class StatusError extends Error {
  name = "StatusError";
  status: number;
  constructor(status: number, message: string) {
    super(`${status} - ${message}`);
    this.status = status;
  }
}
