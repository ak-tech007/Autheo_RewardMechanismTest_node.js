import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Contract ABI (you'll need to expand this to include all relevant functions)
const CONTRACT_ABI = [
    "function registerLowBugBountyUsers(address[] memory _lowBugBountyUsers)",
    "function registerMediumBugBountyUsers(address[] memory _mediumBugBountyUsers)",
    "function registerHighBugBountyUsers(address[] memory _highBugBountyUsers)",
    "function registerContractDeploymentUsers(address[] memory _contractDeploymentUsers)",
    "function registerDappUsers(address[] memory _dappRewardsUsers, bool[] memory _userUptime)",
    "function totalSupply() view returns (uint256)",
    "function BUG_BOUNTY_ALLOCATION_PERCENTAGE() view returns (uint256)",
    "function LOW_PERCENTAGE() view returns (uint256)",
    "function MEDIUM_PERCENTAGE() view returns (uint256)",
    "function HIGH_PERCENTAGE() view returns (uint256)",
    "function DEVELOPER_REWARD_ALLOCATION_PERCENTAGE() view returns (uint256)",
    "function DAPP_REWARD_ALLOCATION_PERCENTAGE() view returns (uint256)",
    "function MONTHLY_DAPP_REWARD() view returns (uint256)",
    "function MONTHLY_UPTIME_BONUS() view returns (uint256)"
];

// Token ABI for transfer
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

// Whitelist types
type WhitelistType =
    | 'lowBugBounty'
    | 'mediumBugBounty'
    | 'highBugBounty'
    | 'contractDeployment'
    | 'dappUsers';


interface WhitelistConfig {
    token: {
        deployedAddress: string;
        walletAddress: string;
        walletPrivateKey: string;
    };
    contract: {
        deployedAddress: string;
        walletAddress: string;
        walletPrivateKey: string;
    };
    validators: {
        [key in WhitelistType]: {
            addresses: string[];
            uptimeStatus?: boolean[]; // Only for dappUsers
        };
    };
}

class WhitelistManager {
    private providers: { [key in WhitelistType]: ethers.Provider };
    private config: WhitelistConfig;
    private tokenWallet: ethers.Wallet;
    private contractWallet: ethers.Wallet;
    private tokenContract: ethers.Contract ;
    private contract: ethers.Contract ;

    constructor(configPath: string) {
        // Load configuration from JSON
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Initialize providers, wallets, and contracts for each whitelist type
        this.providers = {} as { [key in WhitelistType]: ethers.Provider };
        
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        
        this.tokenWallet = new ethers.Wallet(this.config.token.walletPrivateKey, provider);
        this.contractWallet = new ethers.Wallet(this.config.contract.walletPrivateKey, provider);
        
        //Initialize token contract instance
        this.tokenContract = new ethers.Contract(
            this.config.token.deployedAddress,
            ERC20_ABI,
            this.tokenWallet
        );

        //Initialize reward distribution contract instance
        this.contract = new ethers.Contract(
            this.config.contract.deployedAddress,
            CONTRACT_ABI,
            this.contractWallet
        );

        // Initialize for each whitelist type
        const whitelistTypes: WhitelistType[] = [
            'lowBugBounty',
            'mediumBugBounty',
            'highBugBounty',
            'contractDeployment',
            'dappUsers'
        ];

        whitelistTypes.forEach(type => {
            this.providers[type] = provider;

        });
    }

    private async calculateTotalRewardAmount(type: WhitelistType): Promise<bigint> {
        console.log("we are here", type);
        const contract = this.contract;
        const addresses = this.config.validators[type].addresses;
        console.log(addresses, "addresses");
        const maxBps = BigInt(10000);

        // Fetch contract constants
        const totalSupply = BigInt(await contract.totalSupply());
        console.log(totalSupply.toString(), "totalSupply...");
        
        //calculate bugBountyAllocationPercetage
        const totalBugBountyAllocationPercentage = BigInt(await contract.BUG_BOUNTY_ALLOCATION_PERCENTAGE()); // 30% for total bug bounty

        const bugBountyAllocation = (totalSupply * totalBugBountyAllocationPercentage / maxBps)

        switch (type) {
            case 'lowBugBounty':
                console.log("NOW IN LOW BOUNTY");

                // Fetch constants
                const lowPercentage = BigInt(await contract.LOW_PERCENTAGE()); // 5% for low bug bounty
                const lowAddressCount = BigInt(addresses.length);

                console.log(
                    lowPercentage.toString(),
                    totalBugBountyAllocationPercentage.toString(),
                    "lowPercentage, bugBountyAllocationPercentage"
                );
                console.log(lowAddressCount.toString(), " addresses length in low bounty");

                if (lowAddressCount === BigInt(0)) {
                    throw new Error("No addresses found for lowBugBounty rewards.");
                }

                // 30% of total supply allocated for bug bounty
                
                console.log(bugBountyAllocation, "total bugbounty allocation");

                // Calculate the 5% allocation for low bug bounty (5% of the bug bounty allocation)
                const LowBugBountyAllocation = (bugBountyAllocation * lowPercentage) / maxBps;
                console.log(LowBugBountyAllocation, "low bug bounty allocation");

                return LowBugBountyAllocation;


            case 'mediumBugBounty':
                console.log("NOW IN medium BOUNTY");

                // Fetch constants
                const mediumPercentage = BigInt(await contract.MEDIUM_PERCENTAGE()); // 35% for low bug bounty
                const mediumAddressCount = BigInt(addresses.length);

                console.log(
                    mediumPercentage.toString(),
                    totalBugBountyAllocationPercentage.toString(),
                    "mediumPercentage, bugBountyAllocationPercentage"
                );
                console.log(mediumAddressCount.toString(), " addresses length in medium bounty");

                if (mediumAddressCount === BigInt(0)) {
                    throw new Error("No addresses found for lowBugBounty rewards.");
                }

                // 30% of total supply allocated for bug bounty
                
                console.log(bugBountyAllocation, "total bugbounty allocation");

                // Calculate the 5% allocation for low bug bounty (5% of the bug bounty allocation)
                const mediumBugBountyAllocation = (bugBountyAllocation * mediumPercentage) / maxBps;
                console.log(mediumBugBountyAllocation, "medium bug bounty allocation");

                return mediumBugBountyAllocation;

            case 'highBugBounty':
                console.log("NOW IN High BOUNTY");

                // Fetch constants
                const highPercentage = BigInt(await contract.HIGH_PERCENTAGE()); // 60% for low bug bounty
                const highAddressCount = BigInt(addresses.length);

                console.log(
                    highPercentage.toString(),
                    totalBugBountyAllocationPercentage.toString(),
                    "highPercentage, bugBountyAllocationPercentage"
                );
                console.log(highAddressCount.toString(), " addresses length in high bounty");

                if (highAddressCount === BigInt(0)) {
                    throw new Error("No addresses found for lowBugBounty rewards.");
                }

                // 30% of total supply allocated for bug bounty
                
                console.log(bugBountyAllocation, "total bugbounty allocation");

                // Calculate the 5% allocation for low bug bounty (5% of the bug bounty allocation)
                const highBugBountyAllocation = (bugBountyAllocation * highPercentage) / maxBps;
                console.log(highBugBountyAllocation, "high bug bounty allocation");

                return highBugBountyAllocation;

            case 'contractDeployment':
                console.log("NOW IN CONTRACT DEVELOPMENT");
                const deployAllocationPercentage = BigInt(await contract.DAPP_REWARD_ALLOCATION_PERCENTAGE()); //2% of total allocation
                console.log(deployAllocationPercentage.toString(), "deploy Allocation Percentage");

                const deploymentAddressCount = BigInt(addresses.length);
                console.log(deploymentAddressCount.toString(), " addresses length in deployment bounty");

                if (deploymentAddressCount === BigInt(0)) {
                    throw new Error("No addresses found for deployment rewards.");
                }

                // Calculate reward for contract deployment
                return (
                    totalSupply * deployAllocationPercentage / maxBps
                );

            case 'dappUsers':
                console.log("NOW IN CONTRACT dApp USERS");
                const dappAllocationPercentage = BigInt(await contract.DEVELOPER_REWARD_ALLOCATION_PERCENTAGE()); //1% of total supply
                const monthlyDappReward = BigInt(await contract.MONTHLY_DAPP_REWARD());
                const monthlyUptimeBonus = BigInt(await contract.MONTHLY_UPTIME_BONUS());

                // Calculate total reward per user (including potential uptime bonus)
                // const baseReward = monthlyDappReward * BigInt(addresses.length);
                // const uptimeBonusTotal = monthlyUptimeBonus * BigInt(
                //     this.config.validators.dappUsers.uptimeStatus?.filter(status => status).length || 0
                // );
                // console.log({ uptimeBonusTotal, baseReward }, " uptimeBonusTotal, baseReward");

                // return baseReward + uptimeBonusTotal;

                const dappAddressCount = BigInt(addresses.length);
                console.log(dappAddressCount.toString(), " addresses length in dapp bounty");

                if (dappAddressCount === BigInt(0)) {
                    throw new Error("No addresses found for deployment rewards.");
                }

                return (
                    totalSupply * dappAllocationPercentage / maxBps
                );


            default:
                throw new Error(`Unsupported whitelist type: ${type}`);
        }
    }

    
    private async transferTokensToContract(type: WhitelistType) {
        console.log("we are here again...", type)
        const tokenContract = this.tokenContract;
        // const wallet = this.wallets[type];
        // console.log({ tokenContract, wallet }, "tokenContract, wallet ")

        // Calculate total reward amount
        const rewardAmount = await this.calculateTotalRewardAmount(type);
        // console.log(rewardAmount.toString(), "reward Amount")

        // Check wallet balance
        const balance = await tokenContract.balanceOf(this.tokenWallet.address);
        console.log(balance.toString(), "balance in token wallet");

        if (BigInt(balance) <= BigInt(rewardAmount)) {
            throw new Error(`Insufficient token balance for ${type}`);
        }

        // // Approve and transfer tokens to contract
        // const approveTx = await tokenContract.approve(this.config.contractAddress, rewardAmount);
        // await approveTx.wait();

        //transfer tokens to contract
        const transferTx = await tokenContract.transfer(this.contractWallet.address, rewardAmount);
        await transferTx.wait();
        
        console.log(`transfered ${ethers.formatEther(rewardAmount)} tokens for ${type}`);

        const remainingTokenBalance = await tokenContract.balanceOf(this.tokenWallet.address);
        console.log(remainingTokenBalance.toString(), "remaining balance in token wallet");
        
        const contractBalance = await tokenContract.balanceOf(this.contractWallet.address);
        console.log(contractBalance.toString(), "balance in contract wallet");

    }

    public async whitelistAddresses() {
        try {
            // Low Bug Bounty Users
            await this.transferTokensToContract('lowBugBounty');
            await this.contract.registerLowBugBountyUsers(
                this.config.validators.lowBugBounty.addresses
            );

            // Medium Bug Bounty Users
            await this.transferTokensToContract('mediumBugBounty');
            await this.contract.registerMediumBugBountyUsers(
                this.config.validators.mediumBugBounty.addresses
            );

            // High Bug Bounty Users
            await this.transferTokensToContract('highBugBounty');
            await this.contract.registerHighBugBountyUsers(
                this.config.validators.highBugBounty.addresses
            );

            // Contract Deployment Users
            await this.transferTokensToContract('contractDeployment');
            await this.contract.registerContractDeploymentUsers(
                this.config.validators.contractDeployment.addresses
            );

            // Dapp Users
            await this.transferTokensToContract('dappUsers');
            await this.contract.registerDappUsers(
                this.config.validators.dappUsers.addresses,
                this.config.validators.dappUsers.uptimeStatus || []
            );

            console.log('All addresses whitelisted successfully!');
        } catch (error) {
            console.error('Whitelisting failed:', error);
        }
    }
}

// Main execution
async function main() {
    const configPath = path.join(__dirname, 'whitelistedAddress.json');
    const whitelistManager = new WhitelistManager(configPath);
    await whitelistManager.whitelistAddresses();
}

main().catch(console.error);

