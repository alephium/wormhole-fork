# Wait for node to start
while ! /bin/netcat -z localhost 12973; do
  sleep 1
done

cd /alephium
npm run compile
node dist/devnet/deploy.js 12973
