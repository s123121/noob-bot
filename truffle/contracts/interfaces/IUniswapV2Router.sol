// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

interface IUniswapV2Router {
  function swapExactTokensForTokens(
    uint256 amountIn, 
    uint256 amountOutMin, 
    address[] calldata path,
    address to,
    uint256 deadline
  ) external returns (uint256[] memory amounts);

  function getAmountsIn(uint256 amountOut,  address[] calldata path) external view returns (uint256[] memory amounts);
}
