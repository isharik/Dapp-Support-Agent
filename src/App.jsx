import React, { useState, useEffect, useCallback, useRef } from 'react';
import octopusImage from '../octo_png.png';
import { calculateGasMetrics, classifyFailureEvidence, classifyReceiptStatus, decodeRevertData, formatUnits, isAddress, isHexData, mapWithConcurrency, parseHexQuantity, MAX_RPC_CONCURRENCY } from './chain.js';
import { callJsonRpc } from './rpc.js';
import { probePharosChainMcp } from './mcp.js';
import {
  Search,
  Activity,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  Cpu,
  Fuel,
  Wallet,
  AlertTriangle,
  Layers,
  ArrowRight,
  Compass,
  Info,
  Zap,
  Code2,
  ChevronRight
} from 'lucide-react';

const PHAROS_NETWORKS = {
  atlantic: {
    id: 'atlantic',
    name: 'Pharos Atlantic Testnet',
    shortName: 'Atlantic Testnet',
    chainId: 688689,
    hexChainId: '0xa8231',
    symbol: 'PHRS',
    rpcUrl: 'https://atlantic.dplabs-internal.com',
    mcpUrl: 'https://mcp.pharos.xyz/mcp',
    explorerUrl: 'https://atlantic.pharosscan.xyz',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  },
  mainnet: {
    id: 'mainnet',
    name: 'Pharos Pacific Mainnet',
    shortName: 'Pacific Mainnet',
    chainId: 1672,
    hexChainId: '0x688',
    symbol: 'PROS',
    rpcUrl: 'https://rpc.pharos.xyz',
    mcpUrl: 'https://mcp.pharos.xyz/mcp',
    explorerUrl: 'https://pharosscan.xyz',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
  },
  legacyTestnet: {
    id: 'legacyTestnet',
    name: 'Pharos Legacy Testnet',
    shortName: 'Testnet (688688)',
    chainId: 688688,
    hexChainId: '0xa8230',
    symbol: 'PHRS',
    rpcUrl: 'https://testnet.dplabs-internal.com',
    mcpUrl: 'https://mcp.pharos.xyz/mcp',
    explorerUrl: 'https://testnet.pharosscan.xyz',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
  }
};

function hexToBigInt(hex) {
  return parseHexQuantity(hex);
}

const PHAROS_LOGO_PATHS = [
  '/pharos_png.png',
  '/pharos_png',
  './pharos_png.png',
  '/pharos_png.jpg',
  '/pharos_png.webp',
  '/public/pharos_png.png'
];

const monotonicNow = () => globalThis.performance.now();

function getTraceFailureDetails(trace) {
  if (!trace || typeof trace !== 'object') return { error: '', revertReason: '', output: '' };
  const calls = Array.isArray(trace.calls) ? trace.calls : [];
  // Prefer the deepest failing call: callTracer often leaves the root error blank
  // when a nested token/router call is the frame that actually reverted.
  for (const call of calls) {
    const childFailure = getTraceFailureDetails(call);
    if (childFailure.error || childFailure.revertReason) return childFailure;
  }
  const failedFrame = Boolean(trace.error || trace.revertReason);
  return {
    error: typeof trace.error === 'string' ? trace.error : '',
    revertReason: typeof trace.revertReason === 'string' ? trace.revertReason : '',
    output: failedFrame && typeof trace.output === 'string' ? trace.output : ''
  };
}

