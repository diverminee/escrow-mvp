.PHONY: build test test-v snapshot fmt clean deploy-local deploy-sepolia deploy-chainlink sync-abi sync-env build-web dev-web

build:
	forge build

test:
	forge test

test-v:
	forge test -vvv

test-deploy:
	forge test --match-path test/DeployCredenceTest.t.sol -vvv

snapshot:
	forge snapshot

fmt:
	forge fmt

clean:
	rm -rf out/ cache/ broadcast/ .env.deployed

deploy-local:
	forge script script/DeployCredence.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

deploy-sepolia:
	forge script script/DeployCredence.s.sol --rpc-url $${SEPOLIA_RPC_URL} --broadcast --verify

deploy-chainlink:
	USE_CHAINLINK_ORACLE=true forge script script/DeployCredence.s.sol --rpc-url $${SEPOLIA_RPC_URL} --broadcast --verify

# === Frontend Integration ===
ABI_SRC = out
ABI_DST = web/src/lib/contracts/abis
CONTRACTS = TradeInfraEscrow CredenceReceivable CentralizedTradeOracle ProtocolArbiterMultisig

sync-abi: build
	@mkdir -p $(ABI_DST)
	@for contract in $(CONTRACTS); do \
		node -e "const f=require('fs');const d=JSON.parse(f.readFileSync('$(ABI_SRC)/'+process.argv[1]+'.sol/'+process.argv[1]+'.json','utf8'));f.writeFileSync('$(ABI_DST)/'+process.argv[1]+'.json',JSON.stringify(d.abi,null,2))" $$contract; \
		echo "  Synced $$contract ABI"; \
	done
	@echo "ABI sync complete: $(ABI_DST)/"

sync-env:
	@echo "# Auto-generated from .env.deployed" > web/.env.local
	@grep ESCROW_ADDRESS .env.deployed | sed 's/^/NEXT_PUBLIC_/' >> web/.env.local
	@grep RECEIVABLE_ADDRESS .env.deployed | sed 's/^/NEXT_PUBLIC_/' >> web/.env.local
	@grep ORACLE_ADDRESS .env.deployed | sed 's/^/NEXT_PUBLIC_/' >> web/.env.local
	@echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=" >> web/.env.local
	@echo "NEXT_PUBLIC_DEFAULT_CHAIN_ID=31337" >> web/.env.local
	@echo "NEXT_PUBLIC_LOCALHOST_RPC_URL=http://127.0.0.1:8545" >> web/.env.local
	@echo "Wrote web/.env.local"

build-web: sync-abi
	cd web && pnpm build

dev-web:
	cd web && pnpm dev
