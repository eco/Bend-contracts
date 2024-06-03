require('hardhat-deploy');
require('solidity-coverage');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers")

require('dotenv').config()

module.exports = {
  networks: {
    optimism: {
      chainId: 10,
      url: process.env.L2_PROVIDER_URL_OPTIMISM,
      accounts: [process.env.PRIVATE_KEY],
      beamnames: {
        tld: 'beam.eco',
        owner: '0x6E559217A70fa3f429C941811954678780ffAfF3',
        tokenURI: '',
        feeToken: "0xe7BC9b3A936F122f08AAC3b1fac3C3eC29A78874",
        feeAmount: "200", // 200 ECO
      }
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
    ],
  },
};
