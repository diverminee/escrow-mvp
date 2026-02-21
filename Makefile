.PHONY: build test test-v snapshot fmt clean deploy-local deploy-sepolia

build:
	forge build

test:
	forge test

test-v:
	forge test -vvv

snapshot:
	forge snapshot

fmt:
	forge fmt

clean:
	rm -rf out/ cache/ broadcast/

deploy-local:
	forge script script/DeployCredence.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

deploy-sepolia:
	forge script script/DeployCredence.s.sol --rpc-url $${SEPOLIA_RPC_URL} --broadcast --verify
