import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testPerplexityAPI() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    console.error("❌ PERPLEXITY_API_KEY is not set in .env.local");
    process.exit(1);
  }
  
  console.log("✅ PERPLEXITY_API_KEY found");
  console.log(`   Key length: ${apiKey.length}`);
  console.log(`   Key starts with: ${apiKey.substring(0, 10)}...`);
  console.log("");
  
  console.log("🔍 Making test request to Perplexity API...");
  
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a research assistant. Provide citations and sources.",
          },
          {
            role: "user",
            content: "What are the latest developments in AI?",
          },
        ],
      }),
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:");
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log("✅ API Response received!");
    console.log("");
    console.log("📋 Response structure:");
    console.log(JSON.stringify(data, null, 2));
    console.log("");
    
    // Check for citations in different possible locations
    console.log("🔍 Checking for citations...");
    if (data.citations) {
      console.log(`   ✅ Found citations at top level: ${data.citations.length} items`);
      if (Array.isArray(data.citations) && data.citations.length > 0) {
        console.log("   First citation:", JSON.stringify(data.citations[0], null, 2));
      }
    } else {
      console.log("   ❌ No citations at top level");
    }
    
    if (data.choices && data.choices[0]) {
      console.log(`   ✅ Found choices array with ${data.choices.length} items`);
      if (data.choices[0].message) {
        console.log("   ✅ Found message in first choice");
        if (data.choices[0].message.citations) {
          console.log(`   ✅ Found citations in message: ${data.choices[0].message.citations.length} items`);
        } else {
          console.log("   ❌ No citations in message");
        }
        if (data.choices[0].message.content) {
          console.log(`   ✅ Found content (length: ${data.choices[0].message.content.length})`);
        }
      }
    }
    
    console.log("");
    console.log("✅ Test completed successfully!");
    
  } catch (error: any) {
    console.error("❌ Error making API request:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPerplexityAPI();

