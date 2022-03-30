import { transferNativeCode, completeTransferNativeCode, transferWrappedCode, completeTransferWrappedCode, attestTokenCode } from '../token_bridge'

describe('test transfer', () => {
    const contractAddress = '2A84hPgNsaNWrRbpXkbQmy793ChJRPFPZauWiXUPMczg4'
    const toAddress = '0d0F183465284CB5cb426902445860456ed59b34'.padStart(64, '0')
    const tokenId = 'wKz8pbMgAnvtAcapAyT4D5GT4H9RvaBLYuUYGYhyo4b7'
    const sender = '12LgGdbjE6EtnTKw5gdBwV2RRXuXPtzYM7SDZ45YJTRht'
    const arbiter = sender
    const nonceHex = '208b9ef7'
    const vaa = '2abace7db3f82629373393b7bd61d8bfd70d6f661aa05d76538a66661166cea76e3e7b619f028d006b9989759122aea7bc6e2e175e574502f33630ade6b8a2053ada456b6893f833a54d092a88f205d1ddcec7eee46d2e50d183c865bbc41640897a0e9fc188fbeb393a381509848d7c120bbd47cc091819fa7fc0a33eb096cd03545f15d581a1984e77a141675463c8520a7da36016baf33c65064ac3b30068862c34e3022c6d01aa302aded024d5cb286d10612b6de883bc176aca2cfda3084db317fe44cce70cda64fd9cc3b86f65f5ba57455b88a1acfa70d5c32a21334d14783a2a3790fdec429f07222ef930fb271da38e8d6223a71bd420f29d908123fde5b373fcf6d3a73a2e24bad59395df7c4fcfa80fdff7a0318a8afc9357f410210a222b4182e6bb03cc79309b28d54650f96f926fa382ab'
    const tokenAmount = BigInt("1000000000000000000")
    const messageFee = BigInt("100000000000000")
    const arbiterFee = messageFee
    const consistencyLevel = 1

    it('should get transfer native token code', () => {
        const bytecode = transferNativeCode(
            contractAddress, sender, tokenId, toAddress, tokenAmount,
            messageFee, arbiterFee, nonceHex, consistencyLevel
        )
        expect(bytecode.toLowerCase()).toEqual('01010100040018150013e61fdce36f2910229ad91ef7ae8b17cfe58c2e4f0d04917f8d17521b696da31700144020273426b1f2876726828352cde1a9ce3d89ee09281fe9fa7f89464b7db8eab316170113c40de0b6b3a76400001702160013c25af3107a4000a2160016011602a3144020e54e44ee1d76011f61b9858c2f558b3134752b25c08f636da6e42db67a36a1151703160116001440200000000000000000000000000d0f183465284cb5cb426902445860456ed59b34160213c25af3107a40001404208b9ef70d16030105')
    })

    it('should get complete transfer native token code', () => {
        const bytecode = completeTransferNativeCode(contractAddress, vaa, arbiter)
        expect(bytecode.toLowerCase()).toEqual('01010100010006144020e54e44ee1d76011f61b9858c2f558b3134752b25c08f636da6e42db67a36a11517001441382abace7db3f82629373393b7bd61d8bfd70d6f661aa05d76538a66661166cea76e3e7b619f028d006b9989759122aea7bc6e2e175e574502f33630ade6b8a2053ada456b6893f833a54d092a88f205d1ddcec7eee46d2e50d183c865bbc41640897a0e9fc188fbeb393a381509848d7c120bbd47cc091819fa7fc0a33eb096cd03545f15d581a1984e77a141675463c8520a7da36016baf33c65064ac3b30068862c34e3022c6d01aa302aded024d5cb286d10612b6de883bc176aca2cfda3084db317fe44cce70cda64fd9cc3b86f65f5ba57455b88a1acfa70d5c32a21334d14783a2a3790fdec429f07222ef930fb271da38e8d6223a71bd420f29d908123fde5b373fcf6d3a73a2e24bad59395df7c4fcfa80fdff7a0318a8afc9357f410210a222b4182e6bb03cc79309b28d54650f96f926fa382ab150013e61fdce36f2910229ad91ef7ae8b17cfe58c2e4f0d04917f8d17521b696da316000108')
    })

    it('should get transfer wrapped token code', () => {
        const bytecode = transferWrappedCode(
            contractAddress, sender, toAddress, tokenAmount,
            messageFee, arbiterFee, nonceHex, consistencyLevel
        )
        expect(bytecode.toLowerCase()).toEqual('01010100040017150013e61fdce36f2910229ad91ef7ae8b17cfe58c2e4f0d04917f8d17521b696da31700144020e54e44ee1d76011f61b9858c2f558b3134752b25c08f636da6e42db67a36a115170113c40de0b6b3a76400001702160013c25af3107a4000a2160016011602a31601170316001440200000000000000000000000000d0f183465284cb5cb426902445860456ed59b34160213c25af3107a40001404208b9ef70d16030100')
    })

    it('should get complete transfer wrapped token code', () => {
        const bytecode = completeTransferWrappedCode(contractAddress, vaa, arbiter)
        expect(bytecode.toLowerCase()).toEqual('01010100010006144020e54e44ee1d76011f61b9858c2f558b3134752b25c08f636da6e42db67a36a11517001441382abace7db3f82629373393b7bd61d8bfd70d6f661aa05d76538a66661166cea76e3e7b619f028d006b9989759122aea7bc6e2e175e574502f33630ade6b8a2053ada456b6893f833a54d092a88f205d1ddcec7eee46d2e50d183c865bbc41640897a0e9fc188fbeb393a381509848d7c120bbd47cc091819fa7fc0a33eb096cd03545f15d581a1984e77a141675463c8520a7da36016baf33c65064ac3b30068862c34e3022c6d01aa302aded024d5cb286d10612b6de883bc176aca2cfda3084db317fe44cce70cda64fd9cc3b86f65f5ba57455b88a1acfa70d5c32a21334d14783a2a3790fdec429f07222ef930fb271da38e8d6223a71bd420f29d908123fde5b373fcf6d3a73a2e24bad59395df7c4fcfa80fdff7a0318a8afc9357f410210a222b4182e6bb03cc79309b28d54650f96f926fa382ab150013e61fdce36f2910229ad91ef7ae8b17cfe58c2e4f0d04917f8d17521b696da316000101')
    })

    it('should get attest token code', () => {
        const bytecode = attestTokenCode(contractAddress, tokenId, sender, messageFee, nonceHex, consistencyLevel)
        expect(bytecode.toLowerCase()).toEqual('0101010002000d150013e61fdce36f2910229ad91ef7ae8b17cfe58c2e4f0d04917f8d17521b696da31700160013c25af3107a4000a2144020e54e44ee1d76011f61b9858c2f558b3134752b25c08f636da6e42db67a36a11517011600144020273426b1f2876726828352cde1a9ce3d89ee09281fe9fa7f89464b7db8eab3161404208b9ef70d16010108')
    })
})
