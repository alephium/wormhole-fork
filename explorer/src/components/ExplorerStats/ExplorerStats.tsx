import { Box, Card, CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNetworkContext } from "../../contexts/NetworkContext";
import { ChainID } from "../../utils/consts";
import { getVAAFromJson, Response, VAAMessage } from "../ExplorerSearch/ExplorerQuery";
import RecentMessages from "./RecentMessages";
import ChainOverviewCard from "./ChainOverviewCard";
import PastWeekCard from "./PastWeekCard";

import ethereumIcon from "../../images/eth.svg";
import binanceChainIcon from "../../images/bsc.svg";
import alephiumIcon from "../../images/alephium.svg"
import GridWithCards from "../GridWithCards";

export interface Totals {
  TotalCount: { [groupByKey: string]: number };
  DailyTotals: {
    [date: string]: { [groupByKey: string]: number };
  };
}

function timestampToDate(timestamp: number): string {
  let date = new Date(timestamp * 1000)
  const offset = date.getTimezoneOffset()
  date = new Date(date.getTime() - (offset * 60 * 1000))
  return date.toISOString().split('T')[0]
}

export function toTotals(response: any): Totals {
  const totalCount: { [groupByKey: string]: number } = {}
  const dailyTotals: { [date: string]: { [groupByKey: string]: number } } = {}

  for (const key in response.totalMessagesPerEmitter) {
    const array = key.split(':')
    const date = timestampToDate(parseInt(array[0]))
    const emitterChain = array[1]
    const emitterAddress = array[2]
    const vaaCount = response.totalMessagesPerEmitter[key]
    totalCount['*'] = (totalCount['*'] ?? 0) + vaaCount
    totalCount[emitterChain] = (totalCount[emitterChain] ?? 0) + vaaCount
    totalCount[`${emitterChain}:${emitterAddress}`] = (totalCount[`${emitterChain}:${emitterAddress}`] ?? 0) + vaaCount

    if (!dailyTotals[date]) dailyTotals[date] = {}
    dailyTotals[date]['*'] = (dailyTotals[date]['*'] ?? 0) + vaaCount
    dailyTotals[date][emitterChain] = (dailyTotals[date][emitterChain] ?? 0) + vaaCount
    dailyTotals[date][`${emitterChain}:${emitterAddress}`] = (dailyTotals[date][`${emitterChain}:${emitterAddress}`] ?? 0) + vaaCount
  }

  return { TotalCount: totalCount, DailyTotals: dailyTotals }
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
  WithinPeriod: BidirectionalTransferData;
}

function toNotionalTransferred(response: any): NotionalTransferred {
  const withinPeriod: BidirectionalTransferData = {}
  for (const key in response.notionalTransferred) {
    const [emitterChain, targetChain, symbol] = key.split(':')
    const amount = parseFloat(response.notionalTransferred[key])
    if (!withinPeriod[emitterChain]) {
      withinPeriod[emitterChain] = {}
      withinPeriod[emitterChain]['*'] = {}
    }
    if (!withinPeriod[emitterChain][targetChain]) {
      withinPeriod[emitterChain][targetChain] = {}
    }
    withinPeriod[emitterChain]['*']['*'] = (withinPeriod[emitterChain]['*']['*'] ?? 0) + amount
    withinPeriod[emitterChain][targetChain]['*'] = (withinPeriod[emitterChain][targetChain]['*'] ?? undefined) + amount
    withinPeriod[emitterChain][targetChain][symbol] = (withinPeriod[emitterChain][targetChain][symbol] ?? undefined) + amount
  }
  return { WithinPeriod: withinPeriod }
}

interface DirectionalTransferData {
  [chainId: string]: {
    [tokenSymbol: string]: number;
  };
}
export interface NotionalTransferredTo {
  WithinPeriod: DirectionalTransferData;
  Daily: {
    [date: string]: DirectionalTransferData;
  };
}

