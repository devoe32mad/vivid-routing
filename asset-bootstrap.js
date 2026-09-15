const path = require("path");
const express = require("express");

const createExpressApp = express;

function createAppWithAssets(...args) {
  const app = createExpressApp(...args);

  app.use(
    "/assets",
    createExpressApp.static(
      path.join(__dirname, "assets")
    )
  );

  return app;
}

Object.assign(createAppWithAssets, createExpressApp);

require.cache[
  require.resolve("express")
].exports = createAppWithAssets;

require("./server");
