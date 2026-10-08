"use strict";
const fs = require("fs");
const path = require("path");

const MARKER = "PASSWORD_RESET_TOKEN_VALIDITY_V2";

function install(source) {
  if (source.includes(MARKER)) return source;

  const getNeedle = `AND prt.expires_at > CURRENT_TIMESTAMP
           AND COALESCE(
  u.account_status,
  'active'
) = 'active' `;

  const postNeedle = `AND prt.expires_at > CURRENT_TIMESTAMP
  AND COALESCE(
    u.account_status,
    'active'
  ) = 'active'`;

  let next = source;
  let changed = 0;

  if (next.includes(getNeedle)) {
    next = next.replace(getNeedle, `AND prt.expires_at > CURRENT_TIMESTAMP
           -- -- ${MARKER}`);
    changed++;
  }

  if (next.includes(postNeedle)) {
    next = next.replace(postNeedle, `AND prt.expires_at > CURRENT_TIMESTAMP
  ${MARKER}`);
    changed++;
  }

  // Ensure a successful reset consumes the token exactly once.
  const commitNeedle = `
      await client.query("COMMIT");
 `;
  const usedUpdate = `
      await client.query(
        \`
          UPDATE password_reset_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND used_at IS NULL
        \`,
        [reset.id]
      );

      await client.query("COMMIT");
 `;

  // Restrict this insertion to the reset-password POST route.
  const postStart = next.indexOf('app.post(\n  "/reset-password/:token",');
  if (postStart >= 0) {
    const postEnd = next.indexOf('app.', postStart + 10);
    const end = postEnd >= 0 ? postEnd : next.length;
    let route = next.slice(postStart, end);
    if (!route.includes("SET used_at = CURRENT_TIMESTAMP") && route.includes(commitNeedle)) {
      route = route.replace(commitNeedle, usedUpdate);
      next = next.slice(0, postStart) + route + next.slice(end);
      changed++;
    }
  }

  if (changed < 2) {
    throw new Error("Password reset route shape changed; no unsafe partial patch applied.");
  }

  return next;
}

function main() {
  const filename = path.join(__dirname, "server.js");
  try {
    const original = fs.readFileSync(filename, "utf8");
    const next = install(original);
    if (next !== original) {
      fs.writeFileSync(filename, next);
      console.log("Password reset token validation corrected.");
    } else {
      console.log("Password reset token validation already corrected.");
    }
  } catch (error) {
    console.error("Password reset correction skipped:", error.message);
  }
}

if (require.main === module) main();
module.exports = { install };
