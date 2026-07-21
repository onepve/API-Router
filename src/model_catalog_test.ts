import { Logger } from "./logger.ts";
import { ModelCatalog } from "./model_catalog.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

Deno.test("exact model patterns preserve the configured routable ID", () => {
  const catalog = new ModelCatalog("unused.json", new Logger("error")) as any;
  catalog.buildIndex([
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      provider: "a",
      cost: null,
      limit: null,
    },
    {
      id: "DeepSeek-V4-Flash",
      name: "DeepSeek V4 Flash",
      provider: "b",
      cost: null,
      limit: null,
    },
  ]);

  assertEquals(catalog.resolvePatterns([{ name: "deepseek-v4-flash" }]), [
    "deepseek-v4-flash",
  ]);
});

Deno.test("prefix model patterns still expand matching catalog IDs", () => {
  const catalog = new ModelCatalog("unused.json", new Logger("error")) as any;
  catalog.buildIndex([
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
      provider: "openai",
      cost: null,
      limit: null,
    },
    {
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      provider: "openai",
      cost: null,
      limit: null,
    },
  ]);

  assertEquals(catalog.resolvePatterns([{ name: "gpt-5.4*" }]), [
    "gpt-5.4",
    "gpt-5.4-mini",
  ]);
});
