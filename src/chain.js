export const MAX_RPC_CONCURRENCY = 6;

export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function parseHexQuantity(value, label = 'RPC quantity') {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error(`Invalid ${label} returned by RPC.`);
  }
  return BigInt(value);
}

export function isAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
}

export function isHexData(value) {
  return typeof value === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(value);
}

export function formatUnits(value, decimals = 18, precision = 5) {
  const amount = typeof value === 'bigint' ? value : parseHexQuantity(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function classifyReceiptStatus(receipt) {
  if (!receipt) return 'PENDING';
  if (receipt.status === '0x1' || receipt.status === '0x01') return 'PASSED';
  if (receipt.status === '0x0' || receipt.status === '0x00') return 'FAILED';
  return 'UNSUPPORTED';
}

export function calculateGasMetrics(tx, receipt) {
  const gasLimit = tx?.gas ? parseHexQuantity(tx.gas, 'transaction gas limit') : null;
  const gasUsed = receipt?.gasUsed ? parseHexQuantity(receipt.gasUsed, 'receipt gas used') : null;
  const priceHex = receipt?.effectiveGasPrice ?? tx?.gasPrice;
  const gasPrice = priceHex ? parseHexQuantity(priceHex, 'effective gas price') : null;
  const feeWei = gasUsed !== null && gasPrice !== null ? gasUsed * gasPrice : null;
  const gasRatio = gasLimit && gasUsed !== null ? Number((gasUsed * 10000n) / gasLimit) / 100 : null;
  return { gasLimit, gasUsed, gasPrice, feeWei, gasRatio };
}

export function classifyFailureEvidence({ decodedRevert, traceError = '', traceRevertReason = '', replayError = '' }) {
  const text = `${traceError} ${traceRevertReason} ${replayError} ${decodedRevert?.reason || ''}`.toLowerCase();
  if (text.includes('out of gas')) return 'Out of Gas';
  if (decodedRevert?.signature === '0xfb8f41b2' || text.includes('insufficient allowance') || text.includes('erc20insufficientallowance')) return 'Insufficient Allowance';
  if (decodedRevert?.signature === '0xe450d38c' || text.includes('insufficient balance') || text.includes('transfer amount exceeds balance') || text.includes('erc20insufficientbalance')) return 'Insufficient Balance';
  return 'Revert Reason';
}

export function decodeRevertData(data) {
  if (typeof data !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(data) || data.length < 10) return null;
  const selector = data.slice(0, 10).toLowerCase();
  const bytes = data.slice(10);
  const readWord = (offset) => {
    const part = bytes.slice(offset * 2, (offset + 32) * 2);
    return part.length === 64 ? BigInt(`0x${part}`) : null;
  };
  if (selector === '0x08c379a0') {
    const offset = readWord(0);
    const length = offset === null ? null : readWord(Number(offset));
    if (length === null || length > 4096n) return { signature: 'Error(string)', reason: 'Malformed Error(string) revert data', raw: data };
    const payload = bytes.slice((Number(offset) + 32) * 2, (Number(offset) + 32 + Number(length)) * 2);
    if (payload.length !== Number(length) * 2) return { signature: 'Error(string)', reason: 'Malformed Error(string) revert data', raw: data };
    try { return { signature: 'Error(string)', reason: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(payload.match(/../g) || [], (b) => parseInt(b, 16))), raw: data }; }
    catch { return { signature: 'Error(string)', reason: 'Invalid UTF-8 in Error(string) revert data', raw: data }; }
  }
  if (selector === '0x4e487b71') {
    const code = readWord(0);
    const names = { 1n: 'Assertion failed', 0x11n: 'Arithmetic overflow or underflow', 0x12n: 'Division or modulo by zero', 0x21n: 'Invalid enum conversion', 0x31n: 'pop() on an empty array', 0x32n: 'Array index out of bounds', 0x41n: 'Excessive memory allocation', 0x51n: 'Uninitialized function pointer' };
    return code === null ? { signature: 'Panic(uint256)', reason: 'Malformed Solidity panic data', raw: data } : { signature: `Panic(0x${code.toString(16)})`, reason: names[code] || `Solidity panic code 0x${code.toString(16)}`, raw: data };
  }
  if (selector === '0xfb8f41b2' || selector === '0xe450d38c') {
    const first = bytes.slice(0, 64);
    const second = readWord(32);
    const third = readWord(64);
    if (first.length !== 64 || second === null || third === null) return { signature: selector, reason: 'Malformed ERC-20 custom error data', raw: data };
    const firstAddress = `0x${first.slice(24)}`;
    const name = selector === '0xfb8f41b2' ? 'ERC20InsufficientAllowance' : 'ERC20InsufficientBalance';
    const label = selector === '0xfb8f41b2' ? 'allowance' : 'balance';
    return { signature: selector, reason: `${name}: ${label} ${second.toString()} raw units; required ${third.toString()} raw units (token decimals are unknown)${selector === '0xfb8f41b2' ? `; spender ${firstAddress}` : `; account ${firstAddress}`}`, raw: data };
  }
  const knownErrors = {
    '0xf4d678b8': 'InsufficientBalance()', '0x13be252b': 'InsufficientAllowance()',
    '0x8baa579f': 'InvalidSignature()', '0x3ee5aeb5': 'ReentrancyGuardReentrantCall()',
    '0x118cdaa7': 'OwnableUnauthorizedAccount(address)', '0x7939f424': 'TransferFailed()',
    '0x90b8ec18': 'TransferSelectorFailed()', '0x0dc149f0': 'SlippageExceeded()',
    '0x48fee69c': 'ExpiredDeadline()'
  };
  if (knownErrors[selector]) return { signature: knownErrors[selector], reason: `Contract reverted with ${knownErrors[selector]}`, raw: data };
  return { signature: selector, reason: `Unknown custom error (${selector})`, raw: data };
}
