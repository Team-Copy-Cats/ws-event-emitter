import {IncomingMessage} from "http";
import {WebSocket} from "ws";
import {EventEmitter} from "events";
import {JSONTypes, WSEventMessage, WSEventMessageBase, WSEventMessageEvent} from "./index";
import {StatusError} from "./WSHandler";

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
  /** ### Error Event
   * This event will fire if a error is recieved or something went wrong localy.
   * @param eventName
   * @param listener
   */
  on(eventName: "error", listener: (error: StatusError | Error | string, source?: unknown) => void): this;
  emit(eventName: "error", error: StatusError | Error | string, source?: unknown): boolean;

  /** ### Message Event
   * This event will fire if a WSEventMessage is recieved from this client.
   * It will fire without any permission checks as they are done in a WSHandler!
   * You should not use this event if you need the EventDistibutionFilter to work!
   * @param eventName
   * @param listener
   */
  on(eventName: "message", listener: (message: WSEventMessage) => void): this;
  emit(eventName: "message", message: WSEventMessage): boolean;

  /** ### Event Event
     * This event will fire if a atual event (WSEventMessageEvent) is recieved from this client.
     * It will fire without any permission checks as they are done in a WSHandler!
     * You should not use this event if you need the EventDistibutionFilter to work!
     * @param eventName
     * @param listener
     */
  on(eventName: "event", listener: (message: WSEventMessageEvent) => void): this;
  emit(eventName: "event", message: WSEventMessageEvent): boolean;

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
export class WSConnection<conParaT> extends EventEmitter {
  ws: WebSocket | null = null;
  req: IncomingMessage | undefined;
  conPara: conParaT | null = null;
  closed: boolean = false;
  closedClean: boolean = false;
  localEmitters: EventEmitter[] = [];
  autoReconnectTimeout: NodeJS.Timeout | null = null;

  constructor(ws: WebSocket | (() => WebSocket), req?: IncomingMessage) {
    super({captureRejections: true});

    // WS is passed as function (autoReconnect: on)
    if (typeof ws == "function") this.reconnect(ws);
    // WS is passed as function (autoReconnect: off)
    else {
      this.ws = ws;
      this.ws.on("close", this.close.bind(this));
      this.ws.on("message", this.onRawMessage.bind(this));
    }

    this.req = req;
  }

  private reconnect(func: () => WebSocket) {
    var reconnectHandler = () => {
      if (this.closedClean) return;
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
          if(this.ws) this.ws.on("error", (err) => this.emit("error", err, this.ws));
        })
        .on("close", reconnectHandler)
        .on("message", this.onRawMessage.bind(this));
    } catch (err) {
      reconnectHandler();
    }
  }

  /** Returns a new Event Emitter that is bound to this Connection */
  createLocalEmitter(): EventEmitter {
    return this.bindLocalEmitter(new EventEmitter({captureRejections: true}));
  }

  /**
   * Binds a existing Event Emitter to this Connection\
   * !!! Will modify the emit method of the emitter !!!
   */
  bindLocalEmitter(eventEmitter: EventEmitter): EventEmitter {
    if (typeof (eventEmitter as any)._WSHandler_originalEmit == "object") throw new Error("Emitter is bound. Cannot bind again");
    var emit = eventEmitter.emit.bind(eventEmitter);
    (eventEmitter as any)._WSHandler_originalEmit = emit;
    eventEmitter.emit = (eventName: string, ...args: JSONTypes[]) => {
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

  unbindLocalEmitter(eventEmitter: EventEmitter): EventEmitter {
    if (typeof (eventEmitter as any)._WSHandler_originalEmit != "object") throw new Error("Emitter is not bound. Cannot unbind");
    eventEmitter.emit = (eventEmitter as any)._WSHandler_originalEmit as (eventName: string | symbol, ...args: any[]) => boolean;
    (eventEmitter as any)._WSHandler_originalEmit = undefined;
    this.localEmitters = this.localEmitters.filter((e) => e != eventEmitter);
    return eventEmitter;
  }

  /** Internal ws.message handler */
  private onRawMessage(raw: string, isBinary: boolean) {
    if (isBinary) return; // TODO: Send ERROR
    var data = null;
    try {
      data = JSON.parse(raw) as JSONTypes;
    } catch (err) {
      return; // TODO: Send ERROR
    } finally {
      if (data === null) return; // TODO: Send ERROR
      if (typeof data != "object") return; // TODO: Send ERROR
      if (Array.isArray(data)) return; // TODO: Send ERROR
      if (typeof data.type != "string") return; // TODO: Send ERROR
      this.onParsedMessage(data as WSEventMessageBase);
    }
  }

  /** Internal message handler */
  private onParsedMessage(message: WSEventMessageBase) {
    switch (message.type) {
      case "event":
        if (typeof message.event != "string") return; 
        if (typeof message.args != "object") return;
        if (!Array.isArray(message.args)) return;
        var event = message as WSEventMessageEvent;
        this.emit("event", event);
        this.localEmitters.forEach(e => (e as any)._WSHandler_originalEmit(event.event, ...event.args));
        break;

      case "error":
        if (typeof message.code != "number") return; 
        if (typeof message.message != "string") return;
        this.emit("error", new StatusError(message.code, message.message));
        break;

      default:
        this.emit("error", new Error("Unknown message type: " + message.type));
        break;
    }
  }

  /** Send a WSEventMessage to this connection */
  public send(message: WSEventMessage) {
    if (!this.closed && this.ws) this.ws.send(JSON.stringify(message));
    else {
      console.error("Event was lost due to web scoket being closed.");
    }
  }

  /** Close this connection */
  public close() {
    this.closed = true;
    this.closedClean = true;
    if (this.ws) this.ws.close();
    this.emit("close");
    this.ws = null;
  }

  /** Set Custom Parameters (Can be any)*/
  public setParameter(para: conParaT) {
    this.conPara = para;
  }

  /** Get Custom Parameters (Can be any)*/
  public getParameter() {
    return this.conPara;
  }
}
