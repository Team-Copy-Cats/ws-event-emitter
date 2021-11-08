const {WSHandler} = require("./build/index");

const http = require("http");
const server = http.createServer(function (req, res) {
  res.writeHead(200);
  res.end("Hello, World!");
});
server.listen(8080);

// Server
const handler = new WSHandler();
handler.listen(server, "/websocket");

handler.addConnectionFilter((con, req) => {
  // Very unsafe!!! Just an example
  con.setParameter({
    user: req.headers["user-agent"],
  });  
  return null;
});

handler.addEventDistibutionFilter((con, req, dir, event, args) => {
    // Very unsafe!!! Just an example
    if(con.getParameter().user == "admin") return true;

    // Allow client to recive event pong and statusupdate
    if(dir == "recive" && ["pong", "statusupdate"].includes(event)) return true;

    // Allow client to send event ping and statusupdate
    if(dir == "send" && ["ping", "statusupdate"].includes(event)) return true;

    // Default to disallow
    return false;
});

const serverEvents = handler.createLocalEmitter();
serverEvents.on("ping", () => serverEvents.emit("pong"));


