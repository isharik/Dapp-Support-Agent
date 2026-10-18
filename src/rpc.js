export async function callJsonRpc(rpcUrl, method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const id = globalThis.crypto.randomUUID();
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const data = await response.json();
    if (data?.error) {
      const error = new Error(data.error.message || 'RPC Error');
      error.code = data.error.code;
      error.data = data.error.data;
      throw error;
    }
    if (data?.jsonrpc !== '2.0' || data.id !== id || !Object.hasOwn(data, 'result')) {
      throw new Error(`Malformed JSON-RPC response for ${method}.`);
    }
    return data.result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`RPC request timed out (${method}).`);
    throw error;
  } finally { clearTimeout(timeout); }
}
