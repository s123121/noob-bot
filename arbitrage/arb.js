import 'dotenv/config'
import axios from 'axios'
import Web3 from 'web3'
import HDWalletProvider from '@truffle/hdwallet-provider'

const provider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
})

const web3 = new Web3(provider)

// const privateKeyString =
//   "0x1f953dc9b6437fb94fcafa5dabe3faa0c34315b954dd66f41bf53273339c6d26";
// const account = web3.eth.accounts.wallet.add(privateKeyString);

const toBn = web3.utils.toBigInt

const getAbi = async (address) => {
  const explorerUrl = `https://api.arbiscan.io/api?module=contract&action=getabi&address=${address}&apiKey=${process.env.ARBSCAN_API_KEY}`
  const response = await axios.get(explorerUrl)
  const abi = JSON.parse(response.data.result)
  return abi
}

const getContract = async (address, proxyAddress) => {
  const abi = await getAbi(proxyAddress || address)
  const contract = new web3.eth.Contract(abi, address)
  return contract
}

async function getTokenInfo(tokenContract, account) {
  const [address, symbol, decimals, name, balance] = await Promise.all([
    tokenContract._address,
    tokenContract.methods.symbol().call(),
    tokenContract.methods.decimals().call(),
    tokenContract.methods.name().call(),
    tokenContract.methods.balanceOf(account).call(),
  ])
  return { address, decimals, name, symbol, balance }
}

const getAccount = async () => {
  const accounts = await web3.eth.getAccounts()
  return accounts[0]
}

async function main() {
  console.log('Loading Contracts...')
  const daiContract = await getContract('0xda10009cbd5d07dd0cecc66161fc93d7c9000da1')
  const usdcContract = await getContract(
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    '0x0f4fb9474303d10905AB86aA8d5A65FE44b6E04A',
  )
  const usdtContract = await getContract(
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    '0xf31e1AE27e7cd057C1D6795a5a083E0453D39B50',
  )
  const wethContract = await getContract('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')
  const routerContract = await getContract('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')

  const account = await getAccount()

  const dai = await getTokenInfo(daiContract, account)
  const usdc = await getTokenInfo(usdcContract, account)
  const usdt = await getTokenInfo(usdtContract, account)

  console.log({ account, dai, usdc, usdt })
  if (Number(usdt.balance) === 0) {
    console.log('No USDT balance')
    return
  }

  if (usdtContract.allowance(account))
    while (true) {
      for (let pair of tokenPairs) {
        let tokenIn = pair[0]
        let tokenOut = pair[1]
        console.log(`${new Date().toLocaleTimeString()} ${tokenIn.symbol} → ${tokenOut.symbol}`)
        let qtyOut = await routerContract.methods
          .getAmountsOut(toBn(1 * 10 ** Number(tokenIn.decimals)), [
            tokenIn.address,
            wavaxContract._address,
            tokenOut.address,
          ])
          .call()
        const amount = Number(qtyOut[2]) / 10 ** Number(tokenOut.decimals)
        if (amount >= 1.01) {
          console.log(
            `${new Date().toLocaleTimeString()} ${tokenIn.symbol} → ${tokenOut.symbol}: (${amount.toFixed(3)})`,
          )
        }
        await new Promise((r) => setTimeout(r, 100))
      }
    }
}

main()
