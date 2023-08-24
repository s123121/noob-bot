import Web3 from 'web3'
class Provider {
  constructor(url) {
    this.url = url
  }

  connection() {
    return this.web3
  }

  /**
   * Connects to web3 and then sets proper handlers for events
   */
  connect() {
    console.log('Blockchain Connecting ...')
    const provider = new Web3.providers.WebsocketProvider(`${this.url}`)

    provider.on('error', (err) => {
      console.log('Error: ', err)
      throw err
    })
    provider.on('connect', () => console.log('Blockchain Connected ...'))
    provider.on('end', (err) => console.log('Blockchain Connection Closed ...', err))

    this.web3 = new Web3(provider)
  }

  /**
   * Checks the status of connection
   *
   */
  async isConnected() {
    if (this.web3) {
      return await this.web3.eth.net.isListening()
    }
    return false
  }
}

export default Provider
