import { getLocalTokenInfo } from "@alephium/wormhole-sdk";
import { Button, makeStyles } from "@material-ui/core";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import { selectTransferTargetAsset } from "../../store/selectors";
import { CLUSTER } from "../../utils/consts";
import { useAlephiumWallet } from "../../hooks/useAlephiumWallet";
import { getLocalTokenLogoURI } from "../../utils/alephium";
import { AlephiumWindowObject } from '@alephium/get-extension-wallet'
import { useSnackbar } from "notistack";
import { Alert } from "@material-ui/lab";

const useStyles = makeStyles((theme) => ({
  addButton: {
    display: "block",
    margin: `${theme.spacing(1)}px auto 0px`,
  },
}));

export default function AddToAlephium() {
  const classes = useStyles();
  const targetAsset = useSelector(selectTransferTargetAsset);
  const { enqueueSnackbar } = useSnackbar()
  const alphWallet = useAlephiumWallet()
  const handleClick = useCallback(() => {
    if (alphWallet !== undefined && targetAsset) {
      (async () => {
        try {
          const tokenInfo = await getLocalTokenInfo(alphWallet.nodeProvider, targetAsset)
          const logoURI = getLocalTokenLogoURI(tokenInfo.id)
          const windowObject = alphWallet.signer as AlephiumWindowObject
          console.log(`add new token, tokenName: ${tokenInfo.name}, tokenSymbol: ${tokenInfo.symbol}, tokenId: ${tokenInfo.id}`)
          const result = await windowObject.request({
            type: 'AddNewToken',
            params: {
              id: tokenInfo.id,
              networkId: CLUSTER,
              symbol: tokenInfo.symbol,
              decimals: tokenInfo.decimals,
              name: tokenInfo.name,
              logoURI: logoURI
            }
          })
          if (!result) { // the token already exists
            enqueueSnackbar(null, {
              content: <Alert severity="success">The token already exists</Alert>,
            })
          }
        } catch (error) {
          console.error(`failed to add new token, error: ${error}`)
        }
      })()
    }
  }, [alphWallet, targetAsset, enqueueSnackbar])
  return alphWallet !== undefined && alphWallet.isExtensionWallet() ? (
    <Button
      onClick={handleClick}
      size="small"
      variant="outlined"
      className={classes.addButton}
    >
      Add to Wallet
    </Button>
  ) : null
}
