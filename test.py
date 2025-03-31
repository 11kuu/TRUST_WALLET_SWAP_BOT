import time
from web3 import Web3
import json
from web3.middleware import ExtraDataToPOAMiddleware

BSC_RPC_URL = "https://bsc-dataseed.binance.org/"
web3 = Web3(Web3.HTTPProvider(BSC_RPC_URL))
web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

# Endereços dos contratos
UNISWAP_ROUTER = web3.to_checksum_address("0x10ED43C718714eb63d5aA57B78B54704E256024E")
BLEND_TOKEN = web3.to_checksum_address("0xda52b818c1348bFee27989E2a0DF39224A3E52fA")
USDT_TOKEN = web3.to_checksum_address("0x55d398326f99059ff775485246999027b3197955")
WBNB = web3.to_checksum_address("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c")

# Chave privada e endereço da carteira
PRIVATE_KEY = ""
wallet_address = web3.eth.account.from_key(PRIVATE_KEY).address

# ABI atualizada do roteador, incluindo a função getAmountsOut
ROUTER_ABI = json.loads(
    '[{"constant":false,"inputs":[{"name":"amountIn","type":"uint256"},{"name":"amountOutMin","type":"uint256"},{"name":"path","type":"address[]"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"name":"swapExactTokensForTokens","outputs":[{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"nonpayable","type":"function"},'
    '{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},'
    '{"constant":true,"inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"}]'
)
router_contract = web3.eth.contract(address=UNISWAP_ROUTER, abi=ROUTER_ABI)

def get_nonce():
    return web3.eth.get_transaction_count(wallet_address, "pending")

def check_balance():
    balance = web3.eth.get_balance(wallet_address)
    print(f"Saldo da conta: {web3.from_wei(balance, 'ether')} BNB")

def check_blend_balance():
    token_abi = '[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}]'
    blend_contract = web3.eth.contract(address=BLEND_TOKEN, abi=json.loads(token_abi))
    balance = blend_contract.functions.balanceOf(wallet_address).call()
    print(f"Saldo de BLEND: {web3.from_wei(balance, 'ether')} BLEND")

def approve_blend():
    token_abi = '[{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]'
    token_contract = web3.eth.contract(address=BLEND_TOKEN, abi=json.loads(token_abi))
    max_approval = web3.to_wei(20000, "ether")
    tx = token_contract.functions.approve(UNISWAP_ROUTER, max_approval).build_transaction({
        "from": wallet_address,
        "gas": 100000,
        "gasPrice": web3.eth.gas_price,
        "nonce": get_nonce(),
    })
    signed_tx = web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
    print(f"Aprovação realizada! Tx Hash: {web3.to_hex(tx_hash)}")

def swap_blend_to_usdt(amount_in_wei):
    # Define a tolerância de slippage em 5%
    slippage = 0.05  
    deadline = web3.eth.get_block("latest")["timestamp"] + 300  # Prazo de 5 minutos
    # Define a rota de swap: BLEND -> WBNB -> USDT
    path = [BLEND_TOKEN, WBNB, USDT_TOKEN]
    
    try:
        # Simula a troca para obter a quantidade estimada de saída
        amounts = router_contract.functions.getAmountsOut(amount_in_wei, path).call()
        estimated_output = amounts[-1]
        amount_out_min = int(estimated_output * (1 - slippage))
        print(f"Quantidade de entrada: {amount_in_wei}")
        print(f"Quantidade estimada de saída: {estimated_output}")
        print(f"Quantidade mínima de saída (após {int(slippage*100)}% de slippage): {amount_out_min}")

        tx = router_contract.functions.swapExactTokensForTokens(
            amount_in_wei, amount_out_min, path, wallet_address, deadline
        ).build_transaction({
            "from": wallet_address,
            "gas": 250000,
            "gasPrice": web3.eth.gas_price,
            "nonce": get_nonce(),
        })
        signed_tx = web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"Swap realizado! Tx Hash: {web3.to_hex(tx_hash)}")
    except Exception as e:
        print(f"Erro ao realizar o swap: {str(e)}")

check_balance()
check_blend_balance()
approve_blend()

while True:
    print("Realizando swap de BLEND para USDT...")
    swap_blend_to_usdt(web3.to_wei(20000, "ether"))
    print("Aguardando 3 minutos para o próximo swap...")
    time.sleep(180)
