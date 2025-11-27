import '@nomicfoundation/hardhat-toolbox';
import hre from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const { ethers, network } = hre;

async function main() {
  console.log(`\nDeploying FileProof contract to ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

  // FileProof 컨트랙트 배포
  const FileProofFactory = await ethers.getContractFactory('FileProof');
  const fileProof = await FileProofFactory.deploy();
  await fileProof.waitForDeployment();

  const fileProofAddress = await fileProof.getAddress();
  console.log(`\nFileProof deployed to: ${fileProofAddress}`);

  // ABI를 위한 컨트랙트 아티팩트 가져오기
  const artifact = await ethers.getContractFactory('FileProof');
  const abi = artifact.interface.formatJson();

  // 배포 정보 준비
  const deploymentInfo = {
    network: network.name,
    contractAddress: fileProofAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    abi: JSON.parse(abi),
  };

  // 배포 정보 저장
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `FileProof-${network.name}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filepath}`);

  // 배포 검증
  console.log('\nVerifying deployment...');
  const owner = await fileProof.owner();
  const totalCommits = await fileProof.totalCommits();
  console.log(`Owner: ${owner}`);
  console.log(`Total commits: ${totalCommits}`);

  console.log('\nDeployment completed successfully!\n');

  return {
    fileProof: fileProofAddress,
    deployer: deployer.address,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
