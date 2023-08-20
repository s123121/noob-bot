import ERC20Token, { getERC20Token } from '../model/ERC20'
import LiquidityPool, { getLiquidityPool } from '../uniswap/v2/LiquidityPool'

class FlashBorrowToLpSwap {
  constructor({
    borrowPool,
    borrowToken,
    provider,
    swapFactoryAddress,
    swapTokenAddresses,
    swapRouterFee,
    name,
    updateMethod = 'polling',
  }) {
    if (borrowToken.address != swapTokenAddresses[0]) {
      throw new Error('Token addresses must begin with the borrowed token')
    }

    if (borrowPool.token0.address == borrowToken) {
      if (borrowPool.token1.address != swapTokenAddresses[swapTokenAddresses.length - 1]) {
        throw new Error('Token addresses must end with the repaid token')
      }
    } else {
      if (borrowPool.token0.address != swapTokenAddresses[swapTokenAddresses.length - 1]) {
        throw new Error('Token addresses must end with the repaid token')
      }
    }

    this.name = name
    this.borrowPool = borrowPool
    this.borrowToken = borrowToken
    if (this.borrowToken == this.borrowPool.token0.address) {
      this.repayToken = this.borrowPool.token1.address
    } else if (this.borrowToken == this.borrowPool.token1.address) {
      this.repayToken = this.borrowPool.token0.address
    }
  }

  async init({ provider, abi, address, swapRouterFee, swapTokenAddresses, updateMethod = 'polling' }) {
    this.tokens = await Promise.all(swapTokenAddresses.map(async (add) => await getERC20Token(add)))
    this.tokenPath = this.tokens.map((token) => token.address)
    // build the list of intermediate pool pairs for the given multi-token path.
    // Pool list length will be 1 less than the token path length, e.g. a token1->token2->token3
    // path will result in a pool list consisting of token1/token2 and token2/token3
    this.swapPools = []
    try {
      this._factory = new provider.eth.Contract(abi, address)
    } catch (err) {
      throw new Error('Exception in contract_load')
    }
    for (let i = 0; i < this.tokenPath.length - 1; i++) {
      let pool = await getLiquidityPool({
        address: this._factory.getPair(this.tokenPath[i], this.tokenPath[i + 1]),
        name: this.tokens[i].symbol + '-' + this.tokens[i + 1].symbol,
        tokens: [this.tokens[i], this.tokens[i + 1]],
        updateMethod: updateMethod,
        fee: swapRouterFee,
      })
      this.swapPools.push(pool)
      console.log(`Loaded LP: ${this.tokens[i].symbol} - ${this.tokens[i + 1].symbol}`)
    }
    this.swapPoolAddresses = this.swapPools.map((pool) => pool.address)
    this.best = {
      init: true,
      strategy: 'flash borrow swap',
      borrowAmount: 0,
      borrowToken: this.borrowToken,
      borrowPoolAmounts: [],
      repayAmount: 0,
      profitAmount: 0,
      profitToken: this.repayToken,
      swapPools: this.swapPools,
      swapPoolAmounts: [],
    }
  }

  updateReserves({ silent = false, printReserves = true, printRatios = true }) {
    //     Checks each liquidity pool for updates by passing a call to .update_reserves(), which returns False if there are no updates.
    //     Will calculate arbitrage amounts only after checking all pools and finding an update, or on startup (via the 'init' dictionary key)
    let recalculate = false

    // calculate initial arbitrage after the object is instantiated, otherwise proceed with normal checks
    if (this.best.init == true) {
      this.best.init = false
      recalculate = true
    }

    // flag for recalculation if the borrowing pool has been updated
    if (this.borrowPool.updateReserves({ silent, printReserves, printRatios })) {
      recalculate = true
    }

    // flag for recalculation if any of the pools along the swap path have been updated
    for (const pool of this.swapPools) {
      if (pool.updateReserves({ silent, printReserves, printRatios })) {
        recalculate = true
      }
    }

    if (recalculate) {
      this._calculateArbitrage()
      return true
    }
    return false
  }

