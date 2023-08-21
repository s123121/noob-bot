import 'dotenv/config'
import Web3 from 'web3'
import axios from 'axios'
import HDWalletProvider from '@truffle/hdwallet-provider'

const SPOOKY_SWAP_ROUTER = '0xF491e7B69E4244ad4002BC14e878a34207E38c29'

const getAbi = async (address) => {
  const explorerUrl = `https://api.ftmscan.com/api?module=contract&action=getabi&address=${address}&apiKey=${process.env.FTMSCAN_API_KEY}`
  const response = await axios.get(explorerUrl)
  const abi = JSON.parse(response.data.result)
  return abi
}

// const ftmProvider = new HDWalletProvider({
//   mnemonic: process.env.MNEMONIC,
//   providerOrUrl: `https://fantom-mainnet.core.chainstack.com/${process.env.INFURA_KEY}`,
// })

const options = {
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 5,
    onTimeout: false,
  },
}

const webSocketProvider = new Web3.providers.WebsocketProvider(
  `wss://fantom-mainnet.core.chainstack.com/ws/${process.env.CHAINSTACK_KEY}`,
  {},
  options,
)

const web3 = new Web3(webSocketProvider)

const main = async () => {
  const abi = await getAbi(SPOOKY_SWAP_ROUTER)
  // const contract = ftmProvider.eth.Contract(abi, address)
  const subscription = await web3.eth.subscribe('pendingTransactions')
  subscription.on('error', (err) => {
    throw err
  })
  subscription.on('data', (txHash) => {
    console.log('New pending transaction: %s', txHash)
    setTimeout(async () => {
      try {
        let tx = await web3.eth.getTransaction(txHash)
        // console.log({ tx })
        // if (tx) {
        //   console.log('TX hash: ', txHash) // transaction hash
        //   console.log('TX confirmation: ', tx.transactionIndex) // "null" when transaction is pending
        //   console.log('TX nonce: ', tx.nonce) // number of transactions made by the sender prior to this one
        //   console.log('TX block hash: ', tx.blockHash) // hash of the block where this transaction was in. "null" when transaction is pending
        //   console.log('TX block number: ', tx.blockNumber) // number of the block where this transaction was in. "null" when transaction is pending
        //   console.log('TX sender address: ', tx.from) // address of the sender
        //   console.log('TX amount(in Ether): ', web3.utils.fromWei(tx.value, 'ether')) // value transferred in ether
        //   console.log('TX date: ', new Date()) // transaction date
        //   console.log('TX gas price: ', tx.gasPrice) // gas price provided by the sender in wei
        //   console.log('TX gas: ', tx.gas) // gas provided by the sender.
        //   console.log('TX input: ', tx.input) // the data sent along with the transaction.
        //   console.log('=====================================') // a visual separator
        // }
        console.log(tx.to, '>>>>')
        if (tx && tx.to.toLocaleLowerCase() === SPOOKY_SWAP_ROUTER.toLocaleLowerCase()) {
          console.log('Spooky Swap Router Transaction: ', txHash)
          const decoded = web3.eth.abi.decodeLog(abi, tx.input)
          console.log({ decoded })
          process.exit(0)
        }
      } catch (err) {
        // console.error(err)
      }
    })
  })
}

main()
