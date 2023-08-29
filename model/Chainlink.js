import { oracleAbi } from '../abi/index.js'

class ChainlinkPriceContract {
  constructor({ address, provider }) {
    this._address = provider.utils.toChecksumAddress(address)
    this._contract = new provider.eth.Contract(oracleAbi, this._address)
  }

  async updatePrice() {
    const data = await this._contract.methods.latestRoundData().call()
    const decimal = await this._contract.methods.decimals().call()
    this.price = Number(data[1]) / 10 ** Number(decimal)
    return this.price
  }
}

export default ChainlinkPriceContract
