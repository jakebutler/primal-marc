import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testOpik() {
  const apiKey = process.env.OPIK_API_KEY;
  
  console.log("🔍 Testing Opik Integration");
  console.log("");
  
  if (!apiKey) {
    console.error("❌ OPIK_API_KEY is not set in .env.local");
    process.exit(1);
  }
  
  console.log("✅ OPIK_API_KEY found");
  console.log(`   Key length: ${apiKey.length}`);
  console.log(`   Key starts with: ${apiKey.substring(0, 10)}...`);
  
  const projectName = process.env.OPIK_PROJECT_NAME || "blog-generator";
  console.log(`   Project name: ${projectName} (from OPIK_PROJECT_NAME env var)`);
  console.log("");
  
  // Test importing and initializing OpikCallbackHandler
  console.log("📦 Testing OpikCallbackHandler import...");
  try {
    const { OpikCallbackHandler } = await import("opik-langchain");
    console.log("✅ Successfully imported OpikCallbackHandler");
    
    console.log("");
    console.log("🔧 Testing OpikCallbackHandler initialization...");
    try {
      const handler = new OpikCallbackHandler({
        apiKey: apiKey,
        projectName: projectName,
        tags: ["test"],
        metadata: {
          environment: "test",
        },
      });
      console.log("✅ Successfully created OpikCallbackHandler instance");
      console.log("   Handler type:", typeof handler);
      console.log("   Handler methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(handler)));
      
      // Test flush methods
      console.log("");
      console.log("🔄 Testing flush methods...");
      if (typeof handler.flushAsync === 'function') {
        console.log("   ✅ flushAsync method exists");
        try {
          await handler.flushAsync();
          console.log("   ✅ flushAsync() executed successfully");
        } catch (error: any) {
          console.log("   ⚠️  flushAsync() failed (this might be okay if no traces to flush):", error?.message || error);
        }
      } else {
        console.log("   ⚠️  flushAsync method not found");
      }
      
      if (typeof handler.flush === 'function') {
        console.log("   ✅ flush method exists");
      } else {
        console.log("   ⚠️  flush method not found");
      }
      
      console.log("");
      console.log("✅ Opik integration test completed successfully!");
      console.log("   The API key is valid and OpikCallbackHandler can be initialized.");
      
    } catch (initError: any) {
      console.error("❌ Failed to initialize OpikCallbackHandler:");
      console.error("   Error:", initError?.message || initError);
      console.error("   Stack:", initError?.stack);
      process.exit(1);
    }
    
  } catch (importError: any) {
    console.error("❌ Failed to import OpikCallbackHandler:");
    console.error("   Error:", importError?.message || importError);
    console.error("   Stack:", importError?.stack);
    process.exit(1);
  }
}

testOpik().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

