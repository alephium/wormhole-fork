import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material'

import { arrayify, isHexString, zeroPad, hexlify, base64 } from "ethers/lib/utils";
import { Bech32, toHex, fromHex } from "@cosmjs/encoding"
import ExplorerSummary from './ExplorerSummary';

import { useNetworkContext } from '../../contexts/NetworkContext';
import {
    ChainId,
    getEmitterAddressSolana,
    isEVMChain,
    deserializeVAA,
    uint8ArrayToHex,
    VAAPayload,
    coalesceChainName,
    coalesceChainId
} from "@alephium/wormhole-sdk";
import { ChainIDs, chainIDs } from '../../utils/consts';
import { PublicKey } from '@solana/web3.js';

export interface VAA {
    Version: number | string,
    GuardianSetIndex: number,
    Signatures: { Index: number, Signature: string }[],
    Timestamp: string, // "0001-01-01T00:00:00Z",
    Nonce: number,
    Sequence: number,
    ConsistencyLevel: number,
    EmitterChain: number,
    EmitterAddress: string,
    TargetChain: number,
    Payload: VAAPayload
}
export interface TokenTransferPayload {
    Amount: string
    OriginAddress: string
    OriginChain: string,
    TargetAddress: string,
}
export interface TransferDetails {
    Amount: string,             // "1530.000000",
    Decimals: string,           // "6",
    NotionalUSDStr: string,     // "1538.495460",
    TokenPriceUSDStr: string,   // "1.005553",
    TransferTimestamp: string,  // "2021-11-21 16:55:15 +0000 UTC",
    OriginSymbol: string,
    OriginName: string,
    OriginTokenAddress: string,
}
export interface VAAMessage {
    InitiatingTxID?: string
    SignedVAABytes?: string  // base64 encoded byte array
    SignedVAA: VAA
    QuorumTime?: string  // "2021-08-11 00:16:11.757 +0000 UTC"
    EmitterChain: keyof ChainIDs
    EmitterAddress: string
    TargetChain: keyof ChainIDs
    Sequence: string
    TokenTransferPayload?: TokenTransferPayload
    TransferDetails?: TransferDetails
}

export interface Response {
    data: any
}

export function getVAAFromJson(data: any): VAAMessage {
    const txIdStr = data['txId']
    const txId = txIdStr === undefined ? undefined : uint8ArrayToHex(base64.decode(txIdStr))
    const vaaBase64 = data['vaa']
    const vaaBytes = base64.decode(vaaBase64)
    const parsedVaa = deserializeVAA(vaaBytes)
    const vaa: VAA = {
        Version: parsedVaa.version,
        GuardianSetIndex: parsedVaa.guardianSetIndex,
        Signatures: parsedVaa.signatures.map((sig) => {
            return { Index: sig.index, Signature: uint8ArrayToHex(sig.sig) }
        }),
        Timestamp: new Date(parsedVaa.body.timestamp * 1000).toISOString(),
        Nonce: parsedVaa.body.nonce,
        Sequence: Number(parsedVaa.body.sequence),
        ConsistencyLevel: parsedVaa.body.consistencyLevel,
        EmitterChain: parsedVaa.body.emitterChainId,
        EmitterAddress: uint8ArrayToHex(parsedVaa.body.emitterAddress),
        TargetChain: parsedVaa.body.targetChainId,
        Payload: parsedVaa.body.payload
    }
    return {
        InitiatingTxID: txId,
        SignedVAABytes: vaaBase64,
        SignedVAA: vaa,
        QuorumTime: data['updateAt'],
        EmitterChain: coalesceChainName(parsedVaa.body.emitterChainId),
        EmitterAddress: vaa.EmitterAddress,
        TargetChain: coalesceChainName(parsedVaa.body.targetChainId),
        Sequence: parsedVaa.body.sequence.toString(),
        TokenTransferPayload: parsedVaa.body.payload.type === 'TransferToken'
            ? {
                Amount: parsedVaa.body.payload.amount.toString(),
                OriginAddress: uint8ArrayToHex(parsedVaa.body.payload.originAddress),
                OriginChain: coalesceChainName(parsedVaa.body.payload.originChain),
                TargetAddress: uint8ArrayToHex(parsedVaa.body.payload.targetAddress),
            }
            : undefined,
        TransferDetails: undefined // TODO: add transfer details
    }
}

