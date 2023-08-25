import ChainlinkPriceContract from './Chainlink.js'
import { standardAbi } from '../abi/index.js'
import { strict as assert } from 'node:assert'

class ERC20Token {
  //     Represents an ERC-20 token. Must be initialized with an address.
  constructor({ address, user, provider, abi, oracleAddress = null }) {
    this.address = address.toLowerCase()
    this._user = user
    this._web3 = provider
    if (abi) {
      try {
        this._contract = new provider.eth.Contract(abi, address)
      } catch (err) {
        throw new Error('Exception in contract_load')
      }
    } else {
      this._contract = new provider.eth.Contract(standardAbi, address)
    }
    if (oracleAddress) {
      this._price_oracle = new ChainlinkPriceContract({ address: oracleAddress, provider })
    }
    // this.getTokenInfo();
  }

  async getApproval(externalAddress) {
    console.log(`Checking approval for ${externalAddress}...`)
    return await this._contract.methods.allowance(this._user, externalAddress).call()
  }

  async setApproval(externalAddress, value) {
    assert(
      Number.isInteger(value) && value >= -1 && value <= 2 ** 256 - 1,
      'Approval value MUST be an integer between 0 and 2**256-1, or -1',
    )
    if (value === -1) {
      console.log('Setting unlimited approval!')
      value = 2 ** 256 - 1
    }

    try {
      await this._contract.methods.approve(externalAddress, value, {
        from: this._user,
      })
    } catch (e) {
      console.log(`Exception in token_approve: ${e}`)
      throw e
    }
  }

  async init() {
    const [symbol, decimals, name, balance] = await Promise.all([
      this._contract.methods.symbol().call(),
      this._contract.methods.decimals().call(),
      this._contract.methods.name().call(),
      this._contract.methods.balanceOf(this._user).call(),
    ])
    this.symbol = symbol
    this.decimals = Number(decimals)
    this.name = name
    this.balance = Number(balance)
    this.isInit = true
    // console.log('Token info: ', this.symbol, this.decimals, this.name)
  }

  async getBalance() {
    this.balance = Number(await this._contract.methods.balanceOf(this._user).call())
    return this.balance
  }

  async getNormalizedBalance() {
    const balance = await this.getBalance()
    const normalizedBalance = Number(balance) / 10 ** this.decimals
    return normalizedBalance
  }

  async getPrice() {
    this.price = await this._price_oracle.updatePrice()
    return this.price
  }
}

export default ERC20Token

export const getERC20Token = async ({ address, user, provider, abi, oracleAddress }) => {
  const token = new ERC20Token({ address, user, provider, abi, oracleAddress })
  await token.init()
  return token
}
