import React from "react";
import { Typography } from '@mui/material'
import { VAAPayload } from '@alephium/wormhole-sdk'

import { ChainID, ChainIDs } from "../utils/consts";
import { stringifyJson, usdFormatter } from "../utils/explorer";
import { TransferDetails, TokenTransferPayload as TransferPayload } from "./ExplorerSearch/ExplorerQuery";

interface DecodePayloadProps {
    payload: VAAPayload
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
    const { payload } = props
    const titleCase = (str: string) => <span style={{ textTransform: 'capitalize' }}>{str}</span>
    const unknown = "Unknown message"

    return (
        <>
            {props.showType ?
                <span>

                    {props.showSummary ? (
                        payload.type === "AttestToken" ? (<>
                            {"AssetMeta:"}&nbsp;{ChainID[payload.tokenChainId]}&nbsp; {payload.symbol} {payload.name}
                        </>) :
                            payload.type === "TransferToken" ?
                                props.transferDetails && props.transferDetails.OriginSymbol ? (<>
                                    {"Transfer"}&nbsp;
                                    {(Math.round(Number(props.transferDetails.Amount) * 100) / 100).toLocaleString()}&nbsp;{props.transferDetails.OriginSymbol}&nbsp;
                                    {'from'}&nbsp;{titleCase(String(props.emitterChainName))}&nbsp;{'to'}&nbsp;{titleCase(String(props.targetChainName))}&nbsp;
                                    {'('}{usdFormatter.format(Number(props.transferDetails.NotionalUSDStr))}{')'}
                                </>) : (<>
                                    {"Token transfer: "}{ChainID[payload.originChain]}{' asset -> '}{props.targetChainName}
                                </>) :
                                payload.type === "TransferNFT" ? (<>
                                    {"NFT: "}&nbsp;{payload.name || "?"}&nbsp;{" wormholed "}&nbsp;{ChainID[payload.originChain]}{' -> '}{props.targetChainName}
                                </>) : unknown
                    ) : unknown}
                </span> : props.showPayload ? (
                    <>
                        <div style={{ margin: "20px 0" }} className="styled-scrollbar">
                            <Typography variant="h4"> payload</Typography>
                            <pre style={{ fontSize: 14 }}>{stringifyJson(payload)}</pre>
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
