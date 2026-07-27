import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`AI Trip Planner backend listening on http://localhost:${env.port}`);
});
