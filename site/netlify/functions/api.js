const serverless = require("serverless-http");
const app = require("../../server");

exports.handler = async (event, context) => {
  // Netlify rewrites /api/* to this function. Restore the original API route
  // for Express, while preserving the query string.
  const originalPath = event.headers && (
    event.headers["x-nf-original-path"] ||
    event.headers["X-Nf-Original-Path"]
  );
  const rewrittenPath = event.path || "";
  const normalizedEvent = {
    ...event,
    path: originalPath && originalPath.startsWith("/api/")
      ? originalPath
      : rewrittenPath.replace(/^\\/\\.netlify\\/functions\\/api(?=\\/|$)/, "/api")
  };
  return serverless(app)(normalizedEvent, context);
};
