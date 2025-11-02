import '@nomicfoundation/hardhat-toolbox';
import hre from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const { ethers, network } = hre;

async function main() {
  console.log(`\nDeploying Counter contract to ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

  // Counter 컨트랙트 배포
  const CounterFactory = await ethers.getContractFactory('Counter');
  const counter = await CounterFactory.deploy();
  await counter.waitForDeployment();

  const counterAddress = await counter.getAddress();
  console.log(`\nCounter deployed to: ${counterAddress}`);

  // ABI를 위한 컨트랙트 아티팩트 가져오기
  const artifact = await ethers.getContractFactory('Counter');
  const abi = artifact.interface.formatJson();

  // 배포 정보 준비
  const deploymentInfo = {
    network: network.name,
    contractAddress: counterAddress,
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

  const filename = `Counter-${network.name}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filepath}`);

  // 배포 검증
  console.log('\nVerifying deployment...');
  const count = await counter.getCount();
  console.log(`Initial count: ${count}`);

  console.log('\nDeployment completed successfully!\n');

  return {
    counter: counterAddress,
    deployer: deployer.address,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
