import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { NextApiResponseServerIO } from "@/components/socket";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log("✨ Socket.IO server is initializing...");
    const io = new ServerIO(res.socket.server as any, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });
    res.socket.server.io = io;
  } else {
    console.log("Socket.IO server already running.");
  }
  res.end();
}
