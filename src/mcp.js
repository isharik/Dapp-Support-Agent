export async function probePharosChainMcp(mcpUrl, txHash, chainId) {
  const start = performance.now();
  if (chainId !== 1672) return { transport: 'MCP skipped', mcpStatus: 'Unsupported network; transaction evidence uses Direct JSON-RPC', latencyMs: 0, toolResult: null, fallbackReason: `Hosted Pharos MCP advertises Pacific Mainnet (1672); selected chain is ${chainId}.` };
  let sessionId = null;
  let protocolVersion = '2024-11-05';
  try {
    const requestMcp = async (message, expectedId = null) => {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': protocolVersion };
      if (sessionId) headers['MCP-Session-Id'] = sessionId;
      const response = await fetch(mcpUrl, { method: 'POST', headers, signal: AbortSignal.timeout(10000), body: JSON.stringify(message) });
      if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
      sessionId = response.headers.get('MCP-Session-Id') || sessionId;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const source = await response.text();
        const frame = source.split(/\r?\n\r?\n/).filter((part) => part.includes('data:')).at(-1);
        if (!frame) throw new Error('MCP returned an empty event stream.');
        const data = frame.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
        const parsed = JSON.parse(data || 'null');
        if (expectedId !== null && parsed?.id !== expectedId) throw new Error('MCP response id did not match request.');
        return parsed;
      }
      if (response.status === 202 || response.status === 204) return null;
      const parsed = await response.json();
      if (expectedId !== null && parsed?.id !== expectedId) throw new Error('MCP response id did not match request.');
      return parsed;
    };
    const initializeId = crypto.randomUUID();
    const initialized = await requestMcp({ jsonrpc: '2.0', id: initializeId, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'pharos-dapp-support-agent', version: '1.0.0' } } }, initializeId);
    if (initialized?.error || !initialized?.result?.protocolVersion) throw new Error(initialized?.error?.message || 'MCP initialize response was invalid.');
    protocolVersion = initialized.result.protocolVersion;
    await requestMcp({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const listId = crypto.randomUUID();
    const listed = await requestMcp({ jsonrpc: '2.0', id: listId, method: 'tools/list', params: {} }, listId);
    const tools = listed?.result?.tools;
    if (!Array.isArray(tools)) throw new Error('MCP tools/list returned an invalid protocol response.');
    const requestedTool = tools.find((tool) => tool.name === 'get_transaction');
    if (!requestedTool) return { transport: 'Pharos MCP tools/list', mcpStatus: 'Connected; get_transaction unavailable', latencyMs: Math.round(performance.now() - start), toolResult: null, fallbackReason: 'Tool was not advertised by tools/list.' };
    if (!requestedTool.inputSchema?.properties?.hash) throw new Error('Advertised get_transaction schema does not define hash.');
    const callId = crypto.randomUUID();
    const callBody = await requestMcp({ jsonrpc: '2.0', id: callId, method: 'tools/call', params: { name: requestedTool.name, arguments: { hash: txHash } } }, callId);
    if (callBody?.error || !callBody?.result) throw new Error(callBody?.error?.message || 'MCP tools/call response was invalid.');
    return { transport: 'Pharos MCP tools/call', mcpStatus: callBody.result.isError ? 'Tool returned an error' : 'Tool executed', latencyMs: Math.round(performance.now() - start), toolResult: callBody.result, fallbackReason: callBody.result.isError ? 'MCP tool marked result as error.' : null };
  } catch (error) {
    return { transport: 'MCP probe unavailable', mcpStatus: 'Unavailable; transaction evidence uses Direct JSON-RPC', latencyMs: Math.round(performance.now() - start), toolResult: null, fallbackReason: error.message || 'MCP request failed.' };
  }
}
