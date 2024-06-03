const BeamnamesAbi = require('../artifacts/contracts/Beamnames.sol/Beamnames.json').abi;

module.exports = async ({
    getNamedAccounts,
    deployments,
}) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const proxyAdmin = await deployments.get('ProxyAdmin');
    const beamnamesImpl = await deployments.get('BeamnamesImpl');

    // Initialize call data
    const beamnamesInt = new ethers.utils.Interface(BeamnamesAbi);
    const beamnamesInitData = beamnamesInt.encodeFunctionData('initialize', [
        hre.network.config.beamnames.feeToken,
        ethers.utils.parseEther(hre.network.config.beamnames.feeAmount),
        hre.network.config.beamnames.tld,
        hre.network.config.beamnames.tokenURI
    ])

    const [signer] = await ethers.getSigners();

    const beamnames = await deploy('Beamnames', {
        from: deployer,
        gasLimit: 1_000_000,
        contract: "TransparentUpgradeableProxy",
        args: [beamnamesImpl.address, proxyAdmin.address, beamnamesInitData],
    });
    console.log('Transparent Proxy Owner: ', await signer.provider.getStorageAt(beamnames.address, "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"));

    const owner = hre.network.config.beamnames.owner;

    const beamnamesContract = new ethers.Contract(beamnames.address, beamnamesImpl.abi, signer);
    const proxyAdminContract = new ethers.Contract(proxyAdmin.address, proxyAdmin.abi, signer);

    await beamnamesContract.transferOwnership(owner, { gasLimit: 1_000_000 });
    console.log('Beamnames owner changed to ', owner);

    await proxyAdminContract.transferOwnership(owner, { gasLimit: 1_000_000 });
    console.log('Beamnames proxy admin owner changed to ', owner);

    const proxyAdminOwner = await proxyAdminContract.getProxyAdmin(beamnames.address);

    console.log('Beamnames: ', beamnames.address);
    console.log('BeamnamesInitData', beamnamesInitData);
    console.log('Proxy Admin Owner', proxyAdminOwner);
    
    console.log('Transparent Proxy Owner 2: ', await signer.provider.getStorageAt(beamnames.address, "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"));
};

module.exports.tags = ['Beamnames'];
module.exports.dependencies = ['BeamnamesImpl', 'ProxyAdmin'];