  // def _calculate_arbitrage(self):
  //   # set up the boundaries for the Brent optimizer based on which token is being borrowed
  //   if self.borrow_token.address == self.borrow_pool.token0.address:
  //       bounds = (
  //           1,
  //           float(self.borrow_pool.reserves_token0),
  //       )
  //       bracket = (
  //           0.01 * self.borrow_pool.reserves_token0,
  //           0.05 * self.borrow_pool.reserves_token0,
  //       )
  //   else:
  //       bounds = (
  //           1,
  //           float(self.borrow_pool.reserves_token1),
  //       )
  //       bracket = (
  //           0.01 * self.borrow_pool.reserves_token1,
  //           0.05 * self.borrow_pool.reserves_token1,
  //       )

  //   opt = optimize.minimize_scalar(
  //       lambda x: -float(
  //           self.calculate_multipool_tokens_out_from_tokens_in(
  //               token_in=self.borrow_token,
  //               token_in_quantity=x,
  //           )
  //           - self.borrow_pool.calculate_tokens_in_from_tokens_out(
  //               token_in=self.repay_token,
  //               token_out_quantity=x,
  //           )
  //       ),
  //       method="bounded",
  //       bounds=bounds,
  //       bracket=bracket,
  //   )

  //   best_borrow = int(opt.x)

  //   if self.borrow_token.address == self.borrow_pool.token0.address:
  //       borrow_amounts = [best_borrow, 0]
  //   elif self.borrow_token.address == self.borrow_pool.token1.address:
  //       borrow_amounts = [0, best_borrow]
  //   else:
  //       print("wtf?")
  //       raise Exception

  //   best_repay = self.borrow_pool.calculate_tokens_in_from_tokens_out(
  //       token_in=self.repay_token,
  //       token_out_quantity=best_borrow,
  //   )
  //   best_profit = -int(opt.fun)

  //   # only save opportunities with rational, positive values
  //   if best_borrow > 0 and best_profit > 0:
  //       self.best.update(
  //           {
  //               "borrow_amount": best_borrow,
  //               "borrow_pool_amounts": borrow_amounts,
  //               "repay_amount": best_repay,
  //               "profit_amount": best_profit,
  //               "swap_pool_amounts": self._build_multipool_amounts_out(
  //                   token_in=self.borrow_token,
  //                   token_in_quantity=best_borrow,
  //               ),
  //           }
  //       )
  //   else:
  //       self.best.update(
  //           {
  //               "borrow_amount": 0,
  //               "borrow_pool_amounts": [],
  //               "repay_amount": 0,
  //               "profit_amount": 0,
  //               "swap_pool_amounts": [],
  //           }
  //       )

  _calculateArbitrage() {
    //  set up the boundaries for the Brent optimizer based on which token is being borrowed
    let bounds
    let bracket
    if (this.borrowToken == this.borrowPool.token0.address) {
      bounds = [1, this.borrowPool.reservesToken0]
      bracket = [0.01 * this.borrowPool.reservesToken0, 0.05 * this.borrowPool.reservesToken0]
    } else {
      bounds = [1, this.borrowPool.reservesToken1]
      bracket = [0.01 * this.borrowPool.reservesToken1, 0.05 * this.borrowPool.reservesToken1]
    }
  }

  calculateMultipoolTokensOutFromTokensIn({ tokenIn, tokenInQuantity }) {
    const numberOfPools = this.swapPools.length
    let tokenOutQuantity
    for (let i = 0; i < numberOfPools; i++) {
      let tokenOut
      if (tokenIn.address == this.swapPools[i].token0.address) {
        tokenOut = this.swapPools[i].token1
      } else if (tokenIn.address == this.swapPools[i].token1.address) {
        tokenOut = this.swapPools[i].token0
      } else {
        throw new Error('wtf?')
      }
      tokenOutQuantity = this.swapPools[i].calculateTokensOutFromTokensIn({
        tokenIn,
        tokenInQuantity,
      })
      if (i == numberOfPools - 1) {
        break
      } else {
        tokenIn = tokenOut
        tokenInQuantity = tokenOutQuantity
      }
    }

    return tokenOutQuantity
  }
}
