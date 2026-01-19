import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    // Get address from args or env
    const contractAddress = process.env.VITE_IDENTITY_REGISTRY_ADDRESS;

    // Hardcoded for now if not in env, based on your previous deployment
    const REGISTRY_ADDRESS = contractAddress || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    // The address to verify - passed as argument or env
    // usage: npx hardhat run scripts/verify_identity.ts --network localhost -- 0x...
    const targetAddress = process.env.VERIFY_ADDR || process.argv[2];

    if (!targetAddress) {
        console.error("Please set VERIFY_ADDR environment variable or provide an argument.");
        console.log("Usage: npx hardhat run scripts/verify_identity.ts --network localhost -- 0x...");
        process.exit(1);
    }

    console.log(`Verifying identity for ${targetAddress} using registry at ${REGISTRY_ADDRESS}...`);

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const registry = IdentityRegistry.attach(REGISTRY_ADDRESS) as any;

    try {
        const tx = await registry.connect(deployer).verifyIdentity(targetAddress);
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("Identity Verified Successfully!");
    } catch (error) {
        console.error("Error verifying identity:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
