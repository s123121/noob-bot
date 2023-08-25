import { uniswapV2RouterAbi } from '../../abi/index.js'

class Router {
  // Represents a Uniswap V2 router contract
  constructor({ address, name, provider, abi = uniswapV2RouterAbi, user }) {
    this.address = address.toLowerCase()
    this.name = name
    this._contract = new provider.eth.Contract(abi, address)
    if (user) {
      this._user = user
      console.log(`• ${name}`)
    }
  }

  async tokenSwap({ tokenInQuantity, tokenInAddress, tokenOutQuantity, tokenOutAddress, slippage, deadline, scale }) {
    const params = {}
    params.from = this._user
    try {
      await this._contract.methods
        .swapExactTokensForTokens(
          tokenInQuantity,
          tokenOutQuantity * (1 - slippage),
          [tokenInAddress, tokenOutAddress],
          this._user,
          1000 * (Date.now() / 1000 + deadline),
          params,
        )
        .send()
      return true
    } catch (e) {
      console.log(`Exception: ${e}`)
      return false
    }
  }
}

export default Router
