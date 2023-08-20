import { strict as assert } from 'node:assert'
import { uniswapV2PoolAbi } from '../../abi/index.js'

class LiquidityPool {
  constructor({
    address,
    router,
    name,
    tokens,
    updateMethod = 'polling',
    abi = uniswapV2PoolAbi,
    provider,
    fee = 0.003,
    feeToken0,
    feeToken1,
  }) {
    /** 
      Create a new `LiquidityPool` object for interaction with a Uniswap
      V2 pool.

      Arguments
      ---------
      address : str
          Address for the deployed pool contract.
      tokens : List[Erc20Token], optional
          Erc20Token objects for the tokens held by the deployed pool.
      name : str, optional
          Name of the contract, e.g. "DAI-WETH".
      update_method : str
          A string that sets the method used to fetch updates to the pool.
          Can be "polling", which fetches updates from the chain object
          using the contract object, or "external" which relies on updates
          being provided from outside the object.
      router : Router, optional
          A reference to a Router object, which can be used to execute swaps
          using the attributes held within this object.
      abi : list, optional
          Contract ABI.
      factory_address : str, optional
          The address for the factory contract. The default assumes a
          mainnet Uniswap V2 factory contract. If creating a
          `LiquidityPool` object based on another ecosystem, provide this
          value or the address check will fail.
      factory_init_hash : str, optional
          The init hash for the factory contract. The default assumes a
          mainnet Uniswap V2 factory contract.
      fee : Fraction
          The swap fee imposed by the pool. Defaults to `Fraction(3,1000)`
          which is equivalent to 0.3%.
      fee_token0 : Fraction, optional
          Swap fee for token0. Same purpose as `fee` except useful for
          pools with different fees for each token.
      fee_token1 : Fraction, optional
          Swap fee for token1. Same purpose as `fee` except useful for
          pools with different fees for each token.
      silent : bool
          Suppress status output.
      update_reserves_on_start : bool
          Update the reserves during instantiation.
      state_block: int, optional
          Fetch initial state values from the chain at a particular block
          height. Defaults to the latest block if omitted.
    **/
    this.address = address
    this.name = name
    this.router = router
    this._update_method = updateMethod
    this._filter = null
    this._filter_active = false
    this.abi = abi
    this.tokens = tokens
    this._contract = new provider.eth.Contract(abi, address)
    this.token0MaxSwap = 0
    this.token1MaxSwap = 0
    this.feeToken0 = feeToken0 || fee
    this.feeToken1 = feeToken1 || fee
    this.fee = this.feeToken0 && this.feeToken1 ? 0 : fee

    if (tokens.length !== 2) {
      throw new Error(`Expected 2 tokens, found ${tokens.length}`)
    }
  }

  async init() {
    const tokenAddresses = await Promise.all([
      this._contract.methods.token0().call(),
      this._contract.methods.token1().call(),
    ])
    for (const token of this.tokens) {
      if (token.address === tokenAddresses[0]) {
        this.token0 = token
      } else if (token.address === tokenAddresses[1]) {
        this.token1 = token
      } else {
        throw new Error(`${token.name} not found in pool ${this.name}`)
      }
    }
    this.updateReserves({ silent: true })
  }

  calculateTokensInAtRatioOut() {
    // token0 in, token1 out
    // formula: dx = y0*C - x0/(1-FEE), where C = token0/token1
    if (this._ratioToken0In) {
      this.token0MaxSwap = Math.max(
        0,
        (this.reservesToken1 * this._ratioToken0In) - this.reservesToken0 / (1 - this.feeToken0),
      )
    } else {
      this.token0MaxSwap = 0
    }

    // token1 in, token0 out
    // formula: dy = x0*C - y0(1/FEE), where C = token1/token0
    if (this._ratioToken1In) {
      this.token1MaxSwap = Math.max(
        0,
        Number(this.reservesToken0 * this._ratioToken1In) - Number(this.reservesToken1 / (1 - this.feeToken1)),
      )
    }
  }

  calculateTokensOutFromTokensIn({ tokenIn, tokenInQuantity, fee }) {
    assert(tokenIn == this.token0 || tokenIn == this.token1)
    if (tokenIn == this.token0) {
      return (this.reservesToken1 * tokenInQuantity * (1 - fee)) / (this.reservesToken0 + tokenInQuantity * (1 - fee))
    }
    if (tokenIn == this.token1) {
      return (this.reservesToken0 * tokenInQuantity * (1 - fee)) / (this.reservesToken1 + tokenInQuantity * (1 - fee))
    }
  }

  async setSwapTarget({ tokenIn, tokenInQty, tokenOut, tokenOutQty, silent }) {
    if (
      (tokenIn.address === this.token0.address && tokenOut.address === this.token1.address) ||
      (tokenIn.address === this.token1.address && tokenOut.address === this.token0.address)
    ) {
      if (!silent) {
        console.log(
          `${tokenIn.name} -> ${tokenOut.name} @ (${tokenInQty} ${tokenIn.name} = ${tokenOutQty} ${tokenOut.name})`,
        )
      }
      if (tokenIn === this.token0) {
        this._ratioToken0In = (tokenInQty * 10 ** tokenIn.decimals) / (tokenOutQty * 10 ** tokenOut.decimals)
        console.log(this._ratioToken0In, 'ratio token 0 in')
      }
      if (tokenIn === this.token1) {
        this._ratioToken1In = (tokenInQty * 10 ** tokenIn.decimals) / (tokenOutQty * 10 ** tokenOut.decimals)
      }
      this.calculateTokensInAtRatioOut()
    } else {
      throw new Error('Tokens must match the two tokens held by this pool!')
    }
  }

  async updateReserves({ silent, printReserves, printRatio }) {
    let success = false
    if (this._update_method === 'polling') {
      try {
        const reserves = await this._contract.methods.getReserves().call()
        const reservesToken0 = reserves['0']
        const reservesToken1 = reserves['1']
        if (reservesToken0 !== this.reservesToken0 || reservesToken1 !== this.reservesToken1) {
          this.reservesToken0 = Number(reservesToken0)
          this.reservesToken1 = Number(reservesToken1)
          if (!silent) {
            console.log(`[${this.name}]`)
            if (printReserves) {
              console.log(`${this.token0.name}: ${this.reservesToken0}`)
              console.log(`${this.token1.name}: ${this.reservesToken1}`)
            }
            if (printRatio) {
              console.log(
                `${this.token0.name}/${this.token1.name}: ${
                  this.reservesToken0 / 10 ** this.token0.decimals / (this.reservesToken1 / 10 ** this.token1.decimals)
                }`,
              )
              console.log(
                `${this.token1.name}/${this.token0.name}: ${
                  this.reservesToken1 / 10 ** this.token1.decimals / (this.reservesToken0 / 10 ** this.token0.decimals)
                }`,
              )
            }
            this.calculateTokensInAtRatioOut()
            success = true
          }
        } else {
          success = false
        }
      } catch (e) {
        throw new Error(`LiquidityPool: Exception in update_reserves (polling): ${e}`)
      }
    }

    return success
  }
}

export default LiquidityPool
