async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Implementation
  const LumenDAO = await ethers.getContractFactory("LumenDAO");
  const implementation = await LumenDAO.deploy();
  await implementation.waitForDeployment();
  console.log("Implementation deployed to:", await implementation.getAddress());

  // Encode initialize data
  const data = LumenDAO.interface.encodeFunctionData("initialize", [deployer.address]);

  // Deploy Proxy
  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await TransparentUpgradeableProxy.deploy(
    await implementation.getAddress(),
    deployer.address, // admin
    data
  );
  await proxy.waitForDeployment();
  console.log("Proxy deployed to:", await proxy.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
