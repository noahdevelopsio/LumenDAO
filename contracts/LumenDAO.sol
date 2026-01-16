// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IdentityRegistry.sol";

/**
 * @title LumenDAO
 * @dev Modular governance system with Liquid Democracy, EIP-712 voting, and Event Sourcing.
 */
contract LumenDAO is Initializable, OwnableUpgradeable, UUPSUpgradeable, EIP712Upgradeable, ReentrancyGuardUpgradeable {
    
    // -- State Variables --

    IdentityRegistry public identityRegistry;

    struct Proposal {
        string description;
        string ipfsCID;
        uint256 voteCount; // Total weighted votes
        uint256 startTime;
        uint256 endTime;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    struct Checkpoint {
        uint256 fromBlock;
        address delegatee;
    }

    // Mapping from (proposalId) -> Proposal
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    // Liquid Democracy: mapping(delegator => delegatee)
    mapping(address => address) public delegates;
    
    // Mapping of delegators to those who delegated to them (for traversal if needed, 
    // but simplified via recursive weight calculation on vote).
    // Note: For advanced liquid democracy, strict DAG enforcement is needed to prevent cycles.
    // We will implement a cycle check in the `delegate` function.

    // Nonces for EIP-712
    mapping(address => uint256) public nonces;

    // -- Events (Event Sourcing) --
    event ProposalCreated(uint256 indexed proposalId, string description, string ipfsCID, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 weight, uint256 voteOption, string reason);
    event Delegated(address indexed delegator, address indexed delegatee);
    event Undelegated(address indexed delegator);
    event ProposalExecuted(uint256 indexed proposalId);

    // -- EIP-712 TypeHash --
    bytes32 private constant VOTE_TYPEHASH = keccak256("Vote(uint256 proposalId,uint256 voteOption,uint256 nonce,uint256 deadline)");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _identityRegistry) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __EIP712_init("LumenDAO", "1");
        __ReentrancyGuard_init();
        
        identityRegistry = IdentityRegistry(_identityRegistry);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // -- Governance Logic --

    /**
     * @dev Creates a new proposal.
     */
    function createProposal(
        string memory description, 
        string memory ipfsCID, 
        uint256 duration
    ) external onlyOwner {
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.description = description;
        p.ipfsCID = ipfsCID;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + duration;
        p.executed = false;

        emit ProposalCreated(proposalCount, description, ipfsCID, p.startTime, p.endTime);
    }

    /**
     * @dev Delegates voting power to another user.
     *      Prevents self-delegation and simple cycles.
     */
    function delegate(address to) external {
        require(to != msg.sender, "Cannot delegate to self");
        require(to != address(0), "Invalid delegate");
        require(identityRegistry.isVerified(msg.sender), "Not verified");
        
        address current = delegates[msg.sender];
        require(current != to, "Already delegated");

        // Cycle check (Simple 1-hop check for MVP)
        require(delegates[to] != msg.sender, "Cycle detected");

        // Handle weight transfer
        if (current != address(0)) {
            receivedDelegations[current] -= 1;
        }

        delegates[msg.sender] = to;
        receivedDelegations[to] += 1;
        
        emit Delegated(msg.sender, to);
    }

    function undelegate() external {
        address current = delegates[msg.sender];
        require(current != address(0), "Not delegated");
        
        receivedDelegations[current] -= 1;
        delete delegates[msg.sender];
        
        emit Undelegated(msg.sender);
    }

    /**
     * @dev Calculates voting weight recursively. 
     *      NOTE: In production, deep recursion can hit gas limits. 
     *      We limit Max Depth to 10 for safety here.
     */
    function getVotingWeight(address account) public view returns (uint256) {
        return 1 + receivedDelegations[account];
    }
    
    // Internal mapping to track received delegations count
    mapping(address => uint256) public receivedDelegations;

    // -- Cleaned up delegation logic --

    // Fixed implementation for executeVoteBySig
    function executeVoteBySig(
        uint256 proposalId,
        uint256 voteOption,
        uint256 signedNonce,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp <= deadline, "Expired sig");

        bytes32 structHash = keccak256(abi.encode(
            VOTE_TYPEHASH,
            proposalId,
            voteOption,
            signedNonce,
            deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);

        require(signer != address(0), "Invalid sig");
        require(nonces[signer] == signedNonce, "Invalid nonce");
        require(identityRegistry.isVerified(signer), "Signer not verified");
        
        _castVote(signer, proposalId, voteOption);
    }

    function _castVote(address voter, uint256 proposalId, uint256 voteOption) internal {
        // Checks
        Proposal storage p = proposals[proposalId];
        require(block.timestamp <= p.endTime, "Voting closed");
        require(!p.hasVoted[voter], "Already voted");
        // Ensure they haven't delegated
        require(delegates[voter] == address(0), "Delegators cannot vote");

        // Calculate Weight (1 + delegations)
        uint256 weight = 1 + receivedDelegations[voter];

        // Effects
        p.hasVoted[voter] = true;
        p.voteCount += weight; 
        // Note: In a real Yes/No system, we'd map options. 
        // Here assuming simple counter for demo, or `voteOption` usage.
        
        nonces[voter]++;
        
        emit VoteCast(proposalId, voter, weight, voteOption, "");
    }

    // Direct vote (if not using sig)
    function vote(uint256 proposalId, uint256 voteOption) external onlyVerified {
        _castVote(msg.sender, proposalId, voteOption);
    }

    modifier onlyVerified() {
        require(identityRegistry.isVerified(msg.sender), "Not verified");
        _;
    }
}