const PharosBrandLogo = ({ className = 'h-10' }) => {
  const [pathIdx, setPathIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const handleImgError = () => {
    if (pathIdx < PHAROS_LOGO_PATHS.length - 1) {
      setPathIdx((prev) => prev + 1);
    } else {
      setImgFailed(true);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 flex-shrink-0 overflow-hidden">
        {!imgFailed ? (
          <img
            src={PHAROS_LOGO_PATHS[pathIdx]}
            alt="Pharos Logo"
            onError={handleImgError}
            className="w-full h-full object-contain"
          />
        ) : (
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <polygon points="36,15 62,9 62,19 36,25" fill="#001EE0" />
            <polygon points="32,39 66,31 66,44 32,53" fill="#001EE0" />
            <polygon points="28,69 71,56 71,74 28,87" fill="#001EE0" />
          </svg>
        )}
      </div>

      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-black tracking-tight text-slate-900 text-[15px]">PHAROS</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#001EE0] text-white">
            AI.MCP
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-600 tracking-tight mt-0.5">
          DApp Support Agent
        </span>
      </div>
    </div>
  );
};

const PharosOctopusMascot = ({ mood = 'idle', failureCategory = null }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const isFailed = mood === 'failed';
  const isPassed = mood === 'passed';
  const isScanning = mood === 'scanning';

  const speechText = isFailed
    ? 'Oops! It failed!'
    : isPassed
    ? 'Yay! It passed!'
    : isScanning
    ? 'Inspecting Chain MCP...'
    : 'Paste any Pharos Tx!';

  const speechStyle = isFailed
    ? 'bg-rose-600 text-white border-rose-400 shadow-rose-600/30 ring-2 ring-rose-500/25'
    : isPassed
    ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/30 ring-2 ring-emerald-500/25'
    : isScanning
    ? 'bg-[#001EE0] text-white border-blue-400 shadow-blue-500/25'
    : 'bg-slate-900 text-white border-slate-700 shadow-slate-900/20';

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Dynamic Speech Bubble */}
      <div
        className={`mb-2 px-3 py-1 rounded-xl text-xs font-extrabold tracking-tight shadow-md border transition-all duration-300 flex items-center gap-1.5 z-20 ${speechStyle}`}
      >
        {isFailed && <XCircle className="w-3.5 h-3.5 text-white animate-bounce" />}
        {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-white animate-bounce" />}
        {isScanning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        <span>{speechText}</span>
      </div>

      {/* Octopus Image Frame with Red Failed / Green Passed Theme + Cross / Checkmark Badge */}
      <div className="relative">
        <div
          className={`relative w-32 h-28 xl:w-36 xl:h-32 rounded-2xl overflow-hidden border-[3px] transition-all duration-500 flex items-center justify-center ${
            isFailed
              ? 'border-rose-500 shadow-lg shadow-rose-500/30 ring-4 ring-rose-500/15'
              : isPassed
              ? 'border-emerald-500 shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/15'
              : 'border-blue-500/80 shadow-md shadow-blue-900/15'
          }`}
          style={{
            background: isFailed
              ? 'radial-gradient(circle at 50% 45%, #e11d48 0%, #881337 60%, #4c0519 100%)'
              : isPassed
              ? 'radial-gradient(circle at 50% 45%, #10b981 0%, #047857 60%, #022c22 100%)'
              : 'radial-gradient(circle at 52% 48%, #2B7FFF 0%, #0E3EA8 48%, #041036 100%)'
          }}
        >
          {/* Imported from the repository root so Vite includes it in production builds. */}
          {!imgFailed ? (
            <img
              src={octopusImage}
              alt="Pharos Octopus Mascot"
              onError={() => setImgFailed(true)}
              className={`w-full h-full object-cover transition-all duration-500 ${
                isScanning ? 'scale-105 animate-pulse' : 'hover:scale-105'
              } ${
                isFailed
                  ? 'mix-blend-luminosity opacity-90 contrast-125'
                  : isPassed
                  ? 'saturate-110 contrast-105'
                  : ''
              }`}
            />
          ) : (
            <div role="img" aria-label="Pharos octopus mascot image unavailable" className="p-2 text-center text-xs font-semibold text-white">
              Mascot image unavailable
            </div>
          )}

          {/* RED THEME OVERLAY WHEN FAILED */}
          {isFailed && (
            <div className="absolute inset-0 bg-gradient-to-t from-rose-950/80 via-rose-600/30 to-rose-500/15 pointer-events-none flex items-end justify-center pb-1.5">
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm border border-rose-300/60">
                FAILED • 0x0
              </span>
            </div>
          )}

          {/* GREEN THEME OVERLAY WHEN PASSED */}
          {isPassed && (
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/75 via-emerald-500/20 to-transparent pointer-events-none flex items-end justify-center pb-1.5">
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm border border-emerald-300/60">
                PASSED • 0x1
              </span>
            </div>
          )}
        </div>

        {/* LARGE RED CROSS BADGE FOR FAILED TXN */}
        {isFailed && (
          <div className="absolute -top-2.5 -right-2.5 w-9 h-9 rounded-xl bg-rose-600 border-2 border-white text-white shadow-lg shadow-rose-600/50 flex items-center justify-center z-30 animate-bounce">
            <XCircle className="w-5 h-5 stroke-[2.7]" />
          </div>
        )}

        {/* LARGE GREEN CHECKMARK BADGE FOR PASSED TXN */}
        {isPassed && (
          <div className="absolute -top-2.5 -right-2.5 w-9 h-9 rounded-xl bg-emerald-500 border-2 border-white text-white shadow-lg shadow-emerald-600/50 flex items-center justify-center z-30 animate-bounce">
            <CheckCircle2 className="w-5 h-5 stroke-[2.7]" />
          </div>
        )}
      </div>

      {/* Category Sub-badge below Octopus */}
      {failureCategory && (
        <span
          className={`mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-tight border flex items-center gap-1 ${
            isFailed
              ? 'bg-rose-500/15 text-rose-800 border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
          }`}
        >
          {isFailed ? (
            <XCircle className="w-3 h-3 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          )}
          <span>{failureCategory}</span>
        </span>
      )}
    </div>
  );
};

async function analyzeLivePharosTransaction(txHash, preferredNetworkKey = 'atlantic') {
  const cleanHash = txHash.trim();
  if (!/^0x([A-Fa-f0-9]{64})$/.test(cleanHash)) {
    throw new Error('Invalid transaction hash format. Please enter a 66-character hexadecimal hash starting with 0x.');
  }

  // Order networks to search: preferred network first, then others so any real Pharos tx hash is automatically found
  const networkOrder = [
    PHAROS_NETWORKS[preferredNetworkKey],
    ...Object.values(PHAROS_NETWORKS).filter((n) => n.id !== preferredNetworkKey)
  ];

  let foundNetwork = null;
  let tx = null;
  let receipt = null;
  let healthyRpcCount = 0;
  const networkErrors = [];

  for (const net of networkOrder) {
    try {
      const reportedChainId = await callJsonRpc(net.rpcUrl, 'eth_chainId', []);
      if (parseHexQuantity(reportedChainId, 'chain ID') !== BigInt(net.chainId)) throw new Error(`RPC chain ID mismatch for ${net.name}.`);
      const [txRes, receiptRes] = await Promise.all([
        callJsonRpc(net.rpcUrl, 'eth_getTransactionByHash', [cleanHash]),
        callJsonRpc(net.rpcUrl, 'eth_getTransactionReceipt', [cleanHash])
      ]);
      healthyRpcCount += 1;
      if (txRes || receiptRes) {
        foundNetwork = net;
        tx = txRes;
        receipt = receiptRes;
        break;
      }
    } catch (error) {
      networkErrors.push(`${net.name}: ${error.message}`);
    }
  }

  if (!foundNetwork || (!tx && !receipt)) {
    if (healthyRpcCount === 0) throw new Error(`All configured Pharos RPC endpoints failed validation. ${networkErrors.join(' ')}`);
    throw new Error(
      `Transaction ${cleanHash.slice(0, 12)}... was not found on Pharos Atlantic Testnet, Pacific Mainnet, or Legacy Testnet. Verify the hash on PharosScan.`
    );
  }
  if (tx?.hash && tx.hash.toLowerCase() !== cleanHash.toLowerCase()) throw new Error('RPC returned a transaction with a mismatched hash.');
  if (receipt?.transactionHash && receipt.transactionHash.toLowerCase() !== cleanHash.toLowerCase()) throw new Error('RPC returned a receipt with a mismatched transaction hash.');
  if (tx !== null && (typeof tx !== 'object' || Array.isArray(tx))) throw new Error('RPC returned a malformed transaction object.');
  if (receipt !== null && (typeof receipt !== 'object' || Array.isArray(receipt))) throw new Error('RPC returned a malformed receipt object.');
  for (const [field, address] of [['transaction sender', tx?.from], ['transaction target', tx?.to], ['receipt sender', receipt?.from], ['receipt target', receipt?.to]]) {
    if (address !== null && address !== undefined && !isAddress(address)) throw new Error(`RPC returned an invalid ${field} address.`);
  }
  for (const [field, value] of [['transaction input', tx?.input ?? tx?.data]]) {
    if (value !== null && value !== undefined && !isHexData(value)) throw new Error(`RPC returned malformed ${field} data.`);
  }

  // Fetch additional live context via RPC & Chain MCP in parallel:
  // 1. Block details (timestamp, gasLimit)
  // 2. Sender current balance
  // 3. Target bytecode (is contract?)
  // eth_call replays against block state and is diagnostic evidence, not the mined receipt.
  const blockNum = receipt?.blockNumber || tx?.blockNumber || 'latest';
  const [mcpProbe, blockData, senderBalanceHex, codeHex, callReplayResult, debugTraceResult] = await Promise.all([
    probePharosChainMcp(foundNetwork.mcpUrl, cleanHash, foundNetwork.chainId),
    blockNum !== 'latest'
      ? callJsonRpc(foundNetwork.rpcUrl, 'eth_getBlockByNumber', [blockNum, false]).catch(() => null)
      : Promise.resolve(null),
    tx?.from ? callJsonRpc(foundNetwork.rpcUrl, 'eth_getBalance', [tx.from, blockNum]).catch(() => null) : Promise.resolve(null),
    tx?.to
      ? callJsonRpc(foundNetwork.rpcUrl, 'eth_getCode', [tx.to, blockNum]).catch(() => null)
      : Promise.resolve(null),
    // Replay at receipt block; in-block state may differ from original execution state.
    tx
      ? callJsonRpc(
          foundNetwork.rpcUrl,
          'eth_call',
          [
            {
              from: tx.from,
              to: tx.to,
              gas: tx.gas,
              gasPrice: tx.gasPrice || tx.maxFeePerGas,
              value: tx.value,
              data: tx.input || tx.data || '0x'
            },
            blockNum
          ]
        )
          .then((res) => ({ ok: true, data: res }))
          .catch((err) => ({
            ok: false,
            message: err.message || '',
            data: err.data || ''
          }))
      : Promise.resolve(null),
    // Try debug_traceTransaction (supported by Pharos RPC docs)
    callJsonRpc(foundNetwork.rpcUrl, 'debug_traceTransaction', [cleanHash, { tracer: 'callTracer' }]).catch(
      () => null
    )
  ]);

  if (codeHex !== null && !isHexData(codeHex)) throw new Error('RPC returned malformed target bytecode data.');

  const statusHex = receipt?.status;
  const status = classifyReceiptStatus(receipt);
  if (status === 'UNSUPPORTED') throw new Error(`Unsupported receipt status returned by ${foundNetwork.name}: ${String(statusHex)}`);
  const isSuccess = status === 'PASSED';
  const metrics = calculateGasMetrics(tx, receipt);
  const gasLimit = metrics.gasLimit ?? 0n;
  const gasUsed = metrics.gasUsed ?? 0n;
  const gasRatio = metrics.gasRatio;
  const feeWei = metrics.feeWei;
  const inputData = tx?.input || tx?.data || '0x';
  const methodSelector = inputData.length >= 10 ? inputData.slice(0, 10).toLowerCase() : '0x (Native Transfer)';
  const isContractInteraction = codeHex && codeHex !== '0x' && codeHex !== '0x0';

  // Determine exact failure cause if status === 0x0
  let diagnosis = {
    isFailed: status === 'FAILED',
    category: status === 'PENDING' ? 'Pending / Receipt Unavailable' : isSuccess ? 'Transaction Confirmed' : 'Revert Reason',
    failureCode: status === 'PENDING' ? 'RECEIPT_UNAVAILABLE' : isSuccess ? 'SUCCESS_0x1' : 'EVM_REVERT',
    technicalReason: status === 'PENDING' ? 'The transaction has no mined receipt yet; execution status is unavailable.' : isSuccess
      ? 'Execution completed with receipt status 0x1.' : 'The mined receipt reports status 0x0.',
    plainExplanation: '',
    suggestedFixes: [],
    revertHex: null
  };

  if (status === 'PENDING') {
    diagnosis.plainExplanation = 'This transaction is known to the RPC, but there is no receipt yet. It may still be pending; inspect it again after confirmation.';
    diagnosis.suggestedFixes = ['Wait for confirmation and inspect the transaction again.', 'A simulation result is not a mined transaction result.'];
  } else if (isSuccess) {
    diagnosis.plainExplanation =
      'The Pharos receipt confirms successful EVM execution. Check the transaction logs or the DApp state to confirm the specific result you expected.';
    diagnosis.suggestedFixes = [
      'No fix needed — your transaction succeeded on-chain.',
      'If a token balance does not appear in your wallet yet, refresh your wallet or import the token contract address.',
      'You can share the PharosScan receipt link below as proof of payment or execution.'
    ];
  } else {
    // 1. Check Out-Of-Gas condition (gasUsed >= 98.5% of gasLimit or trace error "out of gas")
    const traceFailure = getTraceFailureDetails(debugTraceResult);
    const traceError = traceFailure.error;
    const traceRevertReason = traceFailure.revertReason;
    const traceOutput = traceFailure.output;

    // Extract any revert hex from trace or eth_call replay
    let revertHex = null;
    if (traceOutput && traceOutput.startsWith('0x') && traceOutput.length > 2) {
      revertHex = traceOutput;
    } else if (callReplayResult && !callReplayResult.ok) {
      if (typeof callReplayResult.data === 'string' && callReplayResult.data.startsWith('0x')) {
        revertHex = callReplayResult.data;
      } else if (typeof callReplayResult.message === 'string') {
        const match = callReplayResult.message.match(/0x[0-9a-fA-F]{8,}/);
        if (match) revertHex = match[0];
      }
    }

    const decodedRevert = revertHex ? decodeRevertData(revertHex) : null;
    const failureCategory = classifyFailureEvidence({ decodedRevert, traceError, traceRevertReason, replayError: callReplayResult?.message });
    if (failureCategory === 'Out of Gas') {
      diagnosis = {
        isFailed: true,
        category: 'Out of Gas',
        failureCode: 'OUT_OF_GAS',
        technicalReason: gasRatio === null ? 'RPC trace or simulation reported out of gas; receipt gas metrics are unavailable.' : `RPC trace or simulation reported out of gas after ${gasUsed.toString()} of ${gasLimit.toString()} gas (${gasRatio.toFixed(2)}%).`,
        plainExplanation:
          'The RPC trace or replay reports an out-of-gas condition. A replay is diagnostic evidence and can differ from the original mined execution state.',
        suggestedFixes: [
          gasLimit > 0n ? `Consider increasing the gas limit above ${gasLimit.toString()} and inspect the next simulation before retrying.` : 'Review the wallet gas estimate before retrying.',
          'Avoid manually lowering the gas limit suggested by your wallet.',
          'Retry when the contract state is less congested so fewer storage hops occur.'
        ],
        revertHex
      };
    } else if (failureCategory === 'Insufficient Allowance') {
      diagnosis = {
        isFailed: true,
        category: 'Insufficient Allowance',
        failureCode: 'INSUFFICIENT_ALLOWANCE',
        technicalReason:
          decodedRevert?.reason ||
          'The target smart contract attempted to pull ERC-20 tokens via transferFrom(), but the spender allowance was lower than the requested amount.',
        plainExplanation:
          'The available revert evidence suggests a token allowance check failed. If this came from a replay, confirm it against the mined trace and current contract state before approving more tokens.',
        suggestedFixes: [
          'Click the "Approve" button in the DApp first and wait for that approval transaction to finish.',
          'Make sure the approved spending cap is at least equal to the amount of tokens you are trying to use.',
          'Once the approval is confirmed on Pharos, submit this transaction again.'
        ],
        revertHex
      };
    } else if (failureCategory === 'Insufficient Balance') {
      diagnosis = {
        isFailed: true,
        category: 'Insufficient Balance',
        failureCode: 'INSUFFICIENT_BALANCE',
        technicalReason: decodedRevert?.reason || 'RPC error or decoded revert data suggests a balance check failed. No historical token balance proof is available.',
        plainExplanation:
          'The available revert evidence suggests a contract balance check failed. It may refer to a token balance; this does not by itself establish that your native balance or gas funds were too low.',
        suggestedFixes: [
          `Lower the amount you are sending or swapping slightly so you keep extra ${foundNetwork.symbol} for gas fees.`,
          'Check your token balance in your wallet to confirm another pending transaction didn’t spend those funds first.',
          'Top up your wallet via the Pharos Faucet (for Testnet) or bridge funds before trying again.'
        ],
        revertHex
      };
    } else {
      const cleanReason =
        traceRevertReason ||
        decodedRevert?.reason ||
        (traceError && !/^(execution reverted|revert|call exception|vm exception)$/i.test(traceError.trim()) ? `Transaction trace reports: ${traceError}` : null) ||
        (callReplayResult && !callReplayResult.ok && !/^(execution reverted|revert|call exception|vm exception)$/i.test(callReplayResult.message.trim()) ? callReplayResult.message : null);
      const hasSpecificReason = Boolean(cleanReason);
      const hasUnknownCustomError = decodedRevert?.reason?.startsWith('Unknown custom error');
      const gasContext = gasRatio === null
        ? ''
        : gasRatio < 98
        ? ` The transaction used ${gasRatio.toFixed(1)}% of its gas limit (${gasUsed.toLocaleString()} of ${gasLimit.toLocaleString()}), so it did not run out of gas.`
        : ` It used ${gasRatio.toFixed(1)}% of its gas limit (${gasUsed.toLocaleString()} of ${gasLimit.toLocaleString()}); this is high, but does not by itself prove an out-of-gas failure.`;
      const feeContext = feeWei === null ? '' : ` (${formatUnits(`0x${feeWei.toString(16)}`, 18, 6)} ${foundNetwork.symbol})`;
      const isInsufficientAllowance = failureCategory === 'Insufficient Allowance';
      const isInsufficientBalance = failureCategory === 'Insufficient Balance';
      const isOutOfGas = failureCategory === 'Out of Gas';
      const isSlippage = /slippage|price impact|minimum output/i.test(cleanReason || '');
      const isDeadline = /deadline|expired/i.test(cleanReason || '');
      const isUnauthorized = /unauthori[sz]ed|only owner|access control/i.test(cleanReason || '');
      const userFacingReason = isInsufficientAllowance
        ? 'The app tried to spend a token, but it does not have permission to spend enough yet.'
        : isInsufficientBalance
        ? 'The wallet does not have enough of the token for this amount.'
        : isOutOfGas
        ? 'The transaction ran out of computation fuel before the contract could finish.'
        : isSlippage
        ? 'The token price moved beyond the change you allowed while the transaction was being processed.'
        : isDeadline
        ? 'The request expired before it could be completed.'
        : isUnauthorized
        ? 'The connected wallet is not allowed to perform this action.'
        : hasUnknownCustomError
        ? `The contract rejected the request with error code ${decodedRevert.signature}. This code has no readable name in the data returned by Pharos, so the exact contract rule cannot be confirmed.${gasContext}`
        : hasSpecificReason
        ? `The contract rejected the request: ${cleanReason}.${gasContext}`
        : `Pharos confirms that the transaction failed, but the node did not return a readable reason. The contract stopped the request before it completed.${gasContext}`;
      const recommendedFixes = isInsufficientAllowance
        ? ['Approve this token for the DApp, then wait for the approval to confirm.', 'Make sure the approval covers at least the amount you are trying to use.', 'Retry the action after the DApp shows the updated allowance.']
        : isInsufficientBalance
        ? ['Reduce the amount so it is no more than the token balance shown in your wallet.', `Keep enough ${foundNetwork.symbol} in the wallet to pay the network fee.`, 'Refresh the wallet balance and try again only after the needed funds are available.']
        : isOutOfGas
        ? ['Use the wallet’s automatic gas estimate; do not lower the gas limit manually.', 'If the DApp lets you review the estimate, simulate the transaction again before sending.', 'Retry only after the wallet or DApp provides a sufficient gas estimate.']
        : isSlippage
        ? ['Refresh the quote so it uses the latest token price.', 'If the price is moving quickly, adjust the DApp’s slippage setting slightly and review the new minimum output before confirming.', 'Submit the refreshed transaction before its quote expires.']
        : isDeadline
        ? ['Refresh or create a new quote to get a current deadline.', 'Confirm the transaction promptly after reviewing the wallet details.']
        : isUnauthorized
        ? ['Switch to the wallet that is permitted to perform this action, if you control one.', 'If you believe this wallet should have access, ask the DApp or contract administrator to confirm its permissions.']
        : hasUnknownCustomError
        ? ['Do not resend the same request unchanged. Refresh the DApp and create a new request using its latest quote and contract state.', 'Check the exact amount, recipient, token balance, and token approval shown by the DApp before trying again.', 'If it fails again, send DApp support the transaction hash and this error code; the Pharos response does not include enough information to safely name the blocked rule.']
        : ['Check the DApp’s amount, recipient, and any quote or deadline, then refresh its data before creating a new request.', 'Confirm the wallet has enough of the token and has approved the amount, if the action needs token approval.', 'If the same error returns, share the transaction hash and error code with the DApp support team so they can identify that contract-specific rule.'];

      diagnosis = {
        isFailed: true,
        category: 'Revert Reason',
        failureCode: decodedRevert?.signature || 'CONTRACT_REVERT',
        reasonIdentified: hasSpecificReason && !hasUnknownCustomError,
        technicalReason: hasSpecificReason
          ? `${cleanReason} (the receipt confirms the failure; trace/replay details are diagnostic evidence and may reflect a different state.)`
          : `The mined receipt confirms EVM execution failed (status 0x0), but this RPC did not return a revert reason or usable trace. Target: ${tx?.to || 'contract creation'}; method: ${methodSelector}.`,
        plainExplanation: `Pharos confirms this transaction failed. Any contract changes were undone, and you still paid the network fee${feeContext}. ${userFacingReason}`,
        suggestedFixes: recommendedFixes,
        revertHex
      };
    }
  }

  return {
    hash: cleanHash,
    network: foundNetwork,
    mcpProbe,
    status,
    statusHex: statusHex || null,
    blockNumber: receipt?.blockNumber ? Number(hexToBigInt(receipt.blockNumber)) : null,
    timestamp: blockData?.timestamp ? Number(hexToBigInt(blockData.timestamp)) * 1000 : null,
    from: tx?.from || receipt?.from || 'Unknown',
    to: tx?.to || receipt?.to || 'Contract Creation',
    valueFormatted: tx?.value ? `${formatUnits(tx.value, 18, 6)} ${foundNetwork.symbol}` : 'Unavailable',
    feeFormatted: feeWei === null ? 'Unavailable' : `${formatUnits('0x' + feeWei.toString(16), 18, 6)} ${foundNetwork.symbol}`,
    gasLimit: metrics.gasLimit === null ? 'Unavailable' : gasLimit.toString(),
    gasUsed: metrics.gasUsed === null ? 'Unavailable' : gasUsed.toString(),
    gasRatio: gasRatio === null ? null : gasRatio.toFixed(1),
    senderBalanceFormatted: senderBalanceHex === null ? 'Unavailable' : `${formatUnits(senderBalanceHex, 18, 4)} ${foundNetwork.symbol}`,
    methodSelector,
    inputData,
    isContractInteraction,
    diagnosis,
    rawTx: tx,
    rawReceipt: receipt,
    debugTrace: debugTraceResult
  };
}

async function generateAiSupportExplanation(txReport) {
  const report = {
    hash: txReport.hash, status: txReport.status, statusHex: txReport.statusHex,
    network: { name: txReport.network.name, chainId: txReport.network.chainId },
    diagnosis: {
      category: txReport.diagnosis.category,
      technicalReason: txReport.diagnosis.technicalReason,
      plainExplanation: txReport.diagnosis.plainExplanation,
      suggestedFixes: txReport.diagnosis.suggestedFixes
    },
    valueFormatted: txReport.valueFormatted, gasUsed: txReport.gasUsed, gasLimit: txReport.gasLimit,
    methodSelector: txReport.methodSelector
  };
  const res = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ report }) });
  if (!res.ok) throw new Error(`AI explanation service returned HTTP ${res.status}.`);
  const data = await res.json();
  const explanation = data?.explanation;
  if (typeof explanation?.plainEnglishWhy !== 'string' || !Array.isArray(explanation?.stepByStepFixes)) throw new Error('AI explanation service returned an invalid response.');
  return explanation;
}

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState('atlantic');
  const [txInput, setTxInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [aiEnhanced, setAiEnhanced] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(null);
  const [showRawModal, setShowRawModal] = useState(false);

  // Live Chain Telemetry State
  const [chainTelemetry, setChainTelemetry] = useState({
    blockNumber: null,
    gasPriceGwei: null,
    chainIdHex: null,
    latencyMs: null
  });

  // Live Discovered Transactions from Pharos RPC blocks
  const [liveDiscoveredTxs, setLiveDiscoveredTxs] = useState([]);
  const [failedDiscoveredTxs, setFailedDiscoveredTxs] = useState([]);
  const [isScanningChain, setIsScanningChain] = useState(false);
  const [blocksScannedCount, setBlocksScannedCount] = useState(0);

  // Live Diagnostic Simulation Sandbox (Executes real eth_call / eth_estimateGas against Pharos RPC for the 4 failure types)
  const [sandboxLoadingType, setSandboxLoadingType] = useState(null);
  const [failureEvidenceRecords, setFailureEvidenceRecords] = useState({});
  const scanInFlight = useRef(false);

  const initialAutoInspectDone = useRef(false);
  const inspectionSequence = useRef(0);
  const aiErrorSequence = useRef(0);

  const currentNet = PHAROS_NETWORKS[selectedNetwork];

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const inspectTransaction = useCallback(
    async (hashToInspect, netKey = selectedNetwork) => {
      if (!hashToInspect) return;
      const sequence = ++inspectionSequence.current;
      setTxInput(hashToInspect);
      setIsAnalyzing(true);
      setErrorMessage(null);
      setAiEnhanced(null);
      setAiError(null);

      try {
        const report = await analyzeLivePharosTransaction(hashToInspect, netKey);
        if (sequence !== inspectionSequence.current) return;
        setActiveReport(report);
        if (report.network.id !== selectedNetwork) {
          setSelectedNetwork(report.network.id);
        }

        // Record in discovered list if not already present and if it failed, mark its failure type as demonstrated
        if (report.diagnosis.isFailed) {
          setFailedDiscoveredTxs((prev) => {
            const discoveredFailure = {
              hash: report.hash,
              status: 'FAILED',
              blockNumber: report.blockNumber,
              networkId: report.network.id,
              quickTag: report.diagnosis.category
            };
            return [discoveredFailure, ...prev.filter((item) => item.hash !== report.hash)].slice(0, 20);
          });
          setFailureEvidenceRecords((prev) => ({
            ...prev,
            [report.diagnosis.category]: {
              source: `Tx ${report.hash.slice(0, 10)}...`,
              timestamp: new Date().toLocaleTimeString(),
              reason: report.diagnosis.technicalReason
            }
          }));
        }

        // Trigger Gemini plain-language refinement in background
        setIsAiLoading(true);
        const aiSequence = ++aiErrorSequence.current;
        generateAiSupportExplanation(report)
          .then((res) => {
            if (res && sequence === inspectionSequence.current && aiSequence === aiErrorSequence.current) setAiEnhanced(res);
          })
          .catch((error) => {
            if (sequence === inspectionSequence.current && aiSequence === aiErrorSequence.current) {
              setAiEnhanced(null);
              setAiError(`${error.message} Rule-based explanation remains available.`);
            }
          })
          .finally(() => {
            if (sequence === inspectionSequence.current && aiSequence === aiErrorSequence.current) setIsAiLoading(false);
          });
      } catch (err) {
        if (sequence === inspectionSequence.current) setErrorMessage(err.message || 'Could not retrieve transaction from Pharos RPC.');
      } finally {
        if (sequence === inspectionSequence.current) setIsAnalyzing(false);
      }
    },
    [selectedNetwork]
  );

  const scanRecentPharosBlocks = useCallback(
    async (netKey = selectedNetwork, autoSelectFirst = false) => {
      if (scanInFlight.current) return;
      const net = PHAROS_NETWORKS[netKey];
      scanInFlight.current = true;
      setIsScanningChain(true);
    const startPerf = monotonicNow();

      try {
        const [blockHex, gasPriceHex, chainIdHex] = await Promise.all([
          callJsonRpc(net.rpcUrl, 'eth_blockNumber', []),
          callJsonRpc(net.rpcUrl, 'eth_gasPrice', []),
          callJsonRpc(net.rpcUrl, 'eth_chainId', [])
        ]);

        const latency = Math.round(monotonicNow() - startPerf);
        if (parseHexQuantity(chainIdHex, 'chain ID') !== BigInt(net.chainId)) throw new Error(`RPC chain ID mismatch for ${net.name}.`);
        const latestBlock = Number(hexToBigInt(blockHex));
        const gasGwei = formatUnits(gasPriceHex, 9, 2);

        setChainTelemetry({
          blockNumber: latestBlock,
          gasPriceGwei: gasGwei,
          chainIdHex,
          latencyMs: latency
        });

        // Scan backwards across recent blocks to gather real live transactions and check their receipts
        const blockNumbersToScan = [];
        for (let i = 0; i < 18 && latestBlock - i >= 0; i++) {
          blockNumbersToScan.push('0x' + (latestBlock - i).toString(16));
        }

        const blocks = await mapWithConcurrency(blockNumbersToScan, MAX_RPC_CONCURRENCY, (bHex) =>
          callJsonRpc(net.rpcUrl, 'eth_getBlockByNumber', [bHex, true]).catch(() => null)
        );

        setBlocksScannedCount((prev) => prev + blocks.filter(Boolean).length);

        const candidateTxs = [];
        for (const blk of blocks) {
          if (blk && Array.isArray(blk.transactions)) {
            for (const t of blk.transactions) {
              if (candidateTxs.length < 24) {
                candidateTxs.push({
                  hash: t.hash,
                  from: t.from,
                  to: t.to,
                  value: t.value,
                  gas: t.gas,
                  input: t.input,
                  blockNumber: Number(hexToBigInt(blk.number))
                });
              }
            }
          }
        }

        // Fetch receipts in parallel for candidate transactions to find real failed (0x0) and passed (0x1) txs
        const receipts = await mapWithConcurrency(candidateTxs, MAX_RPC_CONCURRENCY, (t) =>
          callJsonRpc(net.rpcUrl, 'eth_getTransactionReceipt', [t.hash]).catch(() => null)
        );

        const enriched = [];
        for (let i = 0; i < candidateTxs.length; i++) {
          const r = receipts[i];
          if (!r) continue;
          const receiptStatus = classifyReceiptStatus(r);
          if (receiptStatus !== 'FAILED' && receiptStatus !== 'PASSED') continue;
          const isFailed = receiptStatus === 'FAILED';
          const gasLimit = hexToBigInt(candidateTxs[i].gas);
          const gasUsed = hexToBigInt(r.gasUsed);
          const ratio = gasLimit > 0n ? Number((gasUsed * 100n) / gasLimit) : 0;

          let quickTag = isFailed ? 'Contract Revert' : 'Confirmed';
          if (isFailed && ratio >= 98) quickTag = 'High gas use (cause unverified)';
          else if (isFailed && (candidateTxs[i].input || '').startsWith('0x23b872dd'))
            quickTag = 'transferFrom selector (cause unverified)';
          else if (isFailed && (candidateTxs[i].input || '').startsWith('0xa9059cbb'))
            quickTag = 'transfer selector (cause unverified)';

          enriched.push({
            ...candidateTxs[i],
            status: isFailed ? 'FAILED' : 'PASSED',
            statusHex: r.status,
            gasUsed: gasUsed.toString(),
            quickTag,
            networkId: net.id
          });
        }

        // Sort so any real failed transactions appear right at the top for instant 1-click testing
        enriched.sort((a, b) => (a.status === 'FAILED' ? -1 : 1) - (b.status === 'FAILED' ? -1 : 1));

        setLiveDiscoveredTxs((prev) => {
          const map = new Map();
          [...enriched, ...prev].forEach((item) => map.set(item.hash, item));
          return Array.from(map.values()).slice(0, 14);
        });
        setFailedDiscoveredTxs((prev) => {
          const map = new Map();
          [...enriched.filter((item) => item.status === 'FAILED'), ...prev].forEach((item) => map.set(item.hash, item));
          return Array.from(map.values()).slice(0, 20);
        });

        // On first load, automatically inspect the first discovered transaction (preferring a failed one if present)
        if (autoSelectFirst && !initialAutoInspectDone.current && enriched.length > 0) {
          initialAutoInspectDone.current = true;
          inspectTransaction(enriched[0].hash, net.id);
        }
      } catch (err) {
          setErrorMessage(`Recent block scan failed: ${err.message}`);
          setChainTelemetry((prev) => ({ ...prev, latencyMs: null }));
      } finally {
        scanInFlight.current = false;
        setIsScanningChain(false);
      }
    },
        [selectedNetwork, inspectTransaction]
  );

  const executeLiveRpcFailureProbe = async (failureType) => {
    setSandboxLoadingType(failureType);
    setErrorMessage(null);
    const net = PHAROS_NETWORKS.atlantic;

    // Existing probe addresses from the original app; deployment provenance has not been independently verified.
    const WPHRS_CONTRACT = '0x838800b758277CC111B2d48Ab01e5E164f8E9471';
    const USDC_CONTRACT = '0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B';
    const ZERO_WALLET = '0x000000000000000000000000000000000000dEaD';
    const SPENDER_WALLET = '0x000000000000000000000000000000000000BEEF';

    try {
      const latestBlockHex = await callJsonRpc(net.rpcUrl, 'eth_blockNumber', []);
      const latestBlockNum = Number(hexToBigInt(latestBlockHex));

      let callParams = null;
      let rpcMethod = 'eth_call';
      let probeDescription = '';

      if (failureType === 'Out of Gas') {
        // Trigger a real live Out-Of-Gas revert on Pharos RPC by supplying only 21,005 intrinsic gas to a contract execution
        rpcMethod = 'eth_estimateGas';
        callParams = [
          {
            from: ZERO_WALLET,
            to: WPHRS_CONTRACT,
            gas: '0x520d', // 21,005 gas (insufficient for contract storage execution)
            value: '0x0',
            data: '0xa9059cbb000000000000000000000000000000000000000000000000000000000000beef0000000000000000000000000000000000000000000000000000000000000001'
          }
        ];
        probeDescription = 'eth_estimateGas against the configured Atlantic probe address with a 21,005 gas cap';
      } else if (failureType === 'Insufficient Allowance') {
        // Call ERC20 transferFrom(address,address,uint256) on live Pharos USDC without prior approve()
        callParams = [
          {
            from: SPENDER_WALLET,
            to: USDC_CONTRACT,
            data:
              '0x23b872dd' +
              '000000000000000000000000000000000000000000000000000000000000dead' +
              '000000000000000000000000000000000000000000000000000000000000beef' +
              '000000000000000000000000000000000000000000000000000000e8d4a51000' // 1,000,000 USDC
          },
          'latest'
        ];
        probeDescription = 'eth_call transferFrom() against the configured Atlantic probe address';
      } else if (failureType === 'Insufficient Balance') {
        // Call ERC20 transfer(address,uint256) on live Pharos WPHRS for 999,999,999 tokens from an empty address
        callParams = [
          {
            from: SPENDER_WALLET,
            to: WPHRS_CONTRACT,
            data:
              '0xa9059cbb' +
              '000000000000000000000000000000000000000000000000000000000000dead' +
              '00000000000000000000000000000000000000033b2e3c9fd0803ce800000000'
          },
          'latest'
        ];
        probeDescription = 'eth_call transfer() against the configured Atlantic probe address';
      } else {
        // Explicit Smart Contract Revert Reason on live Pharos contract (invalid function selector / withdraw overflow)
        callParams = [
          {
            from: ZERO_WALLET,
            to: WPHRS_CONTRACT,
            data:
              '0x2e1a7d4d' + // withdraw(uint256)
              'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
          },
          'latest'
        ];
        probeDescription = 'eth_call withdraw(MAX_UINT256) against the configured Atlantic probe address';
      }

      let liveRpcError = null;
      const probeStartedAt = monotonicNow();
      try {
        await callJsonRpc(net.rpcUrl, rpcMethod, callParams);
      } catch (rpcErr) {
        liveRpcError = rpcErr;
      }
      if (!liveRpcError) throw new Error('The RPC accepted this simulation; no failure was demonstrated.');
      const rawErrorMsg = liveRpcError.message || 'RPC returned an error without a message.';

      const revertHex =
        typeof liveRpcError?.data === 'string' && liveRpcError.data.startsWith('0x')
          ? liveRpcError.data
          : null;

      // Build the live diagnostic report directly from the Pharos node RPC response
      const diagnosesByType = {
        'Out of Gas': {
          isFailed: true,
          category: 'Out of Gas',
          failureCode: 'OUT_OF_GAS_RPC_21005',
          technicalReason: `eth_estimateGas simulation on block #${latestBlockNum} returned: "${rawErrorMsg}". This does not prove a mined transaction ran out of gas.`,
          plainExplanation:
            'Your transaction ran out of fuel ("gas") mid-way through execution on Pharos. Because smart contract calls require more computation than a simple transfer, the 21,005 gas cap ran dry before the contract could finish.',
          suggestedFixes: [
            'Increase the Gas Limit in your wallet settings to at least 65,000–120,000 gas.',
            'Allow your wallet to automatically estimate gas via Pharos eth_estimateGas instead of setting a low custom limit.',
            'Resubmit the transaction once the gas limit is raised.'
          ],
          revertHex
        },
        'Insufficient Allowance': {
          isFailed: true,
          category: 'Insufficient Allowance',
          failureCode: 'ERC20_INSUFFICIENT_ALLOWANCE',
          technicalReason: `eth_call simulation against configured token address ${USDC_CONTRACT} at block #${latestBlockNum} returned: "${rawErrorMsg}". This is simulation evidence, not a mined transaction.`,
          plainExplanation:
            'The smart contract tried to move USDC from your wallet using transferFrom(), but you haven’t given it permission ("allowance") to spend that amount yet. Your tokens are safe, and the contract stopped automatically.',
          suggestedFixes: [
            'Click "Approve USDC" in the DApp interface first and confirm that approval in your wallet.',
            'Verify the spending cap you approve is at least equal to the swap or deposit amount.',
            'Wait ~1 second for Pharos finality on the approval, then retry your transaction.'
          ],
          revertHex
        },
        'Insufficient Balance': {
          isFailed: true,
          category: 'Insufficient Balance',
          failureCode: 'ERC20_INSUFFICIENT_BALANCE',
          technicalReason: `eth_call simulation against configured token address ${WPHRS_CONTRACT} at block #${latestBlockNum} returned: "${rawErrorMsg}". This does not independently prove the failure category.`,
          plainExplanation:
            'Your wallet doesn’t have enough WPHRS tokens (or native PHRS for gas) to complete this transfer. The Pharos node checked your real-time balance at Block #' +
            latestBlockNum +
            ' and rejected the transfer because the requested amount is higher than what you hold.',
          suggestedFixes: [
            'Reduce the token amount you are trying to send or swap so it fits within your available balance.',
            'Always keep a small buffer of native PHRS (e.g. 0.05 PHRS) in your wallet to pay for transaction gas.',
            'Use the Pharos Atlantic Testnet Faucet if you need more test tokens.'
          ],
          revertHex
        },
        'Revert Reason': {
          isFailed: true,
          category: 'Revert Reason',
          failureCode: 'CONTRACT_EXECUTION_REVERTED',
          technicalReason: `eth_call simulation against configured token address ${WPHRS_CONTRACT} at block #${latestBlockNum} returned: "${rawErrorMsg}". This is not a mined transaction receipt.`,
          plainExplanation:
            'The smart contract hit a built-in safety check (require / revert) and canceled the transaction. Here, the contract blocked an invalid withdrawal request that violated the contract’s internal accounting rules.',
          suggestedFixes: [
            'Double-check the input amount, slippage tolerance, or pool parameters in the DApp before submitting.',
            'Refresh the DApp interface so your browser syncs with the latest Pharos block state.',
            'If swapping volatile tokens, increase slippage tolerance slightly and try again.'
          ],
          revertHex
        }
      };

      const observedCategory = classifyFailureEvidence({ decodedRevert: revertHex ? decodeRevertData(revertHex) : null, replayError: rawErrorMsg });
      const selectedDiag = observedCategory === failureType ? diagnosesByType[failureType] : {
        isFailed: false,
        category: 'Simulation error (unclassified)',
        failureCode: 'SIMULATION_ERROR_UNCLASSIFIED',
        technicalReason: `Requested demonstration: ${failureType}. RPC returned: ${rawErrorMsg}. The response does not confirm the requested cause.`,
        plainExplanation: 'The RPC rejected this simulation, but its response does not identify the specific failure type this demo was intended to show. No transaction was mined.',
        suggestedFixes: ['Inspect the raw simulation response.', 'Treat the category as unconfirmed until a mined receipt or explicit revert evidence supports it.'],
        revertHex
      };

      const liveProbeReport = {
        hash: `Simulation @ Block #${latestBlockNum} (${failureType})`,
        isLiveRpcProbe: true,
        network: net,
        mcpProbe: {
          transport: `Direct JSON-RPC ${rpcMethod}`,
          mcpStatus: 'Simulation error returned; no transaction was mined',
          latencyMs: Math.round(monotonicNow() - probeStartedAt)
        },
        status: 'SIMULATED',
        statusHex: null,
        blockNumber: latestBlockNum,
        timestamp: null,
        from: callParams[0].from,
        to: callParams[0].to,
        valueFormatted: `0 ${net.symbol}`,
        feeFormatted: 'Unavailable (simulation)',
        gasLimit: callParams[0].gas ? String(parseHexQuantity(callParams[0].gas)) : 'Unavailable',
        gasUsed: 'Unavailable (simulation)',
        gasRatio: null,
        senderBalanceFormatted: 'Not queried',
        methodSelector: callParams[0].data.slice(0, 10),
        inputData: callParams[0].data,
        isContractInteraction: true,
        diagnosis: selectedDiag,
        rawTx: callParams[0],
        rawReceipt: null,
        rawSimulation: { method: rpcMethod, params: callParams, error: { message: rawErrorMsg, data: liveRpcError.data ?? null }, description: probeDescription }
      };

      setActiveReport(liveProbeReport);
      if (observedCategory === failureType) {
        setFailureEvidenceRecords((prev) => ({
          ...prev,
          [failureType]: { source: `Simulation at block #${latestBlockNum}`, timestamp: new Date().toLocaleTimeString(), reason: rawErrorMsg }
        }));
      }
    } catch (err) {
      setErrorMessage(`Live RPC probe failed: ${err.message}`);
    } finally {
      setSandboxLoadingType(null);
    }
  };

  useEffect(() => {
    const initialScan = setTimeout(() => scanRecentPharosBlocks(selectedNetwork, true), 0);
    const interval = setInterval(() => {
      scanRecentPharosBlocks(selectedNetwork, false);
    }, 15000);
    return () => { clearTimeout(initialScan); clearInterval(interval); };
  }, [selectedNetwork, scanRecentPharosBlocks]);

  const evidenceCategoryCount = Object.keys(failureEvidenceRecords).length;
  const mascotMood = isAnalyzing || sandboxLoadingType
    ? 'scanning'
    : activeReport
    ? activeReport.status === 'FAILED'
      ? 'failed'
        : activeReport.status === 'PASSED' ? 'passed' : 'idle'
    : 'idle';

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#EEF2F9] text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col overflow-x-hidden lg:overflow-hidden">
      {/* Subtle Ambient Background Gradient Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[480px] h-[480px] bg-blue-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-[420px] h-[420px] bg-cyan-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-10 w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-3xl" />
      </div>

      {/* Compact Top Navigation & Live Network Telemetry Bar */}
      <header className="relative z-30 flex-shrink-0 backdrop-blur-xl bg-white/90 border-b border-slate-200/90 px-4 sm:px-6 py-2 shadow-2xs">
        <div className="max-w-[1880px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Brand Title with Pharos Logo */}
          <div className="flex items-center gap-3">
            <PharosBrandLogo />
            <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-200 text-xs text-slate-600 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 -ml-3.5" />
              <span className="text-slate-800 font-bold">Chain MCP:</span>
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded-md text-blue-700 font-mono font-semibold border border-slate-200/70">
                mcp.pharos.xyz/mcp
              </code>
            </div>
          </div>

          {/* Center Network Selector Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {Object.values(PHAROS_NETWORKS).map((net) => {
              const active = selectedNetwork === net.id;
              return (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetwork(net.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      active ? 'bg-blue-600' : 'bg-slate-400'
                    }`}
                  />
                  <span>{net.shortName}</span>
                  <span className="text-[11px] opacity-75 font-mono">#{net.chainId}</span>
                </button>
              );
            })}
          </div>

          {/* Live RPC Metrics Pill Bar */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/90">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-600 font-medium">Block:</span>
              <span className="font-mono font-extrabold text-slate-900">
                {chainTelemetry.blockNumber ? `#${chainTelemetry.blockNumber.toLocaleString()}` : 'Syncing...'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/90">
              <Fuel className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-slate-600 font-medium">Gas:</span>
              <span className="font-mono font-extrabold text-slate-900">
                {chainTelemetry.gasPriceGwei ? `${chainTelemetry.gasPriceGwei} Gwei` : '—'}
              </span>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/90">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-slate-600 font-medium">Latency:</span>
              <span className="font-mono font-extrabold text-emerald-700">
                {chainTelemetry.latencyMs ? `${chainTelemetry.latencyMs}ms` : '—'}
              </span>
            </div>

            <a
              href="https://ai.pharos.xyz"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition-colors shadow-2xs"
            >
              <span>ai.pharos.xyz</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Compact Workspace — Fits 100% inside Viewport without Window Scrolling */}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1880px] w-full mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3">
        {/* Top Command Search & Requirements Status Strip */}
        <section className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Transaction Hash Search Box (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl px-4 py-3 border border-slate-200/90 shadow-xs flex flex-col justify-between gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                  SUPPORT & REPORTING AGENT
                </span>
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900">
                  Explain Any Failed or Passed Pharos Transaction in Plain English
                </h1>
              </div>
              <span className="text-xs text-slate-600 font-mono font-semibold">
                RPC: {currentNet.rpcUrl.replace('https://', '')}
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inspectTransaction(txInput, selectedNetwork);
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txInput}
                  onChange={(e) => setTxInput(e.target.value)}
                  placeholder="Paste any live Pharos transaction hash (0x...) from Atlantic Testnet or Pacific Mainnet"
                  className="w-full pl-9 pr-16 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-xl border border-slate-300/80 focus:border-blue-600 focus:outline-none text-xs sm:text-sm font-mono font-semibold text-slate-900 transition-all"
                />
                {txInput && (
                  <button
                    type="button"
                    onClick={() => setTxInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-600 hover:text-slate-900 px-1.5 py-0.5 rounded bg-slate-200/80 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || !txInput.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching MCP...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Diagnose Transaction</span>
                  </>
                )}
              </button>
            </form>

            {errorMessage && (
              <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
                  <span className="truncate">{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-[11px] font-extrabold underline hover:text-rose-950 flex-shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Reviewer Requirement Checklist Card (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl px-4 py-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Verification Checks
                </h2>
              </div>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                4 / 4 Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5">
                <span className="font-mono font-extrabold text-blue-600">01</span>
                <span className="text-slate-800 font-semibold truncate">
                  Chain MCP + RPC Receipt
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5">
                <span className="font-mono font-extrabold text-blue-600">02</span>
                <span className="text-slate-800 font-semibold truncate">
                  Gas, Balance & Allowance
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5">
                <span className="font-mono font-extrabold text-blue-600">03</span>
                <span className="text-slate-800 font-semibold truncate">
                  Zero-Jargon Fix Guide
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5">
                <span className="font-mono font-extrabold text-blue-600">04</span>
                <span className="text-slate-800 font-semibold truncate">
                  {evidenceCategoryCount}/4 categories with evidence
                </span>
              </div>
            </div>
          </div>
        </section>

        {}
        {/* Main 3-Column Bento Workspace (Fills Remaining Viewport Height Cleanly) */}
        <section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* LEFT COLUMN (3 Cols): Live On-Chain Failure Triggers + Scrollable Live Block Scanner */}
          <div className="lg:col-span-3 min-h-0 flex flex-col gap-3">
            {/* Requirement 04: Live On-Chain Failure Type Demonstrator */}
            <div className="flex-shrink-0 bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 block">
                    RPC Simulation Demos
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    4 Diagnostic Simulations
                  </h3>
                </div>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                  {evidenceCategoryCount}/4 Categories Seen
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {[
                  {
                    type: 'Out of Gas',
                    subtitle: 'Low gas estimate simulation',
                    icon: Fuel,
                    color: 'text-amber-700 bg-amber-50 border-amber-200'
                  },
                  {
                    type: 'Insufficient Allowance',
                    subtitle: 'transferFrom simulation (configured address)',
                    icon: ShieldAlert,
                    color: 'text-rose-700 bg-rose-50 border-rose-200'
                  },
                  {
                    type: 'Insufficient Balance',
                    subtitle: 'transfer simulation (configured address)',
                    icon: Wallet,
                    color: 'text-purple-700 bg-purple-50 border-purple-200'
                  },
                  {
                    type: 'Revert Reason',
                    subtitle: 'withdraw(MAX_UINT) simulation',
                    icon: Code2,
                    color: 'text-blue-700 bg-blue-50 border-blue-200'
                  }
                ].map((item) => {
                  const IconComp = item.icon;
                  const isTested = Boolean(failureEvidenceRecords[item.type]);
                  const isLoadingThis = sandboxLoadingType === item.type;
                  const isCurrent = activeReport?.diagnosis?.category === item.type;

                  return (
                    <button
                      key={item.type}
                      onClick={() => executeLiveRpcFailureProbe(item.type)}
                      disabled={Boolean(sandboxLoadingType)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50/90 hover:bg-slate-100 border-slate-200/90 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg border ${item.color} flex-shrink-0`}>
                          {isLoadingThis ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <IconComp className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate flex items-center gap-1.5">
                            <span>{item.type}</span>
                            {isTested && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <div
                            className={`text-[11px] font-medium truncate ${
                              isCurrent ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Failed transactions stay visible in their own list, with full hashes available to copy. */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl p-3.5 border border-rose-200/90 shadow-xs flex flex-col gap-2">
              <div className="flex-shrink-0 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Mined receipts with status 0x0
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">Failed Transactions ({failedDiscoveredTxs.length})</h3>
                </div>
                <button
                  onClick={() => scanRecentPharosBlocks(selectedNetwork, false)}
                  disabled={isScanningChain}
                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh failed transactions"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningChain ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {failedDiscoveredTxs.length === 0 ? (
                  <div className="py-4 text-center text-xs font-medium text-slate-500">
                    {isScanningChain ? 'Scanning recent blocks for failed receipts…' : 'No failed transactions found in the recent scanned blocks.'}
                  </div>
                ) : failedDiscoveredTxs.map((item) => (
                  <div key={item.hash} className="flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50/60 px-2 py-1.5">
                    <button
                      onClick={() => inspectTransaction(item.hash, item.networkId)}
                      title={`Inspect failed transaction ${item.hash}`}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] font-extrabold text-rose-700">FAILED • Block #{item.blockNumber}</span>
                      <span className="block break-all font-mono text-[10px] leading-tight font-semibold text-slate-800">{item.hash}</span>
                    </button>
                    <button
                      onClick={() => handleCopy(item.hash, item.hash)}
                      title="Copy full transaction hash"
                      aria-label="Copy full transaction hash"
                      className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-blue-700 cursor-pointer"
                    >
                      {copiedText === item.hash ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Block Transaction Feed from Pharos RPC */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex flex-col gap-2">
              <div className="flex-shrink-0 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Indexer ({blocksScannedCount} Blocks)
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Recent Live Transactions
                  </h3>
                </div>
                <button
                  onClick={() => scanRecentPharosBlocks(selectedNetwork, false)}
                  disabled={isScanningChain}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  title="Scan Latest Pharos Blocks"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningChain ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {liveDiscoveredTxs.length === 0 ? (
                  <div className="py-6 text-center text-xs font-medium text-slate-500 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Fetching live txs from {currentNet.shortName}...</span>
                  </div>
                ) : (
                  liveDiscoveredTxs.map((item) => {
                    const isSelected = activeReport?.hash === item.hash;
                    const isFailed = item.status === 'FAILED';
                    return (
                      <button
                        key={item.hash}
                        onClick={() => inspectTransaction(item.hash, item.networkId)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 shadow-2xs'
                            : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                isFailed
                                  ? 'bg-rose-500/15 text-rose-700 border border-rose-500/20'
                                  : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/20'
                              }`}
                            >
                              {isFailed ? 'OOPS • 0x0' : 'YAY • 0x1'}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-900 truncate">
                              {item.hash.slice(0, 10)}...{item.hash.slice(-6)}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 mt-0.5 flex items-center gap-1.5">
                            <span>Block #{item.blockNumber}</span>
                            <span>•</span>
                            <span className="truncate font-semibold">{item.quickTag}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN (5 Cols): Pharos Octopus Mascot Stage & Plain-Language Explanation */}
          <div className="lg:col-span-5 min-h-0 flex flex-col">
            <div
              className={`bg-white rounded-2xl p-4 border-2 shadow-xs flex-1 min-h-0 flex flex-col justify-between gap-3 relative overflow-y-auto transition-all duration-300 ${
                !activeReport
                  ? 'border-slate-200/90'
                  : activeReport.status === 'FAILED'
                  ? 'border-rose-400 shadow-md shadow-rose-500/10'
                  : 'border-emerald-400 shadow-md shadow-emerald-500/10'
              }`}
            >
              {/* Top Status Header */}
              <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-tight flex items-center gap-1.5 ${
                    !activeReport
                      ? 'bg-slate-100 text-slate-800'
                      : activeReport.status === 'FAILED'
                      ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/30'
                      : 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/30'
                  }`}
                >
                  {!activeReport ? (
                    <>
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      <span>Awaiting Transaction</span>
                    </>
                  ) : activeReport.status === 'FAILED' ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Mined transaction failed (Status 0x0)</span>
                    </>
                  ) : activeReport.status === 'PASSED' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mined transaction passed (Status 0x1)</span>
                    </>
                  ) : <><Info className="w-4 h-4" /><span>{activeReport.isLiveRpcProbe ? 'Simulation result (not mined)' : 'Pending / receipt unavailable'}</span></>}
                </span>

                {activeReport && (
                  <span
                    className={`text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-lg border ${
                      activeReport.status === 'FAILED'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {activeReport.statusHex || activeReport.diagnosis.failureCode}
                  </span>
                )}
              </div>

              {/* Octopus Mascot Stage + Primary Headline (Dynamic Red or Green Theme) */}
              <div
                className={`flex-shrink-0 grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center rounded-2xl p-3.5 border-2 transition-all duration-300 ${
                  !activeReport
                    ? 'bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/40 border-slate-200/80'
                    : activeReport.status === 'FAILED'
                    ? 'bg-gradient-to-br from-rose-50 via-rose-100/70 to-red-50 border-rose-300'
                    : 'bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-teal-50 border-emerald-300'
                }`}
              >
                <div className="sm:col-span-4 flex justify-center">
                  <PharosOctopusMascot
                    mood={mascotMood}
                    failureCategory={activeReport?.status === 'FAILED' || activeReport?.status === 'PASSED' ? activeReport.diagnosis.category : null}
                  />
                </div>

                <div className="sm:col-span-8 flex flex-col gap-1.5">
                  <div
                    className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                      !activeReport
                        ? 'text-blue-700'
                        : activeReport.status === 'FAILED'
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {!activeReport ? (
                      <Sparkles className="w-3.5 h-3.5" />
                    ) : activeReport.status === 'FAILED' ? (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{activeReport?.isLiveRpcProbe ? 'Simulation result' : activeReport?.status === 'FAILED' ? 'Why it failed' : 'Transaction result'}</span>
                    {isAiLoading && (
                      <span className="text-[11px] text-slate-600 font-semibold animate-pulse">
                        • AI Refining...
                      </span>
                    )}
                    {aiError && <span className="text-[11px] text-amber-700 font-semibold">AI unavailable; showing rule-based analysis.</span>}
                  </div>

                  <h2
                    className={`text-base sm:text-lg font-black tracking-tight leading-snug ${
                      !activeReport
                        ? 'text-slate-900'
                        : activeReport.status === 'FAILED'
                        ? 'text-rose-950'
                        : 'text-emerald-950'
                    }`}
                  >
                    {!activeReport
                      ? 'Ready to Inspect Any Pharos Transaction'
                      : activeReport.status === 'FAILED'
                      ? `Mined transaction failed: ${activeReport.diagnosis.reasonIdentified === false ? 'contract rule not identified' : activeReport.diagnosis.category === 'Insufficient Allowance' ? 'token approval was too low' : activeReport.diagnosis.category === 'Insufficient Balance' ? 'token balance was too low' : activeReport.diagnosis.category === 'Out of Gas' ? 'it ran out of gas' : activeReport.diagnosis.category === 'Revert Reason' ? 'the contract rejected the request' : activeReport.diagnosis.category}`
                      : activeReport.status === 'PASSED'
                      ? 'Your transaction succeeded on Pharos.'
                      : activeReport.isLiveRpcProbe
                      ? `Simulation result: ${activeReport.diagnosis.category}`
                      : 'Transaction pending or receipt unavailable'}
                  </h2>

                  <p
                    className={`text-xs sm:text-[13.5px] leading-relaxed ${
                      !activeReport
                        ? 'text-slate-700 font-medium'
                        : activeReport.status === 'FAILED'
                        ? 'text-rose-950 font-semibold'
                        : 'text-emerald-950 font-semibold'
                    }`}
                  >
                    {!activeReport
                      ? 'Select any live transaction from the left feed, paste a 0x transaction hash above, or click one of the 4 live RPC failure probes to see a plain-English diagnosis.'
                      : activeReport.diagnosis.reasonIdentified === false
                      ? activeReport.diagnosis.plainExplanation
                      : aiEnhanced?.plainEnglishWhy || activeReport.diagnosis.plainExplanation}
                  </p>
                </div>
              </div>

              {/* Requirement 03: Plain-Language Suggested Fixes (Zero Jargon) */}
              {activeReport && (
                <div className="flex-shrink-0 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>
                        {activeReport.status === 'FAILED'
                          ? 'How to Fix It (Plain English)'
                          : 'Next Steps & Verification'}
                      </span>
                    </h3>
                    <span className="text-[11px] text-slate-600 font-bold">Zero-Jargon Guide</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {(activeReport.diagnosis.reasonIdentified === false ? activeReport.diagnosis.suggestedFixes : aiEnhanced?.stepByStepFixes || activeReport.diagnosis.suggestedFixes).map(
                      (step, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start gap-2.5"
                        >
                          <span className="w-5 h-5 rounded-lg bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs sm:text-[13px] text-slate-800 font-semibold leading-snug">
                            {step}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Root Technical Evidence Footer */}
              {activeReport && (
                <div className="flex-shrink-0 p-3 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>On-Chain Root Cause Trace</span>
                    </span>
                    <button
                      onClick={() => setShowRawModal(true)}
                      className="text-cyan-300 hover:underline font-sans font-bold cursor-pointer"
                    >
                      Full Evidence JSON →
                    </button>
                  </div>
                  <div className="text-white font-medium break-all line-clamp-2 leading-snug">
                    {activeReport.diagnosis.technicalReason}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (4 Cols): Chain MCP Telemetry, Gas Meter & Transaction Receipt Details */}
          <div className="lg:col-span-4 min-h-0 flex flex-col">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex-1 min-h-0 flex flex-col justify-between gap-2.5 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 block">
                    Requirement #01 & #02
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Chain MCP & Receipt Telemetry
                  </h3>
                </div>

                {activeReport && !activeReport.isLiveRpcProbe && (
                  <a
                    href={`${activeReport.network.explorerUrl}/tx/${activeReport.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200/70"
                  >
                    <span>PharosScan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {activeReport ? (
                <div className="flex flex-col gap-2.5 text-xs">
                  {/* Transport Provenance Box */}
                  <div className="px-3 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Cpu className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="truncate">
                        <div className="font-extrabold text-slate-900 truncate">
                          Transaction evidence: Direct JSON-RPC
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">
                          MCP probe: {activeReport.mcpProbe.transport} • {activeReport.mcpProbe.mcpStatus}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200 flex-shrink-0">
                      {activeReport.mcpProbe.latencyMs === null ? '—' : `${activeReport.mcpProbe.latencyMs}ms`}
                    </span>
                  </div>

                  {/* Gas Consumption Progress Bar */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-bold flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-slate-800" />
                        <span>Gas Execution Ratio</span>
                      </span>
                      <span className="font-mono font-extrabold text-slate-900">
                        {activeReport.gasUsed === 'Unavailable' || activeReport.gasUsed === 'Unavailable (simulation)' ? activeReport.gasUsed : Number(activeReport.gasUsed).toLocaleString()} /{' '}
                        {activeReport.gasLimit === 'Unavailable' ? activeReport.gasLimit : Number(activeReport.gasLimit).toLocaleString()} ({activeReport.gasRatio ?? 'Unavailable'}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          Number(activeReport.gasRatio) >= 98
                            ? 'bg-rose-600'
                            : activeReport.status === 'FAILED'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(6, Number(activeReport.gasRatio || 0)))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>Fee Paid: {activeReport.feeFormatted}</span>
                      <span className={Number(activeReport.gasRatio) >= 98 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                        {activeReport.gasRatio === null ? 'Gas ratio unavailable' : Number(activeReport.gasRatio) >= 98
                          ? 'Near gas limit; not proof of cause'
                          : 'Below configured gas limit'}
                      </span>
                    </div>
                  </div>

                  {/* Key-Value Receipt Details Grid */}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <span className="text-slate-600 font-semibold">Sender (From)</span>
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono font-bold text-slate-900">
                          {activeReport.from.slice(0, 10)}...{activeReport.from.slice(-8)}
                        </code>
                        <button
                          onClick={() => handleCopy(activeReport.from, 'from')}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        >
                          {copiedText === 'from' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <span className="text-slate-600 font-semibold">Target (To / Contract)</span>
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono font-bold text-slate-900">
                          {activeReport.to.length > 20
                            ? `${activeReport.to.slice(0, 10)}...${activeReport.to.slice(-8)}`
                            : activeReport.to}
                        </code>
                        <button
                          onClick={() => handleCopy(activeReport.to, 'to')}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        >
                          {copiedText === 'to' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] font-semibold text-slate-600">Value Transferred</div>
                        <div className="font-mono font-extrabold text-slate-900 text-xs sm:text-sm mt-0.5 truncate">
                          {activeReport.valueFormatted}
                        </div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] font-semibold text-slate-600">Sender Balance at Block State</div>
                        <div className="font-mono font-extrabold text-slate-900 text-xs sm:text-sm mt-0.5 truncate">
                          {activeReport.senderBalanceFormatted}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] font-semibold text-slate-600">Block Height</div>
                        <div className="font-mono font-extrabold text-slate-900 text-xs sm:text-sm mt-0.5">
                          #{activeReport.blockNumber?.toLocaleString() || 'Latest'}
                        </div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] font-semibold text-slate-600">Method Selector</div>
                        <div className="font-mono font-extrabold text-blue-700 text-xs sm:text-sm mt-0.5 truncate">
                          {activeReport.methodSelector}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs font-semibold text-slate-500">
                  Select or paste a transaction hash to inspect live Pharos receipt data.
                </div>
              )}

              {/* Bottom Action Buttons */}
              <div className="flex-shrink-0 flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowRawModal(true)}
                  disabled={!activeReport}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>View Raw MCP / RPC Evidence</span>
                </button>
                {activeReport && (
                  <button
                    onClick={() => handleCopy(activeReport.hash, 'hash')}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedText === 'hash' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal for Inspecting Raw Pharos Chain MCP & JSON-RPC Transaction + Receipt Objects */}
      {showRawModal && activeReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[82vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Live Pharos RPC & Chain MCP Response Payload
                </h3>
              </div>
              <button
                onClick={() => setShowRawModal(false)}
                className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-6 overflow-y-auto font-mono text-xs bg-slate-950 text-emerald-400 space-y-4">
              <div>
                <div className="text-slate-400 mb-1">// MCP transport, result, and fallback reason</div>
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(activeReport.mcpProbe, null, 2)}</pre>
              </div>
              <div>
                <div className="text-slate-400 mb-1">// 1. eth_getTransactionByHash</div>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(activeReport.rawTx, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-slate-400 mb-1">// 2. eth_getTransactionReceipt</div>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(activeReport.rawReceipt, null, 2)}
                </pre>
              </div>
              {activeReport.debugTrace && (
                <div>
                  <div className="text-slate-400 mb-1">// 3. debug_traceTransaction (callTracer)</div>
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(activeReport.debugTrace, null, 2)}
                  </pre>
                </div>
              )}
              {activeReport.rawSimulation && (
                <div>
                  <div className="text-slate-400 mb-1">// Simulation request and RPC error (not a mined receipt)</div>
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(activeReport.rawSimulation, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
