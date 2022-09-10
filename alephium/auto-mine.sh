# Wait for node to start
ALEPHIUM_HOST=${1:-localhost}

while ! nc -z $ALEPHIUM_HOST 22973; do
  echo "Waiting" $ALEPHIUM_HOST "to be up"
  sleep 1
done

cd /app
npm run auto-mine
