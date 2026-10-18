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
