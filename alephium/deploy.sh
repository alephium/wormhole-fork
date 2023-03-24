# Wait for node to start
while ! /bin/netcat -z localhost 22973; do
  sleep 1
done

cd /alephium
npm run compile
npm run deploy:devnet
npm run auto-mine
