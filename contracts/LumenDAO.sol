// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract LumenDAO is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Structs
    struct Proposal {
        string description;
        string ipfsCID;
        uint256 voteCount;
        uint256 endTime;
        bool executed;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votes; // 1 for yes, 2 for no, etc.
    }

    struct VoteEvent {
        address voter;
        uint256 proposalId;
        uint256 vote; // 1 yes, 2 no
        uint256 timestamp;
        uint256 nonce;
    }

    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(address => bool) public verifiedIdentities; // Mock for Soulbound Token or WorldID
    mapping(address => bool) public revokedKeys;
    mapping(address => uint256) public nonces; // For anti-replay
    VoteEvent[] public voteEvents; // Immutable log

    uint256 public proposalCount;

    // Events
    event ProposalCreated(uint256 indexed proposalId, string description, string ipfsCID);
    event Voted(uint256 indexed proposalId, address indexed voter, uint256 vote, uint256 nonce);
    event IdentityVerified(address indexed user);
    event KeyRevoked(address indexed user);

    // Modifiers
    modifier onlyVerified() {
        require(verifiedIdentities[msg.sender], "Identity not verified");
        _;
    }

    modifier notRevoked() {
        require(!revokedKeys[msg.sender], "Key revoked");
        _;
    }

    // Initialize function for upgradeable contract
    function initialize(address initialOwner) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        transferOwnership(initialOwner);
    }

    // Verify identity (mock: set to true)
    function verifyIdentity(address user) external onlyOwner {
        verifiedIdentities[user] = true;
        emit IdentityVerified(user);
    }

    // Revoke key
    function revokeKey(address user) external onlyOwner {
        revokedKeys[user] = true;
        emit KeyRevoked(user);
    }

    // Create proposal
    function createProposal(string memory description, string memory ipfsCID, uint256 duration) external onlyOwner {
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.description = description;
        p.ipfsCID = ipfsCID;
        p.endTime = block.timestamp + duration;
        p.executed = false;
        emit ProposalCreated(proposalCount, description, ipfsCID);
    }

    // Vote on proposal
    function vote(uint256 proposalId, uint256 voteOption) external onlyVerified notRevoked nonReentrant {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp <= p.endTime, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        p.hasVoted[msg.sender] = true;
        p.votes[msg.sender] = voteOption;
        p.voteCount++;

        // Update nonce
        nonces[msg.sender]++;

        // Log event immutably
        voteEvents.push(VoteEvent({
            voter: msg.sender,
            proposalId: proposalId,
            vote: voteOption,
            timestamp: block.timestamp,
            nonce: nonces[msg.sender]
        }));

        emit Voted(proposalId, msg.sender, voteOption, nonces[msg.sender]);
    }

    // Get vote events (for activity log)
    function getVoteEvents() external view returns (VoteEvent[] memory) {
        return voteEvents;
    }

    // Get proposal details (without sensitive data, hash if needed)
    function getProposal(uint256 proposalId) external view returns (string memory, string memory, uint256, uint256, bool) {
        Proposal storage p = proposals[proposalId];
        return (p.description, p.ipfsCID, p.voteCount, p.endTime, p.executed);
    }
}
