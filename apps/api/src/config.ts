import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// npm workspaces run package scripts from apps/api, while the documented .env
// lives at the repository root. Load that file explicitly in every entrypoint.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
config();
