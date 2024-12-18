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
    contractAddress: string;
    tokenAddress: string;
    validators: {
        [key in WhitelistType]: {
            privateKey: string;
            addresses: string[];
            uptimeStatus?: boolean[]; // Only for dappUsers
        };
    };
}
class WhitelistManager {
    private providers: { [key in WhitelistType]: ethers.Provider };
    private wallets: { [key in WhitelistType]: ethers.Wallet };
    private contracts: { [key in WhitelistType]: ethers.Contract };
    private tokenContracts: { [key in WhitelistType]: ethers.Contract };
    private config: WhitelistConfig;
    constructor(configPath: string) {
        // Load configuration from JSON
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Initialize providers, wallets, and contracts for each whitelist type
        this.providers = {} as { [key in WhitelistType]: ethers.Provider };
        this.wallets = {} as { [key in WhitelistType]: ethers.Wallet };
        this.contracts = {} as { [key in WhitelistType]: ethers.Contract };
        this.tokenContracts = {} as { [key in WhitelistType]: ethers.Contract };
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
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
            this.wallets[type] = new ethers.Wallet(this.config.validators[type].privateKey, provider);
            // Initialize contract instances
            this.contracts[type] = new ethers.Contract(
                this.config.contractAddress,
                CONTRACT_ABI,
                this.wallets[type]
            );
            // Initialize token contract instances
            this.tokenContracts[type] = new ethers.Contract(
                this.config.tokenAddress,
                ERC20_ABI,
                this.wallets[type]
            );
        });
    }
    private async calculateTotalRewardAmount(type: WhitelistType): Promise<bigint> {
        console.log("we are here", type);
        const contract = this.contracts[type];
        const addresses = this.config.validators[type].addresses;
        console.log(addresses, "addresses")
        const maxBps = BigInt(10000);
        // Fetch contract constants
        const totalSupply = BigInt(await contract.totalSupply());
        console.log(totalSupply, "totalSupply...")
        switch (type) {
            case 'lowBugBounty':
                console.log("NOW IN LOW BOUNTY")
                const lowAllocationPercentage = BigInt(await contract.BUG_BOUNTY_ALLOCATION_PERCENTAGE());
                const lowPercentage = BigInt(await contract.LOW_PERCENTAGE());
                console.log(lowPercentage.toString(), lowAllocationPercentage.toString(), "lowPercentage, lowAllocationPercentage ")
                console.log(BigInt(addresses.length.toString()), " addresses length in low bounty")
                return (
                    (totalSupply * lowAllocationPercentage / maxBps) *
                    lowPercentage / BigInt(10000)
                );
            case 'mediumBugBounty':
                console.log("NOW IN MEDIUM BOUNTY")
                const mediumAllocationPercentage = BigInt(await contract.BUG_BOUNTY_ALLOCATION_PERCENTAGE());
                const mediumPercentage = BigInt(await contract.MEDIUM_PERCENTAGE());
                console.log({ mediumAllocationPercentage, mediumPercentage }, "mediumAllocationPercentage, mediumPercentage")
                console.log(BigInt(addresses.length.toString()), " addresses length in medium bounty")
                return (
                    (totalSupply * mediumAllocationPercentage / maxBps) *
                    mediumPercentage / BigInt(10000)
                );
            case 'highBugBounty':
                console.log("NOW IN HIGH BOUNTY")
                const highAllocationPercentage = BigInt(await contract.BUG_BOUNTY_ALLOCATION_PERCENTAGE());
                const highPercentage = BigInt(await contract.HIGH_PERCENTAGE());
                console.log(highAllocationPercentage.toString(), highPercentage.toString(), "highAllocationPercentage, highPercentage")
                console.log(BigInt(addresses.length.toString()), " addresses length in high bounty")
                return (
                    (totalSupply * highAllocationPercentage / maxBps) *
                    highPercentage / BigInt(10000)
                );
            case 'contractDeployment':
                console.log("NOW IN CONTRACT DEVELOPMENT")
                const devAllocationPercentage = BigInt(await contract.DEVELOPER_REWARD_ALLOCATION_PERCENTAGE());
                console.log(devAllocationPercentage, "dev Allocation Percentage")
                return (
                    totalSupply * devAllocationPercentage / maxBps
                );
            case 'dappUsers':
                console.log("NOW IN CONTRACT dApp USERSS")
                const dappAllocationPercentage = BigInt(await contract.DAPP_REWARD_ALLOCATION_PERCENTAGE());
                const monthlyDappReward = BigInt(await contract.MONTHLY_DAPP_REWARD());
                const monthlyUptimeBonus = BigInt(await contract.MONTHLY_UPTIME_BONUS());
                // Calculate total reward per user (including potential uptime bonus)
                const baseReward = monthlyDappReward * BigInt(addresses.length);
                const uptimeBonusTotal = monthlyUptimeBonus * BigInt(
                    this.config.validators.dappUsers.uptimeStatus?.filter(status => status).length || 0
                );
                console.log({ uptimeBonusTotal, baseReward }, " uptimeBonusTotal, baseReward")
                return baseReward + uptimeBonusTotal;
            default:
                throw new Error(`Unsupported whitelist type: ${type}`);
        }
    }
    private async transferTokensToContract(type: WhitelistType) {
        console.log("we are here again...", type)
        const tokenContract = this.tokenContracts[type];
        const wallet = this.wallets[type];
        console.log({ tokenContract, wallet }, "tokenContract, wallet ")
        // Calculate total reward amount
        const rewardAmount = await this.calculateTotalRewardAmount(type);
        console.log(rewardAmount.toString(), "reward Amount")
        // Check wallet balance
        const balance = await tokenContract.balanceOf(this.config.contractAddress);
        console.log(balance.toString(), "balance in transfer Tokens To Contract");
        if (BigInt(balance) <= BigInt(rewardAmount)) {
            throw new Error(`Insufficient token balance for ${type}`);
        }
        // Approve and transfer tokens to contract
        const approveTx = await tokenContract.approve(this.config.contractAddress, rewardAmount);
        await approveTx.wait();
        console.log(`Approved ${ethers.formatEther(rewardAmount)} tokens for ${type}`);
    }
    public async whitelistAddresses() {
        try {
            // Low Bug Bounty Users
            await this.transferTokensToContract('lowBugBounty');
            await this.contracts.lowBugBounty.registerLowBugBountyUsers(
                this.config.validators.lowBugBounty.addresses
            );
            // Medium Bug Bounty Users
            await this.transferTokensToContract('mediumBugBounty');
            await this.contracts.mediumBugBounty.registerMediumBugBountyUsers(
                this.config.validators.mediumBugBounty.addresses
            );
            // High Bug Bounty Users
            await this.transferTokensToContract('highBugBounty');
            await this.contracts.highBugBounty.registerHighBugBountyUsers(
                this.config.validators.highBugBounty.addresses
            );
            // Contract Deployment Users
            await this.transferTokensToContract('contractDeployment');
            await this.contracts.contractDeployment.registerContractDeploymentUsers(
                this.config.validators.contractDeployment.addresses
            );
            // Dapp Users
            await this.transferTokensToContract('dappUsers');
            await this.contracts.dappUsers.registerDappUsers(
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
