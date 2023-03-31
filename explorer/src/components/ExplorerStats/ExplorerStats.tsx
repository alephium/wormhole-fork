import { Box, Card, CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNetworkContext } from "../../contexts/NetworkContext";
import { ChainID } from "../../utils/consts";
import { getVAAFromJson, Response, VAAMessage } from "../ExplorerSearch/ExplorerQuery";
import RecentMessages from "./RecentMessages";
import ChainOverviewCard from "./ChainOverviewCard";
import PastWeekCard from "./PastWeekCard";

import ethereumIcon from "../../images/eth.svg";
import fantomIcon from "../../images/fantom.svg"
import alephiumIcon from "../../images/alephium.svg"
import GridWithCards from "../GridWithCards";
import { explorer } from "../../utils/urls";

export interface Totals {
  LastDayCount: { [groupByKey: string]: number };
  TotalCount: { [groupByKey: string]: number };
  DailyTotals: {
    // "2021-08-22": { "*": 0 },
    [date: string]: { [groupByKey: string]: number };
  };
}
export interface Recent {
  vaas: Array<VAAMessage>;
}

function toRecent(response: Response): Recent {
  if (response.data) {
    return {
      vaas: response.data.map((vaa: any) => getVAAFromJson(vaa))
    }
  }
  return { vaas: [] }
}

interface BidirectionalTransferData {
  [leavingChainId: string]: {
    [destinationChainId: string]: {
      [tokenSymbol: string]: number;
    };
  };
}
export interface NotionalTransferred {
  Last24Hours: BidirectionalTransferData;
  WithinPeriod: BidirectionalTransferData;
  PeriodDurationDays: Number;
  Daily: {
    [date: string]: BidirectionalTransferData;
  };
}
interface DirectionalTransferData {
  [chainId: string]: {
    [tokenSymbol: string]: number;
  };
}
export interface NotionalTransferredTo {
  Last24Hours: DirectionalTransferData;
  WithinPeriod: DirectionalTransferData;
  PeriodDurationDays: Number;
  Daily: {
    [date: string]: DirectionalTransferData;
  };
}
export interface NotionalTransferredToCumulative {
  AllTime: DirectionalTransferData;
  AllTimeDurationDays: Number;
  Daily: {
    [date: string]: DirectionalTransferData;
  };
}
interface LockedAsset {
  Symbol: string
  Name: string
  Address: string
  CoinGeckoId: string
  Amount: number
  Notional: number
  TokenPrice: number
}
interface LockedAssets {
  [tokenAddress: string]: LockedAsset
}
interface ChainsAssets {
  [chainId: string]: LockedAssets
}
export interface NotionalTvl {
  Last24HoursChange: ChainsAssets
  AllTime: ChainsAssets
}

type GroupBy = undefined | "chain" | "address";
type ForChain = undefined | StatsProps["emitterChain"];
type ForAddress = undefined | StatsProps["emitterAddress"];

interface StatsProps {
  emitterChain?: number;
  emitterAddress?: string;
}

