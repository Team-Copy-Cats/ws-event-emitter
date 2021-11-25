import { EventEmitter } from "stream";
import { WSHandler } from "./WSHandler";

const http = require("http");
const server = http.createServer(function (req: any, res: { writeHead: (arg0: number) => void; end: (arg0: string) => void; }) {
  res.writeHead(200);
  res.end("Hello, World!");
});
server.listen(8080);

// Server
const handler = new WSHandler<{user: string | undefined}>();
handler.listen(server, "/websocket");

handler.addConnectionFilter((con, req) => {
  // Very unsafe!!! Just an example
  con.setParameter({
    user: req.headers["user-agent"],
  });

  return false;
});

handler.addEventDistibutionFilter((allow, dir, con, event) => {
    // Very unsafe!!! Just an example
    if(con.getParameter()?.user == "admin") return allow();

    // Allow client to recive event pong and statusupdate
    if(dir == "recive" && ["pong", "statusupdate"].includes(event)) return allow();

    // Allow client to send event ping and statusupdate
    if(dir == "send" && ["ping", "statusupdate"].includes(event)) return allow();

    return false;
});


const ev = new EventEmitter();
const serverEvents = handler.bindLocalEmitter(ev);
serverEvents.on("ping", () => {
  console.log("Server recived ping");
  serverEvents.emit("pong");
});

serverEvents.on("statusupdate", () => {
  console.log("Server recived statusupdate");
});
