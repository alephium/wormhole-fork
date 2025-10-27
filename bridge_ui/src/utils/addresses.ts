export function shortenAddress(address: string) {
  return address.length > 10
    ? `${address.slice(0, address.startsWith('0x') ? 6 : 4)}...${address.slice(-4)}`
    : address;
}
