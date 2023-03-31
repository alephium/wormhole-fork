import React from "react";
import { Box, Button, Link, Typography } from "@mui/material";

import { VAAMessage } from "./ExplorerQuery";
import { DecodePayload } from "../DecodePayload";
import ReactTimeAgo from "react-time-ago";
import { Link as RouterLink } from "gatsby";
import {
  contractNameFormatter,
  getNativeAddress,
  nativeExplorerContractUri,
  nativeExplorerTxUri,
  stringifyJson,
  truncateAddress,
  usdFormatter,
} from "../../utils/explorer";
import { OutboundLink } from "gatsby-plugin-google-gtag";
import { ChainID, chainIDs } from "../../utils/consts";
import { hexToNativeString, uint8ArrayToHex } from "alephium-wormhole-sdk";
import { explorer } from "../../utils/urls";

interface SummaryProps {
  emitterChain?: number;
  emitterAddress?: string;
  targetChain?: number;
  sequence?: string;
  txId?: string;
  message: VAAMessage;
  lastFetched?: number;
  refetch: () => void;
}
const textStyles = { fontSize: 16, margin: "6px 0" };

const ExplorerSummary = (props: SummaryProps) => {
  const { SignedVAA, ...message } = props.message;

  const {
    EmitterChain,
    EmitterAddress,
    TargetChain,
    InitiatingTxID,
    TokenTransferPayload,
    TransferDetails,
  } = message;
  // get chainId from chain name
  const emitterChainId = chainIDs[EmitterChain];
  const targetChainId = chainIDs[TargetChain]

  let transactionId: string | undefined;
  if (InitiatingTxID) {
    if (
      emitterChainId === chainIDs["ethereum"] ||
      emitterChainId === chainIDs["bsc"] ||
      emitterChainId === chainIDs["polygon"]
    ) {
      transactionId = InitiatingTxID;
    } else {
      if (emitterChainId === chainIDs["solana"]) {
        const txId = InitiatingTxID.slice(2); // remove the leading "0x"
        transactionId = hexToNativeString(txId, emitterChainId);
      } else if (emitterChainId === chainIDs["terra"]) {
        transactionId = InitiatingTxID.slice(2); // remove the leading "0x"
      }
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "baseline",
          marginTop: 40,
        }}
      >
        <Typography variant="h4">Message Summary</Typography>
          <div>
            <Button onClick={props.refetch}>Refresh</Button>
            <Button component={RouterLink} to={explorer} sx={{ ml: 1 }}>
              Clear
            </Button>
          </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          margin: "20px 0 24px 20px",
        }}
      >
        <ul>
          {TokenTransferPayload &&
          TokenTransferPayload.TargetAddress &&
          TransferDetails &&
          nativeExplorerContractUri(
            targetChainId,
            TokenTransferPayload.TargetAddress
          ) ? (
            <>
              <li>
                <span style={textStyles}>
                  This is a token transfer of{" "}
                  {Math.round(Number(TransferDetails.Amount) * 100) / 100}
                  {` `}
                  {!["UST", "LUNA"].includes(TransferDetails.OriginSymbol) ? (
                    <Link
                      component={OutboundLink}
                      href={nativeExplorerContractUri(
                        Number(TokenTransferPayload.OriginChain),
                        TokenTransferPayload.OriginAddress
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...textStyles, whiteSpace: "nowrap" }}
                    >
                      {TransferDetails.OriginSymbol}
                    </Link>
                  ) : (
                    TransferDetails.OriginSymbol
                  )}
                  {` `}from {ChainID[emitterChainId]}, to{" "}
                  {ChainID[targetChainId]}, destined
                  for address{" "}
                </span>
                <Link
                  component={OutboundLink}
                  href={nativeExplorerContractUri(
                    targetChainId,
                    TokenTransferPayload.TargetAddress
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...textStyles, whiteSpace: "nowrap" }}
                >
                  {truncateAddress(
                    getNativeAddress(
                      targetChainId,
                      TokenTransferPayload.TargetAddress
                    )
                  )}
                </Link>
                <span style={textStyles}>.</span>
              </li>
              {TransferDetails.NotionalUSDStr && (
                <>
                  <li>
                    <span style={textStyles}>
                      When these tokens were sent to Wormhole, the{" "}
                      {Math.round(Number(TransferDetails.Amount) * 100) / 100}{" "}
                      {TransferDetails.OriginSymbol} was worth about{" "}
                      {usdFormatter.format(
                        Number(TransferDetails.NotionalUSDStr)
                      )}
                      .
                    </span>
                  </li>
                  <li>
                    <span style={textStyles}>
                      At the time of the transfer, 1{" "}
                      {TransferDetails.OriginName} was worth about{" "}
                      {usdFormatter.format(
                        Number(TransferDetails.TokenPriceUSDStr)
                      )}
                      .{" "}
                    </span>
                  </li>
                </>
              )}
            </>
          ) : null}
          {EmitterChain &&
          EmitterAddress &&
          nativeExplorerContractUri(emitterChainId, EmitterAddress) ? (
            <li>
              <span style={textStyles}>
                This message was emitted by the {ChainID[emitterChainId]}{" "}
              </span>
              <Link
                component={OutboundLink}
                href={nativeExplorerContractUri(emitterChainId, EmitterAddress)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...textStyles, whiteSpace: "nowrap" }}
              >
                {contractNameFormatter(EmitterAddress, emitterChainId)}
              </Link>
              <span style={textStyles}> contract</span>
              {transactionId && (
                <>
                  <span style={textStyles}>
                    {" "}
                    after the Wormhole Guardians observed transaction{" "}
                  </span>
                  <Link
                    component={OutboundLink}
                    href={nativeExplorerTxUri(emitterChainId, transactionId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...textStyles, whiteSpace: "nowrap" }}
                  >
                    {truncateAddress(transactionId)}
                  </Link>
                </>
              )}{" "}
              <span style={textStyles}>.</span>
            </li>
          ) : null}
        </ul>
      </div>
      <Typography variant="h4">Raw message data:</Typography>
      <Box component="div" sx={{ overflow: "auto", mb: 2.5 }}>
        <pre style={{ fontSize: 14 }}>
          {stringifyJson(message)}
        </pre>
      </Box>
      <DecodePayload
        payload={props.message.SignedVAA.Payload}
        emitterChainName={props.message.EmitterChain}
        emitterAddress={props.message.EmitterAddress}
        targetChainName={props.message.TargetChain}
        showPayload={true}
        transferDetails={props.message.TransferDetails}
      />
      <Box component="div" sx={{ overflow: "auto", mb: 2.5 }}>
        <Typography variant="h4">Signed VAA</Typography>
        <pre style={{ fontSize: 12 }}>
          {stringifyJson(SignedVAA)}
        </pre>
      </Box>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {props.lastFetched ? (
          <span>
            last updated:&nbsp;
            <ReactTimeAgo
              date={new Date(props.lastFetched)}
              timeStyle="round"
            />
          </span>
        ) : null}
      </div>
    </>
  );
};

export default ExplorerSummary;
