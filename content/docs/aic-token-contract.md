---
title: AIC Token Contract
description: Complete technical reference for WebAI3Token.sol — inheritance, constructor, all public functions, events, roles, errors, and security properties.
section: Developer Reference
order: 2
---

`WebAI3Token` is the AIC governance token. It's a thin wrapper around OpenZeppelin v5 extensions — no custom logic beyond the constructor.

**Source:** `webai3_token/src/WebAI3Token.sol`

---

## Constants

```solidity
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 10^27 base units
```

---

## Inheritance Chain

```
WebAI3Token
├── ERC20("WebAI3 Token", "AIC")
│   └── transfer, transferFrom, approve, balanceOf, allowance, totalSupply
├── ERC20Pausable
│   └── pause, unpause — blocks _update() when paused
├── ERC20Permit
│   └── EIP-2612 — permit() for gasless approvals
├── ERC20Votes
│   └── EIP-5805 — delegate(), getVotes(), getPastVotes()
└── AccessControl
    └── grantRole, revokeRole, hasRole, renounceRole
```

Override resolution: `_update()` resolves the diamond ambiguity between `ERC20Pausable` and `ERC20Votes`. `nonces()` resolves the ambiguity between `ERC20Permit` and `Nonces`.

---

## Struct

```solidity
struct Allocation {
    address recipient;  // must not be zero address
    uint256 amount;     // in base units (1e18 = 1 AIC)
}
```

---

## Constructor

```solidity
constructor(address admin, Allocation[] memory allocations)
```

Validates, then mints the entire supply in one pass:

1. `admin != address(0)` → revert `InvalidAdmin(admin)`
2. `allocations.length > 0` → revert `EmptyAllocations()`
3. For each allocation: `recipient != address(0)` → revert `InvalidAllocationRecipient(i)`
4. `_mint(recipient, amount)` for each allocation
5. `sum(allocations) == MAX_SUPPLY` → revert `InvalidAllocationTotal(MAX_SUPPLY, actual)`
6. Grant `DEFAULT_ADMIN_ROLE` and `PAUSER_ROLE` to `admin`

No mint function exists after the constructor. The supply check is post-mint: if the sum is wrong, the transaction reverts and all mints are undone.

---

## Roles

| Role | Holder (at deployment) | Capability |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `admin` (multisig) | Grant and revoke any role |
| `PAUSER_ROLE` | `admin` (multisig) | Call `pause()` and `unpause()` |

---

## Public Functions

### Standard ERC-20

```solidity
function transfer(address to, uint256 value) external returns (bool)
function transferFrom(address from, address to, uint256 value) external returns (bool)
function approve(address spender, uint256 value) external returns (bool)
function balanceOf(address account) external view returns (uint256)
function allowance(address owner, address spender) external view returns (uint256)
function totalSupply() external view returns (uint256)   // always 1_000_000_000 ether
function decimals() external pure returns (uint8)        // always 18
function name() external pure returns (string)           // "WebAI3 Token"
function symbol() external pure returns (string)         // "AIC"
```

### Pausable

```solidity
function pause() external onlyRole(PAUSER_ROLE)
function unpause() external onlyRole(PAUSER_ROLE)
function paused() external view returns (bool)
```

When paused, all `transfer`, `transferFrom`, and `_mint` calls revert with `EnforcedPause()`. Approvals and delegation still work.

### Governance (ERC20Votes)

```solidity
function delegate(address delegatee) external
function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external
function getVotes(address account) external view returns (uint256)
function getPastVotes(address account, uint256 blockNumber) external view returns (uint256)
function getPastTotalSupply(uint256 blockNumber) external view returns (uint256)
function delegates(address account) external view returns (address)
```

**Important:** Voting power is not automatic. Calling `delegate(address(0))` or never calling `delegate()` results in zero voting power, even with a large balance. Self-delegation requires `delegate(msg.sender)`.

Every transfer updates the delegatee's checkpoint: if Alice delegates to Bob and transfers 1,000 AIC to Carol, Bob's voting power drops by 1,000 immediately.

### Permit (EIP-2612)

```solidity
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v, bytes32 r, bytes32 s
) external
function nonces(address owner) external view returns (uint256)
function DOMAIN_SEPARATOR() external view returns (bytes32)
```

`permit()` sets an allowance via an off-chain signature. Used by the presale contract to approve USDC spending without requiring a separate approval transaction from the buyer.

### Access Control

```solidity
function hasRole(bytes32 role, address account) external view returns (bool)
function grantRole(bytes32 role, address account) external  // DEFAULT_ADMIN_ROLE only
function revokeRole(bytes32 role, address account) external // DEFAULT_ADMIN_ROLE only
function renounceRole(bytes32 role, address callerConfirmation) external
```

---

## Events

```solidity
// ERC-20 standard
event Transfer(address indexed from, address indexed to, uint256 value)
event Approval(address indexed owner, address indexed spender, uint256 value)

// ERC20Pausable
event Paused(address account)
event Unpaused(address account)

// ERC20Votes
event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)
event DelegateVotesChanged(address indexed delegate, uint256 previousVotes, uint256 newVotes)

// AccessControl
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
```

---

## Custom Errors

```solidity
error InvalidAdmin(address admin)             // admin is zero address
error EmptyAllocations()                      // no allocations array
error InvalidAllocationRecipient(uint256 i)   // recipient at index i is zero
error InvalidAllocationTotal(uint256 expected, uint256 actual)  // sum mismatch
```

---

## Security Properties

### Supply immutability

No `mint()` function. `MAX_SUPPLY` is a constant. The constructor validates `sum(allocations) == MAX_SUPPLY`. Any mismatch reverts the entire transaction. After deployment, `totalSupply()` is permanently fixed.

### Flash loan attack resistance

Governance contracts should use `getPastVotes(account, proposalCreatedBlock)` rather than `getVotes(account)`. Voting power is checkpointed per block — borrowing tokens in block N doesn't affect checkpoints at block N-1. The design is safe as long as governance uses past snapshots.

### Permit replay protection

Each `permit()` call increments `nonces(owner)`. The signature binds to: owner address, spender address, value, nonce, deadline, and chain ID (via `DOMAIN_SEPARATOR`). A replayed or stale signature reverts.

### Reentrancy

ERC-20 has no transfer hooks (unlike ERC-777). `_update()` is internal. No external calls exist in the contract. Reentrancy is structurally impossible.

---

## Gas Reference

| Operation | Gas (approx) |
|---|---|
| `transfer` (cold slots) | ~51,000 |
| `transfer` (warm slots) | ~29,000 |
| `delegate` | ~30,000–50,000 |
| `permit` | ~2,500 |
| Constructor (1B tokens, 6 allocations) | ~200,000 |

---

## Invariants (Verified by Tests)

1. `totalSupply()` is always exactly `1_000_000_000 ether` after deployment
2. Sum of all `balanceOf(address)` values always equals `totalSupply()`
3. Voting power of delegatee always tracks delegator's balance exactly
4. `nonces(owner)` is monotonically increasing
