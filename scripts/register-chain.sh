#!/bin/bash

set -euo pipefail

NEXT_SEQUENCE=`/guardiand admin get-next-governance-vaa-sequence --socket /tmp/admin.sock | sed 's/the next governance vaa sequence is //'`

TEMPLATE_FILE=/tmp/register-chain-vaa.template

/guardiand template token-bridge-register-chain --idx=0 --new-address 0000000000000000000000004722495183669f1b85d8A2dFA2C6F5dd8FA627b4 --module TokenBridge --chain-id 2 > $TEMPLATE_FILE

sed -i "s/sequence: [[:digit:]]\+/sequence: $NEXT_SEQUENCE/" $TEMPLATE_FILE

echo "Template:"
cat $TEMPLATE_FILE
echo

/guardiand admin governance-vaa-verify $TEMPLATE_FILE

# Yes or no
read -p "Inject the VAA? [y/n] " -n 1 -r
echo
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
  /guardiand admin governance-vaa-inject $TEMPLATE_FILE --socket /tmp/admin.sock
fi
