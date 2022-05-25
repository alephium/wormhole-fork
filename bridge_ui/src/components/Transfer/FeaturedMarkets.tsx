import { Button, makeStyles, Typography } from "@material-ui/core";
import { Launch } from "@material-ui/icons";
import { useSelector } from "react-redux";
import useMarketsMap from "../../hooks/useMarketsMap";
import {
  selectTransferSourceAsset,
  selectTransferSourceChain,
  selectTransferTargetAsset,
  selectTransferTargetChain,
} from "../../store/selectors";

const useStyles = makeStyles((theme) => ({
  description: {
    marginTop: theme.spacing(1),
  },
  button: {
    margin: theme.spacing(0.5, 0.5),
  },
}));

export default function FeaturedMarkets() {
  const sourceChain = useSelector(selectTransferSourceChain);
  const sourceAsset = useSelector(selectTransferSourceAsset);
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAsset = useSelector(selectTransferTargetAsset);
  const { data: marketsData } = useMarketsMap(true);
  const classes = useStyles();

  if (
    !sourceAsset ||
    !targetAsset ||
    !marketsData ||
    !marketsData.markets ||
    !marketsData.tokenMarkets
  ) {
    return null;
  }

  const tokenMarkets =
    marketsData.tokenMarkets[sourceChain]?.[targetChain]?.[sourceAsset];
  if (!tokenMarkets) {
    return null;
  }

  const tokenMarketButtons = [];
  for (const market of tokenMarkets.markets) {
    const marketInfo = marketsData.markets[market];
    if (marketInfo) {
      const url = marketInfo.link;
      tokenMarketButtons.push(
        <Button
          key={market}
          size="small"
          variant="outlined"
          color="secondary"
          startIcon={<Launch />}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={classes.button}
        >
          {marketInfo.name}
        </Button>
      );
    }
  }

  return tokenMarketButtons.length ? (
    <div style={{ textAlign: "center" }}>
      <Typography
        variant="subtitle2"
        gutterBottom
        className={classes.description}
      >
        Featured markets
      </Typography>
      {tokenMarketButtons}
    </div>
  ) : null;
}
