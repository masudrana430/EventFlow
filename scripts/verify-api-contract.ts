import fs from "node:fs";
import path from "node:path";
import { openApiSpec } from "../src/app/docs/openapi";

type Method = "get" | "post" | "patch" | "put" | "delete";

const METHODS = new Set<Method>(["get", "post", "patch", "put", "delete"]);

const normalizePath = (value: string) => {
  const withoutQuery = value.split("?")[0] || "/";
  const normalized = withoutQuery
    .replace(/\{\{([^}]+)\}\}/g, "{$1}")
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
    .replace(/\/+$/g, "");
  return normalized || "/";
};

const canonical = (method: string, routePath: string) =>
  `${method.toUpperCase()} ${normalizePath(routePath).replace(/\{[^}]+\}/g, "{param}")}`;

const appPath = path.resolve("src/app.ts");
const appSource = fs.readFileSync(appPath, "utf8");

const routeImports = new Map<string, string>();
const importRegex =
  /import\s+\{\s*([A-Za-z0-9_]+Routes)\s*\}\s+from\s+"(\.\/app\/module\/[^"]+\.route)";/g;

for (const match of appSource.matchAll(importRegex)) {
  routeImports.set(match[1], `src/${match[2].replace(/^\.\//, "")}.ts`);
}

const sourceRoutes = new Set<string>();
const mountRegex = /app\.use\("([^"]+)",\s*([A-Za-z0-9_]+Routes)\);/g;

for (const mount of appSource.matchAll(mountRegex)) {
  const basePath = mount[1];
  const routeVar = mount[2];
  const routeFile = routeImports.get(routeVar);

  if (!routeFile) {
    throw new Error(`Could not resolve route file for ${routeVar}`);
  }

  const routeSource = fs.readFileSync(path.resolve(routeFile), "utf8");
  const routeRegex =
    /router\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g;

  for (const route of routeSource.matchAll(routeRegex)) {
    const method = route[1];
    const localPath = route[2] === "/" ? "" : route[2];
    sourceRoutes.add(canonical(method, `${basePath}${localPath}`));
  }
}

const openApiRoutes = new Set<string>();
for (const [routePath, operations] of Object.entries(openApiSpec.paths ?? {})) {
  for (const method of Object.keys(operations as Record<string, unknown>)) {
    if (METHODS.has(method as Method)) {
      openApiRoutes.add(canonical(method, routePath));
    }
  }
}

const collection = JSON.parse(
  fs.readFileSync(
    path.resolve("docs/postman/EventFlow.postman_collection.json"),
    "utf8",
  ),
) as {
  item?: Array<unknown>;
};

const postmanRoutes = new Set<string>();

const visit = (items: Array<any> | undefined) => {
  for (const item of items ?? []) {
    if (Array.isArray(item.item)) {
      visit(item.item);
      continue;
    }

    const method = String(item.request?.method ?? "").toLowerCase();
    const raw = String(item.request?.url?.raw ?? "");

    if (!METHODS.has(method as Method) || !raw.includes("{{baseUrl}}")) {
      continue;
    }

    const apiPath = raw.replace("{{baseUrl}}", "");
    postmanRoutes.add(canonical(method, `/api/v1${apiPath}`));
  }
};

visit(collection.item as Array<any> | undefined);

const missingFromOpenApi = [...sourceRoutes].filter((route) => !openApiRoutes.has(route));
const missingFromPostman = [...sourceRoutes].filter((route) => !postmanRoutes.has(route));
const staleOpenApi = [...openApiRoutes].filter((route) => !sourceRoutes.has(route));

console.log(
  JSON.stringify(
    {
      sourceRoutes: sourceRoutes.size,
      openApiRoutes: openApiRoutes.size,
      postmanRoutes: postmanRoutes.size,
      missingFromOpenApi,
      missingFromPostman,
      staleOpenApi,
    },
    null,
    2,
  ),
);

if (missingFromOpenApi.length || missingFromPostman.length || staleOpenApi.length) {
  process.exitCode = 1;
}
