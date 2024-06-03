module.exports = async ({
    getNamedAccounts,
    deployments,
}) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const proxyAdmin = await deploy('ProxyAdmin', {
        from: deployer,
        gasLimit: 1_000_000,
        args: [],
    });

    console.log('Proxy Admin: ', proxyAdmin.address);
};

module.exports.tags = ['ProxyAdmin'];