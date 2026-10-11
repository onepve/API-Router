import { main } from "./src/main.ts";
export { main };

if (import.meta.main) {
    await main();
}
