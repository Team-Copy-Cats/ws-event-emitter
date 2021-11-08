/// <reference types="node" />
import { IncomingMessage } from "http";
import { WSConnection } from "./WSConnection";
import { StatusError } from "./WSHandler";
export { WSConnection } from "./WSConnection";
export { WSHandler, StatusError } from "./WSHandler";
/**
 * A Connection Filter filters incomming ws connection using the underlying http IncommingMessage as a base\
 * It should return null if connection is valid, and a StatusError if connection should be rejected
 */
export declare type ConnectionFilter<conParaT> = (connection: WSConnection<conParaT>, req: IncomingMessage) => null | StatusError;
/**
 * A Event Distibution Filter determins how a certain even is forwarded to different handlers:
 * - A Local handler on the server will allways recive any event
 * - A Remote device will only be able to recive or emit a event if the filter function returns true meaning "allowed"
 * - Direction argument will be "send" if the client emits and "recive" if the client recives event
 */
export declare type EventDistibutionFilter<conParaT> = (connection: WSConnection<conParaT>, request: IncomingMessage, direction: "send" | "recive", eventName: string, ...args: JSONTypes[]) => boolean;
export interface WSEventMessage extends JSONObject {
    event: string;
    args: JSONTypes[];
}
export declare type JSONTypes = number | boolean | string | JSONObject | JSONArray;
export declare type JSONArray = JSONTypes[];
export interface JSONObject {
    [key: string]: JSONTypes;
}
