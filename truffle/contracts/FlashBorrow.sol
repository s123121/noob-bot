// SPDX-License-Identifier: MIT
// Tells the Solidity compiler to compile only from v0.8.13 to v0.9.0
pragma solidity ^0.8.13;

import './interfaces/IUniswapV2Router.sol';
import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Router.sol';
import './interfaces/IUniswapV2Callee.sol';
import './interfaces/IUniswapV2Pair.sol';

contract FlashBorrow {
  uint256 public constant deadline = 60;
  address public sushiswapFactoryAddress;
  address public sushiswapRouterAddress;
  address public flashBorrowPoolAddress;
  address[] public swapPath;
  IUniswapV2Router public swapRouter;
  event ValueChanged(uint256 newValue);

  constructor(address _sushiswapFactoryAddress, address _sushiswapRouterAddress) {
    sushiswapFactoryAddress = _sushiswapFactoryAddress;
    sushiswapRouterAddress = _sushiswapRouterAddress;
  }

  function execute(
    address _flashBorrowPoolAddress,
    address flashBorrowTokenAddress,
    uint256 flashBorrowTokenAmount,
    address[] calldata _swapPath,
    address swapRouterAddress
  ) external {
    emit ValueChanged(0);
    swapPath = _swapPath;
    flashBorrowPoolAddress = _flashBorrowPoolAddress;
    emit ValueChanged(1);
    swapRouter = IUniswapV2Router(swapRouterAddress);
    emit ValueChanged(2);
    uint256 approval = IERC20(flashBorrowTokenAddress).allowance(address(this), swapRouterAddress);
    emit ValueChanged(3);
    if (approval < flashBorrowTokenAmount) {
      IERC20(flashBorrowTokenAddress).approve(swapRouterAddress, type(uint256).max);
    }
    emit ValueChanged(4);
    uint256 amount0 = 0;
    uint256 amount1 = 0;
    if (flashBorrowTokenAddress == IUniswapV2Pair(_flashBorrowPoolAddress).token0()) {
      amount0 = flashBorrowTokenAmount;
    } else {
      amount1 = flashBorrowTokenAmount;
    }

    IUniswapV2Pair(_flashBorrowPoolAddress).swap(amount0, amount1, address(this), bytes('flash'));
  }

  function uniswapV2Call(address _sender, uint256 _amount0, uint256 _amount1, bytes calldata _data) external {
    address token0 = IUniswapV2Pair(msg.sender).token0();
    address token1 = IUniswapV2Pair(msg.sender).token1();
    uint256 amountBorrow = 0;
    address[] memory path = new address[](2);
    if (_amount0 > 0) {
      amountBorrow = _amount0;
      path[0] = token1;
      path[1] = token0;
    } else {
      amountBorrow = _amount1;
      path[0] = token0;
      path[1] = token1;
    }
    uint256 amountRepay = swapRouter.getAmountsIn(amountBorrow, path)[0];
    uint256 amountReceivedAfterSwap = swapRouter.swapExactTokensForTokens(
      amountBorrow,
      amountRepay,
      path,
      address(this),
      block.timestamp + deadline
    )[path.length - 1];
    if (_amount0 > 0) {
      IERC20(token1).transfer(msg.sender, amountRepay);
      IERC20(token1).transfer(tx.origin, amountReceivedAfterSwap - amountRepay);
    } else {
      IERC20(token0).transfer(msg.sender, amountRepay);
      IERC20(token0).transfer(tx.origin, amountReceivedAfterSwap - amountRepay);
    }
  }
}