const ExplorerStats: React.FC<StatsProps> = ({
  emitterChain,
  emitterAddress,
}) => {
  const { activeNetwork } = useNetworkContext();

  const [totals, setTotals] = useState<Totals>();
  const [recent, setRecent] = useState<Recent>();
  const [notionalTransferred, setNotionalTransferred] =
    useState<NotionalTransferred>();
  const [notionalTransferredTo, setNotionalTransferredTo] =
    useState<NotionalTransferredTo>();
  const [notionalTransferredToCumulative, setNotionalTransferredToCumulative] =
    useState<NotionalTransferredToCumulative>();
  const [address, setAddress] = useState<StatsProps["emitterAddress"]>();
  const [chain, setChain] = useState<StatsProps["emitterChain"]>();
  const [lastFetched, setLastFetched] = useState<number>();
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout>();
  const [controller, setController] = useState<AbortController>(
    new AbortController()
  );

  const launchDate = new Date("2021-09-13T00:00:00.000+00:00");
  // calculate the time difference between now and the launch day
  const differenceInTime = new Date().getTime() - launchDate.getTime();
  // calculate the number of days, rounding up
  const daysSinceDataStart = Math.ceil(differenceInTime / (1000 * 3600 * 24));

  const fetchTotals = (
    baseUrl: string,
    groupBy: GroupBy,
    forChain: ForChain,
    forAddress: ForAddress,
    signal: AbortSignal
  ) => {
    const totalsUrl = `${baseUrl}totals`;
    let url = `${totalsUrl}?&daily=true`
    if (groupBy) {
      url = `${url}&groupBy=${groupBy}`;
    }
    if (forChain) {
      url = `${url}&forChain=${forChain}`;
    }
    if (forAddress) {
      url = `${url}&forAddress=${forAddress}`;
    }

    return fetch(url, { signal })
      .then<Totals>((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTotals";
      })
      .then(
        (result) => {
          setTotals(result);

          setLastFetched(Date.now());
        },
        (error) => {
          if (error.name !== "AbortError") {
            //  handle errors here instead of a catch(), so that we don't swallow exceptions from components
            console.error("failed fetching totals. error: ", error);
          }
        }
      );
  };
  const fetchRecent = (
    baseUrl: string,
    groupBy: GroupBy,
    emitterChain: number | undefined,
    emitterAddress: string | undefined,
    signal: AbortSignal
  ) => {
    const recentUrl = `${baseUrl}api/vaas/recent`;
    let numRows = 10
    if (emitterChain) {
      numRows = 30
    }
    if (emitterAddress) {
      numRows = 80
    }
    let url = `${recentUrl}?numRows=${numRows}`;
    if (emitterChain) {
      url = `${url}&emitterChain=${emitterChain}`;
    }
    if (emitterAddress) {
      url = `${url}&emitterAddr=${emitterAddress}`;
    }

    return fetch(url, { signal })
      .then<Response>((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingRecent";
      })
      .then(
        (result) => {
          setRecent(toRecent(result));
          setLastFetched(Date.now());
        },
        (error) => {
          if (error.name !== "AbortError") {
            //  handle errors here instead of a catch(), so that we don't swallow exceptions from components
            console.error("failed fetching recent. error: ", error);
          }
        }
      );
  };
  const fetchTransferred = (
    baseUrl: string,
    groupBy: GroupBy,
    forChain: ForChain,
    forAddress: ForAddress,
    signal: AbortSignal
  ) => {
    const transferredUrl = `${baseUrl}notionaltransferred`;
    let url = `${transferredUrl}?forPeriod=true&numDays=${daysSinceDataStart}`;
    if (groupBy) {
      url = `${url}&groupBy=${groupBy}`;
    }
    if (forChain) {
      url = `${url}&forChain=${forChain}`;
    }
    if (forAddress) {
      url = `${url}&forAddress=${forAddress}`;
    }
    if (groupBy === "address" || forChain || forAddress) {
      return Promise.resolve();
    }

    return fetch(url, { signal })
      .then<NotionalTransferred>((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTransferred";
      })
      .then(
        (result) => {
          setNotionalTransferred(result);
          setLastFetched(Date.now());
        },
        (error) => {
          if (error.name !== "AbortError") {
            //  handle errors here instead of a catch(), so that we don't swallow exceptions from components
            console.error("failed fetching transferred to. error: ", error);
          }
        }
      );
  };
  const fetchTransferredTo = (
    baseUrl: string,
    groupBy: GroupBy,
    forChain: ForChain,
    forAddress: ForAddress,
    signal: AbortSignal
  ) => {
    const transferredUrl = `${baseUrl}notionaltransferredto`;
    let url = `${transferredUrl}?forPeriod=true&daily=true&numDays=${daysSinceDataStart}`;
    if (groupBy) {
      url = `${url}&groupBy=${groupBy}`;
    }
    if (forChain) {
      url = `${url}&forChain=${forChain}`;
    }
    if (forAddress) {
      url = `${url}&forAddress=${forAddress}`;
    }
    if (groupBy === "address" || forChain || forAddress) {
      return Promise.resolve();
    }

    return fetch(url, { signal })
      .then<NotionalTransferredTo>((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTransferredTo";
      })
      .then(
        (result) => {
          setNotionalTransferredTo(result);
          setLastFetched(Date.now());
        },
        (error) => {
          if (error.name !== "AbortError") {
            //  handle errors here instead of a catch(), so that we don't swallow exceptions from components
            console.error("failed fetching transferred to. error: ", error);
          }
        }
      );
  };
  const fetchTransferredToCumulative = (
    baseUrl: string,
    groupBy: GroupBy,
    forChain: ForChain,
    forAddress: ForAddress,
    signal: AbortSignal
  ) => {
    const transferredToUrl = `${baseUrl}notionaltransferredtocumulative`;
    let url = `${transferredToUrl}?allTime=true`
    if (groupBy) {
      url = `${url}&groupBy=${groupBy}`;
    }
    if (forChain) {
      url = `${url}&forChain=${forChain}`;
    }
    if (forAddress) {
      url = `${url}&forAddress=${forAddress}`;
    }
    if (groupBy === "address" || forChain || forAddress) {
      return Promise.resolve();
    }

    return fetch(url, { signal })
      .then<NotionalTransferredToCumulative>((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTransferredTo";
      })
      .then(
        (result) => {
          // let today = "2021-12-03"
          // let { [today]: t, ...dailies } = result.Daily
          // let r = { ...result, Daily: dailies }
          // setNotionalTransferredTo(r)
          setNotionalTransferredToCumulative(result);
          setLastFetched(Date.now());
        },
        (error) => {
          if (error.name !== "AbortError") {
            //  handle errors here instead of a catch(), so that we don't swallow exceptions from components
            console.error("failed fetching transferred to. error: ", error);
          }
        }
      );
  };

  const getData = (props: StatsProps, baseUrl: string, signal: AbortSignal, func: (baseUrl: string,
    recentGroupBy: GroupBy,
    totalsGroupBy: GroupBy,
    forChain: ForChain,
    forAddress: string | undefined,
    signal: AbortSignal) => Promise<any>) => {
    let forChain: ForChain = undefined;
    let forAddress: ForAddress = undefined;
    let recentGroupBy: GroupBy = undefined;
    let totalsGroupBy: GroupBy = "chain";
    if (props.emitterChain) {
      forChain = props.emitterChain;
      totalsGroupBy = "address";
      recentGroupBy = "address";
    }
    if (props.emitterChain && props.emitterAddress) {
      forAddress = props.emitterAddress;
    }
    return func(baseUrl, recentGroupBy, totalsGroupBy, forChain, forAddress, signal)
  };
  const getAllEndpoints = (
    baseUrl: string,
    recentGroupBy: GroupBy,
    totalsGroupBy: GroupBy,
    forChain: ForChain,
    forAddress: string | undefined,
    signal: AbortSignal) => {
    return Promise.all([
      // fetchTotals(baseUrl, totalsGroupBy, forChain, forAddress, signal),
      fetchRecent(baseUrl, recentGroupBy, forChain, forAddress, signal),
      // fetchTransferred(baseUrl, recentGroupBy, forChain, forAddress, signal),
      // fetchTransferredTo(baseUrl, recentGroupBy, forChain, forAddress, signal),
      // fetchTransferredToCumulative(
      //   baseUrl,
      //   recentGroupBy,
      //   forChain,
      //   forAddress,
      //   signal
      // ),
    ]);
  };
  const getRecents = (
    baseUrl: string,
    recentGroupBy: GroupBy,
    totalsGroupBy: GroupBy,
    forChain: ForChain,
    forAddress: string | undefined,
    signal: AbortSignal) => fetchRecent(baseUrl, recentGroupBy, forChain, forAddress, signal)


  const pollingController = (
    emitterChain: StatsProps["emitterChain"],
    emitterAddress: StatsProps["emitterAddress"],
    baseUrl: string,
  ) => {
    // clear any ongoing intervals
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(undefined);
    }
    // abort any in-flight requests
    controller.abort();
    // create a new controller for the new fetches, add it to state
    const newController = new AbortController();
    setController(newController);
    // create a signal for requests
    const { signal } = newController;
    // start polling
    let interval = setInterval(() => {
      getData({ emitterChain, emitterAddress }, baseUrl, signal, getRecents);
    }, 30000);
    setPollInterval(interval);
  };

  useEffect(() => {
    // getData if first load (no totals or recents), or emitterAddress/emitterChain changed.
    if (
      (!totals && !recent) ||
      emitterAddress !== address ||
      emitterChain !== chain
    ) {
      const newController = new AbortController();
      setController(newController);
      getData(
        { emitterChain, emitterAddress },
        activeNetwork.endpoints.backendUrl,
        newController.signal,
        getAllEndpoints
      );
    }
    setTotals(undefined);
    setRecent(undefined);
    setNotionalTransferred(undefined);
    setNotionalTransferredTo(undefined);
    setNotionalTransferredToCumulative(undefined);

    pollingController(
      emitterChain,
      emitterAddress,
      activeNetwork.endpoints.backendUrl
    );
    // hold chain & address in state to detect changes
    setChain(emitterChain);
    setAddress(emitterAddress);
  }, [
    emitterChain,
    emitterAddress,
    activeNetwork.endpoints.backendUrl,
  ]);

  useEffect(() => {
    return function cleanup() {
      controller.abort();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval, activeNetwork.endpoints.backendUrl]);

  let title = "Recent messages";
  let hideTableTitles = false;
  if (emitterChain) {
    title = `Recent ${ChainID[Number(emitterChain)]} messages`;
  }

  // TODO: support stats
  // const stats =
  //   <div>
  //     {!emitterChain && !emitterAddress ? (
  //       totals && notionalTransferredToCumulative && notionalTransferred ? (
  //         <GridWithCards
  //           spacing={3}
  //           sm={6}
  //           md={3}
  //           cardPaddingTop={3}
  //           imgAlignMd="center"
  //           imgOffsetRightMd="0px"
  //           imgOffsetTopXs="0px"
  //           imgOffsetTopMd="-36px"
  //           imgOffsetTopMdHover="-52px"
  //           imgPaddingBottomXs={3}
  //           headerTextAlign="center"
  //           data={[
  //             {
  //               header: ChainID[2],
  //               src: ethereumIcon,
  //               to: `${explorer}?emitterChain=2`,
  //               description: (
  //                 <ChainOverviewCard
  //                   totals={totals}
  //                   notionalTransferredToCumulative={
  //                     notionalTransferredToCumulative
  //                   }
  //                   notionalTransferred={notionalTransferred}
  //                   dataKey="2"
  //                 />
  //               ),
  //               imgStyle: { height: 110 },
  //             },
  //             {
  //               header: ChainID[255],
  //               src: alephiumIcon,
  //               to: `${explorer}?emitterChain=255`,
  //               description: (
  //                 <ChainOverviewCard
  //                   totals={totals}
  //                   notionalTransferredToCumulative={
  //                     notionalTransferredToCumulative
  //                   }
  //                   notionalTransferred={notionalTransferred}
  //                   dataKey="13"
  //                 />
  //               ),
  //               imgStyle: { height: 110 },
  //             }
  //           ].concat(
  //             // check the we have transfer data before adding the fantom card
  //             ("10" in notionalTransferredToCumulative.AllTime) &&
  //               ("*" in notionalTransferredToCumulative.AllTime["10"]) ?
  //               [{
  //                 header: ChainID[10],
  //                 src: fantomIcon,
  //                 to: `${explorer}?emitterChain=10`,
  //                 description: (
  //                   <ChainOverviewCard
  //                     totals={totals}
  //                     notionalTransferredToCumulative={
  //                       notionalTransferredToCumulative
  //                     }
  //                     notionalTransferred={notionalTransferred}
  //                     dataKey="10"
  //                   />
  //                 ),
  //                 imgStyle: { height: 110 },
  //               }] : []
  //           )}
  //         />
  //       ) : (
  //         <Box
  //           sx={{
  //             padding: "24px",
  //             textAlign: "center",
  //           }}
  //         >
  //           <CircularProgress />
  //         </Box>
  //       )
  //     ) : null}

  //     <div style={{ margin: "40px 0" }}>
  //       {!emitterChain && !emitterAddress ? (
  //         notionalTransferredTo && totals ? (
  //           <PastWeekCard
  //             title="Last 7 Days"
  //             numDaysToShow={7}
  //             messages={totals}
  //             notionalTransferredTo={notionalTransferredTo}
  //             notionalTransferred={notionalTransferred}
  //           />
  //         ) : (
  //           <Card
  //             sx={{
  //               backgroundColor: "rgba(255,255,255,.07)",
  //               backgroundImage: "none",
  //               borderRadius: "28px",
  //               padding: "24px",
  //               textAlign: "center",
  //             }}
  //           >
  //             <CircularProgress />
  //           </Card>
  //         )
  //       ) : null}
  //     </div>
  //   </div>

  return (
    <>
      {!totals && !recent ? (
        <Card
          sx={{
            backgroundColor: "rgba(255,255,255,.07)",
            backgroundImage: "none",
            borderRadius: "28px",
            padding: "24px",
            textAlign: "center",
            mt: 5,
          }}
        >
          <CircularProgress />
        </Card>
      ) : (
        <>
          {recent && (
            <div style={{ margin: "40px 0" }}>
              <RecentMessages
                recent={recent}
                lastFetched={lastFetched}
                title={title}
                hideTableTitles={hideTableTitles}
              />
            </div>
          )}
        </>
      )}
    </>
  );
};

export default ExplorerStats;
