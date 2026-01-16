import { ethers, upgrades } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy IdentityRegistry (UUPS)
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [deployer.address], {
        initializer: "initialize",
        kind: "uups"
    });
    await identityRegistry.waitForDeployment();
    console.log("IdentityRegistry deployed to:", await identityRegistry.getAddress());

    // 2. Deploy LumenDAO (UUPS)
    const LumenDAO = await ethers.getContractFactory("LumenDAO");
    const lumenDAO = await upgrades.deployProxy(LumenDAO, [deployer.address, await identityRegistry.getAddress()], {
        initializer: "initialize",
        kind: "uups"
    });
    await lumenDAO.waitForDeployment();
    console.log("LumenDAO deployed to:", await lumenDAO.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
