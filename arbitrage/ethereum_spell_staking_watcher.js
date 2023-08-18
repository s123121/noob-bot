import "dotenv/config";
import axios from "axios";
import Web3 from "web3";
import HDWalletProvider from "@truffle/hdwallet-provider";

const mainetProvider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
});

const web3 = new Web3(mainetProvider);

const getAbi = async (address) => {
  const explorerUrl = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apiKey=${process.env.ETHERSCAN_API_KEY}`;
  const response = await axios.get(explorerUrl);
  const abi = JSON.parse(response.data.result);
  return abi;
};

const contractLoad = async (address, proxyAddress, alias) => {
  try {
    const abi = await getAbi(proxyAddress || address);
    const contract = new web3.eth.Contract(abi, address);
    return contract;
  } catch (e) {
    console.log(`Exception in contract_load: ${e}`);
  }
};

const SPELL_CONTRACT_ADDRESS = "0x090185f2135308bad17527004364ebcc2d37e5f6";
const SSPELL_CONTRACT_ADDRESS = "0x26FA3fFFB6EfE8c1E69103aCb4044C26B9A106a9";

const main = async () => {
  const [account] = await web3.eth.getAccounts();
  const spellContract = await contractLoad(SPELL_CONTRACT_ADDRESS);
  const sspellContract = await contractLoad(SSPELL_CONTRACT_ADDRESS);

  let arbaRate = null;
  while (true) {
    const balance = await spellContract.methods
      .balanceOf(sspellContract._address)
      .call();
    const totalSupply = await sspellContract.methods.totalSupply().call();
    console.log("balance", balance, totalSupply);
    arbaRate = Number(balance) / Number(totalSupply);
    console.log("arbaRate", arbaRate.toFixed(4));
    await new Promise((r) => setTimeout(r, 1000));
  }
};

main()
