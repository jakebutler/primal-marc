/**
 * Helper to call the AI worker service
 */
export async function callWorker(
  endpoint: string,
  body: any
): Promise<any> {
  const workerUrl = process.env.AI_WORKER_URL;
  const workerSecret = process.env.WORKER_API_SECRET;

  if (!workerUrl || !workerSecret) {
    throw new Error(
      "AI_WORKER_URL and WORKER_API_SECRET must be configured"
    );
  }

  const url = `${workerUrl}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { code: "WORKER_ERROR", message: `Worker returned ${response.status}` },
    }));
    throw new Error(error.error?.message || `Worker request failed: ${response.status}`);
  }

  return response.json();
}

