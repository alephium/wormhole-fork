# Wait for node to start
ALEPHIUM_HOST=${1:-localhost}

while ! nc -z $ALEPHIUM_HOST 22973; do
  echo "Waiting" $ALEPHIUM_HOST "to be up"
  sleep 1
done

cd /app
# Should automatically deploy contracts
# npm run compile-contracts && MINIMAL_CONSISTENCY_LEVEL=1 npm run deploy:devnet
npm run auto-mine -- http://alephium:22973
