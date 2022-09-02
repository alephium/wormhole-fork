# Wait for node to start
while ! /bin/netcat -z localhost 22973; do
  sleep 1
done

cd /alephium
npm run build
npx ts-node deploy.ts -n devnet
