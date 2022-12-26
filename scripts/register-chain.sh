#!/bin/bash

set -euo pipefail

NEXT_SEQUENCE=`/guardiand admin get-next-governance-vaa-sequence --socket /tmp/admin.sock | sed 's/the next governance vaa sequence is //'`

TEMPLATE_FILE=/tmp/register-chain-vaa.template

# Register ETH to Alephium on testnet
/guardiand template token-bridge-register-chain --idx=0 --new-address 000000000000000000000000b4d3cbd7BF0503eBFd34637C43B8b6E836611204 --module TokenBridge --chain-id 2 > $TEMPLATE_FILE
# Register ALELPHIUM to ETH on testnet
# /guardiand template token-bridge-register-chain --idx=0 --new-address dcfd296d3934726fae0d441329cad9503eed56c50829adee070cb721d8e4f726 --module TokenBridge --chain-id 255 > $TEMPLATE_FILE

sed -i "s/sequence: [[:digit:]]\+/sequence: $NEXT_SEQUENCE/" $TEMPLATE_FILE

echo "Template:"
cat $TEMPLATE_FILE
echo

#/guardiand admin governance-vaa-verify $TEMPLATE_FILE
#
## Yes or no
#read -p "Inject the VAA? [y/n] " -n 1 -r
#echo
#echo
#if [[ $REPLY =~ ^[Yy]$ ]]
#then
#  /guardiand admin governance-vaa-inject $TEMPLATE_FILE --socket /tmp/admin.sock
#fi
