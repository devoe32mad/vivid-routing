"use strict";

const fs = require("fs");
const path = require("path");
const serverPath = path.join(__dirname, "server.js");
let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes('require("./vivid-public-content")')) {
  const anchor = 'const crypto = require("crypto");';
  if (!source.includes(anchor)) throw new Error("Unable to install Vivid public content import.");
  source = source.replace(anchor, `${anchor}\nconst { registerVividContentRoutes } = require("./vivid-public-content");`);
}

if (!source.includes("registerVividContentRoutes(app);")) {
  const anchor = 'app.get("/r/:qrId", async (req, res) => {';
  if (!source.includes(anchor)) throw new Error("Unable to install Vivid public content route.");
  source = source.replace(anchor, `registerVividContentRoutes(app);\n${anchor}`);
}

fs.writeFileSync(serverPath, source);
console.log("Vivid public content installed.");
