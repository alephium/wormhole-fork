#!/bin/bash
rm -rf node_modules
npm install

rm -rf node_modules/@alephium/cli
rm -rf node_modules/@alephium/web3
rm -rf node_modules/@alephium/web3-wallet

cd node_modules/@alephium
cp -R /Users/muchen/Desktop/workspace/alephium-web3/packages/cli .
cp -R /Users/muchen/Desktop/workspace/alephium-web3/packages/web3 .
cp -R /Users/muchen/Desktop/workspace/alephium-web3/packages/web3-wallet .
cd ../..
