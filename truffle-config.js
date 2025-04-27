module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: 5777 // Match any network id
    }
  },
  compilers: {
    solc: {
      version: "0.5.0" // Use Solidity 0.5.0
    }
  }
};
