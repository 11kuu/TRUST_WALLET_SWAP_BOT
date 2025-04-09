const Web3 = require('web3');
const { toBN, toWei, fromWei } = Web3.utils;
const web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org/'));

const UNISWAP_ROUTER = web3.utils.toChecksumAddress('0x10ED43C718714eb63d5aA57B78B54704E256024E');
const BLEND_TOKEN = web3.utils.toChecksumAddress('0xda52b818c1348bFee27989E2a0DF39224A3E52fA');
const USDT_TOKEN = web3.utils.toChecksumAddress('0x55d398326f99059ff775485246999027b3197955'); 
const WBNB = web3.utils.toChecksumAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');

const PRIVATE_KEY = '';
const walletAddress = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY).address;

const ROUTER_ABI = [
    {
        "constant": false,
        "inputs": [
            { "name": "amountIn", "type": "uint256" },
            { "name": "amountOutMin", "type": "uint256" },
            { "name": "path", "type": "address[]" },
            { "name": "to", "type": "address" },
            { "name": "deadline", "type": "uint256" }
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{ "name": "", "type": "uint256[]" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const routerContract = new web3.eth.Contract(ROUTER_ABI, UNISWAP_ROUTER);

async function getNonce() {
    return await web3.eth.getTransactionCount(walletAddress, 'pending');
}

async function getGasPrices() {
    const baseFee = await web3.eth.getGasPrice();
    const priorityFee = toWei('10', 'gwei');
    return [toBN(baseFee).add(toBN(priorityFee)), priorityFee];
}

async function checkBalance() {
    const balance = await web3.eth.getBalance(walletAddress);
    console.log(`Saldo da conta: ${fromWei(balance, 'ether')} BNB`);
}

async function checkBlendBalance() {
    const tokenAbi = [{
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }];
    const blendContract = new web3.eth.Contract(tokenAbi, BLEND_TOKEN);
    const balance = await blendContract.methods.balanceOf(walletAddress).call();
    console.log(`Saldo de BLEND: ${fromWei(balance, 'ether')} BLEND`);
}

async function approveBlend() {
    const tokenAbi = [{
        "constant": false,
        "inputs": [{ "name": "spender", "type": "address" }, { "name": "value", "type": "uint256" }],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }];
    const tokenContract = new web3.eth.Contract(tokenAbi, BLEND_TOKEN);
    const maxApproval = toWei('20000', 'ether');
    const [maxFee, priorityFee] = await getGasPrices();

    const tx = tokenContract.methods.approve(UNISWAP_ROUTER, maxApproval).buildTransaction({
        from: walletAddress,
        gas: 100000,
        maxPriorityFeePerGas: priorityFee,
        maxFeePerGas: maxFee,
        nonce: await getNonce(),
    });

    const signPromise = web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
    signPromise.then(async (signedTxn) => {
        const txHash = await web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
        console.log(`Aprovação realizada! Tx Hash: ${txHash}`);
    }).catch((error) => {
        console.error('Erro ao aprovar: ', error);
    });
}

async function swapBlendToUsdt(amountInWei) {
    const slippage = 0.15;
    const amountOutMin = Math.floor(amountInWei * (1 - slippage));
    const deadline = Math.floor(Date.now() / 1000) + 300; // Corrigido aqui
    const path = [BLEND_TOKEN, USDT_TOKEN]; // Caminho atualizado para USDT
    const [maxFee, priorityFee] = await getGasPrices();

    try {
        const tx = routerContract.methods.swapExactTokensForTokens(
            amountInWei, amountOutMin, path, walletAddress, deadline
        ).buildTransaction({
            from: walletAddress,
            gas: 250000,
            maxPriorityFeePerGas: priorityFee,
            maxFeePerGas: maxFee,
            nonce: await getNonce(),
        });

        const signPromise = web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
        signPromise.then(async (signedTxn) => {
            const txHash = await web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
            console.log(`Swap realizado! Tx Hash: ${txHash}`);
        }).catch((error) => {
            console.error('Erro ao realizar o swap: ', error);
        });
    } catch (error) {
        console.error(`Erro ao realizar o swap: ${error}`);
    }
}

(async () => {
    await checkBalance();
    await checkBlendBalance();
    await approveBlend();

    setInterval(async () => {
        console.log('Realizando swap de 20.000 BLEND para USDT...');
        await swapBlendToUsdt(toWei('20000', 'ether'));
        console.log('Aguardando 3 minutos para o próximo swap...');
    }, 180000);
})();