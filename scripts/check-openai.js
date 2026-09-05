const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");

// Read .env file
const envPath = path.resolve(__dirname, "../.env");
let apiKey = process.env.CHATGPT_OPENAI_KEY || process.env.OPENAI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match =
    envContent.match(/^CHATGPT_OPENAI_KEY=(.*)$/m) ||
    envContent.match(/^OPENAI_API_KEY=(.*)$/m);
  if (match) {
    apiKey = match[1].trim().replace(/^["']|["']$/g, "");
  }
}

console.log("\n========================================");
console.log("🔍 Checking OpenAI API Key & Credit Status");
console.log("========================================\n");

if (!apiKey || apiKey === "" || apiKey.startsWith("your_")) {
  console.error("❌ Status: NO API KEY CONFIGURED");
  console.error("👉 Please set CHATGPT_OPENAI_KEY in backend/.env\n");
  process.exit(1);
}

const maskedKey =
  apiKey.length > 14
    ? `${apiKey.slice(0, 7)}...${apiKey.slice(-6)}`
    : "********";
console.log(`🔑 Key found: ${maskedKey}`);
console.log("📡 Sending test request to OpenAI API (gpt-4o-mini)...\n");

const openai = new OpenAI({ apiKey });

openai.chat.completions
  .create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Reply with the single word: ACTIVE" }],
    max_tokens: 10,
  })
  .then((res) => {
    const reply = res.choices[0]?.message?.content?.trim();
    console.log("✅ Status: KEY IS ACTIVE & WORKING PROPERLY!");
    console.log(`🤖 Model Response: "${reply}"`);
    console.log(
      '🎉 Generation type "AI_OPENAI" will be used for meal plans.\n',
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error(`❌ Status: FAILED (HTTP ${err.status || "Network Error"})`);
    if (err.code === "invalid_api_key" || err.status === 401) {
      console.error("👉 Reason: The API key is invalid or revoked.");
      console.error(
        "👉 Solution: Generate a new API key at https://platform.openai.com/api-keys\n",
      );
    } else if (
      err.code === "credit_balance_exhausted" ||
      err.code === "insufficient_quota" ||
      err.status === 429
    ) {
      console.error("👉 Reason: Out of OpenAI credits (Insufficient Quota).");
      console.error(
        "👉 Solution: Top up your balance at https://platform.openai.com/settings/organization/billing/\n",
      );
    } else {
      console.error(`👉 Details: ${err.message}\n`);
    }
    process.exit(1);
  });
