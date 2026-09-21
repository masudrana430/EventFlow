import { openApiSpec } from "../src/app/docs/openapi";

const baseUrl = process.env.API_SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const placeholder = "00000000-0000-4000-8000-000000000001";

const replaceParams = (routePath: string) =>
  routePath.replace(/\{[^}]+\}/g, placeholder);

type Result = {
  method: string;
  path: string;
  status?: number;
  ok: boolean;
  note?: string;
};

const results: Result[] = [];

for (const [routePath, operations] of Object.entries(openApiSpec.paths)) {
  for (const method of Object.keys(operations as Record<string, unknown>)) {
    if (!["get", "post", "patch", "put", "delete"].includes(method)) continue;

    const url = new URL(replaceParams(routePath), baseUrl);
    const init: RequestInit = {
      method: method.toUpperCase(),
      redirect: "manual",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    };

    if (["post", "patch", "put"].includes(method)) {
      init.body = "{}";
    }

    try {
      const response = await fetch(url, init);
      const text = await response.text();
      let payload: unknown;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }

      const routeNotFound =
        response.status === 404 &&
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        (payload as { message?: unknown }).message === "Route not found";

      const ok = response.status < 500 && !routeNotFound;
      results.push({
        method: init.method!,
        path: routePath,
        status: response.status,
        ok,
        ...(!ok
          ? {
              note: routeNotFound
                ? "Express route not found"
                : `Unexpected server error: ${text.slice(0, 300)}`,
            }
          : {}),
      });
    } catch (error) {
      results.push({
        method: init.method!,
        path: routePath,
        ok: false,
        note: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const failed = results.filter((result) => !result.ok);
const byStatus = results.reduce<Record<string, number>>((acc, result) => {
  const key = String(result.status ?? "network-error");
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      byStatus,
      failures: failed,
    },
    null,
    2,
  ),
);

if (failed.length) process.exitCode = 1;
