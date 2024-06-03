module.exports = async ({
    getNamedAccounts,
    deployments,
}) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const impl = await deploy('BeamnamesImpl', {
        from: deployer,
        gasLimit: 4_000_000,
        contract: 'Beamnames',
        args: [],
    });

    console.log('Beamnames Implementation: ', impl.address);
};

module.exports.tags = ['BeamnamesImpl'];