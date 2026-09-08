const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
require("ts-node/register");
const { DB_SETTINGS } = require("../src/settings");

async function main() {
  const url = new URL(DB_SETTINGS.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("E2E tests require local PostgreSQL.");
  const schema = `test_weekly_report_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: url.toString(),
    ALLOW_SELF_REGISTRATION: "true",
  };
  const root = path.resolve(__dirname, "..");
  const client = new Client({ connectionString: DB_SETTINGS.url });
  await client.connect();
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
      ],
      { cwd: root, env, stdio: "inherit" },
    );
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/jest/bin/jest.js"),
        "--config",
        "test/jest-e2e.json",
        "--runInBand",
      ],
      { cwd: root, env, stdio: "inherit" },
    );
  } finally {
    if (!/^test_weekly_report_[a-f0-9]{32}$/.test(schema))
      throw new Error("Unexpected test schema; cleanup refused.");
    // Only this invocation's newly created isolated schema is removed.
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}
main().catch((error) => {
  console.error(
    "E2E checks failed:",
    error.code || error.status || error.message,
  );
  process.exitCode = 1;
});
