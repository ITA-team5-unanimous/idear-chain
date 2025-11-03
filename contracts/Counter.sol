// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Counter
 * @dev 스마트 컨트랙트 환경 테스트를 위한 간단한 Counter 컨트랙트
 */
contract Counter {
    uint256 private count;
    address public owner;

    event CountChanged(uint256 newCount, address changedBy);
    event CountReset(address resetBy);

    constructor() {
        owner = msg.sender;
        count = 0;
    }

    /**
     * @dev Count 1 증가
     */
    function increment() public {
        count += 1;
        emit CountChanged(count, msg.sender);
    }

    /**
     * @dev Count 1 감소
     * @notice unsigned int, 0 미만일 시 Revert
     */
    function decrement() public {
        count -= 1;
        emit CountChanged(count, msg.sender);
    }

    /**
     * @dev Count 0으로 초기화
     */
    function reset() public {
        count = 0;
        emit CountReset(msg.sender);
    }

    /**
     * @dev 현재 Count 값 반환
     * @return Current count
     */
    function getCount() public view returns (uint256) {
        return count;
    }
}
