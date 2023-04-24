#!/usr/bin/env bash

SECONDS=0
until [[ `docker container inspect -f '{{.State.Running}}' docker_devnet-init_1` = 'false' ]]
do
  if (( SECONDS > 180 ))
  then
     echo "Devnet does not start after 3 min..."
     exit 1
  fi
  echo "Waiting..."
  sleep 5
done