function toNotionalTransferredTo(response: any): NotionalTransferredTo {
  const withinPeriod: DirectionalTransferData = {}
  const daily: NotionalTransferredTo['Daily'] = {}
  for (const key in response.notionalTransferredTo) {
    const array = key.split(':')
    const date = timestampToDate(parseInt(array[0]))
    const targetChain = array[1]
    const symbol = array[2]
    const amount = parseFloat(response.notionalTransferredTo[key])
    if (!withinPeriod[targetChain]) withinPeriod[targetChain] = {}
    withinPeriod[targetChain]['*'] = (withinPeriod[targetChain]['*'] ?? 0) + amount
    withinPeriod[targetChain][symbol] = (withinPeriod[targetChain][symbol] ?? 0) + amount

    if (!daily[date]) {
      daily[date] = {}
      daily[date]['*'] = {}
    }
    if (!daily[date][targetChain]) {
      daily[date][targetChain] = {}
    }
    daily[date]['*']['*'] = (daily[date]['*']['*'] ?? 0) + amount
    daily[date][targetChain]['*'] = (daily[date][targetChain]['*'] ?? 0) + amount
    daily[date][targetChain][symbol] = (daily[date][targetChain][symbol] ?? 0) + amount
  }
  return { WithinPeriod: withinPeriod, Daily: daily }
}

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
  const [address, setAddress] = useState<StatsProps["emitterAddress"]>();
  const [chain, setChain] = useState<StatsProps["emitterChain"]>();
  const [lastFetched, setLastFetched] = useState<number>();
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout>();
  const [controller, setController] = useState<AbortController>(
    new AbortController()
  );

  const fetchTotals = (baseUrl: string, signal: AbortSignal) => {
    const totalsUrl = `${baseUrl}api/stats/totalmessages`;

    return fetch(totalsUrl, { signal })
      .then((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTotals";
      })
      .then(
        (result) => {
          setTotals(toTotals(result));
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
      .then((res) => {
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
  const fetchTransferred = (baseUrl: string, signal: AbortSignal) => {
    const transferredUrl = `${baseUrl}api/stats/totalnotionaltransferred`;

    return fetch(transferredUrl, { signal })
      .then<NotionalTransferred>((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTransferred";
      })
      .then(
        (result) => {
          setNotionalTransferred(toNotionalTransferred(result));
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
  const fetchTransferredTo = (baseUrl: string, signal: AbortSignal) => {
    const transferredUrl = `${baseUrl}api/stats/totalnotionaltransferredto`;
    return fetch(transferredUrl, { signal })
      .then((res) => {
        if (res.ok) return res.json();
        // throw an error with specific message, rather than letting the json decoding throw.
        throw "explorer.stats.failedFetchingTransferredTo";
      })
      .then(
        (result) => {
          setNotionalTransferredTo(toNotionalTransferredTo(result));
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
    forChain: ForChain,
    forAddress: string | undefined,
    signal: AbortSignal) => Promise<any>) => {
    let forChain: ForChain = undefined;
    let forAddress: ForAddress = undefined;
    if (props.emitterChain) {
      forChain = props.emitterChain;
    }
    if (props.emitterChain && props.emitterAddress) {
      forAddress = props.emitterAddress;
    }
    return func(baseUrl, forChain, forAddress, signal)
  };
  const getAllEndpoints = (
    baseUrl: string,
    forChain: ForChain,
    forAddress: string | undefined,
    signal: AbortSignal) => {
    return Promise.all([
      fetchRecent(baseUrl, forChain, forAddress, signal),
      fetchTotals(baseUrl, signal),
      fetchTransferred(baseUrl, signal),
      fetchTransferredTo(baseUrl, signal),
    ]);
  };
  const getRecents = (
    baseUrl: string,
    forChain: ForChain,
    forAddress: string | undefined,
    signal: AbortSignal) => fetchRecent(baseUrl, forChain, forAddress, signal)

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
  const stats =
    <div>
      {!emitterChain && !emitterAddress ? (
        totals && notionalTransferredTo && notionalTransferred ? (
          <GridWithCards
            spacing={3}
            sm={6}
            md={3}
            cardPaddingTop={3}
            imgAlignMd="center"
            imgOffsetRightMd="0px"
            imgOffsetTopXs="0px"
            imgOffsetTopMd="-36px"
            imgOffsetTopMdHover="-52px"
            imgPaddingBottomXs={3}
            headerTextAlign="center"
            data={[
              {
                header: ChainID[2],
                src: ethereumIcon,
                to: `?emitterChain=2`,
                description: (
                  <ChainOverviewCard
                    totals={totals}
                    notionalTransferredTo={notionalTransferredTo}
                    notionalTransferred={notionalTransferred}
                    dataKey="2"
                  />
                ),
                imgStyle: { height: 110 },
              },
              {
                header: ChainID[255],
                src: alephiumIcon,
                to: `?emitterChain=255`,
                description: (
                  <ChainOverviewCard
                    totals={totals}
                    notionalTransferredTo={notionalTransferredTo}
                    notionalTransferred={notionalTransferred}
                    dataKey="255"
                  />
                ),
                imgStyle: { height: 110 },
              }
            ]}
          />
        ) : (
          <Box
            sx={{
              padding: "24px",
              textAlign: "center",
            }}
          >
            <CircularProgress />
          </Box>
        )
      ) : null}

      <div style={{ margin: "40px 0" }}>
        {!emitterChain && !emitterAddress ? (
          notionalTransferredTo && totals ? (
            <PastWeekCard
              title="Last 7 Days"
              numDaysToShow={7}
              messages={totals}
              notionalTransferredTo={notionalTransferredTo}
              notionalTransferred={notionalTransferred}
            />
          ) : (
            <Card
              sx={{
                backgroundColor: "rgba(255,255,255,.07)",
                backgroundImage: "none",
                borderRadius: "28px",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <CircularProgress />
            </Card>
          )
        ) : null}
      </div>
    </div>

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
          {stats}
        </>
      )}
    </>
  );
};

export default ExplorerStats;
