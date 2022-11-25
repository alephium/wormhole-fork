#!/usr/bin/env bash

SECONDS=0
until [[ `docker container inspect -f '{{.State.Running}}' docker_docker-devnet-init_1` = 'false' ]]
do
  if (( SECONDS > 120 ))
  then
     echo "Devnet does not start after 2 min..."
     exit 1
  fi
  echo "Waiting..."
  sleep 5
done
