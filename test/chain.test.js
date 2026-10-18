import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGasMetrics, classifyFailureEvidence, classifyReceiptStatus, decodeRevertData, formatUnits, isAddress, mapWithConcurrency, parseHexQuantity } from '../src/chain.js';
import { callJsonRpc } from '../src/rpc.js';
import { probePharosChainMcp } from '../src/mcp.js';

test('formats genuine zero and fractional token amounts', () => {
  assert.equal(formatUnits('0x0'), '0');
  assert.equal(formatUnits('0x16345785d8a0000', 18, 4), '0.1');
});

test('rejects malformed RPC quantities instead of silently returning zero', () => {
  assert.throws(() => parseHexQuantity('not-hex'), /Invalid RPC quantity/);
});

test('classifies receipt outcomes without treating a missing receipt as failure', () => {
  assert.equal(classifyReceiptStatus({ status: '0x1' }), 'PASSED');
  assert.equal(classifyReceiptStatus({ status: '0x0' }), 'FAILED');
  assert.equal(classifyReceiptStatus(null), 'PENDING');
  assert.equal(classifyReceiptStatus({ status: '0x2' }), 'UNSUPPORTED');
});

test('calculates gas fee only from observed gas used and price', () => {
  assert.deepEqual(calculateGasMetrics({ gas: '0x5208', gasPrice: '0x3b9aca00' }, { gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00' }), {
    gasLimit: 21000n, gasUsed: 21000n, gasPrice: 1000000000n, feeWei: 21000000000000n, gasRatio: 100
  });
  assert.equal(calculateGasMetrics({ gas: '0x5208', maxFeePerGas: '0x10' }, { gasUsed: '0x1' }).feeWei, null);
});

test('decodes Error(string) UTF-8 and Solidity panic codes defensively', () => {
  const reason = 'Not allowed';
  const bytes = Buffer.from(reason, 'utf8').toString('hex');
  const errorData = `0x08c379a0${'0'.repeat(62)}20${(bytes.length / 2).toString(16).padStart(64, '0')}${bytes.padEnd(64, '0')}`;
  assert.equal(decodeRevertData(errorData).reason, reason);
  assert.equal(decodeRevertData(`0x4e487b71${'0'.repeat(62)}11`).reason, 'Arithmetic overflow or underflow');
  assert.match(decodeRevertData('0x08c379a0').reason, /Malformed/);
});

test('preserves unknown custom error data', () => {
  const result = decodeRevertData('0xdeadbeef1234');
  assert.equal(result.signature, '0xdeadbeef');
  assert.equal(result.raw, '0xdeadbeef1234');
});

test('decodes known ERC-20 custom error arguments without assuming token decimals', () => {
  const addressWord = `${'0'.repeat(24)}${'a'.repeat(40)}`;
  const data = `0xfb8f41b2${addressWord}${7n.toString(16).padStart(64, '0')}${9n.toString(16).padStart(64, '0')}`;
  const decoded = decodeRevertData(data);
  assert.equal(decoded.signature, '0xfb8f41b2');
  assert.match(decoded.reason, /7 raw units; required 9 raw units/);
  assert.match(decoded.reason, /token decimals are unknown/);
  assert.equal(decodeRevertData('0xe450d38c').reason, 'Malformed ERC-20 custom error data');
});

test('classifies failures from revert evidence instead of selectors or high gas ratios', () => {
  assert.equal(classifyFailureEvidence({ replayError: 'out of gas' }), 'Out of Gas');
  assert.equal(classifyFailureEvidence({ replayError: 'execution reverted: insufficient allowance' }), 'Insufficient Allowance');
  assert.equal(classifyFailureEvidence({ replayError: 'execution reverted' }), 'Revert Reason');
  assert.equal(classifyFailureEvidence({ replayError: '', decodedRevert: { signature: '0xe450d38c', reason: 'insufficient token balance' } }), 'Insufficient Balance');
});

test('validates EVM addresses', () => {
  assert.equal(isAddress('0x0000000000000000000000000000000000000001'), true);
  assert.equal(isAddress('0x12'), false);
});

test('runs block work under a bounded concurrency cap and preserves ordering', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([3, 2, 1], 2, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return item * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, [6, 4, 2]);
});

test('validates mocked JSON-RPC success and exposes mocked provider errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: '0x0' }), { status: 200 });
    };
    assert.equal(await callJsonRpc('https://rpc.invalid', 'eth_getBalance', []), '0x0');
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }), { status: 200 });
    };
    await assert.rejects(callJsonRpc('https://rpc.invalid', 'unsupported_method'), /Method not found/);
  } finally { globalThis.fetch = originalFetch; }
});

test('executes the advertised mocked MCP tool schema and argument', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      if (request.method === 'initialize') return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'test', version: '1' } } }), { status: 200, headers: { 'Content-Type': 'application/json', 'MCP-Session-Id': 'session-test' } });
      if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (request.method === 'tools/list') return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { tools: [{ name: 'get_transaction', inputSchema: { type: 'object', properties: { hash: { type: 'string' } }, required: ['hash'] } }] } }), { status: 200 });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: 'mock transaction result' }], isError: false } }), { status: 200 });
    };
    const result = await probePharosChainMcp('https://mcp.invalid', `0x${'a'.repeat(64)}`, 1672);
    assert.equal(result.mcpStatus, 'Tool executed');
    assert.equal(result.toolResult.content[0].text, 'mock transaction result');
    assert.deepEqual(requests.at(-1).params.arguments, { hash: `0x${'a'.repeat(64)}` });
    assert.equal(requests.at(-1).params.arguments.chainId, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('skips mocked MCP requests on unsupported networks', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('MCP should not be called'); };
    const result = await probePharosChainMcp('https://mcp.invalid', '0xhash', 688689);
    assert.match(result.fallbackReason, /1672/);
  } finally { globalThis.fetch = originalFetch; }
});
