// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RevocationRegistry {
    address public issuer;
    mapping(bytes32 => bool) public revoked;

    event CredentialRevoked(bytes32 indexed credentialHash);

    constructor(address _issuer) {
        issuer = _issuer;
    }

    function revoke(bytes32 credentialHash) public {
        require(msg.sender == issuer, "Only the issuer can revoke credentials");
        revoked[credentialHash] = true;
        emit CredentialRevoked(credentialHash);
    }

    function isRevoked(bytes32 credentialHash) public view returns (bool) {
        return revoked[credentialHash];
    }
}