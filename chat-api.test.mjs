import assert from "node:assert/strict";
import chat from "../api/chat.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.DEEPSEEK_API_KEY;

function request(body, options = {}) {
  return new Request(options.url || "https://example.vercel.app/api/chat", {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.origin ? { Origin: options.origin } : {})
    },
    body: options.method === "GET" ? undefined : JSON.stringify(body)
  });
}

try {
  delete process.env.DEEPSEEK_API_KEY;
  let response = await chat.fetch(request({ message: "你好" }));
  assert.equal(response.status, 503);

  process.env.DEEPSEEK_API_KEY = "test-server-only-key";
  response = await chat.fetch(request(null, { method: "GET" }));
  assert.equal(response.status, 405);

  response = await chat.fetch(request({ message: "你好" }, { origin: "https://other.example" }));
  assert.equal(response.status, 403);

  response = await chat.fetch(request({ message: "   " }));
  assert.equal(response.status, 400);

  let upstreamRequest;
  globalThis.fetch = async (url, init) => {
    upstreamRequest = { url, init };
    return Response.json({ choices: [{ message: { content: "我在这里听你说。" } }] });
  };
  response = await chat.fetch(request({ message: "我今天很想它" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: "我在这里听你说。" });
  assert.equal(upstreamRequest.url, "https://api.deepseek.com/chat/completions");
  assert.equal(upstreamRequest.init.headers.Authorization, "Bearer test-server-only-key");
  const upstreamBody = JSON.parse(upstreamRequest.init.body);
  assert.equal(upstreamBody.model, "deepseek-flash");
  assert.equal(upstreamBody.thinking.type, "disabled");
  assert.equal(upstreamBody.messages.at(-1).content, "我今天很想它");

  globalThis.fetch = async () => new Response("rate limited", { status: 429 });
  response = await chat.fetch(request({ message: "再试一次" }));
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, "RATE_LIMITED");

  console.log("PASS chat API validation, proxy, success and upstream error handling");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
}
