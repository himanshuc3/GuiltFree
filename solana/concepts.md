## Concepts

### Blockchain concepts

- Internet::communication -> blockchain::trust
- Satoshi nakamoto invented bitcoin, but also didn't he invent blockchain which is the underlying technology used to implement it?
- Blockchain -> literally list of blocks where each block contains a list of transactions called a ledger
- Distributed & decentralized ledger: All nodes in the blockchain contain the same chain
- Applications:
  - Product tracking: every product has its history from the source to current state
  - Decentralized data sharing means a level above cloud, since cloud is distributed but centralized
- Smart contract:
  - Implements custom business constraints for marking valid transactions
- International wire transfer:
  - B2B transfers (bank to bank :)
  - Time consuming
  - Huge brokerage fees
- Hashing algorithm:
  - A block contains block number, data, prev hash, hash etc.
  - Hash can be generated via SHA-256, RSA or from a wide range of algorithm
  - First block is called genesis block, a buzzword for interviews.
  - Five requirements of algoritm: one-way, deterministic (aur features batai hi nahi video mai)
- Immutable ledger:
  - Changing any data, changes the hash of the block, therefore corrupting the chain and therefore it is rejected. But what about changing data of the last block, since no other block references it.
- P2P network:
  - Torrents work on this afaik.
  - The added blocks are propagated across a network by p2p communication.
  - The blockchain, to stay healthy, have to follow majority consensus.
- Blockchain mining:
  - Transaction will go to mempool
  - Miners pick a transaction from mempool
  - A miner who produces Proof of work, communicates with other miners in the network to verify it is correct and the miner is given a reward for adding a block. Again, a futile use of resources on a large scale.
- Byzantine generals problem (distributed computing):
  - 1 defaulter with 3 majority
  - Majority is followed
