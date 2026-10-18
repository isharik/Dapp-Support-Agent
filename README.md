# Built for Pharos Season of AI

# DApp Support Agent

An AI-powered blockchain support agent built for **Pharos Season of AI** that explains why a blockchain transaction failed and helps users understand what went wrong.

## Overview

Blockchain errors are often difficult to understand. A failed transaction may involve insufficient funds, incorrect transaction parameters, gas limitations, contract reverts, or other execution issues.

**DApp Support Agent** helps bridge the gap between technical blockchain errors and understandable explanations. By analyzing available transaction details and on-chain data through Pharos tools, the agent identifies potential failure causes and presents them in plain language.

Instead of leaving users with an unfamiliar error message, the agent helps them understand the issue and what they can check next.

## Key Features

- **Transaction Analysis:** Examines a transaction hash or supported transaction details.
- **Failure Diagnosis:** Identifies potential reasons for failed execution using available transaction receipts, error messages, and execution data.
- **Plain-Language Explanations:** Translates technical errors into explanations that non-developers can understand.
- **Actionable Troubleshooting:** Suggests relevant checks based on the identified failure.
- **Pharos Integration:** Uses available Pharos blockchain tools and transaction data.
- **Evidence-Based Results:** Connects explanations to available transaction details instead of relying solely on assumptions.

## How It Works

1. **Input:** Provide a transaction hash or supported transaction information.
2. **Retrieve:** Fetch the available transaction details, receipt, and execution information.
3. **Analyze:** Examine the status, gas usage, revert information, and other relevant evidence.
4. **Diagnose:** Identify the most likely cause of failure when sufficient evidence is available.
5. **Explain:** Present the issue in plain language.
6. **Troubleshoot:** Recommend appropriate checks or next steps.

## Common Failure Categories

- **Insufficient Funds:** The wallet may not have enough funds to cover the transfer or transaction fees.
- **Gas Limit or Execution Failure:** The transaction may run out of gas or fail during execution.
- **Contract Revert:** A smart contract may reject an operation because a condition or requirement was not satisfied.
- **Invalid Parameters:** The transaction may contain incorrect arguments, amounts, or other required values.
- **Authorization Issues:** The caller may lack the required permissions or token allowance.
- **Network or Transaction Status Issues:** The transaction may be pending, replaced, dropped, or unavailable in the queried data source.

The agent should report only causes supported by the available evidence and clearly label uncertain diagnoses.

## Example Output

```text
DAPP SUPPORT AGENT
─────────────────────────────────
Network: Pharos
Transaction: 0x...
Status: Failed

FAILURE ANALYSIS
Possible Cause: Contract execution reverted

WHAT THIS MEANS
The smart contract rejected the operation.
This can happen when a required condition is
not satisfied, such as an authorization check,
an invalid parameter, or insufficient allowance.

RECOMMENDED CHECKS
- Review the contract's expected parameters.
- Verify wallet permissions and token allowance.
- Inspect the transaction's revert information.

Source: Available transaction and execution data
```

This example illustrates the response format; the actual diagnosis depends on the transaction evidence.

## Use Cases

- **DApp User Support:** Help users understand failed transactions without requiring blockchain expertise.
- **Developer Debugging:** Investigate contract reverts and transaction execution errors.
- **Troubleshooting:** Identify useful next steps based on transaction evidence.
- **Support Automation:** Reduce repetitive explanations of common blockchain errors.
- **Blockchain Education:** Help users learn how transaction execution and smart contract failures work.

## Design Principles

**Clarity first:** Explain the error in language users can understand.

**Evidence over guesses:** Separate confirmed facts from possible causes.

**Actionable guidance:** Recommend practical checks relevant to the diagnosed issue.

**Read-only investigation:** Analyze transaction data without requiring users to share private keys or seed phrases.

## Limitations

A transaction hash or receipt may not contain enough information to determine the exact cause of failure. Some diagnoses require a transaction trace, contract source code, ABI, or additional execution data.

The agent should distinguish between a confirmed failure reason and a probable explanation. It should never claim certainty when the available evidence is incomplete.

## Built for Pharos Season of AI

Developed as part of the **Pharos AI Agent Arena**, demonstrating how AI agents can make blockchain troubleshooting more accessible by turning technical transaction data into practical explanations.

Explore Pharos AI: https://ai.pharos.xyz/

---

**Every failed transaction tells a story. This agent helps you understand it.**

## Implementation and Local Development

The React + Vite interface retrieves transaction evidence through configured JSON-RPC endpoints. Receipt status determines mined success/failure; eth_call and trace responses remain diagnostic evidence. Missing values remain unavailable.

## Run locally

1. Install dependencies with `npm install`.
2. For Gemini explanations, set `GEMINI_API_KEY` in the shell that runs the proxy. The key stays on the server and is never sent to the browser. Optional: set `GEMINI_MODEL` or `AI_PROXY_PORT`.
3. Start the proxy in one terminal: `npm run dev:ai-proxy`.
4. Start Vite in another terminal: `npm run dev`.
5. Open the local URL printed by Vite. If the proxy or provider is unavailable, on-chain inspection and its rule-based explanation continue to work.

Without a configured API key, the AI proxy responds with a configuration error and no credential is exposed to the client. Production deployments must provide an authenticated, rate-limited server endpoint compatible with `POST /api/explain`; the Vite proxy is development-only.

## Verify

- `npm test` runs deterministic unit tests against utility functions. These use local data and do not claim live RPC evidence.
- `npm run lint` runs Oxlint.
- `npm run build` creates the production frontend bundle.

## Manual test checklist

- Select Atlantic Testnet, Pacific Mainnet, and Legacy Testnet; check chain ID, latest block, gas price, and recent transaction feed against the corresponding RPC/explorer.
- Inspect a known successful and a known failed transaction on each network. Confirm that only receipt status `0x1`/`0x0` is classified as mined pass/fail.
- Inspect a pending hash and an unknown hash. Confirm pending/missing receipt is not called failed and RPC/network errors are visible.
- Check raw transaction/receipt/trace payloads and confirm replay results are identified as simulations.
- Run each diagnostic probe. Confirm it reports a simulation, uses the returned RPC error, has no fabricated receipt/gas/fee/balance, and reports when the call does not fail.
- Exercise invalid hash, malformed RPC response, RPC timeout, and unavailable MCP endpoint. Confirm the selected transport and fallback reason are truthful.
- Configure the AI proxy and test valid response, missing key, provider rate limit, malformed response, and timeout. Confirm rule-based analysis remains available.
- Test narrow viewport, modal close controls, copy buttons, loading states, and refresh during an in-progress scan.

## Configuration and evidence notes

Network RPC, MCP, and explorer endpoints are currently configured in `src/App.jsx`. This client app cannot independently certify provider availability or the provenance of configured token contract addresses. Diagnostic probes use the existing configured Atlantic addresses and should be treated as illustrative calls until independently checked against official Pharos deployment documentation. A successful simulation is never represented as a mined transaction.
