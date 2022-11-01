#!/usr/bin/env bash

SECONDS=0
until [[ `docker container inspect -f '{{.State.Running}}' docker-eth-devnet-deploy-contracts-1` = 'false' ]]
do
  if (( SECONDS > 120 ))
  then
     echo "ETH contracts are not deployed after 2 min..."
     exit 1
  fi
  echo "Waiting..."
  sleep 5
done