- How byzantine generals problem works in blockchain:
  - Consensus protocol: POW, POS etc.
  - Mining takes a lot of compute resources and electricity consumption.
  - Solving the problem takes a lot of time, but verifying the solution is easy. P, NP space of problems as an example or solving vs verifying rubik's cube
  - If we have 2 contending different blockchains, the longest blockchain wins and overrides the other one.
  - Consensus protocol is better than BGP since it only requires 51% majority (but isn't it very naive as well)
  - All the transactions in the orphan block will be blocked

### Cryptocurrency

- Bitcoin:
  - Powered by blockchain
  - It is a protocol
  - Bitcoin doesn't have any tokens (which are different from coins)
  - Nodes, miner, large miners, mining pool
  - Monetary policy:
    - The halving: every 210k transacitions, bitcoin value will reduce, so only 21M bitcoins total.
    - block frequency: 10 minutes to create a new block
- How mining works (Nonce):
  - Transaction -> solve mathematical problem -> miner solved problem first -> miners verify the validy -> block added
  - The mathematical problem is to generate the hash for the block which has some constraints
  - We keep changing the value of nonce which is an input into the mathematical problem to reach and satisfy constraints of the hash value
  - Target: a number used in mining, hash must be below it, adjusts every 2016 blocks (Example target is start hash with 4 '0')
  - Hexadecimal numbers are used in the hashes
  - CPU vs GPU vs ASCIs
- Mining pools:
  - Would be assymetric based on computation power
  - Miners can aggregate in a network to coallesce and form a single entity with higher computation power combined
  - In an coalition, the reward is divided based on the computation power of a single node
- Nonce range:
  - There is not enough nonce range to generate valid hash since hash is 16*64 (~10^7) whereas nonce is 32 bit (~4*10^9)
  - A modest mines does 10^8 hashes/sec, so nonce range will be covered in ~40 seconds
  - Timestamp is also included as a variable to generate a new hash and therefore more of the subset of hash range could be covered
  - According to the actual power of machines, hashes based on nonce can be exhausted without the timestamp even changing (sec precision). So, the miners are idling, if we follow this model.
  - Solution: mempool. It has all the transactions available which needs to be put in the block, which leads to even more hashes that could be generated in that one sec. So we never run out of hashes to generate within a second.
  - Miners and nodes are different in the network

- Transaction and UTXOs:
  - UTXO: unspend transactions have a breakdown, where the input BTC would be split between the actual payment and brokerage fees for mining.
  - Transaction fees

- Cryptocurrency wallets:
  - Derived value from unused transactions

- Private and public key:
  - Useful to protect against frauds like farji transactions
  - Private key + message -> signature
  - Public key is used for verifying the signature on the message is from a particular user
  - Bitcoin address is derived through public key and that is shared as an extra layer of security

- Segregated witness
  - blocks are usually capped at 1MB size
  - The most amount of space required in a transaction is taken by signature and public key for verification
  - Due to heavy usage of blockchain, 1MB space for a block created network congestion
  - We segregated the above 2 verifying values from the transaction block, so block can have more transactions

- Heiracrchical deterministic wallet:
  - A pattern can be established to target users where a particular address is making a lot of transactions
  - Fraudsters/scammers can target that particular address or that physical entity itself
  - New pattern: Master private key -> PrivateK#1 -> PublicK#1 -> Address#1 of wallet

### Ethereum

- Open-source blockchain-based platform (follows a custom protocol)
- Ethereum nodes:
  - Types of nodes: full, light and archive
  - Light node:
    - not enough computational power
    - only used for transactions
    - depends on full node
    - stores only block header
  - Archive:
    - Stores everything kept in the full nodeand built an archive of historical data
    - Requires terabyes of diskspace
- Ethereum accounts:
  - an antity with an ether balance that can send or receive transactions on ethereum
  - Types of account: Ethernally owned account & contract account
  - EOA: Wallet is linked to EOA, private key used to open this wallet, send/receive transaction, smart contract interaction
  - Contract account:
    - controlled by smart code
    - No private or public key is needed
    - Gas is associated
- Smart contract
  - program
  - blockchain is immutable
  - Kept on ethereum block
  - Bitcoin uses bitcoin script (not turing complete) but solidity on ethereum (turing complete)
  - A person who wants to run something on the eth chain, pays for it in gas
  - Each node has the following: current state of all smart contracts, history of both transaction and contract
- Dapps:
  - smart contract + frontend
  - Trustworthy
  - No censorship
  - They pay (how does this even work???)
  - Can never go down
- EVM (ethereum virtual machine)
  - Provides a sandbox environment for running programs and preventing from virus
- Ethereum gas:
  - To run smart contract, gas is required (but isn't it similar to pay-as-you-go server deployment)
  - Each logical operation takes some value: multiplcation - 5, subtraction/equal - 3
  - Any transaction that modifies the blockchain costs gas.
  - The user that generated the transaction pays for the gas.
- Ethereum gas price:
  - Amount the sender wants to pay per unit of gas to get the transaction mined. gasPrice is set by the sender.
  - Gas prices are denoted in gwei (1 gwei = 10^-9 ETH)
  - The higher the gas price the faster the transaction will be mined, similar to transaction fees in bitcoin
  - Gas limit: maximum gas the transaction can consume, used as a way of preventign against attacks like ddos
- DAO (Decentralized autonomous organization)
  - Org working on Smart contracts which seems like the most stupid idea i've ever heard of
  - Fully democratized
  - Voting required
  - Services offered are handled automatically
  - All activity is transparent
  - NGO can be built as a smart contract, which publically reveals what would be done with incoming donations and automatically handled
- The DAO (name of an org) attack
  - user gives ether to the DAO, the DAO gives back DAO tokens
  - The DAO was a platform for people to invest in startups
  - The DAO gives an investment proposal and the folks interested can use the DAO tokens to vote for the proposal
  - The DAO is attacked using a vulnerability in the program'
  - Hard fork was accepted as a solution to the vulnerability: chains splitting in ethereum classic and ethereum
- Hard fork:
  - 1919999 block was the point of split
  - During a hard fork, software implementing a protocol and its mining procedures is upgraded
  - One a user upgrades their software, that version rejects all tranasactions from older software, effectively creatign a new breanch of the blockchain.
  - However, those users who retain the old software continue to process transactions (why is it heading towards centralization again, here we go again)
  - Happened in Bitcoin also, in block, 476768, because of segwit: split in bitcoin and bitcoin cash
- Soft fork:
  - Changes to the protocol, but the end product remains unchanged
  - Backward-compatible, meaning upgraded nodes can still communicate with the non-upgraded ones
- ICO:
  - Like IPO
  - Give bitcoin/ether in exchange for tokens, instead of equity
- Ethereum 2.0 / Serenity
  - Scalability, Security and sustainability
  - Upgrades: POS for consensus, sharding
  - POS
    - Validator instead of miner
    - Validator needs to deposit some minimum ETH, put as stake
    - Then, does similar work as miner
    - System selects a validator, preventing redundant work, at random, with probability of selection directly proportional to ETH at stake
    - Mobile or laptop are enough is enough to hash a block and computation power is not the currency
- Sharding:
  - Network latency for verifying the mined block is correct, since shared with everyone
  - Split the chain into multiple sub-chains which is easier to verify and validate\
  - Transactions per second increase
  - powerful and expensive computers will not be needed
  - More validators with join
  - Beacon chain + ethereum mainnet + shard chain
- Alt coins:
  - Anything not bitcoin, almost like distros in linux

Example:
A wants to send -> B (2 ETH)
What will be the total fees
A sets the gas price per unit = 100 gwei
Transaction gas limit = 21000 units
Total fees will be: gas units(limit)*gasprice per unit
Total fee will be: 21000*100 = 2,100,000 gwei

Case 2: When gas transaction limit requirement was 21000 units
A sets limit = 20000 units
Transaction fails
The gas wouldn't be returned since it's transferred to the miner anyway

Case 3: If limit is above actual consumption
The remaining gas is returned

- Wallet: Main wallet holds SOL and Token accounts are 1:1 mapped for each token type.

- NFT: tokens which are unique, not interchangeable, collectibles
  - Minting, owning, storing
  - Low costs for fees, fast transactions, compressed NFTs
  - Metaplex program

- Types of wallets:
  - Hot wallets: like current accounts
  - Hardware wallets: Maximum security, long-term storage
  - Multi-signature wallets: shared funds, extra security

[Paper: https://www.henrylab.net/wp-content/uploads/2017/10/blockchain.pdf]

- Blockchain: decentralization, persistency, anonymity, auditability
  - Buzzwords: cryptographic hash, digital signature (based
    on asymmetric cryptography) and distributed consensus mechanism
  - Applications: Smart contracts (Kosba et al., 2016), public services (Akins et al., 2013), internet of
    things (IoT) (Zhang and Wen, 2015), reputation systems (Sharples and Domingue, 2015)
    and security services (Noyes, 2016a)
  - For example, PoW wastes too much
    electricity energy while the phenomenon that the rich get richer could appear in the PoS
    consensus process.
  - A block consists of the block header and the block body as shown in Figure 2. In particular,
    the block header includes:
    • Block version: indicates which set of block validation rules to follow.
    • Parent block hash: a 256-bit hash value that points to the previous block.
    • Merkle tree root hash: the hash value of all the transactions in the block.
    • Timestamp: current timestamp as seconds since 1970-01-01T00:00 UTC.
    • nBits: current hashing target in a compact format.
    • Nonce: a 4-byte field, which usually starts with 0 and increase
  - digital signature algorithms used in blockchains include elliptic curve
    digital signature algorithm
  - public blockchain, private blockchain and consortium blockchain

### Questions?

- Redundancy is high
- Network latency would increase considerably?