interface ExplorerQuery {
    emitterChain?: number,
    emitterAddress?: string,
    targetChain?: number,
    sequence?: string,
    txId?: string,
}
const ExplorerQuery = (props: ExplorerQuery) => {
    const { activeNetwork } = useNetworkContext()
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<VAAMessage>();
    const [lastFetched, setLastFetched] = useState<number>()

    const fetchMessage = async (
        emitterChain: ExplorerQuery["emitterChain"],
        emitterAddress: ExplorerQuery["emitterAddress"],
        targetChain: ExplorerQuery["targetChain"],
        sequence: ExplorerQuery["sequence"],
        txId: ExplorerQuery["txId"]) => {
        let paddedAddress: string = ""
        let paddedSequence: string

        let base = `${activeNetwork.endpoints.backendUrl}`
        let url = ""

        if ((emitterChain !== undefined) && emitterAddress && (targetChain !== undefined) && sequence) {
            if (emitterChain === chainIDs["solana"]) {
                if (emitterAddress.length < 64) {
                    try {
                        paddedAddress = await getEmitterAddressSolana(emitterAddress)
                    } catch (_) {
                        // do nothing
                    }
                } else {
                    paddedAddress = emitterAddress
                }
            } else if (isEVMChain(emitterChain as ChainId)) {
                if (isHexString(emitterAddress)) {

                    let paddedAddressArray = zeroPad(arrayify(emitterAddress, { hexPad: "left" }), 32);

                    let maybeString = Buffer.from(paddedAddressArray).toString('hex');

                    paddedAddress = maybeString
                } else {
                    // must already be padded
                    paddedAddress = emitterAddress
                }
            } else if (emitterChain === chainIDs["terra"]) {
                if (emitterAddress.startsWith('terra')) {
                    try {
                        paddedAddress = toHex(zeroPad(Bech32.decode(emitterAddress).data, 32))
                    } catch (_) {
                        // do nothing
                    }
                } else {
                    paddedAddress = emitterAddress
                }
            } else {
                paddedAddress = emitterAddress
            }

            if (sequence.length <= 15) {
                paddedSequence = sequence.padStart(16, "0")
            } else {
                paddedSequence = sequence
            }
            url = `${base}api/vaas/${emitterChain}/${paddedAddress}/${targetChain}/${paddedSequence}`
        } else if (txId) {
            url = `${base}api/vaas/transactions/${txId}`
        }

        fetch(url)
            .then(res => {
                if (res.ok) return res.json()
                if (res.status === 404) {
                    // show a specific message to the user if the query returned 404.
                    throw 'explorer.notFound'
                }
                // if res is not ok, and not 404, throw an error with specific message,
                // rather than letting the json decoding throw.
                throw 'explorer.failedFetching'
            })
            .then(result => {
                setMessage(getVAAFromJson(result.data))
                setLoading(false)
                setLastFetched(Date.now())
            }, error => {
                // Note: it's important to handle errors here
                // instead of a catch() block so that we don't swallow
                // exceptions from actual bugs in components.
                setError(error)
                setLoading(false)
                setLastFetched(Date.now())
            })
    }

    const refreshCallback = () => {
        fetchMessage(props.emitterChain, props.emitterAddress, props.targetChain, props.sequence, props.txId)
    }

    useEffect(() => {
        setError(undefined)
        setMessage(undefined)
        setLastFetched(undefined)
        if ((props.emitterChain && props.emitterAddress && props.sequence) || props.txId) {
            setLoading(true)
            fetchMessage(props.emitterChain, props.emitterAddress, props.targetChain, props.sequence, props.txId)
        }

    }, [props.emitterChain, props.emitterAddress, props.sequence, props.txId, activeNetwork.endpoints.backendUrl])


    return (
        <>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                loading...
            </div> :
                error ? <Typography variant="h4" >error</Typography> :
                    message ? (
                        <ExplorerSummary
                            {...props}
                            message={message}
                            lastFetched={lastFetched}
                            refetch={refreshCallback}
                        />
                    ) : null
            }
        </>
    )
}

export default ExplorerQuery
