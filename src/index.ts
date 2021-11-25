import {IncomingMessage} from "http";
import {WSConnection} from "./WSConnection";
import {StatusError} from "./WSHandler";

export {WSConnection} from "./WSConnection";
export {WSHandler, StatusError} from "./WSHandler";
export {WS_ERRORS} from "./WSErrors";

/**
 * A Connection Filter filters incomming ws connection using the underlying http IncommingMessage as a base\
 * Can be synchronous or asynchronous (Promise)
 * - Shuld Return StatusError or Trusy or throws StatusError if the connection is not allowed 
 * - Returns void or Falsy value if the connection is allowed
 * @param conPara The Custom Parameter of the connection (typescript only)
 * @param req The IncomingMessage of the http server for headers and other http related functions
 * @param connection The connection to be filtered
 * @returns Returns StatusError or throws if the connection is not allowed and void or Falsy value if the connection is allowed
 */
export type ConnectionFilter<conParaT> = (connection: WSConnection<conParaT>, req: IncomingMessage) => Promise<void> | void | false | Promise<StatusError> | StatusError | true;; 

/** ### Event Distibution Filter
 * A Event Distibution Filter determins how a certain even is forwarded to different handlers
 * 
 * The direction argument is the direction of the event (send or recive) and is seen from the perspective of the client
 * - send: The event is send from the client to the server
 * - recive: The event is recived from the server to the client
 * 
 * The connection argument is the connection the event is send from or recived to
 * Note: Local Handler will not be parsed by this filter
 * 
 * The event argument is the event itself
 * The args argument is the arguments of the event
 * 
 * All filter will be called in the order they were added
 * If all filters call allow the event will be forwarded to the handler
 * If one filter does not call allow the event will be blocked and later filter will not even be called
 * 
 * @param conPara The Custom Parameter of the connection (typescript only)
 * @param allow The function to allow the event
 * @param direction The direction of the event (send or recive)
 * @param connection The connection the event is send from or recived to
 * @param event The event itself
 * @param args The arguments of the event
 */
export type EventDistibutionFilter<conParaT> = (
  allow: () => void,
  direction: "send" | "recive",
  connection: WSConnection<conParaT>,
  eventName: string,
  ...eventArgs: JSONTypes[]
) => void;

export type WSEventMessage = WSEventMessageEvent | WSEventMessageError;

export interface WSEventMessageBase extends JSONObject {
  type: string;
}

export interface WSEventMessageEvent extends WSEventMessageBase {
  type: "event";
  event: string;
  args: JSONTypes[];
}

export interface WSEventMessageError extends WSEventMessageBase {
  type: "error";
  code: number;
  message: string;
}

export type JSONTypes = number | boolean | string | JSONObject | JSONArray;
export type JSONArray = JSONTypes[];
export interface JSONObject {
  [key: string]: JSONTypes;
}
