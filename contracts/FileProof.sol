// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FileProof
 * @notice commit 기반 파일 존재 증명을 위한 타임스탬핑 컨트랙트
 * @dev commit = SHA256(fileHash + randomSalt)
 */
contract FileProof {

    uint256 public totalCommits;
    address public owner;

    /**
     * @notice commit 레코드 구조
     * @param commit SHA256(fileHash + randomSalt)
     * @param timestamp 서버가 제공한 원본 업로드 시각
     * @param userSignature 사용자 서명 (fileHash + timestamp)
     * @param serverSignature 서버 서명 (commit + timestamp + userSignature)
     * @param blockNumber 블록 번호
     * @param registeredAt 블록 타임스탬프
     */
    struct CommitRecord {
        bytes32 commit;
        uint256 timestamp;
        bytes userSignature;
        bytes serverSignature;
        uint256 blockNumber;
        uint256 registeredAt;
        bool exists;
    }

    mapping(bytes32 => CommitRecord) private commitRecords;
    mapping(uint256 => bytes32) public commitsByIndex;

    event CommitRegistered(
        bytes32 indexed commit,
        uint256 timestamp,
        uint256 blockNumber,
        uint256 registeredAt,
        address indexed registrar
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice commit을 블록체인에 등록
     * @dev 서버(owner)만 호출 가능
     */
    function registerCommit(
        bytes32 _commit,
        uint256 _timestamp,
        bytes calldata _userSignature,
        bytes calldata _serverSignature
    ) external onlyOwner returns (bool) {
        require(_commit != bytes32(0), "Empty commit");
        require(_timestamp > 0, "Invalid timestamp");
        require(_userSignature.length > 0, "Missing user signature");
        require(_serverSignature.length > 0, "Missing server signature");
        require(!commitRecords[_commit].exists, "Already registered");

        commitRecords[_commit] = CommitRecord({
            commit: _commit,
            timestamp: _timestamp,
            userSignature: _userSignature,
            serverSignature: _serverSignature,
            blockNumber: block.number,
            registeredAt: block.timestamp,
            exists: true
        });

        totalCommits++;
        commitsByIndex[totalCommits] = _commit;

        emit CommitRegistered(
            _commit,
            _timestamp,
            block.number,
            block.timestamp,
            msg.sender
        );
        return true;
    }

    /**
     * @notice commit 레코드 조회
     */
    function getCommit(bytes32 _commit)
        external
        view
        returns (CommitRecord memory)
    {
        require(commitRecords[_commit].exists, "Not found");
        return commitRecords[_commit];
    }

    /**
     * @notice commit 존재 여부 및 일부 정보 확인
     */
    function verifyCommit(bytes32 _commit)
        external
        view
        returns (bool, uint256, uint256)
    {
        CommitRecord memory r = commitRecords[_commit];
        return (r.exists, r.timestamp, r.blockNumber);
    }

    /**
     * @notice 인덱스 기반 commit 조회
     */
    function getCommitByIndex(uint256 _index)
        external
        view
        returns (bytes32)
    {
        require(_index > 0 && _index <= totalCommits, "Invalid index");
        return commitsByIndex[_index];
    }

    function getCommitsByRange(uint256 _start, uint256 _end)
        external
        view
        returns (bytes32[] memory)
    {
        require(_start > 0 && _start <= totalCommits, "Invalid start");
        require(_end >= _start && _end <= totalCommits, "Invalid end");

        uint256 len = _end - _start + 1;
        bytes32[] memory out = new bytes32[](len);

        for (uint256 i = 0; i < len; i++) {
            out[i] = commitsByIndex[_start + i];
        }
        return out;
    }
}
