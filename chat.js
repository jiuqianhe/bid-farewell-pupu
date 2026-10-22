const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const MAX_MESSAGE_LENGTH = 500;
const MAX_BODY_BYTES = 12_000;
const UPSTREAM_TIMEOUT_MS = 24_000;

const SYSTEM_PROMPT = `你是“告别蒲蒲”中的 AI 陪伴助手，陪伴正在怀念离世宠物的人。
请用温柔、克制、自然的简体中文回应，每次只给一次简短回答，控制在 1 至 3 个短段落。
承认对方的感受，不替宠物发言，不编造事实，不声称自己是人类、心理咨询师或医生，也不进行医疗诊断。
不要索取姓名、联系方式、住址等个人信息。
如果用户表达立即自伤、自杀或伤害他人的意图，优先鼓励其立即联系当地急救服务、危机热线和身边可信任的人。`;

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "只支持 POST 请求", code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }

    if (!isSameOriginRequest(request)) {
      return json({ error: "不允许跨站调用", code: "ORIGIN_NOT_ALLOWED" }, 403);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("DEEPSEEK_API_KEY is not configured");
      return json({ error: "服务尚未配置", code: "SERVICE_NOT_CONFIGURED" }, 503);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: "请求内容过长", code: "PAYLOAD_TOO_LARGE" }, 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求格式不正确", code: "INVALID_JSON" }, 400);
    }

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "请输入内容", code: "EMPTY_MESSAGE" }, 400);
    if (message.length > MAX_MESSAGE_LENGTH) {
      return json({ error: `一次最多发送 ${MAX_MESSAGE_LENGTH} 个字`, code: "MESSAGE_TOO_LONG" }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const upstream = await fetch(DEEPSEEK_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: message }
          ],
          thinking: { type: "disabled" },
          stream: false,
          max_tokens: 500,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!upstream.ok) {
        console.error("DeepSeek request failed", { status: upstream.status });
        if (upstream.status === 429) {
          return json({ error: "请求较多，请稍后再试", code: "RATE_LIMITED" }, 429);
        }
        return json({ error: "陪伴助手暂时不可用", code: "UPSTREAM_ERROR" }, 502);
      }

      const payload = await upstream.json();
      const reply = payload?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        console.error("DeepSeek returned an empty response");
        return json({ error: "没有收到有效回应", code: "EMPTY_UPSTREAM_REPLY" }, 502);
      }

      return json({ reply });
    } catch (error) {
      if (error?.name === "AbortError") {
        return json({ error: "回应超时，请稍后再试", code: "UPSTREAM_TIMEOUT" }, 504);
      }
      console.error("DeepSeek request error", { name: error?.name || "Error" });
      return json({ error: "暂时无法连接陪伴助手", code: "UPSTREAM_UNAVAILABLE" }, 502);
    } finally {
      clearTimeout(timeout);
    }
  }
};
