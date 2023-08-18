// const ConvertLib = artifacts.require("ConvertLib");
// const MetaCoin = artifacts.require("MetaCoin");

// module.exports = function(deployer) {
//   deployer.deploy(ConvertLib);
//   deployer.link(ConvertLib, MetaCoin);
//   deployer.deploy(MetaCoin);
// };

const FlashBorrow = artifacts.require('FlashBorrow')
module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(
    FlashBorrow,
    '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  )
  const instance = await FlashBorrow.deployed()
  console.log('instance', instance.address)

  // const tx = await instance.execute('0xE5cddBfd3A807691967e528f1d6b7f00b1919e6F', '0xCE1bFFBD5374Dac86a2893119683F4911a2F7814', BigInt('29312834720491373000000'), ['0xCE1bFFBD5374Dac86a2893119683F4911a2F7814', '0x3Ee97d514BBef95a2f110e6B9b73824719030f7a'], '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', { from: accounts[0] })
  // console.log('tx', tx)
}
