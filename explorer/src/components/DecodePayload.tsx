import React, { useEffect, useState } from "react";
import { Typography } from '@mui/material'
import { deserializeVAA, VAABody, VAAPayload } from 'alephium-wormhole-sdk'

import { ChainID, ChainIDs, METADATA_REPLACE } from "../utils/consts";
import { usdFormatter } from "../utils/explorer";
import { TransferDetails, TokenTransferPayload as TransferPayload } from "./ExplorerSearch/ExplorerQuery";

function bytesToUtf8String(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes).replace(METADATA_REPLACE, '')
}

function convertBase64ToBinary(base64: string) {
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

interface DecodePayloadProps {
    base64VAA?: string
    emitterChainName: keyof ChainIDs
    emitterAddress: string
    targetChainName: keyof ChainIDs
    showType?: boolean
    showSummary?: boolean
    showPayload?: boolean
    transferPayload?: TransferPayload
    transferDetails?: TransferDetails
}

const DecodePayload = (props: DecodePayloadProps) => {
    const [vaaBody, setVaaBody] = useState<VAABody<VAAPayload> | undefined>(undefined)

    useEffect(() => {
        if (props.base64VAA === undefined) {
            setVaaBody(undefined)
            return
        }
        try {
            const bytes = convertBase64ToBinary(props.base64VAA)
            const vaa = deserializeVAA(bytes)
            setVaaBody(vaa.body)
        } catch (e) {
            console.log(`Failed to deserialize vaa, error: ${e}, vaa: ${props.base64VAA}`)
            setVaaBody(undefined)
        }
    }, [])


    const titleCase = (str: string) => <span style={{ textTransform: 'capitalize' }}>{str}</span>
    const unknown = "Unknown message"

    return (
        <>
            {props.showType && vaaBody ?
                <span>

                    {props.showSummary ? (
                        vaaBody.payload.type === "AttestToken" ? (<>
                            {"AssetMeta:"}&nbsp;{ChainID[vaaBody.payload.tokenChainId]}&nbsp; {bytesToUtf8String(vaaBody.payload.symbol)} {bytesToUtf8String(vaaBody.payload.name)}
                        </>) :
                            vaaBody.payload.type === "TransferToken" ?
                                props.transferDetails && props.transferDetails.OriginSymbol ? (<>
                                    {"Transfer"}&nbsp;
                                    {(Math.round(Number(props.transferDetails.Amount) * 100) / 100).toLocaleString()}&nbsp;{props.transferDetails.OriginSymbol}&nbsp;
                                    {'from'}&nbsp;{titleCase(String(props.emitterChainName))}&nbsp;{'to'}&nbsp;{titleCase(String(props.targetChainName))}&nbsp;
                                    {'('}{usdFormatter.format(Number(props.transferDetails.NotionalUSDStr))}{')'}
                                </>) : (<>
                                    {"Token transfer: "}{ChainID[vaaBody.payload.originChain]}{' asset -> '}{props.targetChainName}
                                </>) :
                                vaaBody.payload.type === "TransferNFT" ? (<>
                                    {"NFT: "}&nbsp;{bytesToUtf8String(vaaBody.payload.name) || "?"}&nbsp;{" wormholed "}&nbsp;{ChainID[vaaBody.payload.originChain]}{' -> '}{props.targetChainName}
                                </>) : unknown
                    ) : unknown}
                </span> : props.showPayload && vaaBody ? (
                    <>
                        <div style={{ margin: "20px 0" }} className="styled-scrollbar">
                            <Typography variant="h4"> payload</Typography>
                            <pre style={{ fontSize: 14 }}>{JSON.stringify(vaaBody.payload, undefined, 2)}</pre>
                        </div>
                        {/* TODO - prettier formatting of payload data. POC below. */}
                        {/* {payloadBundle && payloadBundle.payload && knownPayloads.includes(payloadBundle.type) ? (
                            Object.entries(payloadBundle.payload).map(([key, value]) => {
                                return <Statistic title={key} key={key} value={value} />
                            })
                        ) : <span>Can't decode unknown payloads</span>} */}

                    </>
                ) : unknown}

        </>
    )



}


export { DecodePayload }
