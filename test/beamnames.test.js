const { expect } = require('chai');
const { Contract } = require('ethers');
const { Interface } = require('ethers/lib/utils');
const { ethers } = require('hardhat');
const BeamnamesAbi = require('../artifacts/contracts/Beamnames.sol/Beamnames.json').abi;

let currentFee = ethers.utils.parseEther('10');

function dnsEncode(name) {
  const hash = ethers.utils.defaultAbiCoder.encode(['bytes'], [ethers.utils.dnsEncode(name)]);
  if (hash.length !== 194) throw new Error('Invalid name DNS encoding');
  return "0x" + hash.substring(130, 194);
}

describe('Beamnames', () => {
  let alice, bob, charlie, beamnames, beamnamesProxy, eco, token2, proxyAdmin;

  before(async () => {
    [alice, bob, charlie] = await ethers.getSigners();

    // Deploy ECO token
    const ecoFactory = await ethers.getContractFactory("ECO", alice);
    eco = await ecoFactory.deploy();
    token2 = await ecoFactory.deploy();

    // Deploy Beamnames Contract
    const beamnamesFactory = await ethers.getContractFactory("Beamnames", alice);
    beamnamesImpl = await beamnamesFactory.deploy();

    // Initialize call data
    const beamnamesInt = new Interface(BeamnamesAbi);
    const beamnamesInitData = beamnamesInt.encodeFunctionData('initialize', [eco.address, currentFee, 'beam.eco', 'http://localhost:3000/'])

    // Deploy FactoryAdmin
    const proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin", alice);
    proxyAdmin = await proxyAdminFactory.deploy();

    // Deploy Proxy
    const proxyFactory = await ethers.getContractFactory("TransparentUpgradeableProxy", alice);
    beamnamesProxy = await proxyFactory.deploy(beamnamesImpl.address, proxyAdmin.address, beamnamesInitData);
    beamnames = new Contract(beamnamesProxy.address, BeamnamesAbi, alice);


    // Transfer 200 ECO tokens to bob
    await eco.connect(alice).transfer(bob.address, ethers.utils.parseEther('200'));
    // Transfer 200 ECO tokens to charlie
    await token2.connect(alice).transfer(charlie.address, ethers.utils.parseEther('200'));
  })

  describe('registration', () => {
    it('should register an econame', async () => {
      // Test that an econame can be registered successfully
      // and verify the balance, total supply, and name of the registered econame.

      // Approve Beamnames contract to charge the fee
      await eco.connect(bob).approve(beamnames.address, currentFee)

      const balanceBefore = await eco.balanceOf(bob.address);
      const totalSupplyBefore = await beamnames.totalSupply();

      // Register `alice.beam.eco` Econame
      await beamnames.connect(bob).register(alice.address, 'alice')

      const balanceAfter = await eco.balanceOf(bob.address);
      const tokenId = await beamnames.tokenIdOf(dnsEncode('alice.beam.eco'));

      expect(tokenId).to.equal(1);

      const name = await beamnames.nameOf(tokenId);
      const totalSupplyAfter = await beamnames.totalSupply();

      expect(name).to.equal('alice.beam.eco')
      // Check total supply
      expect(totalSupplyAfter).to.equal(1)
      expect(totalSupplyBefore).to.equal(0)
      // Check token balances
      expect(balanceBefore.sub(balanceAfter).toHexString()).to.equal(currentFee.toHexString());
    })

    it('should register an econame with emojis', async () => {
      // Test that an econame with emojis can be registered successfully
      // and verify the balance, total supply, and name of the registered econame.

      await eco.connect(bob).approve(beamnames.address, currentFee)
      await beamnames.connect(bob).register(charlie.address, '😃😃😃😃😃')

      const resolved = await beamnames.resolve('😃😃😃😃😃.beam.eco');
      expect(resolved).to.equal(charlie.address);
    })

    it('should revert if registering an already existing econame', async () => {
      // Test that attempting to register an already existing econame reverts,
      // and verify the appropriate error message is returned.

      await eco.connect(bob).approve(beamnames.address, currentFee)
      await expect(
        beamnames.connect(bob).register(alice.address, 'alice')
      ).to.be.revertedWith('name is already registered')
    })

    it('should revert if econame length is less than 5 characters', async () => {
      // Test that attempting to register a econame less than 5 characters reverts,
      // and verify the appropriate error message is returned.

      await expect(
        beamnames.connect(bob).register(alice.address, 'bob')
      ).to.be.revertedWith('invalid subname length')
    })

    it('should register an econame 3 character if owner is the sender', async () => {
      // Test that an econame 3 characters long can be registered by the owner successfully
      // and verify the balance, total supply, and name of the registered econame.

      await eco.connect(alice).approve(beamnames.address, currentFee)
      await beamnames.connect(alice).register(bob.address, 'bob')

      const resolved = await beamnames.resolve('bob.beam.eco');
      expect(resolved).to.equal(bob.address);
    })

    it('should revert if registering with an empty name', async () => {
      // Test that attempting to register with an empty name reverts,
      // and verify the appropriate error message is returned.

      await eco.connect(bob).approve(beamnames.address, currentFee)
      await expect(
        beamnames.connect(bob).register(alice.address, '')
      ).to.be.revertedWith('subname cannot be null')
    })

    it('should revert if registering with a name containing uppercase characters', async () => {
      // Test that attempting to register with a name containing uppercase characters reverts,
      // and verify the appropriate error message is returned.

      await eco.connect(bob).approve(beamnames.address, currentFee)
      await expect(
        beamnames.connect(bob).register(alice.address, 'Carlos')
      ).to.be.revertedWith('name contains unsupported characters or uppercase characters')
    })

    it('should revert if registering with a name containing invalid characters', async () => {
      // Test that attempting to register with a name containing invalid characters reverts,
      // and verify the appropriate error message is returned.

      await eco.connect(bob).approve(beamnames.address, currentFee)
      await expect(
        beamnames.connect(bob).register(alice.address, 'c@rlos.beam.eco')
      ).to.be.revertedWith('name contains unsupported characters or uppercase characters')
    })
  })

  describe('slot', () => {
    it('should resolve address by deriving slot from dnsEncoded name', async () => {
      // Test that the resolve function correctly returns the address associated with an econame.

      const mappingSlot = 208;
      const dnsHash = dnsEncode('alice.beam.eco')
      const addrSlot = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [dnsHash, mappingSlot])
      );
      const addressData = await beamnames.provider.getStorageAt(
        beamnames.address,
        addrSlot
      );
      const address = ethers.utils.defaultAbiCoder.decode(['address'], addressData)[0];

      const resolved = await beamnames.resolve('alice.beam.eco')

      expect(resolved).to.equal(alice.address)
      expect(address).to.equal(resolved)
    })
  })

  describe('resolve', () => {
    it('should resolve to the correct address', async () => {
      // Test that the resolve function correctly returns the address associated with an econame.

      const resolved = await beamnames.resolve('alice.beam.eco')
      // Check Econame resolves to the correct address
      expect(resolved).to.equal(alice.address)
    })
    it('should resolve to the zero address if the name does not exist', async () => {
      // Test that the resolve function returns the zero address when an econame does not exist.

      const resolved = await beamnames.resolve('namedoesntexist')
      // Check Econame resolves to the correct address
      expect(resolved).to.equal(ethers.constants.AddressZero)
    })
  })

  describe('tokenURI', () => {
    it('should return the correct tokenURI', async () => {
      // Test that the tokenURI function returns the correct URI for a given tokenId.

      const tokenId = await beamnames.tokenIdOf(dnsEncode('alice.beam.eco'));
      const tokenURI = await beamnames.tokenURI(tokenId);
      expect(tokenURI).to.equal('http://localhost:3000/alice.beam.eco')
    })

    it('should set a new tokenURI', async () => {
      // Test that the setTokenURI function successfully sets a new URI for a given tokenId,
      // and verify the updated tokenURI for the corresponding econame.

      await beamnames.connect(alice).setTokenURI('http://localhost:3002/');
      const tokenId = await beamnames.tokenIdOf(dnsEncode('alice.beam.eco'));
      const tokenURI = await beamnames.tokenURI(tokenId);
      expect(tokenURI).to.equal('http://localhost:3002/alice.beam.eco')
    })

    it('should revert setting tokenURI if the sender is not the owner', async () => {
      // Test that attempting to set a new tokenURI by a non-owner reverts,
      // and verify the appropriate error message is returned.

      await expect(
        beamnames.connect(bob).setTokenURI('http://localhost:3002/')
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('registration fee', () => {
    describe('fee amount', () => {
      it('should get the current registration fee', async () => {
        // Test that the registrationFee function returns the current fee amount.

        const initialFee = await beamnames.registrationFee();
        expect(initialFee.toHexString()).to.equal(currentFee.toHexString())
      })

      it('should set a new fee amount', async () => {
        // Test that the setRegistrationFee function successfully sets a new fee amount,
        // and verify that the updated fee amount is reflected.

        await beamnames.connect(alice).setRegistrationFee(ethers.utils.parseEther('5'));
        currentFee = await beamnames.registrationFee();
        expect(currentFee.toHexString()).to.equal(ethers.utils.parseEther('5').toHexString())
      })

      it('should revert setting fee amount if the sender is not the owner', async () => {
        // Test that attempting to set a new fee amount by a non-owner reverts,
        // and verify the appropriate error message is returned.

        await expect(
          beamnames.connect(bob).setRegistrationFee(ethers.BigNumber.from(1))
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('token', () => {
      it('should only allow the owner to set a new token', async () => {
        // Test that only the owner can successfully set a new token,
        // and verify that the token is updated accordingly.

        await expect(
          beamnames.connect(bob).setToken(token2.address)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('should set a new token', async () => {
        // Test that the setToken function successfully sets a new token,
        // and verify that the token is updated accordingly.

        const tokenBefore = await beamnames.token();
        await beamnames.connect(alice).setToken(token2.address);
        const tokenAfter = await beamnames.token();

        expect(tokenBefore).not.to.equal(tokenAfter)
        expect(tokenAfter).to.equal(token2.address)
      })
    })

    describe('withdraw', () => {
      before(async () => {
        await token2.connect(charlie).approve(beamnames.address, currentFee)
        await beamnames.connect(charlie).register(charlie.address, 'carlos')
      })

      it('should revert withdraw if the sender is not the owner', async () => {
        // Test that attempting to withdraw the fee by a non-owner reverts,
        // and verify the appropriate error message is returned.

        await expect(
          beamnames.connect(bob).withdrawFee(bob.address)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('should withdraw the whole balance', async () => {
        // Test that the withdrawFee function successfully withdraws the entire fee balance,
        // and verify that the balance is transferred to the specified address.

        const collectAmount = await token2.balanceOf(beamnames.address);
        const balanceBefore = await token2.balanceOf(bob.address);

        // Withdraw tokens
        await beamnames.connect(alice).withdrawFee(bob.address);

        const balanceAfter = await token2.balanceOf(bob.address);

        expect(balanceAfter.sub(balanceBefore).toHexString()).to.equal(collectAmount.toHexString())
      })

      it('should revert withdraw if there is no balance', async () => {
        // Test that attempting to withdraw the fee when there is no balance reverts,
        // and verify the appropriate error message is returned.

        await expect(
          beamnames.connect(alice).withdrawFee(bob.address)
        ).to.be.revertedWith('There is not balance to withdraw')
      })
    })

    describe('withdraw fee with token', () => {
      it('should revert withdraw with token if the sender is not the owner', async () => {
        // Test that attempting to withdraw the fee with a token by a non-owner reverts,
        // and verify the appropriate error message is returned.

        await expect(
          beamnames.connect(bob).withdrawFeeWithToken(bob.address, eco.address)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('should withdraw the whole balance with the specified token', async () => {
        // Test that the withdrawFeeWithToken function successfully withdraws the entire fee balance with the specified token,
        // and verify that the balance is transferred to the specified address.

        const collectAmount = await eco.balanceOf(beamnames.address);
        const balanceBefore = await eco.balanceOf(bob.address);

        // Withdraw tokens
        await beamnames.connect(alice).withdrawFeeWithToken(bob.address, eco.address);

        const balanceAfter = await eco.balanceOf(bob.address);

        expect(balanceAfter.sub(balanceBefore).toHexString()).to.equal(collectAmount.toHexString())
      })

      it('should revert withdraw with token if there is no balance', async () => {
        // Test that attempting to withdraw the fee with a token when there is no balance reverts,
        // and verify the appropriate error message is returned.

        await expect(
          beamnames.connect(alice).withdrawFeeWithToken(bob.address, eco.address)
        ).to.be.revertedWith('There is not balance to withdraw')
      })
    })
  })


  describe('primary name', () => {
    it('should revert setting a primary name not owned by the caller', async () => {
      // Test that attempting to set a primary name not owned by the caller reverts,
      // and verify the appropriate error message is returned.

      await expect(
        beamnames.connect(bob).setPrimaryName(1)
      ).to.be.revertedWith('Not name owner')
    })

    it('should set a primary name', async () => {
      // Test that the setPrimaryName function successfully sets a primary name for the caller,
      // and verify that the primary name is updated accordingly.

      const initialPrimaryName = await beamnames.primaryNameOf(alice.address);
      await beamnames.connect(alice).setPrimaryName(1);
      const newPrimaryName = await beamnames.primaryNameOf(alice.address);

      expect(initialPrimaryName).to.equal(ethers.constants.AddressZero);
      expect(newPrimaryName).to.equal(1);
    })

    it('should remove the primary name after transferring the primary name', async () => {
      // Test that the primary name is removed after transferring the primary name,
      // and verify that the primary name is set to the zero address.

      const dnshash = dnsEncode('alice.beam.eco');
      const initialNodeAddr = await beamnames.addrByNode(dnshash);
      const initialPrimaryName = await beamnames.primaryNameOf(alice.address);

      // Transfer Econame to Bob
      await beamnames.connect(alice).transferFrom(alice.address, bob.address, 1)

      const newNodeAddr = await beamnames.addrByNode(dnshash);
      const newPrimaryName = await beamnames.primaryNameOf(alice.address);

      // Check primary names
      expect(newPrimaryName).to.equal(0);
      expect(initialPrimaryName).to.equal(1);

      // Check node addresses
      expect(newNodeAddr).to.equal(bob.address);
      expect(initialNodeAddr).to.equal(alice.address);
    })
  })
})
