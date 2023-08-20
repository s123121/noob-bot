// SPDX-License-Identifier: MIT
// Tells the Solidity compiler to compile only from v0.8.13 to v0.9.0
pragma solidity ^0.8.13;

import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Callee.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IJoeCallee.sol';

contract FlashBorrow {
  address public flashBorrowPoolAddress;
  address private _owner;
  uint256[2] public flashBorrowTokenAmounts;
  uint256 public flashRepayTokenAmount;
  address[] public swapPoolAddresses;
  uint256[2][] public swapPoolAmounts;

  modifier isOwner() {
    require(msg.sender == _owner, 'Caller is not owner');
    _; // continue executing rest of method body
  }

  constructor() {
    _owner = msg.sender;
  }

  function execute(
    address _flashBorrowPoolAddress,
    uint256[2] calldata _flashBorrowTokenAmount,
    uint256 _flashRepayTokenAmount,
    address[] calldata _swapPoolAddresses,
    uint256[2][] calldata _swapPoolAmounts
  ) external isOwner {
    flashBorrowPoolAddress = _flashBorrowPoolAddress;
    flashBorrowTokenAmounts = _flashBorrowTokenAmount;
    flashRepayTokenAmount = _flashRepayTokenAmount;
    swapPoolAddresses = _swapPoolAddresses;
    swapPoolAmounts = _swapPoolAmounts;

    IUniswapV2Pair(_flashBorrowPoolAddress).swap(
      flashBorrowTokenAmounts[0],
      flashBorrowTokenAmounts[1],
      address(this),
      bytes('flash')
    );

    //  try this one weird trick to save gas
    flashBorrowPoolAddress = address(0);
    // flashBorrowTokenAmounts = [];
    flashRepayTokenAmount = 0;
    // swapPoolAddresses = [];
    // swapPoolAmounts = [];
  }

  function joeCall(address _sender, uint256 _amount0, uint256 _amount1, bytes calldata _data) external {
    require(msg.sender == flashBorrowPoolAddress, 'Not LP');
    address token0Address = IUniswapV2Pair(msg.sender).token0();
    address token1Address = IUniswapV2Pair(msg.sender).token1();

    //  transfer the borrowed token to the first LP
    if (_amount0 == 0) {
      IERC20(token1Address).transfer(swapPoolAddresses[0], _amount1);
    }

    if (_amount1 == 0) {
      IERC20(token0Address).transfer(swapPoolAddresses[0], _amount0);
    }

    uint256 numberOfPools = swapPoolAddresses.length;

    // loop through the LP addresses, calling swap() directly using the submitted amounts. Transfers the output from
    // each swap to the next LP in the array. When we reach the last LP in the array, transfer the token back to
    // the contract and break the loop
    for (uint256 i = 0; i < 16; i++) {
      if (i < numberOfPools - 1) {
        IUniswapV2Pair(swapPoolAddresses[i]).swap(
          swapPoolAmounts[i][0],
          swapPoolAmounts[i][1],
          swapPoolAddresses[i + 1],
          bytes('')
        );
      } else if (i == numberOfPools - 1) {
        IUniswapV2Pair(swapPoolAddresses[i]).swap(
          swapPoolAmounts[i][0],
          swapPoolAmounts[i][1],
          address(this),
          bytes('')
        );
      } else {
        break;
      }
    }

    // repay the flash loan
    if (_amount0 == 0) {
      IERC20(token0Address).transfer(msg.sender, flashRepayTokenAmount);
    }

    if (_amount1 == 0) {
      IERC20(token1Address).transfer(msg.sender, flashRepayTokenAmount);
    }
  }

  function withdraw(address tokenAddress) external isOwner {
    IERC20(tokenAddress).transfer(msg.sender, IERC20(tokenAddress).balanceOf(address(this)) - 1);
  }
}
