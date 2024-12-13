// const server = setupServer(
//     http.get("/api/pipelines", () => {
//       return HttpResponse.json([]);
//     })
//   );

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
