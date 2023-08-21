import ERC20Token, { getERC20Token } from '../model/ERC20'
import LiquidityPool, { getLiquidityPool } from '../uniswap/v2/LiquidityPool'

class FlashBorrowToLpSwap {
  constructor({ borrowPool, borrowToken, swapTokenAddresses, name, updateMethod = 'polling' }) {
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

  _calculateArbitrage() {
    //  set up the boundaries for the Brent optimizer based on which token is being borrowed
    let bounds
    if (this.borrowToken == this.borrowPool.token0.address) {
      bounds = [1, this.borrowPool.reservesToken0]
    } else {
      bounds = [1, this.borrowPool.reservesToken1]
    }
    const func = (x) =>
      -(
        this.calculateMultipoolTokensOutFromTokensIn({ tokenIn: this.borrowToken, tokenInQuantity: x }) -
        this.borrowPool.calculateTokensInFromTokensOut({ tokenIn: this.repayToken, tokenOutQuantity: x })
      )
    const bestBorrow = Math.round(brent(func, bounds[0], bounds[1], 0.001, 500))

    let borrowAmounts
    if (this.borrowToken.address == this.borrowPool.token0.address) {
      borrowAmounts = [bestBorrow, 0]
    } else if (this.borrowToken.address == this.borrowPool.token1.address) {
      borrowAmounts = [0, bestBorrow]
    } else {
      throw new Error('wtf?')
    }

    const bestRepay = this.borrowPool.calculateTokensInFromTokensOut({
      tokenIn: this.repayToken,
      tokenOutQuantity: bestBorrow,
    })

    const bestProfit = -func(bestBorrow)
    // only save opportunities with rational, positive values
    if (bestBorrow > 0 && bestProfit > 0) {
      this.best = {
        ...this.best,
        borrowAmount: bestBorrow,
        borrowPoolAmounts: borrowAmounts,
        repayAmount: bestRepay,
        profitAmount: bestProfit,
        swapPoolAmounts: this._buildMultipoolAmountsOut({
          tokenIn: this.borrowToken,
          tokenInQuantity: bestBorrow,
        }),
      }
    } else {
      this.best = {
        ...this.best,
        borrowAmount: 0,
        borrowPoolAmounts: [],
        repayAmount: 0,
        profitAmount: 0,
        swapPoolAmounts: [],
      }
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

  _buildMultipoolAmountsOut({ tokenIn, tokenInQuantity, silent }) {
    const numberOfPools = this.swapPools.length
    let poolAmountsOut = []
    for (let i = 0; i < numberOfPools; i++) {
      let tokenOut
      if (tokenIn.address == this.swapPools[i].token0.address) {
        tokenOut = this.swapPools[i].token1
      } else if (tokenIn.address == this.swapPools[i].token1.address) {
        tokenOut = this.swapPools[i].token0
      } else {
        throw new Error('wtf?')
      }
      let tokenOutQuantity = this.swapPools[i].calculateTokensOutFromTokensIn({
        tokenIn,
        tokenInQuantity,
      })
      if (tokenIn.address == this.swapPools[i].token0.address) {
        poolAmountsOut.push([0, tokenOutQuantity])
      } else if (tokenIn.address == this.swapPools[i].token1.address) {
        poolAmountsOut.push([tokenOutQuantity, 0])
      }
      if (i == numberOfPools - 1) {
        break
      } else {
        tokenIn = tokenOut
        tokenInQuantity = tokenOutQuantity
      }
    }

    return poolAmountsOut
  }
}

export const getFlashBorrowToLpSwap = async ({
  borrowPool,
  borrowToken,
  provider,
  swapFactoryAddress,
  swapFactoryAbi,
  swapTokenAddresses,
  swapRouterFee,
  name,
  updateMethod = 'polling',
}) => {
  const flashBorrowToLpSwap = new FlashBorrowToLpSwap({
    borrowPool,
    borrowToken,
    provider,
    swapFactoryAddress,
    swapTokenAddresses,
    swapRouterFee,
    name,
    updateMethod,
  })
  await flashBorrowToLpSwap.init({
    provider,
    abi: swapFactoryAbi,
    address: swapFactoryAddress,
    swapRouterFee,
    swapTokenAddresses,
    updateMethod,
  })
  return flashBorrowToLpSwap
}
