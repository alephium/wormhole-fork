# Wait for node to start
ALEPHIUM_HOST=${1:-localhost}

while ! /bin/netcat -z $ALEPHIUM_HOST 22973; do
  sleep 1
done

cd /alephium
npm run build
npm run auto-mine
