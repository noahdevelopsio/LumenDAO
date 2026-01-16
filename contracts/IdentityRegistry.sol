// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title IdentityRegistry
 * @dev Manages identity verification (Mock DID/SBT) and revocation registry.
 *      Implments UUPS upgradability.
 */
contract IdentityRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    
    // Mappings
    mapping(address => bool) private _verifiedIdentities;
    mapping(address => bool) private _revokedKeys;

    // Events
    event IdentityVerified(address indexed user, uint256 timestamp);
    event KeyRevoked(address indexed user, uint256 timestamp);
    event IdentityRestored(address indexed user, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    /**
     * @dev Authorize upgrades (UUPS)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Verifies a user's identity (Simulates SBT issuance).
     * @param user The address to verify.
     */
    function verifyIdentity(address user) external onlyOwner {
        require(user != address(0), "Invalid address");
        require(!_verifiedIdentities[user], "Already verified");
        
        _verifiedIdentities[user] = true;
        emit IdentityVerified(user, block.timestamp);
    }

    /**
     * @dev Revokes a user's verification status (e.g., lost key, malicious actor).
     * @param user The address to revoke.
     */
    function revokeKey(address user) external onlyOwner {
        require(_verifiedIdentities[user], "Not verified");
        require(!_revokedKeys[user], "Already revoked");

        _revokedKeys[user] = true;
        emit KeyRevoked(user, block.timestamp);
    }

    /**
     * @dev Restores a revoked key (if accidental).
     * @param user The address to restore.
     */
    function restoreKey(address user) external onlyOwner {
        require(_revokedKeys[user], "Not revoked");

        _revokedKeys[user] = false;
        emit IdentityRestored(user, block.timestamp);
    }

    /**
     * @dev Checks if a user is valid (Verified AND Not Revoked).
     */
    function isVerified(address user) external view returns (bool) {
        return _verifiedIdentities[user] && !_revokedKeys[user];
    }

    /**
     * @dev View strictly for verification status (ignoring revocation).
     */
    function hasSBT(address user) external view returns (bool) {
        return _verifiedIdentities[user];
    }

    /**
     * @dev View strictly for revocation status.
     */
    function isRevoked(address user) external view returns (bool) {
        return _revokedKeys[user];
    }
}
