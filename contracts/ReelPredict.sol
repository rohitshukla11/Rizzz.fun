// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ReelPredict
 * @notice Prediction market for short-form video content with Yellow Network integration (Rizzz.fun)
 * @dev Handles deposits, settlements, and payouts for reel prediction challenges
 */
contract ReelPredict is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Structs ============

    struct Challenge {
        string challengeId;
        string title;
        uint256 startTime;
        uint256 endTime;
        uint256 totalPool;
        uint256 reelCount;
        bool isSettled;
        string winnerReelId;
    }

    struct UserDeposit {
        uint256 amount;
        uint256 timestamp;
        bytes32 channelId;
        bool isActive;
    }

    struct SettlementData {
        bytes32 stateHash;
        bytes[] signatures;
        address[] participants;
        uint256[] payouts;
        string winnerReelId;
    }

    // ============ State Variables ============

    IERC20 public immutable predictionToken;
    address public yellowClearnode;
    uint256 public platformFeePercent = 250; // 2.5% in basis points
    uint256 public constant MAX_FEE = 1000; // 10% max fee
    uint256 public minDeposit = 10 * 10**18; // 10 tokens minimum
    
    mapping(string => Challenge) public challenges;
    mapping(address => UserDeposit) public userDeposits;
    mapping(string => mapping(address => uint256)) public userPredictions;
    mapping(string => mapping(string => uint256)) public reelPredictionTotals;
    mapping(bytes32 => bool) public settledChannels;
    
    string[] public activeChallengeIds;
    
    // ============ Events ============

    event ChallengeCreated(
        string indexed challengeId,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    
    event DepositMade(
        address indexed user,
        uint256 amount,
        bytes32 channelId,
        string challengeId
    );
    
    event WithdrawalMade(
        address indexed user,
        uint256 amount
    );
    
    event SettlementSubmitted(
        string indexed challengeId,
        string winnerReelId,
        uint256 totalPool
    );
    
    event PayoutDistributed(
        string indexed challengeId,
        address indexed user,
        uint256 amount
    );
    
    event ClearnodeUpdated(
        address indexed oldClearnode,
        address indexed newClearnode
    );

    // ============ Errors ============

    error ChallengeNotFound();
    error ChallengeAlreadyExists();
    error ChallengeNotEnded();
    error ChallengeAlreadySettled();
    error InsufficientDeposit();
    error InvalidSignature();
    error ChannelAlreadySettled();
    error InvalidSettlementData();
    error Unauthorized();
    error InvalidFee();

    // ============ Constructor ============

    constructor(
        address _predictionToken,
        address _yellowClearnode
    ) Ownable(msg.sender) {
        predictionToken = IERC20(_predictionToken);
        yellowClearnode = _yellowClearnode;
    }

    // ============ User Functions ============

    /**
     * @notice Deposit tokens to open a Yellow Network state channel
     * @param amount Amount of tokens to deposit
     * @param challengeId Challenge to participate in
     * @param channelId Yellow Network channel ID
     */
    function deposit(
        uint256 amount,
        string calldata challengeId,
        bytes32 channelId
    ) external nonReentrant {
        if (amount < minDeposit) revert InsufficientDeposit();
        if (bytes(challenges[challengeId].challengeId).length == 0) revert ChallengeNotFound();
        
        predictionToken.safeTransferFrom(msg.sender, address(this), amount);
        
        userDeposits[msg.sender] = UserDeposit({
            amount: amount,
            timestamp: block.timestamp,
            channelId: channelId,
            isActive: true
        });
        
        challenges[challengeId].totalPool += amount;
        
        emit DepositMade(msg.sender, amount, channelId, challengeId);
    }

    /**
     * @notice Emergency withdrawal before challenge ends (with penalty)
     * @dev Only available if user hasn't made any predictions
     */
    function emergencyWithdraw() external nonReentrant {
        UserDeposit storage userDeposit = userDeposits[msg.sender];
        if (!userDeposit.isActive) revert InsufficientDeposit();
        
        uint256 amount = userDeposit.amount;
        uint256 penalty = (amount * platformFeePercent) / 10000;
        uint256 withdrawAmount = amount - penalty;
        
        userDeposit.isActive = false;
        userDeposit.amount = 0;
        
        predictionToken.safeTransfer(msg.sender, withdrawAmount);
        
        emit WithdrawalMade(msg.sender, withdrawAmount);
    }

    // ============ Settlement Functions ============

    /**
     * @notice Submit settlement from Yellow Network
     * @dev Called by clearnode with aggregated off-chain state
     * @param challengeId Challenge to settle
     * @param settlementData Aggregated settlement data from Yellow Network
     */
    function submitSettlement(
        string calldata challengeId,
        SettlementData calldata settlementData
    ) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        if (bytes(challenge.challengeId).length == 0) revert ChallengeNotFound();
        if (block.timestamp < challenge.endTime) revert ChallengeNotEnded();
        if (challenge.isSettled) revert ChallengeAlreadySettled();
        
        // Verify settlement signatures from Yellow Network
        _verifySettlement(settlementData);
        
        challenge.isSettled = true;
        challenge.winnerReelId = settlementData.winnerReelId;
        
        // Distribute payouts
        uint256 totalPayouts = 0;
        for (uint256 i = 0; i < settlementData.participants.length; i++) {
            address participant = settlementData.participants[i];
            uint256 payout = settlementData.payouts[i];
            
            if (payout > 0) {
                totalPayouts += payout;
                predictionToken.safeTransfer(participant, payout);
                
                emit PayoutDistributed(challengeId, participant, payout);
            }
            
            // Clear user deposit
            userDeposits[participant].isActive = false;
        }
        
        // Platform fee from remaining pool
        uint256 platformFee = challenge.totalPool - totalPayouts;
        if (platformFee > 0) {
            predictionToken.safeTransfer(owner(), platformFee);
        }
        
        emit SettlementSubmitted(challengeId, settlementData.winnerReelId, challenge.totalPool);
    }

    /**
     * @notice Verify settlement data from Yellow Network
     * @dev Checks signatures from clearnode and participants
     */
    function _verifySettlement(SettlementData calldata data) internal view {
        if (data.participants.length != data.payouts.length) revert InvalidSettlementData();
        if (data.signatures.length == 0) revert InvalidSettlementData();
        
        // Construct the message that was signed
        bytes32 messageHash = keccak256(abi.encodePacked(
            data.stateHash,
            data.winnerReelId,
            data.participants,
            data.payouts
        ));
        
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        
        // Verify clearnode signature (first signature)
        address recoveredSigner = ethSignedHash.recover(data.signatures[0]);
        if (recoveredSigner != yellowClearnode) revert InvalidSignature();
    }

    // ============ Admin Functions ============

    /**
     * @notice Create a new prediction challenge
     */
    function createChallenge(
        string calldata challengeId,
        string calldata title,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner {
        if (bytes(challenges[challengeId].challengeId).length != 0) revert ChallengeAlreadyExists();
        
        challenges[challengeId] = Challenge({
            challengeId: challengeId,
            title: title,
            startTime: startTime,
            endTime: endTime,
            totalPool: 0,
            reelCount: 0,
            isSettled: false,
            winnerReelId: ""
        });
        
        activeChallengeIds.push(challengeId);
        
        emit ChallengeCreated(challengeId, title, startTime, endTime);
    }

    /**
     * @notice Update Yellow Network clearnode address
     */
    function setClearnode(address _newClearnode) external onlyOwner {
        address oldClearnode = yellowClearnode;
        yellowClearnode = _newClearnode;
        emit ClearnodeUpdated(oldClearnode, _newClearnode);
    }

    /**
     * @notice Update platform fee
     */
    function setPlatformFee(uint256 _newFeePercent) external onlyOwner {
        if (_newFeePercent > MAX_FEE) revert InvalidFee();
        platformFeePercent = _newFeePercent;
    }

    /**
     * @notice Update minimum deposit
     */
    function setMinDeposit(uint256 _newMinDeposit) external onlyOwner {
        minDeposit = _newMinDeposit;
    }

    // ============ View Functions ============

    /**
     * @notice Get challenge details
     */
    function getChallenge(string calldata challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    /**
     * @notice Get user deposit info
     */
    function getUserDeposit(address user) external view returns (UserDeposit memory) {
        return userDeposits[user];
    }

    /**
     * @notice Get all active challenge IDs
     */
    function getActiveChallenges() external view returns (string[] memory) {
        return activeChallengeIds;
    }

    /**
     * @notice Check if challenge exists and is active
     */
    function isChallengeActive(string calldata challengeId) external view returns (bool) {
        Challenge memory challenge = challenges[challengeId];
        return bytes(challenge.challengeId).length > 0 
            && block.timestamp >= challenge.startTime 
            && block.timestamp < challenge.endTime
            && !challenge.isSettled;
    }
}
