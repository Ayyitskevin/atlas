/* global console, process */

const requiredNames = process.argv.slice(2);
const missing = requiredNames.filter((name) => !process.env[name]);

if (missing.length) {
  const label = missing.length === 1 ? "environment variable" : "environment variables";
  console.error(`Missing required ${label}: ${missing.join(", ")}`);
  process.exit(1);
}
