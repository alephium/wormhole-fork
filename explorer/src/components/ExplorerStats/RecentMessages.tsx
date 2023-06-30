import React from "react";
import { Link as RouterLink } from "gatsby";
import { Recent } from "./ExplorerStats";
import ReactTimeAgo from "react-time-ago";
import {
  Box,
  Card,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableRow,
  Typography,
} from "@mui/material";
import { contractNameFormatter } from "../../utils/explorer";
import { chainIDs } from "../../utils/consts";
import { formatQuorumDate } from "../../utils/time";
import { explorer } from "../../utils/urls";
import ChainIcon from "../ChainIcon";
import { DecodePayload } from "../DecodePayload";

interface RecentMessagesProps {
  recent: Recent;
  lastFetched?: number;
  title: string;
  hideTableTitles?: boolean;
}

const RecentMessages = (props: RecentMessagesProps) => {
  //   const columns: ColumnsType<BigTableMessage> = [
  //     {
  //       title: "",
  //       key: "icon",
  //       render: (item: BigTableMessage) =>
  //         networkIcons[chainIDs[item.EmitterChain]],
  //       responsive: ["sm"],
  //     },
  //     {
  //       title: "contract",
  //       key: "contract",
  //       render: (item: BigTableMessage) => {
  //         const name = contractNameFormatter(
  //           item.EmitterAddress,
  //           chainIDs[item.EmitterChain]
  //         );
  //         return <div>{name}</div>;
  //       },
  //       responsive: ["sm"],
  //     },
  //     {
  //       title: "message",
  //       key: "payload",
  //       render: (item: BigTableMessage) =>
  //         item.SignedVAABytes ? (
  //           <DecodePayload
  //             base64VAA={item.SignedVAABytes}
  //             emitterChainName={item.EmitterChain}
  //             emitterAddress={item.EmitterAddress}
  //             showType={true}
  //             showSummary={true}
  //             transferDetails={item.TransferDetails}
  //           />
  //         ) : null,
  //     },
  //     {
  //       title: "sequence",
  //       key: "sequence",
  //       render: (item: BigTableMessage) => {
  //         let sequence = item.Sequence.replace(/^0+/, "");
  //         if (!sequence) sequence = "0";

  //         return sequence;
  //       },
  //       responsive: ["md"],
  //     },
  //     {
  //       title: "attested",
  //       dataIndex: "QuorumTime",
  //       key: "time",
  //       render: (QuorumTime) => (
  //         <ReactTimeAgo
  //           date={
  //             QuorumTime ? Date.parse(formatQuorumDate(QuorumTime)) : new Date()
  //           }
  //           locale={intl.locale}
  //           timeStyle={!screens.md ? "twitter" : "round"}
  //         />
  //       ),
  //     },
  //     {
  //       title: "",
  //       key: "view",
  //       render: (item: BigTableMessage) => (
  //         <Link
  //           to={`/${intl.locale}/explorer/?emitterChain=${
  //             chainIDs[item.EmitterChain]
  //           }&emitterAddress=${item.EmitterAddress}&sequence=${item.Sequence}`}
  //         >
  //           View
  //         </Link>
  //       ),
  //     },
  //   ];

  const toChainId = (chain: string | number): number => {
    if (typeof chain === 'number') return chain
    if (chain === 'unset') return 0
    return chainIDs[chain]
  }

  return (
    <Card
      sx={{
        backgroundColor: "rgba(255,255,255,.07)",
        backgroundImage: "none",
        borderRadius: "28px",
        padding: "24px",
      }}
    >
      <Typography variant="h4" gutterBottom>
        {props.title}
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableBody>
            {props.recent.vaas.map((item) => (
              <TableRow key={item.EmitterChain + item.EmitterAddress + item.TargetChain + item.Sequence}>
                <TableCell>
                  <ChainIcon chainId={chainIDs[item.EmitterChain]} />
                </TableCell>
                <TableCell>
                  {contractNameFormatter(
                    item.EmitterAddress,
                    chainIDs[item.EmitterChain]
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {item.SignedVAABytes
                    ? <DecodePayload
                      payload={item.SignedVAA.Payload}
                      emitterChainName={item.EmitterChain}
                      emitterAddress={item.EmitterAddress}
                      targetChainName={item.TargetChain}
                      showType={true}
                      showSummary={true}
                      transferDetails={item.TransferDetails}
                    /> : null}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {item.Sequence.replace(/^0+/, "") || "0"}
                </TableCell>
                <TableCell sx={{ "& > time": { whiteSpace: "nowrap" } }}>
                  {
                    <ReactTimeAgo
                      date={
                        item.QuorumTime
                          ? Date.parse(formatQuorumDate(item.QuorumTime))
                          : new Date()
                      }
                      timeStyle={"round"}
                    />
                  }
                </TableCell>
                <TableCell>
                  <Link
                    component={RouterLink}
                    to={`${explorer}?emitterChain=${toChainId(item.EmitterChain)}&emitterAddress=${item.EmitterAddress}&targetChain=${toChainId(item.TargetChain)}&sequence=${item.Sequence}`}
                    color="inherit"
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={6}
                sx={{ textAlign: "right", borderBottom: "none" }}
              >
                {props.lastFetched ? (
                  <ReactTimeAgo
                    date={new Date(props.lastFetched)}
                    timeStyle="round"
                  />
                ) : null}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Card>
  );
};

export default RecentMessages;
