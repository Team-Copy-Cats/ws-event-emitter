import {IncomingMessage, Server as HttpServer} from "http";
import {Socket} from "net";
import {normalize} from "path";
import {Server as WebSocketServer, WebSocket} from "ws";
import {EventEmitter} from "events";
import {WSConnection} from "./WSConnection";
import {ConnectionFilter, EventDistibutionFilter, JSONTypes, WSEventMessageEvent} from "./index";
import {WS_ERRORS} from "./WSErrors";

/**
 * Contains a WS Server and can be bound to a http server
 * Will handel event communication between clients and server
 */
export class WSHandler<conParaT = unknown> extends WebSocketServer {
  /** Will store the last instance created */
  public static instance: WebSocketServer;

  localEmitters: (EventEmitter & {_originalEmit: any})[] = [];
  connections: WSConnection<conParaT>[] = [];
  connectionFilter: ConnectionFilter<conParaT>[] = [];
  eventDistibutionFilter: EventDistibutionFilter<conParaT>[] = [];

  private static normalisePath(path: string): string {
    return normalize(path).replace(/\/{0,1}(\?.*){0,1}$/, "");
  }

  /**
   * Returns a new Event Emitter that is bound to this Handler
   */
  createLocalEmitter(): EventEmitter & {_originalEmit: any} {
    return this.bindLocalEmitter(new EventEmitter({captureRejections: true}));
  }

  /**
   * Binds a existing Event Emitter to this Handler\
   * !!! Will modify the emit method of the emitter !!!
   */
  bindLocalEmitter<ev extends EventEmitter>(eventEmitter: ev): ev & {_originalEmit: any} {
    if (typeof (eventEmitter as ev & {_originalEmit: any})._originalEmit == "object") throw new Error("Emitter is bound. Cannot bind again");
    var emit = eventEmitter.emit.bind(eventEmitter);
    (eventEmitter as ev & {_originalEmit: any})._originalEmit = emit;
    eventEmitter.emit = (eventName: string, ...args: JSONTypes[]) => {
      this.distributeEventPartA(eventEmitter, {type: "event", event: eventName, args});
      return emit(eventName, ...args);
    };
    this.localEmitters.push(eventEmitter as any);
    return eventEmitter as ev & {_originalEmit: any};
  }

  /**
   * Will remove Event Emitter from this handler and repair the emit method
   */
  unbindLocalEmitter<ev extends EventEmitter>(eventEmitter: ev & {_originalEmit: any}): ev {
    if (typeof (eventEmitter as any)._originalEmit != "object") throw new Error("Emitter is not bound. Cannot unbind");
    eventEmitter.emit = (eventEmitter as any)._originalEmit as (eventName: string | symbol, ...args: any[]) => boolean;
    (eventEmitter as any)._originalEmit = undefined;
    this.localEmitters = this.localEmitters.filter(e => e !== eventEmitter);
    return eventEmitter;
  }

  constructor() {
    super({
      noServer: true,
      clientTracking: false,
    });
    WSHandler.instance = this;
    this.on("connection", this.onConnection.bind(this));

    if (process) {
      process.on("exit", () => {
        this.connections.forEach(con => con.close());
      });
    }
  }

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    var con = new WSConnection<conParaT>(ws, req);
    var filterResult = Promise.all(this.connectionFilter.map(filter => filter(con, req)));

    // Error Condition
    filterResult.catch(err => {
      if (err instanceof StatusError) con.send({type: "error", code: err.code, message: err.message});
      else con.send({type: "error", ...WS_ERRORS.CONNECTION_REFUSED});
      con.close();
    });
    filterResult.then(res => {
      if (res.some(r => r instanceof StatusError)) {
        var statusError = res.find(r => r instanceof StatusError) as StatusError;
        con.send({type: "error", code: statusError.code, message: statusError.message});
        con.close();
      } else if (res.some(r => !!r)) {
        con.send({type: "error", ...WS_ERRORS.CONNECTION_REFUSED});
        con.close();
      } else {
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
  private distributeEventPartA(sender: WSConnection<conParaT> | EventEmitter, message: WSEventMessageEvent) {
    if (sender instanceof WSConnection) {
      // If sender is Remote, first check asyncronosly if sender is allowed to send
      this.runEventDistributionFilters("send", sender, message.event, message.args, () => this.distributeEventPartB(sender, message));
    } else {
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
  private distributeEventPartB(sender: WSConnection<conParaT> | EventEmitter, message: WSEventMessageEvent) {
    // Emit (without backloop) event to each local emitter if it was not the sender
    this.localEmitters.forEach(e => e !== sender && (e as any)._originalEmit(message.event, ...message.args));

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
  private runEventDistributionFilters(
    direction: "send" | "recive",
    connection: WSConnection<conParaT>,
    eventName: string,
    eventArgs: JSONTypes[],
    allowedCallback: () => void,
    i = 0
  ) {
    if (this.eventDistibutionFilter.length <= i) allowedCallback();
    else
      this.eventDistibutionFilter[i](
        () => this.runEventDistributionFilters(direction, connection, eventName, eventArgs, allowedCallback, i + 1),
        direction,
        connection,
        eventName,
        ...eventArgs
      );
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
  code: number;
  constructor(public status: number, message: string) {
    super(`${status} - ${message}`);
    this.code = status;
  }
}
